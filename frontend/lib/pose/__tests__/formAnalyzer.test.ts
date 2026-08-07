import { describe, test, expect } from "vitest";
import { analyzeForm } from "../formAnalyzer";
import { SQUAT_PROFILE, BICEP_CURL_PROFILE, DEFAULT_PROFILE } from "../exercisePoseProfiles";
import { Exercise } from "@/types";

describe("formAnalyzer logic", () => {
  const mockExerciseSquat: Exercise = {
    id: "squat-1",
    name: "Bodyweight Squat",
    start_time_seconds: 0,
    end_time_seconds: 60,
    counting_joint: "left_knee",
  };

  const mockExerciseCurl: Exercise = {
    id: "curl-1",
    name: "Bicep Curls",
    start_time_seconds: 0,
    end_time_seconds: 60,
    counting_joint: "left_elbow",
    acceptable_ranges: {
      left_elbow: [50, 170],
    },
  };

  test("returns null if user is not playing", () => {
    const error = analyzeForm(
      { left_knee: 60 },
      mockExerciseSquat,
      SQUAT_PROFILE,
      true, // poseAvailable
      true, // requiredVisible
      false, // isPlaying
      1000,
      "left"
    );
    expect(error).toBeNull();
  });

  test("returns null if pose is unavailable or required landmarks not visible", () => {
    const err1 = analyzeForm(
      { left_knee: 60 },
      mockExerciseSquat,
      SQUAT_PROFILE,
      false, // poseAvailable
      true,
      true,
      1000,
      "left"
    );
    expect(err1).toBeNull();

    const err2 = analyzeForm(
      { left_knee: 60 },
      mockExerciseSquat,
      SQUAT_PROFILE,
      true,
      false, // requiredVisible
      true,
      1000,
      "left"
    );
    expect(err2).toBeNull();
  });

  test("returns null if exercise profile is unsupported", () => {
    const error = analyzeForm(
      { left_knee: 60 },
      { ...mockExerciseSquat, name: "Pushups" },
      DEFAULT_PROFILE,
      true,
      true,
      true,
      1000,
      "left"
    );
    expect(error).toBeNull();
  });

  test("returns null if angle is inside acceptable tolerance bounds", () => {
    const error = analyzeForm(
      { left_knee: 120 }, // default squat range is [75, 180], 120 is inside
      mockExerciseSquat,
      SQUAT_PROFILE,
      true,
      true,
      true,
      1000,
      "left"
    );
    expect(error).toBeNull();
  });

  test("returns FormError with correct severity when out of bounds using defaults", () => {
    // observed left_knee: 65, default squat range is [75, 180]
    // diff = 75 - 65 = 10 -> severity = low/medium boundary (diff <= 10 -> low)
    const errLow = analyzeForm(
      { left_knee: 65 },
      mockExerciseSquat,
      SQUAT_PROFILE,
      true,
      true,
      true,
      1000,
      "left"
    );
    expect(errLow).not.toBeNull();
    expect(errLow?.joint).toBe("left_knee");
    expect(errLow?.severity).toBe("low");
    expect(errLow?.observed_angle).toBe(65);

    // observed left_knee: 60, diff = 75 - 60 = 15 -> severity = medium
    const errMedium = analyzeForm(
      { left_knee: 60 },
      mockExerciseSquat,
      SQUAT_PROFILE,
      true,
      true,
      true,
      1000,
      "left"
    );
    expect(errMedium?.severity).toBe("medium");

    // observed left_knee: 50, diff = 75 - 50 = 25 -> severity = high
    const errHigh = analyzeForm(
      { left_knee: 50 },
      mockExerciseSquat,
      SQUAT_PROFILE,
      true,
      true,
      true,
      1000,
      "left"
    );
    expect(errHigh?.severity).toBe("high");
  });

  test("respects exercise specific acceptable_ranges overrides", () => {
    // left_elbow default curl range is [45, 180]
    // curl-1 override has left_elbow range: [50, 170]
    // An angle of 48 is inside default range ([45, 180]) but outside override ([50, 170])
    const error = analyzeForm(
      { left_elbow: 48 },
      mockExerciseCurl,
      BICEP_CURL_PROFILE,
      true,
      true,
      true,
      1000,
      "left"
    );
    expect(error).not.toBeNull();
    expect(error?.observed_angle).toBe(48);
    expect(error?.expected_range).toEqual([50, 170]);
  });

  test("enforces 10-second cooldown/deduplication per joint connection target", () => {
    const errorTimes: Record<string, number> = {
      left_knee: 1000,
    };

    // Attempting at 5000ms (within 10s cooldown since 1000ms error)
    const errInside = analyzeForm(
      { left_knee: 50 },
      mockExerciseSquat,
      SQUAT_PROFILE,
      true,
      true,
      true,
      5000,
      "left",
      errorTimes
    );
    expect(errInside).toBeNull();

    // Attempting at 12000ms (outside 10s cooldown since 1000ms error)
    const errOutside = analyzeForm(
      { left_knee: 50 },
      mockExerciseSquat,
      SQUAT_PROFILE,
      true,
      true,
      true,
      12000,
      "left",
      errorTimes
    );
    expect(errOutside).not.toBeNull();
    expect(errOutside?.observed_angle).toBe(50);
  });

  test("emits position warning with form_model and rich metadata", () => {
    const mockExerciseWithModel: Exercise = {
      ...mockExerciseSquat,
      form_model: {
        knee_left: { importance: "critical", weight: 1.0, tolerance_deg: 10 },
      },
      acceptable_ranges: {
        knee_left: [75, 180],
      },
    };

    // Knee at 40 degrees (out of range [75, 180], dev = 35, tol = 10, penalty = 3.5 >= 1.0)
    const err = analyzeForm(
      { knee_left: 40 },
      mockExerciseWithModel,
      SQUAT_PROFILE,
      true,
      true,
      true,
      1000,
      "left"
    );

    expect(err).not.toBeNull();
    expect(err?.metadata?.correction_kind).toBe("position");
    expect(err?.metadata?.offender_angle).toBe("knee_left");
    expect(err?.metadata?.provider).toBe("camera_mediapipe");
    expect(err?.message).toContain("out of position");
  });

  test("emits symmetry warning when left and right limbs diverge in bilateral exercise", () => {
    const mockExerciseWithBilateral: Exercise = {
      ...mockExerciseCurl,
      form_model: {
        elbow_left: { importance: "important", weight: 0.6, tolerance_deg: 15 },
        elbow_right: { importance: "important", weight: 0.6, tolerance_deg: 15 },
      },
    };

    // Left elbow at 90, Right elbow at 150 (diff = 60 >= 30 deg symTol)
    const err = analyzeForm(
      { elbow_left: 90, elbow_right: 150 },
      mockExerciseWithBilateral,
      BICEP_CURL_PROFILE,
      true,
      true,
      true,
      1000,
      "left"
    );

    expect(err).not.toBeNull();
    expect(err?.metadata?.correction_kind).toBe("symmetry");
    expect(err?.metadata?.offender_angle).toBe("elbow_left");
    expect(err?.message).toContain("Even out your left and right left elbow");
  });

  test("emits pacing_fast warning when user rep duration is too fast", () => {
    const err = analyzeForm(
      { left_elbow: 100 },
      mockExerciseCurl,
      BICEP_CURL_PROFILE,
      true,
      true,
      true,
      5000,
      "left",
      {},
      {
        repTimingHistory: [0, 1.0, 2.0], // 1 second per rep vs reference 3 seconds
        refRepDurationS: 3.0,
        repsBehind: 0,
      }
    );

    expect(err).not.toBeNull();
    expect(err?.metadata?.correction_kind).toBe("pacing_fast");
    expect(err?.message).toContain("moving faster than the video");
  });

  test("emits pacing_slow warning when user falls behind", () => {
    const err = analyzeForm(
      { left_elbow: 100 },
      mockExerciseCurl,
      BICEP_CURL_PROFILE,
      true,
      true,
      true,
      20000,
      "left",
      {},
      {
        repTimingHistory: [0, 5.0, 10.0], // 5 seconds per rep vs reference 2 seconds (ratio = 2.5 > 1.4)
        refRepDurationS: 2.0,
        repsBehind: 3,
      }
    );

    expect(err).not.toBeNull();
    expect(err?.metadata?.correction_kind).toBe("pacing_slow");
    expect(err?.message).toContain("3 reps behind");
  });
});
