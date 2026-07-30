/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Exercise } from "@/types";
import { CameraStreamStatus } from "./useCameraStream";
import { PoseRuntimeStatus } from "@/lib/pose/poseRuntimeTypes";
import { getExercisePoseProfile } from "@/lib/pose/exercisePoseProfiles";

export type AlignmentPolicyState =
  | "pre_workout_required"
  | "pre_exercise_required"
  | "aligned"
  | "monitoring"
  | "low_confidence_warning"
  | "mid_exercise_realign_required"
  | "fallback_active"
  | "camera_disabled";

export type GateType = "pre_workout" | "pre_exercise" | "mid_exercise_realign" | null;

export interface UseCameraAlignmentPolicyProps {
  isReady: boolean;
  manifest: any;
  currentExercise: Exercise | null;
  currentTime: number;
  currentTimeMs: number;
  cameraStreamStatus: CameraStreamStatus;
  mediaPipeRuntimeStatus: PoseRuntimeStatus;
  poseAvailable: boolean;
  requiredLandmarksVisible: boolean;
  landmarkConfidence: number;
  cameraGatesDisabled: boolean;
  isManualRetryGate?: boolean;
  onClearManualRetry?: () => void;
}

const LOW_CONFIDENCE_WARNING_MS = 3000;
const REALIGNMENT_REQUIRED_MS = 5000;
const REALIGNMENT_COOLDOWN_MS = 15000;

type CheckpointStatus = "completed" | "skipped" | "fallback";

function getExerciseKey(ex: Exercise | null): string | null {
  if (!ex) return null;
  return ex.id || `${ex.name}:${ex.start_time_seconds}:${ex.end_time_seconds}`;
}

