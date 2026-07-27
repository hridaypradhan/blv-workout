"use client";
import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PageWrapper from "@/components/layout/PageWrapper";
import { useYouTubePlayer } from "@/lib/hooks/useYouTubePlayer";
import { useSessionArtifacts } from "@/lib/hooks/useSessionArtifacts";
import { ProcessingStage } from "@/types";
import { useSessionTelemetry } from "@/lib/hooks/useSessionTelemetry";
import { useAssistantCueQueue } from "@/lib/hooks/useAssistantCueQueue";
import { useSpokenCuePlayback } from "@/lib/hooks/useSpokenCuePlayback";
import { useHapticDeviceStatus } from "@/lib/hooks/useHapticDeviceStatus";
import { useHapticEventDelivery } from "@/lib/hooks/useHapticEventDelivery";
import {
  InterruptionLevel,
  AssistantVerbosity,
  AudioCoexistenceSettings,
  RuntimeCueSelectionResponse,
} from "@/types";
import { SESSION_EVENTS } from "@/lib/sessionEvents";
import { useAutomaticCue } from "@/lib/hooks/useAutomaticCue";
import { useQnAChat } from "@/lib/hooks/useQnAChat";
import { useLiveVoiceCommands } from "@/lib/hooks/useLiveVoiceCommands";
import { useUserProfile } from "@/components/layout/UserProfileContext";
import { inferHapticCategoryFromCue, HAPTIC_CATEGORY_DEFAULT_IDS } from "@/lib/userPreferences";
import { initSpeechRegistryMonkeyPatch } from "@/lib/voice/speechRegistry";
import { useSessionEnd } from "@/lib/hooks/useSessionEnd";
import { useLiveCueDelivery } from "@/lib/hooks/useLiveCueDelivery";
import { usePoseSessionEvents } from "@/lib/hooks/usePoseSessionEvents";
import { usePrototypePoseRuntime } from "@/lib/hooks/usePrototypePoseRuntime";
import { useCameraStream, useCameraLifecycleCleanup } from "@/lib/hooks/useCameraStream";
import { useMediaPipePoseRuntime } from "@/lib/hooks/useMediaPipePoseRuntime";
import { getExercisePoseProfile } from "@/lib/pose/exercisePoseProfiles";
import { CameraPositioningGate } from "@/components/session/CameraPositioningGate";
import { getPoseRequirementForAnchor } from "@/lib/pose/positioningGuide";
import { usePlaybackPauseCoordinator } from "@/lib/hooks/usePlaybackPauseCoordinator";
import { useLivePositioningGate } from "@/lib/hooks/useLivePositioningGate";
import { useLiveSessionAnnouncements } from "@/lib/hooks/useLiveSessionAnnouncements";
import { useLiveSessionNavigation } from "@/lib/hooks/useLiveSessionNavigation";
import { useLiveSessionCueGlue } from "@/lib/hooks/useLiveSessionCueGlue";
import { useSessionLifecycleHaptics } from "@/lib/hooks/useSessionLifecycleHaptics";
import { useLiveSessionCameraTelemetry } from "@/lib/hooks/useLiveSessionCameraTelemetry";
import { LiveSessionPlaybackColumn } from "@/components/session/LiveSessionPlaybackColumn";
import SessionStatusGuards from "@/components/session/SessionStatusGuards";
import { LiveSessionSidebar } from "@/components/session/LiveSessionSidebar";

interface LiveSessionProps {
  params: {
    videoId: string;
  };
}

/** Helper to format time readouts */
function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

/** Generate a unique stable cue ID for Q&A answers with fallback. */
function generateQnaCueId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `qna-${crypto.randomUUID()}`;
  }
  const randomStr = Math.random().toString(36).substring(2, 15);
  return `qna-${Date.now()}-${randomStr}`;
}

