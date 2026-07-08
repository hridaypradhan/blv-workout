/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from "react";
import { SESSION_EVENTS } from "@/lib/sessionEvents";

export interface UseLivePositioningGateProps {
  isReady: boolean;
  manifest: any;
  currentExercise: any;
  currentTime: number;
  currentTimeMs: number;
  cameraStream: any;
  pauseCoordinator: any;
  logSessionEvent: (event: string, timestampMs: number, payload?: any) => void;
  announce: (msg: string) => void;
  handleSeek: (seconds: number, reason?: string) => void;
}

export function useLivePositioningGate({
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
}: UseLivePositioningGateProps) {
  const [isLiveGateOpen, setIsLiveGateOpen] = useState(false);
  const [liveGateExerciseName, setLiveGateExerciseName] = useState<string | null>(null);
  const [isLiveCountdownActive, setIsLiveCountdownActive] = useState(false);
  const [liveCancelCountdownTrigger, setLiveCancelCountdownTrigger] = useState(0);
  const [liveGuidance, setLiveGuidance] = useState("Position yourself in front of the camera.");

  const [exerciseGateStates, setExerciseGateStates] = useState<Record<string, "opened" | "skipped_user" | "skipped_camera" | "completed_camera">>({});
  const [cameraGatesDisabled, setCameraGatesDisabled] = useState(false);
  const [isManualRetryGate, setIsManualRetryGate] = useState(false);

  const lastGatedExerciseRef = useRef<string | null>(null);
  const lastGatedExerciseStartRef = useRef<number | null>(null);
  const lastProcessedExerciseRef = useRef<string | null>(null);

  // Reset gated exercise ref if seeking backward before its start time
  useEffect(() => {
    if (!manifest) return;
    setExerciseGateStates((prev) => {
      let changed = false;
      const next = { ...prev };
      manifest.exercise_timeline_anchors.forEach((anchor: any) => {
        const exerciseKey = anchor.id || `${anchor.name}:${anchor.start_time_seconds}:${anchor.end_time_seconds}`;
        if (next[exerciseKey] && currentTime < anchor.start_time_seconds - 2) {
          delete next[exerciseKey];
          changed = true;
          // Clear gated refs if it's the current exercise being cleared
          if (currentExercise) {
            const currentKey = currentExercise.id || `${currentExercise.name}:${currentExercise.start_time_seconds}:${currentExercise.end_time_seconds}`;
            if (currentKey === exerciseKey) {
              lastGatedExerciseRef.current = null;
              lastGatedExerciseStartRef.current = null;
              lastProcessedExerciseRef.current = null;
            }
          }
        }
      });
      return changed ? next : prev;
    });
  }, [currentTime, manifest, currentExercise]);

  const handleDisableCameraGates = React.useCallback(() => {
    logSessionEvent(SESSION_EVENTS.CAMERA_DISABLED_FOR_SESSION, currentTimeMs, {
      reason: "user_disabled_gates",
    });
    setCameraGatesDisabled(true);
    setIsLiveGateOpen(false);
    setIsManualRetryGate(false);
    cameraStream.stopCamera();
    pauseCoordinator.releasePause("positioning_gate", "Gates disabled for session");
    announce("Camera gates disabled for this session.");
  }, [currentTimeMs, logSessionEvent, pauseCoordinator, announce, cameraStream]);

  const handleSkipLiveGate = React.useCallback(() => {
    const isCameraUnavailable = !cameraStream.stream || cameraStream.status !== "ready";
    const statusType = isCameraUnavailable ? "skipped_camera" : "skipped_user";

    logSessionEvent(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, currentTimeMs, {
      command: "skip_alignment",
    });
    logSessionEvent(SESSION_EVENTS.POSITIONING_GATE_SKIPPED, currentTimeMs, {
      exerciseName: liveGateExerciseName,
      reason: isCameraUnavailable ? "camera_unavailable" : "user_manual_skip",
    });

    if (isCameraUnavailable) {
      logSessionEvent(SESSION_EVENTS.CAMERA_FALLBACK_USED, currentTimeMs, {
        exerciseName: liveGateExerciseName,
        reason: "camera_unavailable_on_gate_skip",
        provider: "prototype_pose",
      });
    }

    announce("Positioning gate skipped.");
    setIsLiveGateOpen(false);
    setIsManualRetryGate(false);

    if (currentExercise) {
      const exerciseKey = currentExercise.id || `${currentExercise.name}:${currentExercise.start_time_seconds}:${currentExercise.end_time_seconds}`;
      setExerciseGateStates((prev) => ({
        ...prev,
        [exerciseKey]: statusType,
      }));
      handleSeek(currentExercise.start_time_seconds, "Seeking to start of exercise.");
    }
    pauseCoordinator.releasePause("positioning_gate", "Gate skipped by user");
  }, [currentTimeMs, liveGateExerciseName, handleSeek, currentExercise, logSessionEvent, announce, pauseCoordinator, cameraStream.stream, cameraStream.status]);

  const handleCompleteLiveGate = React.useCallback(() => {
    logSessionEvent(SESSION_EVENTS.POSITIONING_GATE_COMPLETED, currentTimeMs, {
      exerciseName: liveGateExerciseName,
    });
    announce("Positioning gate completed. Resuming workout.");
    setIsLiveGateOpen(false);
    setIsManualRetryGate(false);

    if (currentExercise) {
      const exerciseKey = currentExercise.id || `${currentExercise.name}:${currentExercise.start_time_seconds}:${currentExercise.end_time_seconds}`;
      setExerciseGateStates((prev) => ({
        ...prev,
        [exerciseKey]: "completed_camera",
      }));
      handleSeek(currentExercise.start_time_seconds, "Seeking to start of exercise.");
    }
    pauseCoordinator.releasePause("positioning_gate", "Gate completed successfully");
  }, [currentTimeMs, liveGateExerciseName, handleSeek, currentExercise, logSessionEvent, announce, pauseCoordinator]);

  const isCameraReady = !!(cameraStream.status === "ready" && cameraStream.stream);

  // Synchronize gate state with current exercise and camera readiness
  useEffect(() => {
    if (!isReady || !manifest || !currentExercise || cameraGatesDisabled) {
      if (isLiveGateOpen) {
        setIsLiveGateOpen(false);
        setIsManualRetryGate(false);
        pauseCoordinator.releasePause("positioning_gate", "Gate closed automatically");
      }
      return;
    }

    const exerciseKey = currentExercise.id || `${currentExercise.name}:${currentExercise.start_time_seconds}:${currentExercise.end_time_seconds}`;
    const gateState = exerciseGateStates[exerciseKey];
    const isHandled = gateState === "skipped_user" || gateState === "skipped_camera" || gateState === "completed_camera";

    if (isHandled) {
      if (isLiveGateOpen) {
        setIsLiveGateOpen(false);
        setIsManualRetryGate(false);
        pauseCoordinator.releasePause("positioning_gate", "Gate closed after skip/complete");
      }
      return;
    }

    if (isCameraReady || isManualRetryGate) {
      if (!isLiveGateOpen) {
        setLiveGateExerciseName(currentExercise.name);
        setLiveGuidance(`Position yourself for ${currentExercise.name}.`);
        setIsLiveGateOpen(true);
        logSessionEvent(SESSION_EVENTS.POSITIONING_GATE_OPENED, currentTimeMs, {
          exerciseName: currentExercise.name,
        });
        pauseCoordinator.requestPause("positioning_gate", `Live gate opened for exercise: ${currentExercise.name}`);
      }
    } else {
      if (isLiveGateOpen) {
        // Stream lost while gate was open! Switch to soft fallback
        setIsLiveGateOpen(false);
        pauseCoordinator.releasePause("positioning_gate", "Stream lost, switching to soft fallback");
        logSessionEvent(SESSION_EVENTS.POSITIONING_GATE_SOFT_SKIPPED, currentTimeMs, {
          exerciseName: currentExercise.name,
          reason: "stream_lost",
        });
        setExerciseGateStates((prev) => ({
          ...prev,
          [exerciseKey]: "skipped_camera",
        }));
        announce("Camera stream lost. Continuing with simulated fallback tracking.");
      }
    }
  }, [
    isReady,
    manifest,
    currentExercise,
    cameraGatesDisabled,
    isCameraReady,
    isManualRetryGate,
    exerciseGateStates,
    isLiveGateOpen,
    pauseCoordinator,
    logSessionEvent,
    currentTimeMs,
    announce,
  ]);

  // Transition Monitor for Soft Bypassing when camera is not ready
  useEffect(() => {
    if (!isReady || !manifest || !currentExercise || cameraGatesDisabled) return;

    const exerciseKey = currentExercise.id || `${currentExercise.name}:${currentExercise.start_time_seconds}:${currentExercise.end_time_seconds}`;
    if (exerciseKey === lastProcessedExerciseRef.current) return;

    const gateState = exerciseGateStates[exerciseKey];
    if (gateState === "skipped_user" || gateState === "skipped_camera" || gateState === "completed_camera") {
      lastProcessedExerciseRef.current = exerciseKey;
      return;
    }

    if (!isCameraReady) {
      // Soft skip transition
      lastProcessedExerciseRef.current = exerciseKey;
      setExerciseGateStates((prev) => ({
        ...prev,
        [exerciseKey]: "skipped_camera",
      }));
      logSessionEvent(SESSION_EVENTS.POSITIONING_GATE_SOFT_SKIPPED, currentTimeMs, {
        exerciseName: currentExercise.name,
        reason: "camera_not_ready",
      });
      announce("Camera not ready. Continuing with simulated fallback tracking.");
    } else {
      lastProcessedExerciseRef.current = exerciseKey;
    }
  }, [
    isReady,
    manifest,
    currentExercise,
    cameraGatesDisabled,
    isCameraReady,
    exerciseGateStates,
    logSessionEvent,
    currentTimeMs,
    announce,
  ]);

  const handleRetryAlignment = React.useCallback(() => {
    if (!currentExercise) return;
    const exerciseKey = currentExercise.id || `${currentExercise.name}:${currentExercise.start_time_seconds}:${currentExercise.end_time_seconds}`;

    setExerciseGateStates((prev) => {
      const copy = { ...prev };
      delete copy[exerciseKey];
      return copy;
    });
    lastGatedExerciseRef.current = null;
    lastProcessedExerciseRef.current = null;

    setLiveGateExerciseName(currentExercise.name);
    setLiveGuidance(`Position yourself for ${currentExercise.name}.`);

    logSessionEvent(SESSION_EVENTS.POSITIONING_GATE_OPENED, currentTimeMs, {
      exerciseName: currentExercise.name,
      trigger: "user_retry_alignment",
    });

    setIsManualRetryGate(true);
    setIsLiveGateOpen(true);
    pauseCoordinator.requestPause("positioning_gate", `Live gate manually opened for exercise: ${currentExercise.name}`);

    cameraStream.requestCamera(cameraStream.selectedDeviceId, true).catch((err: any) => {
      console.error("Failed to request camera stream for retry alignment:", err);
    });
  }, [currentExercise, currentTimeMs, logSessionEvent, pauseCoordinator, cameraStream]);

  return {
    isLiveGateOpen,
    setIsLiveGateOpen,
    liveGateExerciseName,
    setLiveGateExerciseName,
    isLiveCountdownActive,
    setIsLiveCountdownActive,
    liveCancelCountdownTrigger,
    setLiveCancelCountdownTrigger,
    liveGuidance,
    setLiveGuidance,
    handleSkipLiveGate,
    handleCompleteLiveGate,
    cameraGatesDisabled,
    handleDisableCameraGates,
    setCameraGatesDisabled,
    exerciseGateStates,
    setExerciseGateStates,
    handleRetryAlignment,
  };
}
