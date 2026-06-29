"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PageWrapper from "@/components/layout/PageWrapper";
import { useYouTubePlayer } from "@/lib/hooks/useYouTubePlayer";
import { useSessionArtifacts } from "@/lib/hooks/useSessionArtifacts";
import { ProcessingStage } from "@/types";
import YouTubePlayerPanel from "@/components/session/YouTubePlayerPanel";
import SessionControls from "@/components/session/SessionControls";
import { useSessionTelemetry } from "@/lib/hooks/useSessionTelemetry";
import { useAssistantCueQueue } from "@/lib/hooks/useAssistantCueQueue";
import { useSpokenCuePlayback } from "@/lib/hooks/useSpokenCuePlayback";
import { useHapticDeviceStatus } from "@/lib/hooks/useHapticDeviceStatus";
import { useHapticEventDelivery } from "@/lib/hooks/useHapticEventDelivery";
import { InterruptionLevel, AssistantVerbosity, AudioCoexistenceSettings, RuntimeCueSelectionResponse } from "@/types";
import { SESSION_EVENTS } from "@/lib/sessionEvents";
import { useAutomaticCue } from "@/lib/hooks/useAutomaticCue";
import { useQnAChat } from "@/lib/hooks/useQnAChat";
import { useLiveVoiceCommands } from "@/lib/hooks/useLiveVoiceCommands";
import { useUserProfile } from "@/components/layout/UserProfileContext";
import CurrentAutomaticCuePanel from "@/components/session/CurrentAutomaticCuePanel";
import QnAChatPanel from "@/components/session/QnAChatPanel";
import VoiceControlPanel from "@/components/session/VoiceControlPanel";
import PerformanceSummaryPanel from "@/components/session/PerformanceSummaryPanel";
import { useSessionEnd } from "@/lib/hooks/useSessionEnd";
import { useLiveCueDelivery } from "@/lib/hooks/useLiveCueDelivery";
import { usePrototypePoseSessionEvents } from "@/lib/hooks/usePrototypePoseSessionEvents";

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



