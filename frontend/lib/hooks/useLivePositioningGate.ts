/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { SESSION_EVENTS } from "@/lib/sessionEvents";
import { useCameraAlignmentPolicy, GateType } from "./useCameraAlignmentPolicy";
import { CameraPoseRuntimeContract } from "./useMediaPipePoseRuntime";

export interface UseLivePositioningGateProps {
  isReady: boolean;
  manifest: any;
  currentExercise: any;
  currentTime: number;
  currentTimeMs: number;
  cameraStream: any;
  mediaPipePoseRuntime: CameraPoseRuntimeContract;
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
  mediaPipePoseRuntime,
  pauseCoordinator,
  logSessionEvent,
  announce,
  handleSeek,
}: UseLivePositioningGateProps) {
  const [liveGateExerciseName, setLiveGateExerciseName] = useState<string | null>(null);
  const [isLiveCountdownActive, setIsLiveCountdownActive] = useState(false);
  const [liveCancelCountdownTrigger, setLiveCancelCountdownTrigger] = useState(0);
  const [liveGuidance, setLiveGuidance] = useState("Position yourself in front of the camera.");

  const [cameraGatesDisabled, setCameraGatesDisabled] = useState(false);
  const [isManualRetryGate, setIsManualRetryGate] = useState(false);

  const clearManualRetry = useCallback(() => {
    setIsManualRetryGate(false);
  }, []);

  // Alignment Policy Layer
  const alignmentPolicy = useCameraAlignmentPolicy({
    isReady,
    manifest,
    currentExercise,
    currentTime,
    currentTimeMs,
    cameraStreamStatus: cameraStream.status,
    mediaPipeRuntimeStatus: mediaPipePoseRuntime.runtimeStatus,
    poseAvailable: mediaPipePoseRuntime.poseAvailable,
    requiredLandmarksVisible: mediaPipePoseRuntime.requiredLandmarksVisible,
    landmarkConfidence: mediaPipePoseRuntime.landmarkConfidence,
    cameraGatesDisabled,
    isManualRetryGate,
    onClearManualRetry: clearManualRetry,
  });

  const {
    shouldOpenHardGate,
    gateType,
    policyState,
    isSoftFallback,
    reason: policyReason,
    markPreWorkoutHandled,
    markExerciseCheckpointHandled,
    dismissRealignment,
  } = alignmentPolicy;

  const isLiveGateOpen = shouldOpenHardGate;

  // Exercise key helper
  const getExerciseKey = useCallback((ex: any): string | null => {
    if (!ex) return null;
    return ex.id || `${ex.name}:${ex.start_time_seconds}:${ex.end_time_seconds}`;
  }, []);

  const currentExerciseKey = getExerciseKey(currentExercise);
  const activeGateTypeRef = useRef<GateType>(null);

  // Synchronize pause coordinator with shouldOpenHardGate state
  const prevGateOpenRef = useRef(false);
  useEffect(() => {
    if (shouldOpenHardGate && !prevGateOpenRef.current) {
      prevGateOpenRef.current = true;
      activeGateTypeRef.current = gateType;
      const exName = currentExercise ? currentExercise.name : "Workout Setup";
      setLiveGateExerciseName(exName);
      setLiveGuidance(
        gateType === "mid_exercise_realign"
          ? `Realignment required for ${exName}. Re-center in camera view.`
          : `Position yourself for ${exName}.`
      );

      logSessionEvent(SESSION_EVENTS.POSITIONING_GATE_OPENED, currentTimeMs, {
        exerciseName: exName,
        gateType,
        trigger: isManualRetryGate ? "user_retry_alignment" : policyState,
      });

      pauseCoordinator.requestPause(
        "positioning_gate",
        `Camera gate opened (${gateType || "checkpoint"}) for ${exName}`
      );
    } else if (!shouldOpenHardGate && prevGateOpenRef.current) {
      prevGateOpenRef.current = false;
      pauseCoordinator.releasePause("positioning_gate", "Gate closed");
    }
  }, [
    shouldOpenHardGate,
    gateType,
    currentExercise,
    isManualRetryGate,
    policyState,
    currentTimeMs,
    logSessionEvent,
    pauseCoordinator,
  ]);

  const handleDisableCameraGates = useCallback(() => {
    setCameraGatesDisabled(true);
    setIsManualRetryGate(false);
    cameraStream.stopCamera();
    pauseCoordinator.releasePause("positioning_gate", "Gates disabled for session");
    announce("Camera gates disabled for this session.");
  }, [pauseCoordinator, announce, cameraStream]);

  const handleSkipLiveGate = useCallback(() => {
    const isCameraUnavailable = !cameraStream.stream || cameraStream.status !== "ready";
    const currentGateType = activeGateTypeRef.current || gateType || "pre_workout";

    logSessionEvent(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, currentTimeMs, {
      command: "skip_alignment",
    });
    logSessionEvent(SESSION_EVENTS.POSITIONING_GATE_SKIPPED, currentTimeMs, {
      exerciseName: liveGateExerciseName,
      gateType: currentGateType,
      reason: isCameraUnavailable ? "camera_unavailable" : "user_manual_skip",
    });

    if (isCameraUnavailable) {
      logSessionEvent(SESSION_EVENTS.CAMERA_FALLBACK_USED, currentTimeMs, {
        exerciseName: liveGateExerciseName,
        gateType: currentGateType,
        reason: "camera_unavailable_on_gate_skip",
        provider: "prototype_pose",
      });
    }

    announce("Positioning gate skipped.");
    setIsManualRetryGate(false);

    if (currentGateType === "pre_workout") {
      markPreWorkoutHandled("skipped");
    } else if (currentGateType === "pre_exercise" && currentExerciseKey) {
      markExerciseCheckpointHandled(currentExerciseKey, isCameraUnavailable ? "fallback" : "skipped");
      if (currentExercise) {
        handleSeek(currentExercise.start_time_seconds, "Seeking to start of exercise.");
      }
    } else if (currentGateType === "mid_exercise_realign") {
      dismissRealignment();
    }
  }, [
    cameraStream.stream,
    cameraStream.status,
    gateType,
    currentTimeMs,
    liveGateExerciseName,
    logSessionEvent,
    announce,
    currentExerciseKey,
    currentExercise,
    markPreWorkoutHandled,
    markExerciseCheckpointHandled,
    dismissRealignment,
    handleSeek,
  ]);

  const handleCompleteLiveGate = useCallback(() => {
    const currentGateType = activeGateTypeRef.current || gateType || "pre_workout";

    logSessionEvent(SESSION_EVENTS.POSITIONING_GATE_COMPLETED, currentTimeMs, {
      exerciseName: liveGateExerciseName,
      gateType: currentGateType,
    });
    announce("Positioning gate completed. Resuming workout.");
    setIsManualRetryGate(false);

    if (currentGateType === "pre_workout") {
      markPreWorkoutHandled("completed");
    } else if (currentGateType === "pre_exercise" && currentExerciseKey) {
      markExerciseCheckpointHandled(currentExerciseKey, "completed");
      if (currentExercise) {
        handleSeek(currentExercise.start_time_seconds, "Seeking to start of exercise.");
      }
    } else if (currentGateType === "mid_exercise_realign") {
      dismissRealignment();
    }
  }, [
    gateType,
    currentTimeMs,
    liveGateExerciseName,
    logSessionEvent,
    announce,
    currentExerciseKey,
    currentExercise,
    markPreWorkoutHandled,
    markExerciseCheckpointHandled,
    dismissRealignment,
    handleSeek,
  ]);

  const handleRetryAlignment = useCallback(() => {
    const exName = currentExercise ? currentExercise.name : "Workout Setup";
    setLiveGateExerciseName(exName);
    setLiveGuidance(`Position yourself for ${exName}.`);

    setIsManualRetryGate(true);
    cameraStream
      .requestCamera(cameraStream.selectedDeviceId, true)
      .catch((err: any) => {
        console.error("Failed to request camera stream for retry alignment:", err);
      });
  }, [currentExercise, cameraStream]);

  return {
    isLiveGateOpen,
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
    handleRetryAlignment,
    alignmentPolicy,
    policyState,
    isSoftFallback,
    policyReason,
    gateType: activeGateTypeRef.current || gateType,
  };
}
