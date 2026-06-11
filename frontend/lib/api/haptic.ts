import { API_BASE_URL, checkResponse } from "./client";
import { HapticPattern, HapticTestResponse, HapticTriggerResponse, SleeveSide, HapticVibrationCandidate } from "../../types";

// ============================================================================
// Wired API Surface - Haptic Sleeve Calibrations
// ============================================================================

/** Retrieve the complete haptic pattern library from the backend. */
export async function getHapticPatterns(): Promise<Record<string, HapticPattern>> {
  const res = await fetch(`${API_BASE_URL}/api/haptic/patterns`);
  return checkResponse<Record<string, HapticPattern>>(res, "Failed to get haptic patterns");
}

/** Retrieve all haptic vibration candidates from the manifest. */
export async function getHapticVibrations(): Promise<HapticVibrationCandidate[]> {
  const res = await fetch(`${API_BASE_URL}/api/haptic/vibrations`);
  return checkResponse<HapticVibrationCandidate[]>(res, "Failed to get haptic vibrations");
}

/** Trigger a test haptic pulse on a sleeve. */
export async function triggerHapticTest(sleeveSide: SleeveSide): Promise<HapticTestResponse> {
  console.log("Triggering test haptic pulse on sleeve:", sleeveSide);
  const res = await fetch(`${API_BASE_URL}/api/haptic/test`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sleeve_side: sleeveSide }),
  });
  return checkResponse<HapticTestResponse>(res, "Failed to trigger haptic test");
}

/** Trigger a haptic feedback pattern on specific sleeves. */
export async function triggerHapticPattern(
  sleeveSides: SleeveSide[] | null,
  patternName: string | null,
  intensity: number,
  cueType?: string,
  vibrationId?: string,
  limbs?: string[]
): Promise<HapticTriggerResponse> {
  console.log("Triggering haptic pattern:", { sleeveSides, patternName, intensity, cueType, vibrationId, limbs });
  const res = await fetch(`${API_BASE_URL}/api/haptic/trigger`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sleeve_sides: sleeveSides,
      pattern_name: patternName,
      intensity,
      cue_type: cueType,
      vibration_id: vibrationId,
      limbs,
    }),
  });
  return checkResponse<HapticTriggerResponse>(res, "Failed to trigger haptic pattern");
}
