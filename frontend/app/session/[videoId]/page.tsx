"use client";
import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
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
import { initSpeechRegistryMonkeyPatch } from "@/lib/voice/speechRegistry";
import { useSessionEnd } from "@/lib/hooks/useSessionEnd";
import { useLiveCueDelivery } from "@/lib/hooks/useLiveCueDelivery";
import { usePoseSessionEvents } from "@/lib/hooks/usePoseSessionEvents";
import { usePrototypePoseRuntime } from "@/lib/hooks/usePrototypePoseRuntime";
import { useCameraStream, useCameraLifecycleCleanup } from "@/lib/hooks/useCameraStream";
import { useMediaPipePoseRuntime } from "@/lib/hooks/useMediaPipePoseRuntime";
import { getCameraPreference } from "@/lib/camera/cameraPreference";
import { getExercisePoseProfile } from "@/lib/pose/exercisePoseProfiles";
import { CameraPositioningGate } from "@/components/session/CameraPositioningGate";
import { getPoseRequirementForAnchor } from "@/lib/pose/positioningGuide";
import { usePlaybackPauseCoordinator } from "@/lib/hooks/usePlaybackPauseCoordinator";
import { useLivePositioningGate } from "@/lib/hooks/useLivePositioningGate";
import { useLiveSessionAnnouncements } from "@/lib/hooks/useLiveSessionAnnouncements";
import { useLiveSessionNavigation } from "@/lib/hooks/useLiveSessionNavigation";
import { useLiveSessionCueGlue } from "@/lib/hooks/useLiveSessionCueGlue";
import { LiveSessionPlaybackColumn } from "@/components/session/LiveSessionPlaybackColumn";
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

