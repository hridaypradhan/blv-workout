import { ExercisePoseProfile } from "./exercisePoseProfiles";

export type RepState = "extended" | "contracted" | "returning";

export interface RepCounterState {
  state: RepState;
  repCount: number;
  lastRepTimeMs: number;
}

/**
 * Pure state machine transition function to update the rep counter state.
 * Models: extended (starting phase) -> contracted (flexed phase) -> returning (return phase) -> completed rep.
 */
export function updateRepCounter(
  currentState: RepCounterState,
  angle: number,
  profile: ExercisePoseProfile,
  currentTimeMs: number
): RepCounterState {
  const { state, repCount, lastRepTimeMs } = currentState;
  const { contractedThreshold, returningThreshold, extendedThreshold, cooldownMs } = profile;

  switch (state) {
    case "extended":
      // Flexing into bottom/contracted position
      if (angle <= contractedThreshold) {
        return {
          state: "contracted",
          repCount,
          lastRepTimeMs,
        };
      }
      break;

    case "contracted":
      // Extending back up towards returning or fully extended
      if (angle >= extendedThreshold) {
        const isOutsideCooldown = lastRepTimeMs === 0 || (currentTimeMs - lastRepTimeMs >= cooldownMs);
        return {
          state: "extended",
          repCount: isOutsideCooldown ? repCount + 1 : repCount,
          lastRepTimeMs: isOutsideCooldown ? currentTimeMs : lastRepTimeMs,
        };
      } else if (angle >= returningThreshold) {
        return {
          state: "returning",
          repCount,
          lastRepTimeMs,
        };
      }
      break;

    case "returning":
      // Fully returned to starting position, completes the repetition
      if (angle >= extendedThreshold) {
        const isOutsideCooldown = lastRepTimeMs === 0 || (currentTimeMs - lastRepTimeMs >= cooldownMs);
        return {
          state: "extended",
          repCount: isOutsideCooldown ? repCount + 1 : repCount,
          lastRepTimeMs: isOutsideCooldown ? currentTimeMs : lastRepTimeMs,
        };
      } else if (angle <= contractedThreshold) {
        // Handles double-bounce/reset back to bottom without completing the rep
        return {
          state: "contracted",
          repCount,
          lastRepTimeMs,
        };
      }
      break;
  }

  // Maintain current state if no thresholds are crossed
  return currentState;
}
