import { API_BASE_URL, checkResponse } from "./client";
import { HapticTestResponse, HapticTriggerResponse, SleeveSide, HapticVibrationCandidate, HapticStatusResponse, HapticEventMappingItem } from "../../types";
import { devLogger } from "../logger";

// ============================================================================
// Wired API Surface - Haptic Sleeve Calibrations
// ============================================================================

/** Retrieve all haptic vibration candidates from the manifest. */
export async function getHapticVibrations(): Promise<HapticVibrationCandidate[]> {
  const res = await fetch(`${API_BASE_URL}/api/haptic/vibrations`);
  return checkResponse<HapticVibrationCandidate[]>(res, "Failed to get haptic vibrations");
}

/** Retrieve the canonical mapping of cue categories to neutral bHaptics event names. */
export async function getHapticEventMap(): Promise<HapticEventMappingItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/haptic/event-map`);
  return checkResponse<HapticEventMappingItem[]>(res, "Failed to get haptic event map");
}

/** Trigger a test haptic pulse on a sleeve. */
export async function triggerHapticTest(sleeveSide: SleeveSide): Promise<HapticTestResponse> {
  devLogger.log("Triggering test haptic pulse on sleeve:", sleeveSide);
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
  limbs?: string[],
  bhapticsEventName?: string
): Promise<HapticTriggerResponse> {
  devLogger.log("Triggering haptic pattern:", { sleeveSides, patternName, intensity, cueType, vibrationId, limbs, bhapticsEventName });
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
      bhaptics_event_name: bhapticsEventName,
    }),
  });
  return checkResponse<HapticTriggerResponse>(res, "Failed to trigger haptic pattern");
}

/** Retrieve the current connection and provider status. */
export async function getHapticStatus(): Promise<HapticStatusResponse> {
  const res = await fetch(`${API_BASE_URL}/api/haptic/status`);
  return checkResponse<HapticStatusResponse>(res, "Failed to get haptic status");
}

/** Reset and refresh the haptic provider connection status. */
export async function refreshHapticStatus(): Promise<unknown> {
  devLogger.log("Refreshing haptic status...");
  const res = await fetch(`${API_BASE_URL}/api/haptic/refresh`, {
    method: "POST",
  });
  return checkResponse<unknown>(res, "Failed to refresh haptic status");
}

/** Ping check to verify provider responsiveness. */
export async function pingHapticProvider(): Promise<unknown> {
  const res = await fetch(`${API_BASE_URL}/api/haptic/ping`, {
    method: "POST",
  });
  return checkResponse<unknown>(res, "Failed to ping haptic provider");
}

/**
 * Local fallback haptic event map.
 * This mirrors the backend event contract for offline resilience when the backend
 * event map endpoint is unreachable.
 */
export const DEFAULT_HAPTIC_EVENT_MAP: HapticEventMappingItem[] = [
  { cue_type: "start", bhaptics_event_name: "assist_start", label: "Session Start Cue", description: "Tactile vibration signifying the start of the workout or active phase." },
  { cue_type: "countdown", bhaptics_event_name: "assist_countdown", label: "Countdown Tick Cue", description: "Pulsing ticks counting down to the next movement or transition." },
  { cue_type: "per_rep_tick", bhaptics_event_name: "assist_rep_tick", label: "Repetition Tick Cue", description: "Short pulse delivered on each completed repetition." },
  { cue_type: "speed_up", bhaptics_event_name: "assist_speed_up", label: "Speed Up Cue", description: "Ascending tactile sweep indicating you should increase your movement speed." },
  { cue_type: "slow_down", bhaptics_event_name: "assist_slow_down", label: "Slow Down Cue", description: "Descending tactile sweep indicating you should decrease your movement speed." },
  { cue_type: "form_warning_above", bhaptics_event_name: "assist_form_warning_high", label: "Form Warning Cue", description: "Sharp warning buzz indicating joint/posture angle is too high." },
  { cue_type: "cooldown", bhaptics_event_name: "assist_cooldown", label: "Cooldown / Session End Cue", description: "Gentle, dissipating pattern signifying workout completion." }
];
