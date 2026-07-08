import { NormalizedLandmark } from "../hooks/useMediaPipePoseLandmarker";
import { ExercisePoseProfile } from "./exercisePoseProfiles";

export type SpecificPoseStatus =
  | "model_loading"
  | "camera_unavailable"
  | "body_not_detected"
  | "too_close"
  | "lower_body_missing"
  | "required_joints_missing"
  | "low_confidence"
  | "unsupported_exercise"
  | "mediapipe_active"
  | "prototype_fallback_active";

export interface PoseStatusDetails {
  status: SpecificPoseStatus;
  label: string;
  guidance: string;
}

/**
 * Computes specific pose status categories and movement cues based on the current camera runtime state.
 */
export function determineSpecificPoseStatus(params: {
  streamActive: boolean;
  runtimeStatus: "offline" | "initializing" | "active" | "unavailable" | "error";
  rawPoseLandmarks: NormalizedLandmark[] | null;
  landmarkConfidence: number;
  profile: ExercisePoseProfile;
  minVisibility?: number;
  minConfidence?: number;
  fallbackActive: boolean;
}): PoseStatusDetails {
  const {
    streamActive,
    runtimeStatus,
    rawPoseLandmarks,
    landmarkConfidence,
    profile,
    minVisibility = 0.5,
    minConfidence = 0.5,
    fallbackActive,
  } = params;

  // 1. Model Loading
  if (runtimeStatus === "initializing") {
    return {
      status: "model_loading",
      label: "Camera unavailable",
      guidance: "Loading MediaPipe model...",
    };
  }

  // 2. Camera Unavailable / Inactive
  if (!streamActive || runtimeStatus === "unavailable" || runtimeStatus === "offline" || runtimeStatus === "error") {
    return {
      status: "camera_unavailable",
      label: "Camera unavailable",
      guidance: fallbackActive
        ? "This exercise is using fallback tracking."
        : "Camera is offline or fallback simulation is active.",
    };
  }

  // 3. Unsupported Exercise
  if (!profile.supported) {
    return {
      status: "unsupported_exercise",
      label: "Prototype fallback active",
      guidance: "This exercise is using fallback tracking.",
    };
  }

  // 4. Body Not Detected (No landmarks)
  if (!rawPoseLandmarks || rawPoseLandmarks.length === 0) {
    return {
      status: "body_not_detected",
      label: "Camera visible but required joints missing",
      guidance: "Step back so your whole body is visible in the frame.",
    };
  }

  // 5. Low Confidence (Poor lighting / noise)
  if (landmarkConfidence < minConfidence) {
    return {
      status: "low_confidence",
      label: "Camera visible but required joints missing",
      guidance: "Move into brighter light.",
    };
  }

  // 6. Too Close (Body cropped check: if height is too large)
  const visLms = rawPoseLandmarks.filter(lm => (lm.visibility ?? 0) >= minVisibility);
  if (visLms.length > 0) {
    const ys = visLms.map(lm => lm.y);
    const boxHeight = Math.max(...ys) - Math.min(...ys);
    if (boxHeight > 0.88) {
      return {
        status: "too_close",
        label: "Camera visible but required joints missing",
        guidance: "You're too close. Take one step back.",
      };
    }
  }

  // 7. Check specific required landmarks for this exercise
  const requiredIndices = profile.requiredLandmarks;
  const missingIndices = requiredIndices.filter((idx) => {
    const lm = rawPoseLandmarks[idx];
    return !lm || (lm.visibility ?? 0) < minVisibility;
  });

  if (missingIndices.length > 0) {
    // Check if the exercise is a Squat profile and knees/ankles are missing
    const isSquat = profile.primaryJoints.includes("left_knee") || profile.primaryJoints.includes("right_knee");
    if (isSquat) {
      const kneesMissing = missingIndices.includes(25) || missingIndices.includes(26);
      const anklesMissing = missingIndices.includes(27) || missingIndices.includes(28);

      if (kneesMissing) {
        return {
          status: "lower_body_missing",
          label: "Camera visible but required joints missing",
          guidance: "Step back until your knees are visible.",
        };
      }
      if (anklesMissing) {
        return {
          status: "lower_body_missing",
          label: "Camera visible but required joints missing",
          guidance: "Tilt the camera lower so your ankles are visible.",
        };
      }
    }

    // Default required joints missing
    return {
      status: "required_joints_missing",
      label: "Camera visible but required joints missing",
      guidance: "Adjust camera so your active joints are in frame.",
    };
  }

  // 8. If fallback is active despite everything else
  if (fallbackActive) {
    return {
      status: "prototype_fallback_active",
      label: "Prototype fallback active",
      guidance: "This exercise is using fallback tracking.",
    };
  }

  // 9. MediaPipe Active
  return {
    status: "mediapipe_active",
    label: "Camera tracking active",
    guidance: "Real-time camera observation is active and tracking posture.",
  };
}
