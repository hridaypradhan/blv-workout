import { Exercise } from "@/types";

export interface ExercisePoseProfile {
  primaryJoints: string[];
  requiredLandmarks: number[];
  extendedThreshold: number;
  contractedThreshold: number;
  returningThreshold: number;
  minVisibility: number;
  cooldownMs: number;
  supported: boolean;
  acceptableRangeDefault: [number, number];
}

export const SQUAT_PROFILE: ExercisePoseProfile = {
  primaryJoints: ["left_knee", "right_knee"],
  requiredLandmarks: [23, 24, 25, 26, 27, 28], // Hip, Knee, Ankle landmarks for both sides
  extendedThreshold: 160,      // extended/standing position
  contractedThreshold: 100,    // deep squat bottom position
  returningThreshold: 130,     // midpoint during return extension
  minVisibility: 0.5,
  cooldownMs: 1500,
  supported: true,
  acceptableRangeDefault: [75, 180],
};

export const BICEP_CURL_PROFILE: ExercisePoseProfile = {
  primaryJoints: ["left_elbow", "right_elbow"],
  requiredLandmarks: [11, 12, 13, 14, 15, 16], // Shoulder, Elbow, Wrist landmarks for both sides
  extendedThreshold: 150,      // arms fully straight
  contractedThreshold: 60,     // arms fully flexed at top
  returningThreshold: 100,     // midpoint during return extension
  minVisibility: 0.5,
  cooldownMs: 1500,
  supported: true,
  acceptableRangeDefault: [45, 180],
};

export const DEFAULT_PROFILE: ExercisePoseProfile = {
  primaryJoints: [],
  requiredLandmarks: [11, 12, 23, 24], // Shoulders and hips baseline orientation landmarks
  extendedThreshold: 180,
  contractedThreshold: 0,
  returningThreshold: 90,
  minVisibility: 0.5,
  cooldownMs: 1500,
  supported: false,
  acceptableRangeDefault: [75, 180],
};

/**
 * Resolves an exercise timeline anchor/exercise into its corresponding target pose profile.
 */
export function getExercisePoseProfile(exercise: Exercise | null): ExercisePoseProfile {
  if (!exercise) {
    return DEFAULT_PROFILE;
  }
  const name = exercise.name?.toLowerCase() || "";
  const joint = exercise.counting_joint?.toLowerCase() || "";
  if (name.includes("squat") || joint.includes("knee")) {
    return SQUAT_PROFILE;
  }
  if (name.includes("curl") || joint.includes("elbow")) {
    return BICEP_CURL_PROFILE;
  }
  return DEFAULT_PROFILE;
}