function LiveSessionContent({ params }: LiveSessionProps) {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const {
    job,
    manifest,
    cuePlan,
    transcript,
    isLoading: isLoadingArtifacts,
    error: artifactsError,
  } = useSessionArtifacts(params.videoId);

  const youtubeId = job?.youtube_id || null;
  const metadata = job;
  const jobStage = job?.stage || null;

  const [assistantMuted, setAssistantMuted] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const { user: userProfile } = useUserProfile();
  const [recentlyDeliveredCueIds, setRecentlyDeliveredCueIds] = useState<string[]>([]);
  const [currentSpokenCue, setCurrentSpokenCue] = useState<
    (RuntimeCueSelectionResponse & { timestampMs?: number }) | null
  >(null);
  const [seekEpoch, setSeekEpoch] = useState(0);

  // Camera & lifecycle cleanup
  useCameraLifecycleCleanup();
  const cameraStream = useCameraStream();

  const { statusText: hapticStatusText, deviceStatuses } = useHapticDeviceStatus();

  // Initialize speech registry monkey-patch to prevent app speech feedback interference
  React.useEffect(() => {
    initSpeechRegistryMonkeyPatch();
  }, []);

  const announce = React.useCallback((msg: string) => {
    setAnnouncement(msg);
  }, []);

  const handleAudioCueAnnouncement = React.useCallback(
    (text: string) => {
      const isSpeechSynthAvailable =
        typeof window !== "undefined" && !!window.speechSynthesis;
      if (!isSpeechSynthAvailable || assistantMuted) {
        announce(`Assistant cue: ${text}`);
      } else {
        announce("New assistant cue.");
      }
    },
    [assistantMuted, announce]
  );

  // YouTube IFrame player
  const {
    containerRef,
    isReady,
    isPlaying,
    isBuffering,
    hasEnded,
    currentTime,
    duration,
    playbackRate,
    error: playerError,
    play,
    pause,
    seek,
    setPlaybackRate,
    getVolume,
    setVolume,
    isPlayerMuted,
  } = useYouTubePlayer(youtubeId);

  // Session playback telemetry
  const { logSessionEvent, getBufferedEvents } = useSessionTelemetry({
    sessionId,
    isReady,
    isPlaying,
    hasEnded,
    currentTime,
    playbackRate,
  });

  const { recentEvents, triggerHapticEvent } = useHapticEventDelivery(announce, logSessionEvent);

  const currentTimeRef = useRef(currentTime);
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  const { latestAutomaticCue, isAutomaticCueActive, updateLatestAutomaticCue } = useAutomaticCue(
    currentTimeRef,
    currentTime
  );

  const lastCheckedSecond = useRef<number>(-1);

  const handleSeek = React.useCallback(
    (seconds: number, reason?: string) => {
      setSeekEpoch((prev) => prev + 1);
      setCurrentSpokenCue(null);

      if (seconds < currentTime - 1.5) {
        setRecentlyDeliveredCueIds([]);
        lastCheckedSecond.current = -1;
      }

      seek(seconds);
      if (reason) announce(reason);
    },
    [currentTime, seek, announce]
  );

  const handleHapticCueTrigger = React.useCallback(
    (text: string, hapticCueRef: string | null, cueId: string | null) => {
      const category = inferHapticCategoryFromCue(text, hapticCueRef ? { cue_type: hapticCueRef } : null);
      if (!category) {
        // Countdown, Form Warning, or unclassifiable cue -> suppress haptics
        return;
      }

      const defaultId = HAPTIC_CATEGORY_DEFAULT_IDS[category];
      const vibrationId =
        (userProfile?.haptic_preferences as Record<string, string | null | undefined>)?.[category] || defaultId;
      const limbs = ["left_arm", "right_arm"];

      triggerHapticEvent({
        cueType: category,
        vibrationId,
        intensity: 0.7,
        limbs,
        text,
        cueId,
        currentTimeMs: currentTime * 1000,
      }).catch((err) => {
        console.error("Failed to trigger haptic cue:", err);
      });
    },
    [userProfile, currentTime, triggerHapticEvent]
  );

  // Screen-reader announcements (playback state + artifact loading)
  useLiveSessionAnnouncements({
    isReady,
    isPlaying,
    isBuffering,
    hasEnded,
    playerError,
    youtubeId,
    isLoadingArtifacts,
    artifactsError,
    manifest,
    announce,
  });

  const currentExercise =
    manifest?.exercise_timeline_anchors.find(
      (anchor) =>
        currentTime >= anchor.start_time_seconds && currentTime <= anchor.end_time_seconds
    ) || null;

  const currentTimeMs = currentTime * 1000;

  // Playback pause coordinator
  const pauseCoordinator = usePlaybackPauseCoordinator(
    play,
    pause,
    logSessionEvent,
    currentTimeMs,
    () => isEnding
  );

  const {
    isLiveGateOpen,
    liveGateExerciseName,
    isLiveCountdownActive,
    liveCancelCountdownTrigger,
    setLiveCancelCountdownTrigger,
    liveGuidance,
    setLiveGuidance,
    handleSkipLiveGate,
    handleCompleteLiveGate,
    cameraGatesDisabled,
    handleDisableCameraGates,
    handleRetryAlignment,
    setIsLiveCountdownActive,
  } = useLivePositioningGate({
    isReady,
    manifest,
    currentExercise,
    currentTime,
    currentTimeMs,
    cameraStream,
    pauseCoordinator,
    logSessionEvent,
    announce,
    handleSeek,
  });

  // Session Start and Finish lifecycle haptic triggers
  const { triggerFinishHaptic } = useSessionLifecycleHaptics({
    sessionId,
    isReady,
    isPlaying,
    hasEnded,
    isLiveGateOpen,
    currentTime,
    userProfile,
    triggerHapticEvent,
  });

  const handleManualPlay = React.useCallback(() => {
    pauseCoordinator.releasePause("user_manual", "Manual user play trigger");
  }, [pauseCoordinator]);

  const handleManualPause = React.useCallback(() => {
    pauseCoordinator.requestPause("user_manual", "Manual user pause trigger");
  }, [pauseCoordinator]);

  // Sync IFrame direct play/pause to the pause coordinator user_manual owner
  useEffect(() => {
    if (!isPlaying) {
      const hasProgrammaticOwner =
        pauseCoordinator.activeOwners.has("positioning_gate") ||
        pauseCoordinator.activeOwners.has("assistant_speech");
      if (!hasProgrammaticOwner && !pauseCoordinator.activeOwners.has("user_manual")) {
        pauseCoordinator.requestPause("user_manual", "IFrame manual pause detected");
      }
    } else {
      if (pauseCoordinator.activeOwners.has("user_manual")) {
        pauseCoordinator.releasePause("user_manual", "IFrame manual play detected");
      }
    }
  }, [isPlaying, pauseCoordinator]);

  // Instantiate prototype pose runtime fallback
  const prototypePoseRuntime = usePrototypePoseRuntime({
    currentTimeMs,
    activeAnchor: currentExercise,
    isPlaying,
  });

  // Instantiate real browser-local MediaPipe live pose runtime
  const mediaPipePoseRuntime = useMediaPipePoseRuntime({
    stream: cameraStream.stream,
    currentExercise,
    currentTimeMs,
    isPlaying,
  });

  // Determine active runtime based on usability, readiness, and visibility
  const isMediaPipeUsable = React.useMemo(() => {
    if (cameraGatesDisabled) return false;
    if (!mediaPipePoseRuntime.isReady) return false;
    if (mediaPipePoseRuntime.runtimeStatus !== "active") return false;
    if (!mediaPipePoseRuntime.poseAvailable) return false;
    if (!mediaPipePoseRuntime.requiredLandmarksVisible) return false;

    // Check if exercise is supported
    const profile = getExercisePoseProfile(currentExercise);
    if (!profile.supported) return false;

    return true;
  }, [mediaPipePoseRuntime.isReady, mediaPipePoseRuntime.runtimeStatus, mediaPipePoseRuntime.poseAvailable, mediaPipePoseRuntime.requiredLandmarksVisible, currentExercise, cameraGatesDisabled]);

  const activePoseRuntime = isMediaPipeUsable ? mediaPipePoseRuntime : prototypePoseRuntime;

  // Automatically start the active pose runtime tracking when the session is loaded/running
  React.useEffect(() => {
    if (!activePoseRuntime.isTracking) {
      activePoseRuntime.startTracking();
    }
  }, [activePoseRuntime]);

  const {
    startPoseTracking,
    stopPoseTracking,
    isPrototypeTracking,
    currentAngles,
    latestRepCount,
    repsBufferRef,
    formErrorsBufferRef,
  } = usePoseSessionEvents({
    sessionId,
    currentTimeMs,
    currentExercise,
    userProfile,
    announce,
    updateLatestAutomaticCue,
    logSessionEvent,
    triggerHapticEvent,
    activePoseRuntime,
  });

  // Keep screen-reader status text for tracking system and fallback reason
  const fallbackReason = !isMediaPipeUsable
    ? !mediaPipePoseRuntime.isReady
      ? "MediaPipe model is loading"
      : mediaPipePoseRuntime.runtimeStatus !== "active"
      ? "Camera stream is inactive"
      : !mediaPipePoseRuntime.poseAvailable
      ? "User body not fully detected by camera"
      : !mediaPipePoseRuntime.requiredLandmarksVisible
      ? "Required joints not visible in camera view"
      : "Exercise not supported for camera tracking"
    : null;

  const activePoseProvider = isMediaPipeUsable ? "camera_mediapipe" : "prototype_pose";

  const {
    runtimeObservationContext,
    handleSelectCameraDevice,
    cameraPoseStatusLabel,
    cameraPoseGuidance,
    preferredCameraLabel,
  } = useLiveSessionCameraTelemetry({
    cameraStream,
    mediaPipePoseRuntime,
    currentExercise,
    currentTimeMs,
    isReady,
    cameraGatesDisabled,
    isMediaPipeUsable,
    activePoseProvider,
    fallbackReason,
    announce,
    logSessionEvent,
  });

  const searchLevel = searchParams.get("overrideLevel");
  const searchPause = searchParams.get("overridePause");

  const coexistenceSettings = React.useMemo<AudioCoexistenceSettings>(
    () => ({
      interruption_level: assistantMuted
        ? InterruptionLevel.HAPTIC_ONLY
        : ((searchLevel as InterruptionLevel) ||
            userProfile?.audio_coexistence?.interruption_level ||
            InterruptionLevel.BRIEF_SPEECH),
      assistant_verbosity:
        userProfile?.audio_coexistence?.assistant_verbosity || AssistantVerbosity.MODERATE,
      pause_before_speaking:
        searchPause !== null
          ? searchPause === "true"
          : userProfile?.audio_coexistence?.pause_before_speaking !== undefined
          ? userProfile.audio_coexistence.pause_before_speaking
          : true,
      correction_frequency: userProfile?.audio_coexistence?.correction_frequency || "medium",
    }),
    [assistantMuted, searchLevel, userProfile, searchPause]
  );

  // Invalidate stale cues on seek or mute/video change
  const prevTimeRef = useRef<number>(0);
  useEffect(() => {
    const diff = Math.abs(currentTime - prevTimeRef.current);
    if (diff > 1.5) {
      setCurrentSpokenCue(null);
      if (currentTime < prevTimeRef.current - 1.5) {
        setRecentlyDeliveredCueIds([]);
        lastCheckedSecond.current = -1;
      }
    }
    prevTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    setCurrentSpokenCue(null);
  }, [assistantMuted, params.videoId]);



  // Live cue plan delivery
  useLiveCueDelivery({
    cuePlan,
    currentTime,
    isPlaying,
    coexistenceSettings,
    assistantMuted,
    recentlyDeliveredCueIds,
    setRecentlyDeliveredCueIds,
    updateLatestAutomaticCue,
    handleAudioCueAnnouncement,
    handleHapticCueTrigger,
    logSessionEvent,
    announce,
    setCurrentSpokenCue,
    isGateOpen: isLiveGateOpen,
  });

  // Legacy fallback cue path (only active when no cuePlan)
  const { activeCue } = useAssistantCueQueue(
    cuePlan ? null : manifest,
    currentTimeMs,
    coexistenceSettings
  );

  // Wire legacy activeCue to spoken/haptic/telemetry systems
  useLiveSessionCueGlue({
    activeCue,
    currentTime,
    currentTimeMs,
    isLiveGateOpen,
    coexistenceSettings,
    userProfile,
    announce,
    handleAudioCueAnnouncement,
    updateLatestAutomaticCue,
    logSessionEvent,
    triggerHapticEvent,
    setCurrentSpokenCue,
  });

  // Spoken cue playback
  useSpokenCuePlayback({
    cueId: currentSpokenCue?.cue_id,
    shouldDeliver: currentSpokenCue?.should_deliver,
    modality: currentSpokenCue?.modality,
    text: currentSpokenCue?.text,
    recommendedPlaybackAction: currentSpokenCue?.recommended_playback_action,
    assistantMuted,
    audioCoexistenceSettings: coexistenceSettings,
    voiceSettings: userProfile?.voice_settings,
    feedbackModalities: userProfile?.feedback_modalities,
    videoId: params.videoId,
    sessionId,
    currentTime,
    isPlaying,
    requestPause: pauseCoordinator.requestPause,
    releasePause: pauseCoordinator.releasePause,
    getVolume,
    setVolume,
    isPlayerMuted,
    timestampMs: currentSpokenCue?.timestampMs,
    seekEpoch,
  });

  // Q&A answer delivery (gate-aware)
  const handleAssistantAnswerReady = React.useCallback(
    (answerText: string) => {
      if (isLiveGateOpen) {
        logSessionEvent(SESSION_EVENTS.QA_SPEECH_SUPPRESSED_BY_GATE, currentTimeMs, {
          text: answerText,
          reason: "positioning_gate_active",
        });
        announce(`Answer received (text only): ${answerText}`);
        return;
      }
      const qnaId = generateQnaCueId();
      setCurrentSpokenCue({
        cue_id: qnaId,
        should_deliver: true,
        modality: "audio",
        text: answerText,
        haptic_cue_ref: null,
        interruption_policy_hint: null,
        recommended_playback_action: coexistenceSettings.pause_before_speaking
          ? "pause_before_speaking"
          : "none",
        reason: "Assistant Q&A response",
      });
    },
    [coexistenceSettings.pause_before_speaking, isLiveGateOpen, currentTimeMs, logSessionEvent, announce]
  );

  const {
    qaMessages,
    chatInput,
    setChatInput,
    isPending,
    qaError,
    handleSendMessage,
    submitQuestion,
  } = useQnAChat({
    sessionId,
    videoId: params.videoId,
    currentTime,
    currentTimeMs,
    currentExercise,
    manifest,
    cuePlan,
    transcript,
    coexistenceSettings,
    assistantMuted,
    metadata: metadata ? { title: metadata.title } : null,
    userProfile,
    announce,
    logSessionEvent,
    onAssistantAnswerReady: handleAssistantAnswerReady,
    runtimeObservationContext,
  });

  // Session end orchestration
  const { isEnding, endError, handleEndSession } = useSessionEnd({
    sessionId,
    videoId: params.videoId,
    playbackEventsBuffer: getBufferedEvents(),
    repsBuffer: repsBufferRef.current,
    formErrorsBuffer: formErrorsBufferRef.current,
    announce,
    onSuccess: triggerFinishHaptic,
  });

  const handleToggleMute = (muted: boolean) => {
    setAssistantMuted(muted);
    announce(muted ? "Assistant voice muted." : "Assistant voice unmuted.");
  };

  // Navigation handlers (repeat, skip, previous, read current)
  const { handleRepeatTrainerInstruction, handleSkipSection, handlePreviousSection, handleReadCurrentSection } =
    useLiveSessionNavigation({
      manifest,
      currentTime,
      currentTimeMs,
      currentExercise,
      handleSeek,
      logSessionEvent,
      announce,
    });

  // Live voice command orchestration
  const { voiceStatus, startVoice, stopVoice, lastTranscript: voiceLastTranscript, voiceError } =
    useLiveVoiceCommands({
      isPlaying,
      play: handleManualPlay,
      pause: handleManualPause,
      seek: handleSeek,
      currentTime,
      playbackRate,
      setPlaybackRate,
      handleSkipSection,
      handleRepeatTrainerInstruction,
      assistantMuted,
      setAssistantMuted: handleToggleMute,
      submitQuestion,
      announce,
      logSessionEvent,
      currentTimeMs,
      isQnAPending: isPending,
      isGateOpen: isLiveGateOpen,
      isCountdownActive: isLiveCountdownActive,
      activeOwners: pauseCoordinator.activeOwners,
      cameraDevices: cameraStream.devices,
      selectedCameraDeviceId: cameraStream.selectedDeviceId,
      requestCamera: cameraStream.requestCamera,
      onRepeatGuidance: () => {
        if (typeof window !== "undefined" && window.speechSynthesis) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(liveGuidance);
          window.speechSynthesis.speak(utterance);
        }
      },
      onCancelCountdown: () => {
        setLiveCancelCountdownTrigger((prev) => prev + 1);
      },
      onSkipAlignment: () => {
        handleSkipLiveGate();
      },
      handlePreviousSection,
      handleReadCurrentSection,
    });

  // Early-return guards encapsulated in SessionStatusGuards component
  if (!sessionId || isLoadingArtifacts || artifactsError || jobStage !== ProcessingStage.COMPLETED) {
    return (
      <SessionStatusGuards
        sessionId={sessionId}
        videoId={params.videoId}
        isLoadingArtifacts={isLoadingArtifacts}
        artifactsError={artifactsError}
        jobStage={jobStage}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <PageWrapper id="live-session-wrapper">
      {/* Screen-reader status announcement live region */}
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {announcement}
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <LiveSessionPlaybackColumn
          containerRef={containerRef}
          isReady={isReady}
          playerError={playerError}
          metadata={metadata}
          currentTime={currentTime}
          duration={duration}
          playbackRate={playbackRate}
          assistantMuted={assistantMuted}
          isPlaying={isPlaying}
          isPrototypeTracking={isPrototypeTracking}
          currentAngles={currentAngles}
          handleSeek={handleSeek}
          setPlaybackRate={setPlaybackRate}
          handleToggleMute={handleToggleMute}
          handleRepeatTrainerInstruction={handleRepeatTrainerInstruction}
          play={play}
          pause={pause}
          handleSkipSection={handleSkipSection}
          stopPoseTracking={stopPoseTracking}
          startPoseTracking={startPoseTracking}
          formatTime={formatTime}
          cameraPoseStatusLabel={cameraPoseStatusLabel}
          cameraPoseGuidance={cameraPoseGuidance}
          cameraPoseAvailable={mediaPipePoseRuntime.poseAvailable}
          activePoseProvider={activePoseProvider}
          fallbackReason={fallbackReason}
          cameraDevices={cameraStream.devices}
          selectedCameraDeviceId={cameraStream.selectedDeviceId}
          activeDeviceId={cameraStream.activeDeviceId}
          pendingDeviceId={cameraStream.pendingDeviceId}
          onSelectCameraDevice={handleSelectCameraDevice}
          cameraStatus={cameraStream.status}
          onRetryCamera={() => cameraStream.requestCamera(cameraStream.selectedDeviceId, true)}
          onTurnCameraOff={handleDisableCameraGates}
          onRetryAlignment={handleRetryAlignment}
        />

        <LiveSessionSidebar
          currentExercise={currentExercise}
          latestRepCount={latestRepCount}
          currentTime={currentTime}
          formatTime={formatTime}
          latestAutomaticCue={latestAutomaticCue}
          isAutomaticCueActive={isAutomaticCueActive}
          isLoadingArtifacts={isLoadingArtifacts}
          artifactsError={artifactsError}
          voiceStatus={voiceStatus}
          startVoice={startVoice}
          stopVoice={stopVoice}
          voiceLastTranscript={voiceLastTranscript}
          voiceError={voiceError}
          deviceStatuses={deviceStatuses}
          recentEvents={recentEvents}
          hapticStatusText={hapticStatusText}
          qaMessages={qaMessages}
          chatInput={chatInput}
          setChatInput={setChatInput}
          isPending={isPending}
          qaError={qaError}
          handleSendMessage={handleSendMessage}
        />
      </div>

      {/* Bottom Bar: Action buttons */}
      <section
        className="flex flex-wrap items-center justify-center gap-3 mt-8 pt-6 border-t border-slate-900"
        aria-label="Playback and Session Controls"
      >
        <div className="flex flex-col items-center gap-1.5">
          {endError && (
            <span className="text-sm text-red-400 font-semibold animate-pulse" role="alert">
              {endError}
            </span>
          )}
          <button
            onClick={handleEndSession}
            disabled={isEnding}
            className="px-5 py-3 bg-red-600 hover:bg-red-500 disabled:bg-red-800 disabled:text-slate-300 text-white font-bold rounded-xl text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
            id="end-session-btn"
            aria-label="End this assisted workout session and view progress history"
          >
            {isEnding ? "Ending..." : "End & Save Session"}
          </button>
        </div>
      </section>

      {/* Positioning Gate Modal */}
      {isLiveGateOpen && liveGateExerciseName && (() => {
        const poseReq = getPoseRequirementForAnchor(liveGateExerciseName);
        return (
          <CameraPositioningGate
            isOpen={isLiveGateOpen}
            onClose={handleSkipLiveGate}
            stream={cameraStream.stream}
            requiredCameraOrientation={poseReq.cameraOrientation}
            requiredBodyOrientation={poseReq.bodyOrientation}
            onComplete={handleCompleteLiveGate}
            isActionPending={false}
            actionButtonLabel="Skip Camera Alignment"
            title="Camera Positioning Gate"
            subtitle={`Position yourself for ${liveGateExerciseName}. Live session playback will resume once you are aligned.`}
            currentGuidance={liveGuidance}
            onGuidanceChange={setLiveGuidance}
            onCountdownActiveChange={setIsLiveCountdownActive}
            cancelCountdownTrigger={liveCancelCountdownTrigger}
            cameraStatus={cameraStream.status}
            cameraErrorMessage={cameraStream.errorMessage}
            cameraDevices={cameraStream.devices}
            selectedCameraDeviceId={cameraStream.selectedDeviceId}
            onRequestCamera={cameraStream.requestCamera}
            onDisableCameraGatesForSession={handleDisableCameraGates}
            preferredCameraLabel={preferredCameraLabel}
            announce={announce}
          />
        );
      })()}
    </PageWrapper>
  );
}

export default function LiveSession({ params }: LiveSessionProps) {
  return (
    <Suspense
      fallback={
        <PageWrapper id="live-session-suspense-wrapper">
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
            <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Loading Player Page</h2>
          </div>
        </PageWrapper>
      }
    >
      <LiveSessionContent params={params} />
    </Suspense>
  );
}