/** Inferred mapping of cue description text to haptic vibration category types. */
function getCueTypeFromCue(text: string, metadata?: Record<string, unknown> | null): string {
  if (metadata?.cue_type && typeof metadata.cue_type === "string") return metadata.cue_type;
  const t = text.toLowerCase();
  if (t.includes("countdown")) return "countdown";
  if (t.includes("start")) return "start";
  if (t.includes("cooldown") || t.includes("cool down") || t.includes("finish") || t.includes("done")) return "cooldown";
  if (t.includes("speed up") || t.includes("faster") || t.includes("accelerate")) return "speed_up";
  if (t.includes("slow down") || t.includes("slower") || t.includes("pace")) {
    if (t.includes("slow")) return "slow_down";
    if (t.includes("speed")) return "speed_up";
  }
  if (t.includes("rep") || t.includes("tick")) return "per_rep_tick";
  return "form_warning_above";
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
  const [currentSpokenCue, setCurrentSpokenCue] = useState<(RuntimeCueSelectionResponse & { timestampMs?: number }) | null>(null);
  const [seekEpoch, setSeekEpoch] = useState(0);

  const { status: hapticStatus, statusText: hapticStatusText, deviceStatuses, isLoading: isLoadingHapticStatus, error: hapticError } = useHapticDeviceStatus();




  const announce = React.useCallback((msg: string) => {
    setAnnouncement(msg);
  }, []);

  const handleAudioCueAnnouncement = React.useCallback((text: string) => {
    const isSpeechSynthAvailable = typeof window !== "undefined" && !!window.speechSynthesis;
    if (!isSpeechSynthAvailable || assistantMuted) {
      announce(`Assistant cue: ${text}`);
    } else {
      announce("New assistant cue.");
    }
  }, [assistantMuted, announce]);

  // Hook into the YouTube IFrame player
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

  // Session playback interaction telemetry hook
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

  const { latestAutomaticCue, updateLatestAutomaticCue } = useAutomaticCue(currentTimeRef);

  const lastCheckedSecond = useRef<number>(-1);

  const handleSeek = React.useCallback((seconds: number, reason?: string) => {
    setSeekEpoch((prev) => prev + 1);
    setCurrentSpokenCue(null);

    if (seconds < currentTime - 1.5) {
      setRecentlyDeliveredCueIds([]);
      lastCheckedSecond.current = -1;
    }

    seek(seconds);

    if (reason) {
      announce(reason);
    }
  }, [currentTime, seek, announce]);

  const handleHapticCueTrigger = React.useCallback((text: string, hapticCueRef: string | null, cueId: string | null) => {
    const cueType = hapticCueRef || (text ? getCueTypeFromCue(text) : "per_rep_tick");
    const vibrationId = (userProfile?.haptic_preferences as Record<string, string | null | undefined>)?.[cueType] || `${cueType}_001`;
    const limbs = ["left_arm", "right_arm"];

    triggerHapticEvent({
      cueType,
      vibrationId,
      intensity: 0.7,
      limbs,
      text,
      cueId,
      currentTimeMs: currentTime * 1000
    }).catch((err) => {
      console.error("Failed to trigger haptic cue:", err);
    });
  }, [userProfile, currentTime, triggerHapticEvent]);

  // Monitor playback states to populate the screen-reader announcement live region
  const prevIsPlayingAnnouncement = useRef(false);
  useEffect(() => {
    if (playerError) {
      announce(`Trainer player error: ${playerError}`);
    } else if (hasEnded) {
      announce("Trainer video playback ended.");
    } else if (isBuffering) {
      announce("Trainer video is buffering.");
    } else if (isPlaying) {
      announce("Trainer video playback started.");
    } else if (!isPlaying && prevIsPlayingAnnouncement.current) {
      announce("Trainer video playback paused.");
    } else if (isReady) {
      announce("Trainer video player is ready.");
    } else if (!isReady && youtubeId) {
      announce("Loading trainer video player.");
    }
    prevIsPlayingAnnouncement.current = isPlaying;
  }, [isReady, isPlaying, isBuffering, hasEnded, playerError, youtubeId, announce]);


  const currentExercise = manifest?.exercise_timeline_anchors.find(
    (anchor) => currentTime >= anchor.start_time_seconds && currentTime <= anchor.end_time_seconds
  ) || null;

  const currentTimeMs = currentTime * 1000;

  // Setup the prototype pose runtime hook and buffer reps & form errors locally
  const {
    startPoseTracking,
    stopPoseTracking,
    isPrototypeTracking,
    currentAngles,
    trackingStatusLabel,
    latestRepCount,
    repsBufferRef,
    formErrorsBufferRef,
  } = usePrototypePoseSessionEvents({
    sessionId,
    currentTimeMs,
    currentExercise,
    isPlaying,
    userProfile,
    announce,
    updateLatestAutomaticCue,
    logSessionEvent,
    triggerHapticEvent,
  });

  // Monitor session artifacts loading updates
  const prevIsLoadingArtifacts = useRef(false);
  const prevArtifactsError = useRef<string | null>(null);
  useEffect(() => {
    if (isLoadingArtifacts && !prevIsLoadingArtifacts.current) {
      announce("Assisted playback session artifacts are loading.");
    }
    if (!isLoadingArtifacts && prevIsLoadingArtifacts.current && manifest) {
      announce("Assisted playback session artifacts loaded successfully.");
    }
    if (artifactsError && artifactsError !== prevArtifactsError.current) {
      announce(`Failed to load assisted playback artifacts: ${artifactsError}`);
    }
    prevIsLoadingArtifacts.current = isLoadingArtifacts;
    prevArtifactsError.current = artifactsError;
  }, [isLoadingArtifacts, manifest, artifactsError, announce]);

  const searchLevel = searchParams.get("overrideLevel");
  const searchPause = searchParams.get("overridePause");

  const coexistenceSettings = React.useMemo<AudioCoexistenceSettings>(() => {
    return {
      interruption_level: assistantMuted
        ? InterruptionLevel.HAPTIC_ONLY
        : ((searchLevel as InterruptionLevel) || userProfile?.audio_coexistence?.interruption_level || InterruptionLevel.BRIEF_SPEECH),
      assistant_verbosity: userProfile?.audio_coexistence?.assistant_verbosity || AssistantVerbosity.MODERATE,
      pause_before_speaking: searchPause !== null
        ? searchPause === "true"
        : (userProfile?.audio_coexistence?.pause_before_speaking !== undefined
          ? userProfile.audio_coexistence.pause_before_speaking
          : true),
      correction_frequency: userProfile?.audio_coexistence?.correction_frequency || "medium",
    };
  }, [assistantMuted, searchLevel, userProfile, searchPause]);

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

  // Invalidate stale cues on mute or video change
  useEffect(() => {
    setCurrentSpokenCue(null);
  }, [assistantMuted, params.videoId]);

  // Live cue plan candidate selection and delivery orchestration
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
  });

  // Wire up the assistant cue queue (legacy fallback)
  const { activeCue } = useAssistantCueQueue(
    cuePlan ? null : manifest,
    currentTimeMs,
    coexistenceSettings
  );

  // Hook for spoken cue playback
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
    play,
    pause,
    getVolume,
    setVolume,
    isPlayerMuted,
    timestampMs: currentSpokenCue?.timestampMs,
    seekEpoch,
  });



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
  });

  // Append new cues to the message feed as they trigger
  const lastRecordedCueKey = useRef<string | null>(null);
  useEffect(() => {
    if (activeCue) {
      const cueKey = `${activeCue.timestamp_ms}-${activeCue.text}`;
      if (lastRecordedCueKey.current === cueKey) return;
      lastRecordedCueKey.current = cueKey;

      updateLatestAutomaticCue(activeCue.text, "legacy");

      // Expose as announcement for screen readers
      if (activeCue.modality === "audio") {
        handleAudioCueAnnouncement(activeCue.text);
        setCurrentSpokenCue({
          cue_id: `legacy-${activeCue.timestamp_ms}-${activeCue.text}`,
          should_deliver: true,
          modality: "audio",
          text: activeCue.text,
          haptic_cue_ref: null,
          interruption_policy_hint: null,
          recommended_playback_action: coexistenceSettings.pause_before_speaking ? "pause_before_speaking" : "none",
          reason: "Legacy fallback cue",
          timestampMs: activeCue.timestamp_ms || currentTime * 1000
        });
      } else if (activeCue.modality === "haptic") {
        announce(`Haptic cue requested: ${activeCue.text}`);
      }

      const isHaptic = activeCue.modality === "haptic";

      if (!isHaptic) {
        logSessionEvent(SESSION_EVENTS.ASSISTANT_CUE_DELIVERED, activeCue.timestamp_ms || currentTime * 1000, {
          text: activeCue.text,
          modality: activeCue.modality,
          priority: activeCue.priority,
          persona: activeCue.persona
        });
      }

      if (isHaptic) {
        const cueType = getCueTypeFromCue(activeCue.text, activeCue.metadata);
        const vibrationId = (userProfile?.haptic_preferences as Record<string, string | null | undefined>)?.[cueType] || `${cueType}_001`;
        const intensity = typeof activeCue.metadata?.intensity === "number" ? activeCue.metadata.intensity : 0.7;

        const limbs: string[] = [];
        const requestSleeves = (activeCue.metadata?.sleeve_sides || activeCue.metadata?.sleeves || ["both"]) as string[];
        requestSleeves.forEach(s => {
          if (s === "left") limbs.push("left_arm");
          else if (s === "right") limbs.push("right_arm");
          else if (s === "both") limbs.push("left_arm", "right_arm");
        });
        if (limbs.length === 0) {
          limbs.push("left_arm", "right_arm");
        }

        triggerHapticEvent({
          cueType,
          vibrationId,
          intensity,
          limbs,
          text: activeCue.text,
          cueId: `legacy-${activeCue.timestamp_ms}-${activeCue.text}`,
          currentTimeMs: activeCue.timestamp_ms || currentTime * 1000
        }).catch((err) => {
          console.error("Failed to trigger haptic event:", err);
        });
      }
    }
  }, [activeCue, sessionId, currentTime, userProfile, announce, coexistenceSettings, handleAudioCueAnnouncement, updateLatestAutomaticCue, logSessionEvent, triggerHapticEvent]);

  const handleRepeatTrainerInstruction = () => {
    if (!manifest || !manifest.trainer_instruction_events) return;
    const priorEvents = manifest.trainer_instruction_events.filter(
      (evt) => evt.start_ms !== null && evt.start_ms !== undefined && evt.start_ms <= currentTimeMs
    );
    if (priorEvents.length > 0) {
      priorEvents.sort((a, b) => (b.start_ms ?? 0) - (a.start_ms ?? 0));
      const latestEvent = priorEvents[0];
      if (latestEvent.start_ms !== null && latestEvent.start_ms !== undefined) {
        handleSeek(latestEvent.start_ms / 1000, `Repeating trainer instruction: "${latestEvent.text}"`);
        logSessionEvent(SESSION_EVENTS.TRAINER_INSTRUCTION_REPEATED, currentTimeMs, {
          text: latestEvent.text,
          timestamp_ms: latestEvent.start_ms
        });
      }
    } else {
      announce("No prior trainer instructions found in this workout session.");
    }
  };

  const handleSkipSection = () => {
    if (!manifest || !manifest.exercise_timeline_anchors) return;
    const nextAnchor = manifest.exercise_timeline_anchors.find(
      (anchor) => anchor.start_time_seconds > currentTime + 1.0
    );
    if (nextAnchor) {
      handleSeek(nextAnchor.start_time_seconds, `Skipped to section: ${nextAnchor.name}`);
      logSessionEvent(SESSION_EVENTS.SECTION_SKIPPED, currentTimeMs, {
        section_name: nextAnchor.name,
        start_time_seconds: nextAnchor.start_time_seconds
      });
    } else {
      announce("No more exercise sections found in this workout.");
    }
  };

  // Session end orchestration
  const {
    isEnding,
    endError,
    handleEndSession,
  } = useSessionEnd({
    sessionId,
    videoId: params.videoId,
    playbackEventsBuffer: getBufferedEvents(),
    repsBuffer: repsBufferRef.current,
    formErrorsBuffer: formErrorsBufferRef.current,
    announce,
  });



  const handleToggleMute = (muted: boolean) => {
    setAssistantMuted(muted);
    announce(muted ? "Assistant voice muted." : "Assistant voice unmuted.");
  };

  // Live voice command orchestration
  const {
    voiceStatus,
    startVoice,
    stopVoice,
    lastTranscript: voiceLastTranscript,
    voiceError,
  } = useLiveVoiceCommands({
    isPlaying,
    play,
    pause,
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
  });


  if (!sessionId) {
    return (
      <PageWrapper id="live-session-no-id-wrapper">
        <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-slate-900 border border-slate-800 rounded-3xl mt-10">
          <svg className="w-12 h-12 text-yellow-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-bold text-white mb-2">Session ID Missing</h2>
          <p className="text-sm text-slate-400 mb-6">
            An active session is required to record your workout and view telemetry. Please configure your session first.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
            <Link
              href={`/session/${params.videoId}/setup`}
              className="px-5 py-3 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold rounded-xl text-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
            >
              Go to Session Setup
            </Link>
            <Link
              href="/video-library"
              className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm border border-slate-700 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
            >
              Back to Video Library
            </Link>
          </div>
        </div>
      </PageWrapper>
    );
  }

  if (isLoadingArtifacts) {
    return (
      <PageWrapper id="live-session-loading-wrapper">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
          <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Loading Assisted Playback Session</h2>
          <p className="text-sm text-slate-400">Fetching workout metadata and preparation details...</p>
        </div>
      </PageWrapper>
    );
  }

  if (artifactsError) {
    return (
      <PageWrapper id="live-session-error-wrapper">
        <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-slate-900 border border-slate-800 rounded-3xl mt-10">
          <svg className="w-12 h-12 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-bold text-white mb-2">Failed to Load Session</h2>
          <p className="text-sm text-slate-400 mb-6">{artifactsError}</p>
          <Link
            href="/video-library"
            className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm border border-slate-700 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
          >
            Back to Video Library
          </Link>
        </div>
      </PageWrapper>
    );
  }

  if (jobStage !== ProcessingStage.COMPLETED) {
    return (
      <PageWrapper id="live-session-pending-wrapper">
        <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-slate-900 border border-slate-800 rounded-3xl mt-10">
          <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Preparation in Progress</h2>
          <p className="text-sm text-slate-400 mb-2">
            Workout assistance preparation is not complete yet.
          </p>
          <p className="text-sm text-yellow-400 font-semibold bg-yellow-400/10 border border-yellow-400/20 px-3 py-1.5 rounded-full mb-6">
            Current Stage: {jobStage ? jobStage.replace(/_/g, " ") : "unknown"}
          </p>
          <Link
            href="/video-library"
            className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm border border-slate-700 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
          >
            Back to Video Library
          </Link>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper id="live-session-wrapper">
      {/* Screen-reader status announcement live region */}
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {announcement}
      </div>

      {/* Top Bar: Sleeve Calibration & Device Strip */}
      <div className="mb-6 flex flex-col gap-2">
        <section className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-md" aria-label="Device Status Bar">
          <div className="flex items-center gap-2 shrink-0">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              hapticStatus === "connected" || hapticStatus === "partially_connected"
                ? "bg-emerald-500 animate-ping"
                : hapticStatus === "initialized_no_devices" || isLoadingHapticStatus
                ? "bg-yellow-500 animate-pulse"
                : "bg-red-500"
            }`} />
            <span className="text-sm font-semibold text-slate-300">
              Haptic Status: {hapticStatusText}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 xl:gap-4 w-full xl:w-auto" aria-label="Individual Sleeve Connection Statuses">
            {deviceStatuses.map((s) => {
              const dotColor = s.connected
                ? "bg-yellow-400 animate-pulse"
                : "bg-red-500";
              return (
                <div key={s.key} className="flex items-center gap-2 p-2 bg-slate-950 border border-slate-800/60 rounded-xl min-w-0" aria-label={`${s.name}: ${s.status_text}`}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} aria-hidden="true" />
                  <div className="text-xs font-bold text-slate-300 min-w-0">
                    <span className="text-yellow-400">{s.name}: </span>
                    <span className="block md:inline font-semibold text-slate-400" title={s.status_text}>{s.status_text}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        {hapticError && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-xl" id="session-haptic-error">
            Unable to refresh haptic provider status. Indicator mode may still work once the backend is available.
          </div>
        )}
      </div>

      {/* Haptic Event Delivery Feed */}
      {recentEvents.length > 0 && (
        <section
          className="p-4 bg-slate-900 border border-slate-800 rounded-2xl mb-6 shadow-md"
          aria-live="polite"
          aria-atomic="true"
          aria-labelledby="haptic-feed-heading"
        >
          <h2 id="haptic-feed-heading" className="text-xs uppercase font-extrabold text-yellow-400 tracking-wider mb-2">
            Haptic Event Feed (Live Delivery)
          </h2>
          <div className="space-y-2">
            {recentEvents.map((evt, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-slate-950 rounded-xl border border-slate-850 text-xs">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                    evt.deliveryMode === "hardware"
                      ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                      : evt.deliveryMode === "indicator" || evt.deliveryMode === "dry_run"
                      ? "bg-blue-500/10 border border-blue-500/20 text-blue-400"
                      : "bg-red-500/10 border border-red-500/20 text-red-400"
                  }`}>
                    {evt.deliveryMode}
                  </span>
                  <span className="font-bold text-slate-200">{evt.eventName}</span>
                  <span className="text-slate-500">on {evt.targetLimbs.join(", ")}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="font-medium italic text-slate-300">{evt.statusMessage}</span>
                  <span className="text-slate-600 font-medium ml-2">
                    {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left/Center Column: YouTube Embedded Player & Playback Controls */}
        <div className="lg:col-span-8 flex flex-col gap-6 order-2 lg:order-1">
          <YouTubePlayerPanel
            containerRef={containerRef}
            isReady={isReady}
            playerError={playerError}
            metadata={metadata ? {
              title: metadata.title || undefined,
              channel_name: metadata.channel_name || undefined,
              duration: metadata.duration || undefined,
            } : null}
            currentTime={currentTime}
            duration={duration}
            playbackRate={playbackRate}
            formatTime={formatTime}
          >
            <SessionControls
              currentTime={currentTime}
              playbackRate={playbackRate}
              assistantMuted={assistantMuted}
              seek={handleSeek}
              setPlaybackRate={setPlaybackRate}
              setAssistantMuted={handleToggleMute}
              handleRepeatTrainerInstruction={handleRepeatTrainerInstruction}
              isPlaying={isPlaying}
              play={play}
              pause={pause}
              handleSkipSection={handleSkipSection}
            />
          </YouTubePlayerPanel>

          {/* Bottom Pose Feed Panel */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4" aria-label="Pose Tracker Cam">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all ${isPrototypeTracking ? "bg-emerald-950/40 border-emerald-500/20 text-emerald-400" : "bg-slate-950 border-slate-800 text-slate-600"}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{trackingStatusLabel}</h3>
                <p className="text-xs text-slate-400">
                  {isPrototypeTracking
                    ? "Simulating time-varying joint angles from manifest coordinates."
                    : "Mock tracking coordinates are currently offline."}
                </p>
                {isPrototypeTracking && Object.keys(currentAngles).length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-2 text-xs font-bold text-slate-300">
                    {Object.entries(currentAngles).map(([joint, val]) => (
                      <span key={joint} className="bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                        {joint.replace("_", " ")}: {val.toFixed(0)}{"\u00b0"}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={isPrototypeTracking ? stopPoseTracking : startPoseTracking}
                className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 ${isPrototypeTracking
                    ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                    : "bg-yellow-400 hover:bg-yellow-300 text-slate-950 border-yellow-400"
                  }`}
                aria-label={isPrototypeTracking ? "Stop prototype pose tracking" : "Start prototype pose tracking"}
              >
                {isPrototypeTracking ? "Stop Simulating" : "Start Simulating"}
              </button>
            </div>
          </section>
        </div>

        {/* Right Column: Tracked Performance & Assistant Cue Feed */}
        <div className="lg:col-span-4 flex flex-col gap-6 order-1 lg:order-2">
          <PerformanceSummaryPanel
            currentExercise={currentExercise}
            lastHandledRep={latestRepCount}
            currentTime={currentTime}
            formatTime={formatTime}
          />

          <CurrentAutomaticCuePanel
            latestAutomaticCue={latestAutomaticCue}
            formatTime={formatTime}
            isLoadingCuePlan={isLoadingArtifacts}
            cuePlanError={artifactsError}
            isLoadingManifest={isLoadingArtifacts}
            manifestError={artifactsError}
          />

          <VoiceControlPanel
            voiceStatus={voiceStatus}
            startVoice={startVoice}
            stopVoice={stopVoice}
            lastTranscript={voiceLastTranscript}
            voiceError={voiceError}
          />

          <QnAChatPanel
            qaMessages={qaMessages}
            chatInput={chatInput}
            setChatInput={setChatInput}
            isPending={isPending}
            qaError={qaError}
            handleSendMessage={handleSendMessage}
          />
        </div>
      </div>

      {/* Bottom Bar: Action buttons */}
      <section className="flex flex-wrap items-center justify-center gap-3 mt-8 pt-6 border-t border-slate-900" aria-label="Playback and Session Controls">
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
    </PageWrapper>
  );
}

export default function LiveSession({ params }: LiveSessionProps) {
  return (
    <Suspense fallback={
      <PageWrapper id="live-session-suspense-wrapper">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
          <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Loading Player Page</h2>
        </div>
      </PageWrapper>
    }>
      <LiveSessionContent params={params} />
    </Suspense>
  );
}
