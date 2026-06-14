export enum AssistantPersona {
  SUPPORTIVE = "supportive",
  DIRECT = "direct",
  ENERGETIC = "energetic",
  CALM = "calm",
}

// Backward compatibility alias
export type CoachPersona = AssistantPersona;
export const CoachPersona = {
  HYPE: AssistantPersona.ENERGETIC,
  TECHNICAL: AssistantPersona.DIRECT,
  SUPPORTIVE: AssistantPersona.SUPPORTIVE,
};

export enum ProcessingStage {
  SUBMITTED = "submitted",
  FETCHING_METADATA = "fetching_metadata",
  TRANSCRIBING = "transcribing",
  ANCHORING_TIMELINE = "anchoring_timeline",
  CLASSIFYING_TRAINER_INSTRUCTIONS = "classifying_trainer_instructions",
  ANALYZING_MOVEMENT_WINDOWS = "analyzing_movement_windows",
  GENERATING_SIDECAR_MANIFEST = "generating_sidecar_manifest",
  COMPLETED = "completed",
  FAILED = "failed",
}

export interface AssistanceJob {
  video_id: string;
  youtube_url: string;
  stage: ProcessingStage;
  error?: string | null;
  title?: string | null;
  duration?: number | null;
  youtube_id?: string | null;
  channel_name?: string | null;
  thumbnail_url?: string | null;
  created_at?: string | null;
  sidecar_provider?: string | null;
  sidecar_fallback_reason?: string | null;
  caption_status?: string | null;
}

// Backward compatibility alias
export type ImportJob = AssistanceJob;

export interface SleeveStatus {
  leftArm: boolean;
  rightArm: boolean;
  leftLeg: boolean;
  rightLeg: boolean;
}

export enum FeedbackModality {
  AUDIO = "audio",
  HAPTIC = "haptic",
  VISUAL = "visual",
}

export type HapticLimb = "left_arm" | "right_arm" | "left_leg" | "right_leg";

export interface HapticPreferences {
  start?: string | null;
  countdown?: string | null;
  per_rep_tick?: string | null;
  speed_up?: string | null;
  slow_down?: string | null;
  form_warning_above?: string | null;
  cooldown?: string | null;
}

export interface HapticVibrationCandidate {
  id: string;
  cue_type: string;
  label: string;
  source_wav: string;
  filename: string;
  duration_ms: number;
  conversion_status: string;
  bhaptics_event_name?: string | null;
  provider_notes?: string | null;
}

export interface User {
  id?: string | null;
  email: string;
  name: string;
  assistant_persona: AssistantPersona;
  voice_settings?: Record<string, unknown> | null;
  feedback_modalities?: FeedbackModality[] | null;
  audio_coexistence?: AudioCoexistenceSettings | null;
  haptic_preferences?: HapticPreferences | null;
  created_at?: string | null;
}

export interface UserSettingsUpdate {
  assistant_persona?: AssistantPersona | null;
  voice_settings?: Record<string, unknown> | null;
  feedback_modalities?: FeedbackModality[] | null;
  audio_coexistence?: AudioCoexistenceSettings | null;
  haptic_preferences?: HapticPreferences | null;
}

export interface UserPreferencesFormState {
  visionLevel: string;
  screenReaderType: string;
  personaPreference: AssistantPersona;
  voiceSettings: {
    speed: number;
    voiceId: string;
    spatialAudio: boolean;
  };
  sleeveMap: SleeveStatus;
}

export interface ExerciseTimelineAnchor {
  id: string;
  video_id?: string;
  name: string;
  start_time_seconds: number;
  end_time_seconds: number;
  primary_body_part?: string | null;
  secondary_body_parts?: string[];
  description_internal?: string | null;
  description_accessible?: string | null;
  counting_joint?: string | null;
  angle_range?: [number, number] | null;
  acceptable_ranges?: Record<string, [number, number]>;
}

// Backward compatibility alias
export type Exercise = ExerciseTimelineAnchor;

export interface Video {
  id?: string | null;
  youtube_id?: string | null;
  youtube_url: string;
  title?: string | null;
  channel_name?: string | null;
  thumbnail_url?: string | null;
  processing_stage: ProcessingStage;
  transcript?: string | null;
  created_at?: string | null;
}

