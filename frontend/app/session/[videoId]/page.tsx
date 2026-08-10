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
  AssistantPersona,
  AssistantVerbosity,
  AudioCoexistenceSettings,
  RuntimeCueSelectionResponse,
  FeedbackModality,
  FormError,
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
import { usePersonaRuntimePolicy } from "@/lib/hooks/usePersonaRuntimePolicy";
import { usePrototypePoseRuntime } from "@/lib/hooks/usePrototypePoseRuntime";
import { useCameraStream, useCameraLifecycleCleanup } from "@/lib/hooks/useCameraStream";
import { useMediaPipePoseRuntime } from "@/lib/hooks/useMediaPipePoseRuntime";
import { CameraPositioningGate } from "@/components/session/CameraPositioningGate";
import { getPoseRequirementForAnchor } from "@/lib/pose/positioningGuide";
import { usePlaybackPauseCoordinator } from "@/lib/hooks/usePlaybackPauseCoordinator";
import { useLivePositioningGate } from "@/lib/hooks/useLivePositioningGate";
import { useLiveSessionAnnouncements } from "@/lib/hooks/useLiveSessionAnnouncements";
import { useLiveSessionNavigation } from "@/lib/hooks/useLiveSessionNavigation";
import { useLiveSessionCueGlue } from "@/lib/hooks/useLiveSessionCueGlue";
import { useSessionLifecycleHaptics } from "@/lib/hooks/useSessionLifecycleHaptics";
import { useLiveSessionCameraTelemetry } from "@/lib/hooks/useLiveSessionCameraTelemetry";
import { useLivePoseRuntimeSelection } from "@/lib/hooks/useLivePoseRuntimeSelection";
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
  const activePersona = userProfile?.assistant_persona || AssistantPersona.GUIDE;

  // Playback pause coordinator
  const pauseCoordinator = usePlaybackPauseCoordinator(
    play,
    pause,
    logSessionEvent,
    currentTimeMs,
    () => isEnding
  );

  const prototypePoseRuntime = usePrototypePoseRuntime({
    currentTimeMs,
    activeAnchor: currentExercise,
    isPlaying,
  });

  const mediaPipePoseRuntime = useMediaPipePoseRuntime({
    stream: cameraStream.stream,
    currentExercise,
    currentTimeMs,
    isPlaying,
  });

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
    gateType,
  } = useLivePositioningGate({
    isReady,
    manifest,
    currentExercise,
    currentTime,
    currentTimeMs,
    cameraStream,
    mediaPipePoseRuntime,
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
    pauseCoordinator.resume("Manual user play trigger");
  }, [pauseCoordinator]);

  const handleManualPause = React.useCallback(() => {
    pauseCoordinator.requestPause("user_manual", "Manual user pause trigger");
  }, [pauseCoordinator]);

  // Sync IFrame direct play/pause to the pause coordinator user_manual owner
  useEffect(() => {
    if (!isPlaying) {
      // If the coordinator requested play/resume, the iframe is transitioning to PLAYING state.
      // Do not misclassify this transient state as a direct manual iframe pause.
      if (pauseCoordinator.playbackIntent === "playing") {
        return;
      }
      if (pauseCoordinator.playbackIntent === "paused") {
        pauseCoordinator.clearPlaybackIntent();
      }

      const hasProgrammaticOwner =
        pauseCoordinator.activeOwners.has("positioning_gate") ||
        pauseCoordinator.activeOwners.has("assistant_speech");

      if (!hasProgrammaticOwner && !pauseCoordinator.activeOwners.has("user_manual")) {
        pauseCoordinator.requestPause("user_manual", "IFrame manual pause detected");
      }
    } else {
      // isPlaying is true.
      // If the coordinator requested pause, the iframe is transitioning to PAUSED state.
      // Do not misclassify this transient state as a direct manual iframe play.
      if (pauseCoordinator.playbackIntent === "paused") {
        return;
      }

      if (pauseCoordinator.playbackIntent === "playing") {
        pauseCoordinator.clearPlaybackIntent();
      }

      if (pauseCoordinator.activeOwners.has("user_manual")) {
        pauseCoordinator.releasePause("user_manual", "IFrame manual play detected");
      }
    }
  }, [isPlaying, pauseCoordinator]);

  const {
    isMediaPipeUsable,
    fallbackReason,
    activePoseProvider,
    activePoseRuntime,
  } = useLivePoseRuntimeSelection({
    prototypePoseRuntime,
    mediaPipePoseRuntime,
    currentExercise,
    cameraGatesDisabled,
  });

  // Automatically start the active pose runtime tracking when the session is loaded/running
  React.useEffect(() => {
    if (!activePoseRuntime.isTracking) {
      activePoseRuntime.startTracking();
    }
  }, [activePoseRuntime]);

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

  const coexistenceSettings = React.useMemo<AudioCoexistenceSettings>(
    () => ({
      assistant_verbosity:
        userProfile?.audio_coexistence?.assistant_verbosity || AssistantVerbosity.MODERATE,
      pause_before_speaking: userProfile?.audio_coexistence?.pause_before_speaking !== undefined
          ? userProfile.audio_coexistence.pause_before_speaking
          : true,
    }),
    [userProfile]
  );

  const {
    resetExercise: resetPersonaExercise,
    canVoiceCorrection,
    noteFormError: notePersonaFormError,
    onRepCompleted: onPersonaRepCompleted,
    onProgress: onPersonaProgress,
    onExerciseCompleted: onPersonaExerciseCompleted,
  } = usePersonaRuntimePolicy(activePersona);

  // Persona-generated speech is deliberately more conservative than ordinary
  // cue-plan playback: it is only spoken when FitA11y is configured to pause
  // before speaking, so it cannot compete with the trainer's audio.
  const canSpeakPersonaCue =
    isPlaying &&
    !assistantMuted &&
    !isLiveGateOpen &&
    coexistenceSettings.pause_before_speaking;

  const handlePersonaTrigger = React.useCallback(
    (decision: { trigger: string | null; reason: string | null; text?: string }, timestampMs: number) => {
      if (!decision.trigger) return;

      const metadata = {
        persona: activePersona,
        persona_trigger: decision.trigger,
        persona_reason: decision.reason,
      };
      logSessionEvent(SESSION_EVENTS.PERSONA_CUE_ELIGIBLE, timestampMs, metadata);

      if (!canSpeakPersonaCue || !decision.text) {
        logSessionEvent(SESSION_EVENTS.PERSONA_CUE_SUPPRESSED, timestampMs, {
          ...metadata,
          reason: canSpeakPersonaCue ? "missing_persona_text" : "audio_coexistence_policy",
        });
        return;
      }

      updateLatestAutomaticCue(decision.text, `persona_${decision.trigger}`);
      setCurrentSpokenCue({
        cue_id: `persona-${decision.trigger}-${Math.round(timestampMs)}`,
        should_deliver: true,
        modality: "audio",
        text: decision.text,
        haptic_cue_ref: null,
        interruption_policy_hint: "pause_then_speak",
        recommended_playback_action: "pause_before_speaking",
        reason: `Persona ${decision.trigger}`,
        timestampMs,
      });
    },
    [activePersona, canSpeakPersonaCue, logSessionEvent, updateLatestAutomaticCue]
  );

  const completedPersonaExercisesRef = useRef(0);
  const previousPersonaExerciseIdRef = useRef<string | null>(null);
  useEffect(() => {
    const nextExerciseId = currentExercise?.id || null;
    const previousExerciseId = previousPersonaExerciseIdRef.current;

    if (previousExerciseId && nextExerciseId && previousExerciseId !== nextExerciseId) {
      completedPersonaExercisesRef.current += 1;
      handlePersonaTrigger(
        onPersonaExerciseCompleted(completedPersonaExercisesRef.current),
        currentTimeMs
      );
    }

    if (nextExerciseId !== previousExerciseId) {
      resetPersonaExercise(false, activePersona);
      previousPersonaExerciseIdRef.current = nextExerciseId;
    }
  }, [activePersona, currentExercise?.id, currentTimeMs, handlePersonaTrigger, onPersonaExerciseCompleted, resetPersonaExercise]);

  useEffect(() => {
    if (!currentExercise || !isPlaying) return;
    const exerciseDuration = currentExercise.end_time_seconds - currentExercise.start_time_seconds;
    if (exerciseDuration <= 0) return;
    const progress = Math.max(0, Math.min(1, (currentTime - currentExercise.start_time_seconds) / exerciseDuration));
    handlePersonaTrigger(onPersonaProgress(progress, undefined, canSpeakPersonaCue), currentTimeMs);
  }, [canSpeakPersonaCue, currentExercise, currentTime, currentTimeMs, handlePersonaTrigger, isPlaying, onPersonaProgress]);

  const handleCorrectionReady = React.useCallback(
    (
      response: {
        text: string;
        modality?: string;
        priority?: string;
        persona?: string;
        metadata?: Record<string, unknown>;
      },
      timestampMs: number,
      latestFormError: FormError
    ) => {
      // 1. Log delivered telemetry
      logSessionEvent(SESSION_EVENTS.ASSISTANT_CORRECTION_DELIVERED, timestampMs, {
        text: response.text,
        joint: latestFormError.joint,
        modality: response.modality,
        priority: response.priority,
        persona: response.persona,
        source: response.metadata?.source,
        provider: response.metadata?.provider,
        correction_kind: response.metadata?.correction_kind || latestFormError.metadata?.correction_kind,
      });

      // 2. Check positioning gate
      if (isLiveGateOpen) {
        logSessionEvent(SESSION_EVENTS.CORRECTION_SPEECH_SUPPRESSED_BY_GATE, timestampMs, {
          text: response.text,
          joint: latestFormError.joint,
          reason: "positioning_gate_active",
        });
        announce(`Assistant correction (text only): ${response.text}`);
        return;
      }

      // 3. Update UI state and announcement
      updateLatestAutomaticCue(response.text, "correction");
      announce(`Assistant correction: ${response.text}`);

      // 4. Check speech policy restrictions
      if (assistantMuted) {
        return;
      }



      if (
        userProfile?.feedback_modalities &&
        !userProfile.feedback_modalities.includes(FeedbackModality.AUDIO)
      ) {
        return;
      }

      // 5. Dispatch spoken cue with stable cue ID
      const correctionCueId = `correction-${latestFormError.joint}-${Math.round(timestampMs)}`;
      setCurrentSpokenCue({
        cue_id: correctionCueId,
        should_deliver: true,
        modality: "audio",
        text: response.text,
        haptic_cue_ref: null,
        interruption_policy_hint: "pause_then_speak",
        recommended_playback_action: coexistenceSettings.pause_before_speaking
          ? "pause_before_speaking"
          : "none",
        reason: `Assistant form correction (${latestFormError.joint})`,
        timestampMs,
      });
    },
    [
      isLiveGateOpen,
      assistantMuted,
      coexistenceSettings.pause_before_speaking,
      userProfile?.feedback_modalities,
      logSessionEvent,
      announce,
      updateLatestAutomaticCue,
      setCurrentSpokenCue,
    ]
  );

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
    canVoiceCorrection,
    notePersonaFormError,
    onPersonaRepCompleted: (canSpeak) => onPersonaRepCompleted(true, null, canSpeak),
    onPersonaTrigger: handlePersonaTrigger,
    canSpeakPersonaCue,
    onCorrectionReady: handleCorrectionReady,
  });

  // Invalidate stale cues on seek or mute/video change
  const prevTimeRef = useRef<number>(0);
  useEffect(() => {
    const diff = Math.abs(currentTime - prevTimeRef.current);
    if (diff > 1.5) {
      setCurrentSpokenCue(null);
      if (currentTime < prevTimeRef.current - 1.5) {
        setRecentlyDeliveredCueIds([]);
        lastCheckedSecond.current = -1;
        resetPersonaExercise(false, activePersona);
      }
    }
    prevTimeRef.current = currentTime;
  }, [activePersona, currentTime, resetPersonaExercise]);

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
    coexistenceSettings,
    activePersona
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

  const initialVoiceIntent = React.useMemo(() => {
    if (typeof window === "undefined") return false;
    const fromQuery = searchParams.get("voiceIntent") === "true" || searchParams.get("overrideVoice") === "true";
    const fromStorage = sessionStorage.getItem("fitA11y_voiceIntent") === "true";
    if (fromStorage) {
      sessionStorage.removeItem("fitA11y_voiceIntent");
    }
    return fromQuery || fromStorage;
  }, [searchParams]);

  // Live voice command orchestration
  const { voiceStatus, startVoice, stopVoice, lastTranscript: voiceLastTranscript, voiceError } =
    useLiveVoiceCommands({
      autoStart: initialVoiceIntent,
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
        const gateTitle = gateType === "mid_exercise_realign"
          ? "Mid-Exercise Camera Realignment"
          : gateType === "pre_workout"
          ? "Pre-Workout Camera Alignment"
          : "Camera Positioning Gate";

        const gateSubtitle = gateType === "mid_exercise_realign"
          ? `Posture tracking was lost during ${liveGateExerciseName}. Re-center in camera view to resume.`
          : gateType === "pre_workout"
          ? "Confirm your camera framing before starting your workout."
          : `Position yourself for ${liveGateExerciseName}. Live session playback will resume once aligned.`;

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
            title={gateTitle}
            subtitle={gateSubtitle}
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
