import { Exercise, FormError } from "@/types";
import { ExercisePoseProfile } from "./exercisePoseProfiles";

/**
 * Pure utility function to analyze form errors for browser-local MediaPipe pose tracking.
 * Returns a FormError object if an error is detected and cooldown constraints are met, otherwise null.
 */
export function analyzeForm(
  currentAngles: Record<string, number>,
  exercise: Exercise | null,
  profile: ExercisePoseProfile,
  poseAvailable: boolean,
  requiredLandmarksVisible: boolean,
  isPlaying: boolean,
  currentTimeMs: number,
  activeSide: "left" | "right",
  lastErrorTimePerJoint: Record<string, number> = {}
): FormError | null {
  // 1. Do not emit form warnings if playing is inactive, pose is unavailable, or required landmarks are not visible
  if (!isPlaying || !poseAvailable || !requiredLandmarksVisible) {
    return null;
  }

  // 2. Do not emit form warnings if the exercise profile is unsupported
  if (!profile.supported || !profile.primaryJoints || profile.primaryJoints.length === 0) {
    return null;
  }

  // 3. Resolve active joint connection based on target active side
  const leftJoint = profile.primaryJoints[0];
  const rightJoint = profile.primaryJoints[1];
  const activeJoint = activeSide === "left" ? leftJoint : (rightJoint || leftJoint);

  if (!activeJoint) {
    return null;
  }

  // 4. Retrieve observed joint angle
  const observed = currentAngles[activeJoint];
  if (observed === undefined || isNaN(observed)) {
    return null;
  }

  // 5. Determine expected acceptable range bounds (exercise manifest override or profile defaults)
  const range = exercise?.acceptable_ranges?.[activeJoint] || profile.acceptableRangeDefault;
  if (!range) {
    return null;
  }

  const [minVal, maxVal] = range;

  // 6. Check if observed value is within acceptable range tolerance bounds
  if (observed >= minVal && observed <= maxVal) {
    return null;
  }

  // 7. Enforce 10-second deduplication cooldown/throttle per joint connection target
  const lastErrorTime = lastErrorTimePerJoint[activeJoint];
  if (lastErrorTime !== undefined && currentTimeMs - lastErrorTime < 10000) {
    return null;
  }

  // 8. Compute deviation distance outside range
  const diff = observed < minVal ? minVal - observed : observed - maxVal;

  // 9. Map severity based on distance outside bounds
  let severity = "low";
  if (diff > 20) {
    severity = "high";
  } else if (diff > 10) {
    severity = "medium";
  }

  // 10. Formulate friendly a11y readable warning message
  const jointDisplay = activeJoint.replace(/_/g, " ");
  const message = `Observed ${jointDisplay} angle (${observed.toFixed(0)}\u00b0) is outside range [${minVal}\u00b0, ${maxVal}\u00b0].`;

  return {
    joint: activeJoint,
    observed_angle: observed,
    expected_range: [minVal, maxVal],
    severity,
    message,
  };
}
