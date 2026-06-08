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

export interface User {
  id?: string | null;
  email: string;
  name: string;
  assistant_persona: AssistantPersona;
  voice_settings?: Record<string, unknown> | null;
  feedback_modalities?: FeedbackModality[] | null;
  audio_coexistence?: AudioCoexistenceSettings | null;
  created_at?: string | null;
}

export interface UserSettingsUpdate {
  assistant_persona?: AssistantPersona | null;
  voice_settings?: Record<string, unknown> | null;
  feedback_modalities?: FeedbackModality[] | null;
  audio_coexistence?: AudioCoexistenceSettings | null;
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
  patterns: Record<string, any>;
  default_intensity?: number;
}

export interface SidecarManifest {
  video_id?: string;
  youtube_id?: string;
  exercise_timeline_anchors: ExerciseTimelineAnchor[];
  trainer_instruction_events: TrainerInstructionEvent[];
  expected_movement_windows: Record<string, any>;
  form_risk_templates: FormRiskTemplate[];
  haptic_spatial_cue_profiles: HapticSpatialCueProfile[];
  beat_timestamps: number[];
  speaking_opportunity_map: SpeakingOpportunityWindow[];
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
  pattern_name: string;
  sleeve_sides: SleeveSide[];
  intensity: number;
  source: string;
  provider: string;
  replace_with: string;
}