/** Inferred mapping of cue description text to haptic vibration category types. */
function getCueTypeFromCue(text: string, metadata?: Record<string, unknown> | null): string {
  if (metadata?.cue_type && typeof metadata.cue_type === "string") return metadata.cue_type;
  const t = text.toLowerCase();
  if (t.includes("countdown")) return "countdown";
  if (t.includes("start")) return "start";
  if (t.includes("cooldown") || t.includes("cool down") || t.includes("finish") || t.includes("done"))
    return "cooldown";
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
      const cueType = hapticCueRef || (text ? getCueTypeFromCue(text) : "per_rep_tick");
      const vibrationId =
        (userProfile?.haptic_preferences as Record<string, string | null | undefined>)?.[cueType] ||
        `${cueType}_001`;
      const limbs = ["left_arm", "right_arm"];

      triggerHapticEvent({
        cueType,
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

  // Start camera using the preferred device ID on mount exactly once
  const autoStartRanRef = useRef(false);
  useEffect(() => {
    if (autoStartRanRef.current) return;
    autoStartRanRef.current = true;
    const pref = getCameraPreference();
    cameraStream.requestCamera(pref?.deviceId).catch((err) => {
      console.error("Failed to auto-start camera on session mount:", err);
    });
  }, [cameraStream.requestCamera]);

  // Auto-request camera if idle on exercise transition
  useEffect(() => {
    if (!isReady || !currentExercise || cameraGatesDisabled) return;
    if (cameraStream.status === "idle") {
      cameraStream.requestCamera().catch((err: any) => {
        console.error("Auto camera request on transition failed:", err);
      });
    }
  }, [currentExercise, isReady, cameraGatesDisabled, cameraStream.status, cameraStream.requestCamera]);

  // Monitor camera stream changes and announce status to screen reader
  const lastStreamDeviceIdRef = useRef<string | null>(null);
  const lastStreamStatusRef = useRef<string>("idle");

  useEffect(() => {
    if (cameraStream.status === "ready" && cameraStream.stream) {
      const activeDeviceId = cameraStream.activeDeviceId;
      const devicesList = cameraStream.devices || [];
      const activeDevice = devicesList.find((d: any) => d.deviceId === activeDeviceId);
      const label = activeDevice?.label || "";

      // Only announce if the device ID has actually changed (or transitioned to ready)
      if (activeDeviceId !== lastStreamDeviceIdRef.current || lastStreamStatusRef.current !== "ready") {
        lastStreamDeviceIdRef.current = activeDeviceId;
        lastStreamStatusRef.current = "ready";

        const labelLower = label.toLowerCase();
        const isIntegrated =
          labelLower.includes("integrated") ||
          labelLower.includes("built-in") ||
          labelLower.includes("facetime") ||
          labelLower.includes("front") ||
          labelLower.includes("isight") ||
          labelLower.includes("internal");

        // Check if user had a preferred external camera that failed
        const pref = getCameraPreference();
        const prefWasExternal = pref && !((pref.label || "").toLowerCase().includes("integrated") ||
                                          (pref.label || "").toLowerCase().includes("built-in") ||
                                          (pref.label || "").toLowerCase().includes("facetime") ||
                                          (pref.label || "").toLowerCase().includes("front") ||
                                          (pref.label || "").toLowerCase().includes("isight") ||
                                          (pref.label || "").toLowerCase().includes("internal"));

        if (isIntegrated) {
          if (prefWasExternal && activeDeviceId !== pref?.deviceId) {
            announce("External webcam unavailable. Switched to integrated webcam.");
          } else {
            announce("Using integrated webcam.");
          }
        } else {
          announce("Using external webcam.");
        }
      }
    } else if (
      cameraStream.status !== "idle" &&
      cameraStream.status !== "requesting" &&
      cameraStream.status !== lastStreamStatusRef.current
    ) {
      lastStreamStatusRef.current = cameraStream.status;
      lastStreamDeviceIdRef.current = null;
      announce("Camera unavailable. Using simulated fallback.");
    }
  }, [cameraStream.status, cameraStream.stream, cameraStream.activeDeviceId, cameraStream.devices, announce]);

  const runtimeObservationContext = React.useMemo(() => {
    const mpActive = mediaPipePoseRuntime.runtimeStatus === "active";
    const mpAvailable = mediaPipePoseRuntime.poseAvailable;
    const mpVisible = mediaPipePoseRuntime.requiredLandmarksVisible;
    const profile = getExercisePoseProfile(currentExercise);
    const exerciseSupported = profile.supported;

    let pose_available = false;
    let observation_capability: "not_available" | "available" | "low_confidence" = "not_available";
    let notes = "";

    if (isMediaPipeUsable && mpAvailable && mpVisible) {
      pose_available = true;
      observation_capability = "available";
      notes = "Real-time camera observation using browser-local MediaPipe is active and reliable.";
    } else if (mpActive && (!mpAvailable || !mpVisible)) {
      pose_available = false;
      observation_capability = "low_confidence";
      notes = "Camera is present and active, but posture detection confidence is low or required joints are obscured.";
    } else {
      pose_available = false;
      observation_capability = "not_available";
      if (!exerciseSupported && currentExercise) {
        notes = `Pose tracking is not supported for exercise: ${currentExercise.name}. Falling back to prototype simulation.`;
      } else if (mediaPipePoseRuntime.runtimeStatus === "initializing") {
        notes = "Camera pose tracking is initializing (loading model).";
      } else {
        notes = "Camera is offline or fallback simulation is active. The assistant cannot see you.";
      }
    }

    const pose_confidence = mpActive ? mediaPipePoseRuntime.landmarkConfidence : null;

    const latest_form_error = (pose_available && mediaPipePoseRuntime.latestFormError)
      ? {
          joint: mediaPipePoseRuntime.latestFormError.joint,
          observed_angle: mediaPipePoseRuntime.latestFormError.observed_angle,
          expected_range: mediaPipePoseRuntime.latestFormError.expected_range,
          severity: mediaPipePoseRuntime.latestFormError.severity,
          message: mediaPipePoseRuntime.latestFormError.message,
          provider: "camera_mediapipe",
        }
      : null;

    const latest_rep_event = (pose_available && mediaPipePoseRuntime.latestRepEvent)
      ? {
          rep_count: mediaPipePoseRuntime.latestRepEvent.rep_count,
          exercise_id: mediaPipePoseRuntime.latestRepEvent.exercise_id,
          provider: "camera_mediapipe",
        }
      : null;

    return {
      pose_available,
      pose_confidence,
      observation_capability,
      latest_form_error,
      latest_rep_event,
      notes,
    };
  }, [mediaPipePoseRuntime, isMediaPipeUsable, currentExercise]);

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

  const handleSelectCameraDevice = React.useCallback(async (deviceId?: string, isExplicit = true) => {
    const devices = cameraStream.devices || [];
    const device = devices.find((d: any) => d.deviceId === deviceId);
    logSessionEvent(SESSION_EVENTS.CAMERA_DEVICE_SELECTED, currentTimeMs, {
      selectedDeviceId: deviceId || "",
      selectedDeviceLabel: device?.label || "",
    });
    await cameraStream.requestCamera(deviceId, isExplicit);
  }, [cameraStream.devices, cameraStream.requestCamera, logSessionEvent, currentTimeMs]);

  const cameraPoseStatusLabel = React.useMemo(() => {
    if (cameraGatesDisabled || cameraStream.status === "idle") {
      return "Camera off. Using fallback tracking.";
    }
    if (cameraStream.status === "requesting") {
      const devicesList = cameraStream.devices || [];
      const device = devicesList.find((d: any) => d.deviceId === cameraStream.selectedDeviceId);
      return `Trying ${device?.label || "Camera"}...`;
    }
    if (cameraStream.status === "ready") {
      if (cameraStream.selectedDeviceId !== cameraStream.activeDeviceId) {
        const devicesList = cameraStream.devices || [];
        const selDevice = devicesList.find((d: any) => d.deviceId === cameraStream.selectedDeviceId);
        return `${selDevice?.label || "Selected camera"} failed. Using integrated webcam fallback.`;
      }
      return "Camera ready. Retry alignment available.";
    }
    if (cameraStream.status === "error" || cameraStream.status === "permission_denied" || cameraStream.status === "not_found") {
      const devicesList = cameraStream.devices || [];
      const selDevice = devicesList.find((d: any) => d.deviceId === cameraStream.selectedDeviceId);
      return `${selDevice?.label || "Camera"} did not start. Using fallback tracking.`;
    }
    return "Camera unavailable.";
  }, [cameraGatesDisabled, cameraStream.status, cameraStream.selectedDeviceId, cameraStream.activeDeviceId, cameraStream.devices]);

  const cameraPoseGuidance = React.useMemo(() => {
    if (activePoseProvider === "camera_mediapipe") {
      return mediaPipePoseRuntime.poseStatusDetails?.guidance || "Real-time camera observation is active.";
    }
    return "Simulated fallback tracking is active. Assistive voice and haptic guidance are fully operational.";
  }, [activePoseProvider, mediaPipePoseRuntime.poseStatusDetails]);

  // Telemetry event logging for camera stream
  const prevCameraStatusRef = useRef<string>("idle");
  const prevDeviceIdRef = useRef<string>("");

  useEffect(() => {
    if (!isReady) return;

    const currentStatus = cameraStream.status;
    const activeDeviceId = cameraStream.activeDeviceId;
    const selectedDeviceId = cameraStream.selectedDeviceId;
    const prevStatus = prevCameraStatusRef.current;
    const prevDeviceId = prevDeviceIdRef.current;

    const devicesList = cameraStream.devices || [];
    const activeDevice = devicesList.find((d: any) => d.deviceId === activeDeviceId);
    const activeLabel = activeDevice?.label || "";
    
    const selectedDevice = devicesList.find((d: any) => d.deviceId === selectedDeviceId);
    const selectedLabel = selectedDevice?.label || "";

    // 1. CAMERA_REQUESTED
    if (currentStatus === "requesting" && prevStatus !== "requesting") {
      logSessionEvent(SESSION_EVENTS.CAMERA_REQUESTED, currentTimeMs, {
        requestedDeviceId: selectedDeviceId,
        requestedDeviceLabel: selectedLabel,
      });
    }

    // 2. CAMERA_READY
    if (currentStatus === "ready" && prevStatus !== "ready") {
      logSessionEvent(SESSION_EVENTS.CAMERA_READY, currentTimeMs, {
        activeDeviceId: activeDeviceId,
        activeDeviceLabel: activeLabel,
        selectedDeviceId: selectedDeviceId,
        selectedDeviceLabel: selectedLabel,
        status: currentStatus,
        provider: "camera_mediapipe",
      });
    }

    // 3. CAMERA_FAILED
    if (
      (currentStatus === "permission_denied" || currentStatus === "not_found" || currentStatus === "error") &&
      prevStatus !== currentStatus
    ) {
      logSessionEvent(SESSION_EVENTS.CAMERA_FAILED, currentTimeMs, {
        status: currentStatus,
        error: cameraStream.errorMessage || "Unknown camera error",
        fallbackReason: currentStatus === "permission_denied" ? "permission_denied" : "device_not_found",
        selectedDeviceId: selectedDeviceId,
        selectedDeviceLabel: selectedLabel,
      });
    }

    // 4. CAMERA_DEVICE_CHANGED
    if (
      currentStatus === "ready" &&
      prevStatus === "ready" &&
      activeDeviceId !== prevDeviceId &&
      prevDeviceId !== ""
    ) {
      logSessionEvent(SESSION_EVENTS.CAMERA_DEVICE_CHANGED, currentTimeMs, {
        previousDeviceId: prevDeviceId,
        activeDeviceId: activeDeviceId,
        activeDeviceLabel: activeLabel,
      });
    }

    prevCameraStatusRef.current = currentStatus;
    prevDeviceIdRef.current = activeDeviceId;
  }, [cameraStream.status, cameraStream.activeDeviceId, cameraStream.selectedDeviceId, cameraStream.devices, isReady, currentTimeMs, logSessionEvent]);

  // Telemetry for fallback and runtime changes
  const prevPoseProviderRef = useRef<string>("prototype_pose");
  useEffect(() => {
    if (!isReady) return;
    if (activePoseProvider === "prototype_pose" && prevPoseProviderRef.current === "camera_mediapipe") {
      logSessionEvent(SESSION_EVENTS.CAMERA_FALLBACK_USED, currentTimeMs, {
        reason: fallbackReason || "camera_disabled_or_unavailable",
        provider: "prototype_pose",
      });
    }
    prevPoseProviderRef.current = activePoseProvider;
  }, [activePoseProvider, fallbackReason, isReady, currentTimeMs, logSessionEvent]);

  const prevRuntimeStatusRef = useRef<string>("");
  useEffect(() => {
    if (!isReady) return;
    const status = mediaPipePoseRuntime.runtimeStatus;
    if (status !== prevRuntimeStatusRef.current) {
      logSessionEvent(SESSION_EVENTS.POSE_RUNTIME_STATUS_CHANGED, currentTimeMs, {
        status,
        provider: "camera_mediapipe",
      });
      prevRuntimeStatusRef.current = status;
    }
  }, [mediaPipePoseRuntime.runtimeStatus, isReady, currentTimeMs, logSessionEvent]);

  const prevGatesDisabledRef = useRef(false);
  useEffect(() => {
    if (!isReady) return;
    if (cameraGatesDisabled && !prevGatesDisabledRef.current) {
      logSessionEvent(SESSION_EVENTS.CAMERA_DISABLED_FOR_SESSION, currentTimeMs, {
        reason: "user_disabled_gates",
      });
    }
    prevGatesDisabledRef.current = cameraGatesDisabled;
  }, [cameraGatesDisabled, isReady, currentTimeMs, logSessionEvent]);

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
    getCueTypeFromCue,
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

  // ---------------------------------------------------------------------------
  // Early-return guards
  // ---------------------------------------------------------------------------

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
            <Link href={`/session/${params.videoId}/setup`}
              className="px-5 py-3 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold rounded-xl text-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400">
              Go to Session Setup
            </Link>
            <Link href="/video-library"
              className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm border border-slate-700 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400">
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
          <Link href="/video-library"
            className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm border border-slate-700 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400">
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
          <p className="text-sm text-slate-400 mb-2">Workout assistance preparation is not complete yet.</p>
          <p className="text-sm text-yellow-400 font-semibold bg-yellow-400/10 border border-yellow-400/20 px-3 py-1.5 rounded-full mb-6">
            Current Stage: {jobStage ? jobStage.replace(/_/g, " ") : "unknown"}
          </p>
          <Link href="/video-library"
            className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm border border-slate-700 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400">
            Back to Video Library
          </Link>
        </div>
      </PageWrapper>
    );
  }

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
            preferredCameraLabel={getCameraPreference()?.label}
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
