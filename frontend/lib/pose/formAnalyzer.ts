import { Exercise, FormError } from "@/types";
import { ExercisePoseProfile } from "./exercisePoseProfiles";
import { resolveSide, jointLabel, ALIGNMENT_CUES } from "./jointAngles";

export type CorrectionKind =
  | "depth"
  | "pacing_fast"
  | "pacing_slow"
  | "position"
  | "symmetry"
  | "range";

export interface FormAnalysisExtraOptions {
  repTimingHistory?: number[]; // Timestamps in seconds of recent completed reps
  refRepDurationS?: number;    // Reference rep duration in seconds
  repsBehind?: number;         // Rep drift count
  calibratedRange?: [number, number]; // User's calibrated ROM [lo, hi]
  providerSource?: string;     // e.g. "camera_mediapipe" | "prototype_pose"
}

export const FORM_IMPORTANCE_WEIGHTS: Record<string, number> = {
  critical: 1.0,
  important: 0.6,
  minor: 0.3,
  ignore: 0.0,
};

/**
 * Pure utility function to analyze form errors for browser-local MediaPipe pose tracking.
 * Supports Maryam-style form categories (depth, pacing, position, symmetry, and range fallback).
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
  lastErrorTimePerJoint: Record<string, number> = {},
  options?: FormAnalysisExtraOptions
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

  const provider = options?.providerSource ?? "camera_mediapipe";

  // Throttling / deduping helper (10 seconds per joint or joint+kind)
  const isThrottled = (key: string): boolean => {
    const lastTime = lastErrorTimePerJoint[key];
    return lastTime !== undefined && currentTimeMs - lastTime < 10000;
  };

  // 4. Pacing Check (if rep timing history & reference rep duration available)
  if (
    options?.refRepDurationS &&
    options.refRepDurationS > 0 &&
    options.repTimingHistory &&
    options.repTimingHistory.length >= 2
  ) {
    const recent = options.repTimingHistory.slice(-3);
    const intervals: number[] = [];
    for (let i = 0; i < recent.length - 1; i++) {
      intervals.push(recent[i + 1] - recent[i]);
    }
    if (intervals.length > 0) {
      const avgDuration = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const ratio = avgDuration / options.refRepDurationS;
      const repsBehind = options.repsBehind ?? 0;

      // Fast pacing check
      if (ratio < 0.70 && repsBehind <= 0 && !isThrottled(activeJoint) && !isThrottled(`${activeJoint}:pacing_fast`)) {
        return {
          joint: activeJoint,
          observed_angle: currentAngles[activeJoint] ?? 0,
          expected_range: profile.acceptableRangeDefault,
          severity: "medium",
          message: "You're moving faster than the video; slow down and control each rep.",
          metadata: {
            correction_kind: "pacing_fast",
            offender_angle: activeJoint,
            offender_joint: jointLabel(activeJoint),
            provider,
          },
        };
      }

      // Slow pacing check
      if (ratio > 1.40 && repsBehind >= 2 && !isThrottled(activeJoint) && !isThrottled(`${activeJoint}:pacing_slow`)) {
        return {
          joint: activeJoint,
          observed_angle: currentAngles[activeJoint] ?? 0,
          expected_range: profile.acceptableRangeDefault,
          severity: "medium",
          message: repsBehind > 0 ? `You're ${repsBehind} reps behind the video; pick up the pace.` : "Pick up the pace a little.",
          metadata: {
            correction_kind: "pacing_slow",
            offender_angle: activeJoint,
            offender_joint: jointLabel(activeJoint),
            provider,
          },
        };
      }
    }
  }

  // 5. Rich Maryam-style Form Model Check (Position & Symmetry)
  if (exercise?.form_model) {
    const formModel = exercise.form_model;

    // A. Position check across weighted form_model angles
    let worstOffender: {
      angle: string;
      penalty: number;
      dev: number;
      tol: number;
      observed: number;
      target: [number, number];
    } | null = null;

    for (const [angleKey, spec] of Object.entries(formModel)) {
      const importance = spec.importance ?? "minor";
      if (importance === "ignore") continue;

      const weight = spec.weight ?? FORM_IMPORTANCE_WEIGHTS[importance] ?? 0.3;
      if (weight <= 0) continue;

      const observedVal = resolveSide(currentAngles, angleKey);
      if (observedVal === undefined || isNaN(observedVal)) continue;

      const range = exercise?.acceptable_ranges?.[angleKey] || profile.acceptableRangeDefault;
      const [minVal, maxVal] = range;
      const tol = Math.max(spec.tolerance_deg ?? 25, 5);

      let dev = 0;
      if (observedVal < minVal) {
        dev = minVal - observedVal;
      } else if (observedVal > maxVal) {
        dev = observedVal - maxVal;
      }

      const penalty = weight * (dev / tol);
      if (penalty >= 1.0) {
        if (!worstOffender || penalty > worstOffender.penalty) {
          worstOffender = {
            angle: angleKey,
            penalty,
            dev,
            tol,
            observed: observedVal,
            target: range,
          };
        }
      }
    }

    if (
      worstOffender &&
      !isThrottled(worstOffender.angle) &&
      !isThrottled(`${worstOffender.angle}:position`)
    ) {
      const offenderKey = worstOffender.angle;
      const label = jointLabel(offenderKey);
      const message = ALIGNMENT_CUES[offenderKey] || `Pay attention to your ${label}; it is out of position.`;

      let severity = "low";
      if (worstOffender.penalty >= 2.0) severity = "high";
      else if (worstOffender.penalty >= 1.4) severity = "medium";

      return {
        joint: offenderKey,
        observed_angle: worstOffender.observed,
        expected_range: worstOffender.target,
        severity,
        message,
        metadata: {
          correction_kind: "position",
          offender_angle: offenderKey,
          offender_joint: label,
          provider,
        },
      };
    }

    // B. Symmetry check for bilateral joint pairs
    const bilateralPairs: [string, string][] = [
      ["elbow_left", "elbow_right"],
      ["knee_left", "knee_right"],
      ["hip_left", "hip_right"],
      ["shoulder_left", "shoulder_right"],
    ];

    for (const [leftKey, rightKey] of bilateralPairs) {
      const leftVal = resolveSide(currentAngles, leftKey);
      const rightVal = resolveSide(currentAngles, rightKey);

      if (leftVal !== undefined && rightVal !== undefined && !isNaN(leftVal) && !isNaN(rightVal)) {
        const diff = Math.abs(leftVal - rightVal);
        const specL = formModel[leftKey] || formModel[rightKey];
        const tolL = specL?.tolerance_deg ?? 25;
        const symTol = Math.max(2.0 * tolL, 30);

        if (diff >= symTol && !isThrottled(leftKey) && !isThrottled(`${leftKey}:symmetry`)) {
          const label = jointLabel(leftKey);
          return {
            joint: leftKey,
            observed_angle: leftVal,
            expected_range: profile.acceptableRangeDefault,
            severity: diff > 45 ? "high" : "medium",
            message: `Even out your left and right ${label}; keep them matched.`,
            metadata: {
              correction_kind: "symmetry",
              offender_angle: leftKey,
              offender_joint: label,
              provider,
            },
          };
        }
      }
    }
  }

  // 6. Fallback Acceptable Ranges Check (when no form_model error fired or no form_model exists)
  const observed = currentAngles[activeJoint];
  if (observed === undefined || isNaN(observed)) {
    return null;
  }

  const range = exercise?.acceptable_ranges?.[activeJoint] || profile.acceptableRangeDefault;
  if (!range) {
    return null;
  }

  const [minVal, maxVal] = range;

  if (observed < minVal || observed > maxVal) {
    if (isThrottled(activeJoint) || isThrottled(`${activeJoint}:range`)) {
      return null;
    }

    const diff = observed < minVal ? minVal - observed : observed - maxVal;

    let severity = "low";
    if (diff > 20) {
      severity = "high";
    } else if (diff > 10) {
      severity = "medium";
    }

    const label = jointLabel(activeJoint);
    const message = `Observed ${label} angle (${observed.toFixed(0)}\u00b0) is outside range [${minVal}\u00b0, ${maxVal}\u00b0].`;

    return {
      joint: activeJoint,
      observed_angle: observed,
      expected_range: [minVal, maxVal],
      severity,
      message,
      metadata: {
        correction_kind: "range",
        offender_angle: activeJoint,
        offender_joint: label,
        provider,
      },
    };
  }

  return null;
}
