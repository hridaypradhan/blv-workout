import { describe, test, expect } from "vitest";
import {
  getExercisePoseProfile,
  SQUAT_PROFILE,
  BICEP_CURL_PROFILE,
  DEFAULT_PROFILE,
} from "../exercisePoseProfiles";
import { Exercise } from "@/types";

describe("exercisePoseProfiles resolution", () => {
  test("resolves squat profile for squat exercises", () => {
    const mockExercise: Exercise = {
      id: "ex-1",
      name: "Goblet Squats",
      start_time_seconds: 0,
      end_time_seconds: 30,
      counting_joint: "left_knee",
    };
    const profile = getExercisePoseProfile(mockExercise);
    expect(profile).toBe(SQUAT_PROFILE);
  });

  test("resolves bicep curl profile for curl exercises", () => {
    const mockExercise: Exercise = {
      id: "ex-2",
      name: "Hammer Bicep Curls",
      start_time_seconds: 0,
      end_time_seconds: 30,
      counting_joint: "right_elbow",
    };
    const profile = getExercisePoseProfile(mockExercise);
    expect(profile).toBe(BICEP_CURL_PROFILE);
  });

  test("resolves default profile for unknown exercises", () => {
    const mockExercise: Exercise = {
      id: "ex-3",
      name: "Jumping Jacks",
      start_time_seconds: 0,
      end_time_seconds: 30,
      counting_joint: "unknown",
    };
    const profile = getExercisePoseProfile(mockExercise);
    expect(profile).toBe(DEFAULT_PROFILE);
  });

  test("resolves squat profile for knee joint exercises regardless of name", () => {
    const mockExercise: Exercise = {
      id: "ex-4",
      name: "Custom Leg Press",
      start_time_seconds: 0,
      end_time_seconds: 30,
      counting_joint: "left_knee",
    };
    const profile = getExercisePoseProfile(mockExercise);
    expect(profile).toBe(SQUAT_PROFILE);
  });

  test("resolves bicep curl profile for elbow joint exercises regardless of name", () => {
    const mockExercise: Exercise = {
      id: "ex-5",
      name: "Custom Upper Body Pull",
      start_time_seconds: 0,
      end_time_seconds: 30,
      counting_joint: "right_elbow",
    };
    const profile = getExercisePoseProfile(mockExercise);
    expect(profile).toBe(BICEP_CURL_PROFILE);
  });

  test("resolves default profile for null exercise", () => {
    const profile = getExercisePoseProfile(null);
    expect(profile).toBe(DEFAULT_PROFILE);
  });
});
