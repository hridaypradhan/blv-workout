import { describe, test, expect } from "vitest";
import { buildRuntimeObservationContext } from "../liveSessionCameraStatus";
import { Exercise, FormError } from "@/types";

describe("liveSessionCameraStatus observation context builder", () => {
  const mockExercise: Exercise = {
    id: "squat-1",
    name: "Bodyweight Squat",
    start_time_seconds: 0,
    end_time_seconds: 60,
    counting_joint: "left_knee",
  };

  const mockFormError: FormError = {
    joint: "left_knee",
    observed_angle: 45,
    expected_range: [75, 180],
    severity: "high",
    message: "Go a bit deeper; bend your left knee further.",
    metadata: {
      correction_kind: "depth",
      offender_angle: "knee_left",
      offender_joint: "left knee",
      provider: "camera_mediapipe",
    },
  };

  test("includes latest_form_error with richer metadata when MediaPipe is reliable", () => {
    const ctx = buildRuntimeObservationContext({
      mediaPipePoseRuntime: {
        runtimeStatus: "active",
        poseAvailable: true,
        requiredLandmarksVisible: true,
        landmarkConfidence: 0.95,
        latestFormError: mockFormError,
        latestRepEvent: null,
      },
      currentExercise: mockExercise,
      isMediaPipeUsable: true,
    });

    expect(ctx.pose_available).toBe(true);
    expect(ctx.observation_capability).toBe("available");
    expect(ctx.latest_form_error).not.toBeNull();
    expect(ctx.latest_form_error?.joint).toBe("left_knee");
    expect(ctx.latest_form_error?.provider).toBe("camera_mediapipe");
    const metadata = ctx.latest_form_error?.metadata as Record<string, unknown> | undefined;
    expect(metadata?.correction_kind).toBe("depth");
    expect(metadata?.offender_angle).toBe("knee_left");
  });

  test("suppresses latest_form_error when MediaPipe is not reliable", () => {
    const ctx = buildRuntimeObservationContext({
      mediaPipePoseRuntime: {
        runtimeStatus: "active",
        poseAvailable: false, // Low confidence / not available
        requiredLandmarksVisible: false,
        landmarkConfidence: 0.2,
        latestFormError: mockFormError,
        latestRepEvent: null,
      },
      currentExercise: mockExercise,
      isMediaPipeUsable: true,
    });

    expect(ctx.pose_available).toBe(false);
    expect(ctx.observation_capability).toBe("low_confidence");
    expect(ctx.latest_form_error).toBeNull(); // Must be null when unreliable!
  });
});
