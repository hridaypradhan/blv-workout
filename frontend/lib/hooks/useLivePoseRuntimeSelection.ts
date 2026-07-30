"use client";

import React from "react";
import { Exercise } from "@/types";
import { getExercisePoseProfile } from "@/lib/pose/exercisePoseProfiles";
import { PoseRuntimeContract } from "@/lib/pose/poseRuntimeTypes";
import { CameraPoseRuntimeContract } from "@/lib/hooks/useMediaPipePoseRuntime";

interface UseLivePoseRuntimeSelectionProps {
  prototypePoseRuntime: PoseRuntimeContract;
  mediaPipePoseRuntime: CameraPoseRuntimeContract;
  currentExercise: Exercise | null;
  cameraGatesDisabled: boolean;
}

export function useLivePoseRuntimeSelection({
  prototypePoseRuntime,
  mediaPipePoseRuntime,
  currentExercise,
  cameraGatesDisabled,
}: UseLivePoseRuntimeSelectionProps) {
  const isMediaPipeUsable = React.useMemo(() => {
    if (cameraGatesDisabled) return false;
    if (!mediaPipePoseRuntime.isReady) return false;
    if (mediaPipePoseRuntime.runtimeStatus !== "active") return false;
    if (!mediaPipePoseRuntime.poseAvailable) return false;
    if (!mediaPipePoseRuntime.requiredLandmarksVisible) return false;

    return getExercisePoseProfile(currentExercise).supported;
  }, [
    cameraGatesDisabled,
    currentExercise,
    mediaPipePoseRuntime.isReady,
    mediaPipePoseRuntime.poseAvailable,
    mediaPipePoseRuntime.requiredLandmarksVisible,
    mediaPipePoseRuntime.runtimeStatus,
  ]);

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

  const activePoseProvider: "camera_mediapipe" | "prototype_pose" = isMediaPipeUsable
    ? "camera_mediapipe"
    : "prototype_pose";
  const activePoseRuntime = isMediaPipeUsable ? mediaPipePoseRuntime : prototypePoseRuntime;

  return {
    prototypePoseRuntime,
    mediaPipePoseRuntime,
    isMediaPipeUsable,
    fallbackReason,
    activePoseProvider,
    activePoseRuntime,
  };
}