export function useCameraAlignmentPolicy({
  isReady,
  manifest,
  currentExercise,
  currentTime,
  currentTimeMs,
  cameraStreamStatus,
  mediaPipeRuntimeStatus,
  poseAvailable,
  requiredLandmarksVisible,
  landmarkConfidence,
  cameraGatesDisabled,
  isManualRetryGate = false,
  onClearManualRetry,
}: UseCameraAlignmentPolicyProps) {
  const [preWorkoutHandled, setPreWorkoutHandled] = useState(false);
  const [handledCheckpoints, setHandledCheckpoints] = useState<Record<string, CheckpointStatus>>({});
  const [realignmentCooldowns, setRealignmentCooldowns] = useState<Record<string, number>>({});

  const lossStartTimeRef = useRef<number | null>(null);
  const [lossDurationMs, setLossDurationMs] = useState(0);

  const currentExerciseKey = getExerciseKey(currentExercise);
  const currentProfile = useMemo(
    () => getExercisePoseProfile(currentExercise),
    [currentExercise]
  );

  // Reset handled checkpoints when seeking backward before exercise start
  useEffect(() => {
    if (!manifest || !manifest.exercise_timeline_anchors) return;
    setHandledCheckpoints((prev) => {
      let changed = false;
      const next = { ...prev };
      manifest.exercise_timeline_anchors.forEach((anchor: any) => {
        const key = anchor.id || `${anchor.name}:${anchor.start_time_seconds}:${anchor.end_time_seconds}`;
        if (next[key] && currentTime < anchor.start_time_seconds - 2) {
          delete next[key];
          changed = true;
        }
      });
      return changed ? next : prev;
    });

  }, [currentTime, manifest]);

  // Monitor sustained loss duration during exercise
  useEffect(() => {
    const isExerciseActive = !!currentExercise;
    const isCameraReady = cameraStreamStatus === "ready";
    const isMediaPipeActive = mediaPipeRuntimeStatus === "active";
    const isWellPositioned = poseAvailable && requiredLandmarksVisible;

    if (!isExerciseActive || !currentProfile.supported || cameraGatesDisabled) {
      lossStartTimeRef.current = null;
      setLossDurationMs(0);
      return;
    }

    if (isCameraReady && isMediaPipeActive && isWellPositioned) {
      lossStartTimeRef.current = null;
      setLossDurationMs(0);
    } else if (isCameraReady && isMediaPipeActive && !isWellPositioned) {
      if (lossStartTimeRef.current === null) {
        lossStartTimeRef.current = currentTimeMs;
        setLossDurationMs(0);
      } else {
        const elapsed = Math.max(0, currentTimeMs - lossStartTimeRef.current);
        setLossDurationMs(elapsed);
      }
    } else {
      // Camera or MediaPipe lost during active exercise
      if (lossStartTimeRef.current === null) {
        lossStartTimeRef.current = currentTimeMs;
        setLossDurationMs(0);
      } else {
        const elapsed = Math.max(0, currentTimeMs - lossStartTimeRef.current);
        setLossDurationMs(elapsed);
      }
    }
  }, [
    currentExercise,
    currentProfile.supported,
    cameraGatesDisabled,
    cameraStreamStatus,
    mediaPipeRuntimeStatus,
    poseAvailable,
    requiredLandmarksVisible,
    currentTimeMs,
  ]);

  // Reset loss tracking when exercise changes
  const lastExerciseKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (currentExerciseKey !== lastExerciseKeyRef.current) {
      lastExerciseKeyRef.current = currentExerciseKey;
      lossStartTimeRef.current = null;
      setLossDurationMs(0);
    }
  }, [currentExerciseKey]);

  // Calculate Policy State
  const { policyState, gateType, shouldOpenHardGate, isSoftFallback, reason } = useMemo(() => {
    if (cameraGatesDisabled) {
      return {
        policyState: "camera_disabled" as AlignmentPolicyState,
        gateType: null as GateType,
        shouldOpenHardGate: false,
        isSoftFallback: true,
        reason: "Camera gates disabled for session.",
      };
    }

    if (isManualRetryGate) {
      return {
        policyState: "pre_exercise_required" as AlignmentPolicyState,
        gateType: (currentExercise ? "pre_exercise" : "pre_workout") as GateType,
        shouldOpenHardGate: true,
        isSoftFallback: false,
        reason: "User requested manual alignment retry.",
      };
    }

    // 1. Pre-workout checkpoint
    if (!preWorkoutHandled && isReady) {
      const isCameraAvailable = cameraStreamStatus === "ready";
      if (!isCameraAvailable && cameraStreamStatus !== "requesting" && cameraStreamStatus !== "idle") {
        return {
          policyState: "fallback_active" as AlignmentPolicyState,
          gateType: null as GateType,
          shouldOpenHardGate: false,
          isSoftFallback: true,
          reason: "Camera unavailable pre-workout. Using fallback tracking.",
        };
      }
      return {
        policyState: "pre_workout_required" as AlignmentPolicyState,
        gateType: "pre_workout" as GateType,
        shouldOpenHardGate: true,
        isSoftFallback: false,
        reason: "Pre-workout camera framing confirmation required.",
      };
    }

    // 2. Pre-exercise checkpoint for supported exercises
    if (currentExercise && currentExerciseKey) {
      const isHandled = !!handledCheckpoints[currentExerciseKey];
      if (!isHandled && currentProfile.supported) {
        if (cameraStreamStatus !== "ready") {
          // Camera not ready for pre-exercise -> soft fallback, do not hard-gate!
          return {
            policyState: "fallback_active" as AlignmentPolicyState,
            gateType: null as GateType,
            shouldOpenHardGate: false,
            isSoftFallback: true,
            reason: "Camera unavailable for pre-exercise checkpoint. Using fallback tracking.",
          };
        }
        return {
          policyState: "pre_exercise_required" as AlignmentPolicyState,
          gateType: "pre_exercise" as GateType,
          shouldOpenHardGate: true,
          isSoftFallback: false,
          reason: `Pre-exercise checkpoint required for ${currentExercise.name}.`,
        };
      }
    }

    // 3. During exercise monitoring & sustained loss
    if (currentExercise && currentProfile.supported) {
      const isCameraReady = cameraStreamStatus === "ready";
      const isMediaPipeActive = mediaPipeRuntimeStatus === "active";

      if (!isCameraReady || !isMediaPipeActive) {
        return {
          policyState: "fallback_active" as AlignmentPolicyState,
          gateType: null as GateType,
          shouldOpenHardGate: false,
          isSoftFallback: true,
          reason: "Camera stream or pose runtime unavailable. Using fallback tracking.",
        };
      }

      if (poseAvailable && requiredLandmarksVisible) {
        return {
          policyState: "aligned" as AlignmentPolicyState,
          gateType: null as GateType,
          shouldOpenHardGate: false,
          isSoftFallback: false,
          reason: "Pose aligned and all required joints visible.",
        };
      }

      // Check sustained loss thresholds
      const nextAllowedAt = currentExerciseKey ? realignmentCooldowns[currentExerciseKey] || 0 : 0;
      const isInCooldown = currentTimeMs < nextAllowedAt;
      if (lossDurationMs >= REALIGNMENT_REQUIRED_MS && !isInCooldown) {
        return {
          policyState: "mid_exercise_realign_required" as AlignmentPolicyState,
          gateType: "mid_exercise_realign" as GateType,
          shouldOpenHardGate: true,
          isSoftFallback: false,
          reason: "Sustained pose loss (>5s) during active exercise.",
        };
      }

      if (lossDurationMs >= LOW_CONFIDENCE_WARNING_MS) {
        return {
          policyState: "low_confidence_warning" as AlignmentPolicyState,
          gateType: null as GateType,
          shouldOpenHardGate: false,
          isSoftFallback: false,
          reason: "Low confidence or partial landmark loss detected.",
        };
      }

      return {
        policyState: "monitoring" as AlignmentPolicyState,
        gateType: null as GateType,
        shouldOpenHardGate: false,
        isSoftFallback: false,
        reason: "Monitoring posture.",
      };
    }

    // Unsupported exercise or idle playback
    return {
      policyState: "fallback_active" as AlignmentPolicyState,
      gateType: null as GateType,
      shouldOpenHardGate: false,
      isSoftFallback: true,
      reason: currentExercise
        ? `Pose tracking not supported for ${currentExercise.name}. Using fallback tracking.`
        : "Session active.",
    };
  }, [
    cameraGatesDisabled,
    isManualRetryGate,
    preWorkoutHandled,
    isReady,
    cameraStreamStatus,
    currentExercise,
    currentExerciseKey,
    handledCheckpoints,
    currentProfile.supported,
    mediaPipeRuntimeStatus,
    poseAvailable,
    requiredLandmarksVisible,
    lossDurationMs,
    currentTimeMs,
    realignmentCooldowns,
  ]);

  const markPreWorkoutHandled = useCallback((status: CheckpointStatus = "completed") => {
    setPreWorkoutHandled(true);
    if (onClearManualRetry) onClearManualRetry();
  }, [onClearManualRetry]);

  const markExerciseCheckpointHandled = useCallback(
    (exerciseKey: string, status: CheckpointStatus = "completed") => {
      setHandledCheckpoints((prev) => ({
        ...prev,
        [exerciseKey]: status,
      }));
      setPreWorkoutHandled(true); // Completing an exercise checkpoint implies pre-workout is also handled
      if (onClearManualRetry) onClearManualRetry();
    },
    [onClearManualRetry]
  );

  const dismissRealignment = useCallback(() => {
    if (currentExerciseKey) {
      setRealignmentCooldowns((prev) => ({
        ...prev,
        [currentExerciseKey]: currentTimeMs + REALIGNMENT_COOLDOWN_MS,
      }));
    }
    lossStartTimeRef.current = currentTimeMs;
    setLossDurationMs(0);
    if (onClearManualRetry) onClearManualRetry();
  }, [currentExerciseKey, currentTimeMs, onClearManualRetry]);

  return {
    policyState,
    gateType,
    shouldOpenHardGate,
    isSoftFallback,
    reason,
    preWorkoutHandled,
    handledCheckpoints,
    lossDurationMs,
    realignmentCooldowns,
    markPreWorkoutHandled,
    markExerciseCheckpointHandled,
    dismissRealignment,
  };
}
