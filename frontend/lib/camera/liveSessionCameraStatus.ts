"use client";

import { Exercise, FormError, RepEvent } from "@/types";
import { isIntegratedCameraLabel } from "@/lib/camera/cameraDeviceSelection";
import { getExercisePoseProfile } from "@/lib/pose/exercisePoseProfiles";

interface MediaPipePoseRuntimeSnapshot {
  runtimeStatus: string;
  poseAvailable: boolean;
  requiredLandmarksVisible: boolean;
  landmarkConfidence: number;
  latestFormError: FormError | null;
  latestRepEvent: RepEvent | null;
}

export interface RuntimeObservationSnapshot {
  pose_available: boolean;
  pose_confidence: number | null;
  observation_capability: "not_available" | "available" | "low_confidence";
  latest_form_error: Record<string, unknown> | null;
  latest_rep_event: Record<string, unknown> | null;
  notes?: string | null;
}

export function describeCameraKind(label: string, preferenceLabel?: string) {
  const isIntegrated = isIntegratedCameraLabel(label);
  const preferenceWasExternal =
    Boolean(preferenceLabel) && !isIntegratedCameraLabel(preferenceLabel || "");

  return {
    isIntegrated,
    preferenceWasExternal,
  };
}

export function buildRuntimeObservationContext({
  mediaPipePoseRuntime,
  currentExercise,
  isMediaPipeUsable,
}: {
  mediaPipePoseRuntime: MediaPipePoseRuntimeSnapshot;
  currentExercise: Exercise | null;
  isMediaPipeUsable: boolean;
}): RuntimeObservationSnapshot {
  const mediaPipeActive = mediaPipePoseRuntime.runtimeStatus === "active";
  const poseAvailable = mediaPipePoseRuntime.poseAvailable;
  const landmarksVisible = mediaPipePoseRuntime.requiredLandmarksVisible;
  const exerciseSupported = getExercisePoseProfile(currentExercise).supported;

  let observationCapability: RuntimeObservationSnapshot["observation_capability"] =
    "not_available";
  let notes =
    "Camera is offline or fallback simulation is active. The assistant cannot see you.";
  let reliablePoseAvailable = false;

  if (isMediaPipeUsable && poseAvailable && landmarksVisible) {
    reliablePoseAvailable = true;
    observationCapability = "available";
    notes =
      "Real-time camera observation using browser-local MediaPipe is active and reliable.";
  } else if (mediaPipeActive && (!poseAvailable || !landmarksVisible)) {
    observationCapability = "low_confidence";
    notes =
      "Camera is present and active, but posture detection confidence is low or required joints are obscured.";
  } else if (!exerciseSupported && currentExercise) {
    notes = `Pose tracking is not supported for exercise: ${currentExercise.name}. Falling back to prototype simulation.`;
  } else if (mediaPipePoseRuntime.runtimeStatus === "initializing") {
    notes = "Camera pose tracking is initializing (loading model).";
  }

  return {
    pose_available: reliablePoseAvailable,
    pose_confidence: mediaPipeActive ? mediaPipePoseRuntime.landmarkConfidence : null,
    observation_capability: observationCapability,
    latest_form_error:
      reliablePoseAvailable && mediaPipePoseRuntime.latestFormError
        ? {
            ...mediaPipePoseRuntime.latestFormError,
            provider: "camera_mediapipe",
          } as Record<string, unknown>
        : null,
    latest_rep_event:
      reliablePoseAvailable && mediaPipePoseRuntime.latestRepEvent
        ? {
            rep_count: mediaPipePoseRuntime.latestRepEvent.rep_count,
            exercise_id: mediaPipePoseRuntime.latestRepEvent.exercise_id,
            provider: "camera_mediapipe",
          } as Record<string, unknown>
        : null,
    notes,
  };
}
