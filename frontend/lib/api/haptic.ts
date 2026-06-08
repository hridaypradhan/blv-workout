import { plannedApiStub } from "./client";
import { HapticTestResponse, HapticTriggerResponse, SleeveSide } from "../../types";

// ============================================================================
// Planned API Surface - Haptic Sleeve Calibrations (Not wired to backend yet)
// ============================================================================

/** Trigger a test haptic pulse on a sleeve. */
export async function triggerHapticTest(sleeveSide: SleeveSide): Promise<HapticTestResponse> {
  console.log("Triggering test haptic pulse on sleeve:", sleeveSide);
  return plannedApiStub("triggerHapticTest");
}

/** Trigger a haptic feedback pattern on specific sleeves. */
export async function triggerHapticPattern(
  sleeveSides: SleeveSide[],
  patternName: string,
  intensity: number
): Promise<HapticTriggerResponse> {
  console.log("Triggering haptic pattern:", { sleeveSides, patternName, intensity });
  return plannedApiStub("triggerHapticPattern");
}