export interface RepEvent {
  id?: string | null;
  session_id: string;
  exercise_id: string;
  rep_count: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface FormError {
  joint: string;
  observed_angle: number;
  expected_range: [number, number];
  severity: string;
  message?: string | null;
}

export interface Session {
  id?: string | null;
  user_id: string;
  video_id: string;
  video_title?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  reps?: RepEvent[];
  form_errors?: FormError[];
  playback_events?: PlaybackEvent[];
  summary?: string | null;
}

export enum TrainerInstructionEventType {
  REP_COUNT = "rep_count",
  FORM_CUE = "form_cue",
  EXERCISE_TRANSITION = "exercise_transition",
  ENCOURAGEMENT = "encouragement",
  REST_CUE = "rest_cue",
  DEMONSTRATION_ONLY = "demonstration_only",
  SILENCE = "silence",
}

export enum SpeakingOpportunityMode {
  HAPTIC_ONLY = "haptic_only",
  GAP_TIMED = "gap_timed",
  DUCK_SPEAK = "duck_speak",
  PAUSE_SPEAK = "pause_speak",
}

export enum InterruptionLevel {
  SILENT = "silent",
  HAPTIC_ONLY = "haptic_only",
  BRIEF_SPEECH = "brief_speech",
  FULL_SPEECH = "full_speech",
}

export enum AssistantVerbosity {
  MINIMAL = "minimal",
  MODERATE = "moderate",
  DETAILED = "detailed",
}

export interface AudioCoexistenceSettings {
  interruption_level: InterruptionLevel;
  assistant_verbosity: AssistantVerbosity;
  pause_before_speaking: boolean;
  correction_frequency: string;
}

export interface AssistantCue {
  text: string;
  persona: AssistantPersona;
  modality: string; // 'audio' | 'haptic' | 'visual'
  priority: string;
  timestamp_ms: number | null;
  metadata?: Record<string, any>;
}

export interface PlaybackEvent {
  event_type: string; // 'play' | 'pause' | 'seek' | 'speed_change'
  timestamp_ms: number | null;
  metadata?: Record<string, any>;
}

export interface SpeakingOpportunityWindow {
  start_ms: number;
  end_ms: number;
  duration_ms?: number;
  mode: SpeakingOpportunityMode;
  context?: string | null;
}

export interface TrainerInstructionEvent {
  timestamp_ms?: number;
  start_ms?: number;
  end_ms?: number;
  text: string;
  event_type: TrainerInstructionEventType;
  assistant_may_speak: boolean;
}

export interface FormRiskTemplate {
  exercise_name: string;
  joint: string;
  risk_description?: string;
  correction_cue?: string;
}

export interface HapticSpatialCueProfile {
  exercise_name: string;
  body_parts: string[];
  patterns: Record<string, string>;
  default_intensity?: number;
}

export interface SidecarValidationWarning {
  code: string;
  message: string;
  path?: string | null;
}

export interface SidecarGenerationMetadata {
  provider: string;
  model?: string | null;
  prompt_version: string;
  schema_version: string;
  generated_at: string;
  caption_status?: string | null;
  fallback_reason?: string | null;
  validation_warning_count: number;
}

export interface SidecarManifest {
  video_id?: string;
  youtube_id?: string;
  exercise_timeline_anchors: ExerciseTimelineAnchor[];
  trainer_instruction_events: TrainerInstructionEvent[];
  expected_movement_windows: Record<string, number[]>;
  form_risk_templates: FormRiskTemplate[];
  haptic_spatial_cue_profiles: HapticSpatialCueProfile[];
  beat_timestamps: number[];
  speaking_opportunity_map: SpeakingOpportunityWindow[];
  generation_metadata?: SidecarGenerationMetadata | null;
  validation_warnings?: SidecarValidationWarning[];
  created_at?: string;
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
  metadata?: Record<string, any>;
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
}

export interface QARequest {
  question: string;
  session_context?: Record<string, any>;
  current_timestamp_ms?: number | null;
  persona?: AssistantPersona;
}

export interface CorrectionRequest {
  exercise_id: string;
  exercise_name: string;
  joint: string;
  angle: number;
  current_timestamp_ms?: number | null;
  persona?: AssistantPersona;
}

export type CueSourceType =
  | "exercise_anchor"
  | "trainer_instruction"
  | "speaking_window"
  | "form_risk"
  | "haptic_profile";

export type CuePriority = "low" | "medium" | "high";

export type CueIntent =
  | "setup_orientation"
  | "movement_description"
  | "form_reminder"
  | "pacing_reminder"
  | "transition_notice"
  | "trainer_instruction_repeat"
  | "haptic_prompt";

export type InterruptionPolicyHint =
  | "haptic_only"
  | "safe_gap_only"
  | "pause_then_speak"
  | "duck_speak";

export type CueModality = "audio" | "haptic";

export interface CuePlanValidationWarning {
  code: string;
  message: string;
  path?: string | null;
}

export interface CuePlanGenerationMetadata {
  provider: string;
  model?: string | null;
  prompt_version: string;
  schema_version: string;
  source_sidecar_provider?: string | null;
  source_sidecar_prompt_version?: string | null;
  source_sidecar_schema_version?: string | null;
  generated_at: string;
  fallback_reason?: string | null;
  validation_warning_count: number;
}

export interface CueTextVariants {
  brief?: string | null;
  moderate: string;
  detailed?: string | null;
}

export interface CueCandidate {
  id: string;
  exercise_anchor_id?: string | null;
  source_type: CueSourceType;
  source_ref?: string | null;
  start_ms: number;
  end_ms: number;
  priority: CuePriority;
  intent: CueIntent;
  allowed_modalities: CueModality[];
  text_variants?: CueTextVariants | null;
  haptic_cue_ref?: string | null;
  interruption_policy_hint: InterruptionPolicyHint;
}

export interface ExerciseCueDescription {
  exercise_anchor_id: string;
  name: string;
  accessible_description: string;
}

export interface TrainerInstructionSummary {
  source_event_id?: string | null;
  start_ms: number;
  end_ms: number;
  summary: string;
}

export interface CuePlan {
  video_id?: string | null;
  youtube_id?: string | null;
  generation_metadata?: CuePlanGenerationMetadata | null;
  pre_session_overview: string;
  exercise_descriptions: ExerciseCueDescription[];
  cue_candidates: CueCandidate[];
  trainer_instruction_summaries: TrainerInstructionSummary[];
  validation_warnings: CuePlanValidationWarning[];
  created_at?: string | null;
}

export interface RuntimeCueSelectionRequest {
  video_id: string;
  current_time_ms: number;
  coexistence_settings: AudioCoexistenceSettings;
  assistant_muted: boolean;
  recently_delivered_cue_ids?: string[] | null;
}

export interface RuntimeCueSelectionResponse {
  cue_id: string | null;
  should_deliver: boolean;
  modality: CueModality | null;
  text: string | null;
  haptic_cue_ref: string | null;
  interruption_policy_hint: InterruptionPolicyHint | null;
  recommended_playback_action: "none" | "pause_before_speaking" | "duck_audio" | null;
  reason: string;
}




