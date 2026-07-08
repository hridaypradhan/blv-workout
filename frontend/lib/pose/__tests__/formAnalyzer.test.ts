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
});
