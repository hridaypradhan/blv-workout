export type HapticLimb =
  | "left_arm"
  | "right_arm";

export type HapticCategory =
  | "start"
  | "finish"
  | "reps"
  | "speed_up"
  | "slow_down";

export type HapticProviderStatus =
  | "disabled"
  | "not_configured"
  | "sdk_unavailable"
  | "python_unsupported"
  | "player_unavailable"
  | "initialized_no_devices"
  | "partially_connected"
  | "connected"
  | "error";

export interface HapticDeviceStatus {
  key: string;
  name: string;
  position: number;
  connected: boolean;
  paired: boolean;
  battery: number | null;
  status_text: string;
  source: string;
}

export interface HapticStatusResponse {
  status: HapticProviderStatus;
  provider: string;
  hardware_available: boolean;
  player_available: boolean | null;
  devices: Record<string, HapticDeviceStatus>;
  details?: Record<string, unknown>;
}

export interface HapticPreferences {
  start?: string | null;
  finish?: string | null;
  reps?: string | null;
  speed_up?: string | null;
  slow_down?: string | null;
}

export interface HapticVibrationCandidate {
  id: string;
  cue_type: string;
  label: string;
  source_wav: string;
  filename: string;
  duration_ms: number;
  original_vibviz_id?: string | null;
  pleasantness_score?: number | null;
  pleasantness_band?: "high" | "low" | string | null;
  conversion_status: string;
  bhaptics_event_name?: string | null;
  provider_notes?: string | null;
}

export interface HapticEventMappingItem {
  cue_type: string;
  bhaptics_event_name: string;
  label: string;
  description: string;
}

export type SleeveSide = "left" | "right" | "both";

export interface HapticPattern {
  name: string;
  label: string;
  purpose: string;
  duration_ms: number;
  pulse_count: number;
  default_intensity: number;
  replace_with: string;
  metadata?: Record<string, unknown>;
}

export interface HapticTestResponse {
  success: boolean;
  sleeve_side: SleeveSide;
  message: string;
  source: string;
  provider: string;
  replace_with: string;
}

export interface HapticTriggerResponse {
  status: string;
  pattern_name?: string | null;
  sleeve_sides?: SleeveSide[] | null;
  intensity: number;
  source: string;
  provider: string;
  replace_with: string;
  cue_type?: string | null;
  selected_vibration_id?: string | null;
  selected_wav?: string | null;
  target_limbs?: HapticLimb[] | null;
  bhaptics_event_name?: string | null;
  delivery_mode?: "hardware" | "indicator" | "dry_run" | "failed" | null;
  hardware_available?: boolean;
  player_available?: boolean | null;
  request_id?: string | null;
  status_message?: string | null;
  resolved_cue_type?: string | null;
  target_positions?: string[] | null;
}
