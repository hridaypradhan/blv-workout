"""Pydantic schemas and enums for the FitA11y backend API.

FitA11y is an assistive playback companion for BLV users. The YouTuber
remains the trainer of record — FitA11y provides supplementary assistance
(form correction, motivation, haptic/spatial cues, Q&A) alongside the
original embedded YouTube video.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class ProcessingStage(str, Enum):
    """Pipeline stages for preparing an assistance sidecar manifest."""

    SUBMITTED = "submitted"
    FETCHING_METADATA = "fetching_metadata"
    TRANSCRIBING = "transcribing"
    ANCHORING_TIMELINE = "anchoring_timeline"
    CLASSIFYING_TRAINER_INSTRUCTIONS = "classifying_trainer_instructions"
    ANALYZING_MOVEMENT_WINDOWS = "analyzing_movement_windows"
    GENERATING_SIDECAR_MANIFEST = "generating_sidecar_manifest"
    COMPLETED = "completed"
    FAILED = "failed"


class AssistantPersona(str, Enum):
    """Available assistant personas for FitA11y supplementary cues.

    The persona only controls the tone of *FitA11y's* assistant layer —
    it never replaces or overrides the YouTube trainer's voice.
    """

    SUPPORTIVE = "supportive"
    DIRECT = "direct"
    ENERGETIC = "energetic"
    CALM = "calm"


# Backward-compatibility alias — internal code may still reference this.
CoachPersona = AssistantPersona


class FeedbackModality(str, Enum):
    """Supported feedback channels for BLV users."""

    AUDIO = "audio"
    HAPTIC = "haptic"
    VISUAL = "visual"


class SleeveSide(str, Enum):
    """Haptic sleeve side selections."""

    LEFT = "left"
    RIGHT = "right"
    BOTH = "both"


class HapticLimb(str, Enum):
    """Logical haptic limb targets."""

    LEFT_ARM = "left_arm"
    RIGHT_ARM = "right_arm"
    LEFT_LEG = "left_leg"
    RIGHT_LEG = "right_leg"


class TrainerInstructionEventType(str, Enum):
    """Classification of an instruction spoken by the original YouTube trainer."""

    REP_COUNT = "rep_count"
    FORM_CUE = "form_cue"
    EXERCISE_TRANSITION = "exercise_transition"
    ENCOURAGEMENT = "encouragement"
    REST_CUE = "rest_cue"
    DEMONSTRATION_ONLY = "demonstration_only"
    SILENCE = "silence"


class SpeakingOpportunityMode(str, Enum):
    """How the assistant may deliver cues during a speaking opportunity window."""

    HAPTIC_ONLY = "haptic_only"
    GAP_TIMED = "gap_timed"
    DUCK_SPEAK = "duck_speak"
    PAUSE_SPEAK = "pause_speak"


class InterruptionLevel(str, Enum):
    """How aggressively the assistant may interrupt the trainer's audio."""

    SILENT = "silent"
    HAPTIC_ONLY = "haptic_only"
    BRIEF_SPEECH = "brief_speech"
    FULL_SPEECH = "full_speech"


class AssistantVerbosity(str, Enum):
    """How much detail the assistant provides when it does speak."""

    MINIMAL = "minimal"
    MODERATE = "moderate"
    DETAILED = "detailed"


# ---------------------------------------------------------------------------
# YouTube & Video Metadata
# ---------------------------------------------------------------------------

class YouTubeURL(BaseModel):
    """Request body containing a YouTube workout URL to prepare assistance for."""

    url: HttpUrl


class YouTubeVideoMetadata(BaseModel):
    """Metadata about a YouTube video fetched for assistance preparation."""

    youtube_id: str
    youtube_url: HttpUrl
    title: str | None = None
    channel_name: str | None = None
    duration_seconds: float | None = None
    thumbnail_url: str | None = None
    published_at: datetime | None = None
    caption_tracks: list[str] = Field(default_factory=list)


class Video(BaseModel):
    """YouTube video registered for assisted playback.

    The original YouTube video is always the source of truth. FitA11y
    never downloads or stores the video for local playback — the user
    watches the embedded YouTube player directly.
    """

    id: UUID | None = None
    youtube_id: str | None = None
    youtube_url: HttpUrl
    title: str | None = None
    channel_name: str | None = None
    thumbnail_url: str | None = None
    processing_stage: ProcessingStage = ProcessingStage.SUBMITTED
    transcript: str | None = None
    created_at: datetime | None = None


# ---------------------------------------------------------------------------
# Assistance Sidecar Manifest Models
# ---------------------------------------------------------------------------

class ExerciseTimelineAnchor(BaseModel):
    """An exercise segment anchored to the original YouTube video timeline.

    These anchors describe *where* exercises occur in the creator's video
    so FitA11y can provide contextual assistance — they do NOT represent
    a regenerated or replacement workout.
    """

    id: UUID | None = None
    video_id: UUID | None = None
    name: str
    start_time_seconds: float
    end_time_seconds: float
    primary_body_part: str | None = None
    secondary_body_parts: list[str] = Field(default_factory=list)
    description_internal: str | None = None
    description_accessible: str | None = None
    counting_joint: str | None = None
    angle_range: tuple[float, float] | None = None
    acceptable_ranges: dict[str, tuple[float, float]] = Field(default_factory=dict)


class TrainerInstructionEvent(BaseModel):
    """A classified instruction from the original YouTube trainer's speech."""

    timestamp_ms: float | None = None
    start_ms: float | None = None
    end_ms: float | None = None
    text: str
    event_type: TrainerInstructionEventType = TrainerInstructionEventType.FORM_CUE
    assistant_may_speak: bool = False


class SpeakingOpportunityWindow(BaseModel):
    """A time window in the video where the assistant may deliver cues."""

    start_ms: float
    end_ms: float
    duration_ms: float | None = None
    mode: SpeakingOpportunityMode = SpeakingOpportunityMode.HAPTIC_ONLY
    context: str | None = None


class FormRiskTemplate(BaseModel):
    """Pre-generated form correction template for sidecar use.

    These are supplementary — they help FitA11y deliver brief, contextual
    form cues without creating a shadow trainer script.
    """

    exercise_name: str
    joint: str
    risk_description: str | None = None
    correction_cue: str | None = None


class HapticSpatialCueProfile(BaseModel):
    """Haptic and spatial guidance profile for an exercise."""

    exercise_name: str
    body_parts: list[str] = Field(default_factory=list)
    patterns: dict[str, str] = Field(default_factory=dict)
    default_intensity: float | None = None


class SidecarValidationWarning(BaseModel):
    """Structured warning detail produced during manifest validation/clamping."""

    code: str
    message: str
    path: str | None = None


class SidecarGenerationMetadata(BaseModel):
    """Metadata about the generation process of the assistance sidecar manifest."""

    provider: str
    model: str | None = None
    prompt_version: str
    schema_version: str
    generated_at: datetime
    caption_status: str | None = None
    fallback_reason: str | None = None
    validation_warning_count: int = 0


class AssistanceSidecarManifest(BaseModel):
    """The full assistance sidecar manifest for a YouTube video.

    This manifest is the core artifact produced by the assistance
    preparation pipeline. It enables FitA11y to provide contextual,
    supplementary assistance during embedded YouTube playback without
    regenerating or replacing the trainer's workout.
    """

    video_id: UUID | None = None
    youtube_id: str | None = None
    exercise_timeline_anchors: list[ExerciseTimelineAnchor] = Field(default_factory=list)
    trainer_instruction_events: list[TrainerInstructionEvent] = Field(default_factory=list)
    expected_movement_windows: dict[str, list[float]] = Field(default_factory=dict)
    form_risk_templates: list[FormRiskTemplate] = Field(default_factory=list)
    haptic_spatial_cue_profiles: list[HapticSpatialCueProfile] = Field(default_factory=list)
    beat_timestamps: list[float] = Field(default_factory=list)
    speaking_opportunity_map: list[SpeakingOpportunityWindow] = Field(default_factory=list)
    generation_metadata: SidecarGenerationMetadata | None = None
    validation_warnings: list[SidecarValidationWarning] = Field(default_factory=list)
    created_at: datetime | None = None


# ---------------------------------------------------------------------------
# Audio Coexistence Settings
# ---------------------------------------------------------------------------

class AudioCoexistenceSettings(BaseModel):
    """User preferences for how FitA11y coexists with the trainer's audio.

    These settings ensure the assistant never talks over the trainer
    unless explicitly permitted by the user.
    """

    interruption_level: InterruptionLevel = InterruptionLevel.HAPTIC_ONLY
    assistant_verbosity: AssistantVerbosity = AssistantVerbosity.MODERATE
    pause_before_speaking: bool = True
    correction_frequency: str = "medium"


class HapticPreferences(BaseModel):
    """User selections of vibration candidates for haptic cue categories."""

    start: str | None = "start_001"
    countdown: str | None = "countdown_001"
    per_rep_tick: str | None = "per_rep_tick_001"
    speed_up: str | None = "speed_up_001"
    slow_down: str | None = "slow_down_001"
    form_warning_above: str | None = "form_warning_above_001"
    cooldown: str | None = "cooldown_001"


class HapticVibrationCandidate(BaseModel):
    """Individual haptic vibration configuration entry from the manifest."""

    id: str
    cue_type: str
    label: str
    source_wav: str
    filename: str
    duration_ms: float
    conversion_status: str = "raw_wav"
    bhaptics_event_name: str | None = None
    provider_notes: str | None = None


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class User(BaseModel):
    """User profile and accessibility preferences."""

    id: UUID | None = None
    email: str
    name: str
    assistant_persona: AssistantPersona = AssistantPersona.SUPPORTIVE
    voice_settings: dict[str, Any] = Field(default_factory=dict)
    feedback_modalities: list[FeedbackModality] = Field(default_factory=list)
    audio_coexistence: AudioCoexistenceSettings = Field(default_factory=AudioCoexistenceSettings)
    haptic_preferences: HapticPreferences = Field(default_factory=HapticPreferences)
    created_at: datetime | None = None


# ---------------------------------------------------------------------------
# Session & Events
# ---------------------------------------------------------------------------

class RepEvent(BaseModel):
    """Recorded repetition completion event during an assisted playback session."""

    id: UUID | None = None
    session_id: UUID
    exercise_id: UUID
    rep_count: int
    timestamp: datetime
    metadata: dict[str, Any] = Field(default_factory=dict)


class FormError(BaseModel):
    """Detected form issue for a joint or movement pattern."""

    joint: str
    observed_angle: float
    expected_range: tuple[float, float]
    severity: str
    message: str | None = None


class PlaybackEvent(BaseModel):
    """A recorded playback interaction with the embedded YouTube player.

    Used to track user interactions such as pause, play, seek, and speed
    changes during an assisted playback session.
    """

    event_type: str  # pause, play, seek, speed_change, assistant_cue_delivered, user_override
    timestamp_ms: float | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class Session(BaseModel):
    """Assisted playback session for a user watching a YouTube workout video.

    The session tracks the user's performance and FitA11y's interventions
    alongside the original video — it does not contain a regenerated workout.
    """

    id: UUID | None = None
    user_id: UUID
    video_id: UUID
    video_title: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    reps: list[RepEvent] = Field(default_factory=list)
    form_errors: list[FormError] = Field(default_factory=list)
    playback_events: list[PlaybackEvent] = Field(default_factory=list)
    summary: str | None = None
    reps_count: int | None = 0
    form_errors_count: int | None = 0
    assistant_interactions_count: int | None = 0
    haptic_cues_count: int | None = 0
    playback_interactions_count: int | None = 0


class SleeveStatus(BaseModel):
    """Runtime connection and readiness state for a haptic sleeve."""

    side: SleeveSide
    connected: bool
    battery_level: float | None = None
    firmware_version: str | None = None
    last_seen_at: datetime | None = None


# ---------------------------------------------------------------------------
# Assistant Cue (replaces CoachMessage for v2)
# ---------------------------------------------------------------------------

class AssistantCue(BaseModel):
    """Supplementary cue from the FitA11y assistant.

    Unlike a coach message, an assistant cue is brief, contextual, and
    preferably haptic-first. The assistant never replaces the YouTube
    trainer — it only supplements.
    """

    text: str
    persona: AssistantPersona
    modality: FeedbackModality = FeedbackModality.AUDIO
    priority: str = "normal"  # low, normal, high, safety
    timestamp_ms: float | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


# Backward-compatibility alias
CoachMessage = AssistantCue


# ---------------------------------------------------------------------------
# Request Bodies
# ---------------------------------------------------------------------------

class SessionStartRequest(BaseModel):
    """Request body for starting an assisted playback session."""

    user_id: UUID
    video_id: UUID


class RepEventCreate(BaseModel):
    """Request body for recording a tracked repetition during assisted playback."""

    exercise_id: UUID
    rep_count: int
    timestamp: datetime | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class FormErrorCreate(BaseModel):
    """Request body for recording a form error event during assisted playback."""

    exercise_id: UUID
    form_error: FormError
    timestamp: datetime | None = None


class PlaybackEventCreate(BaseModel):
    """Request body for recording a playback event (pause, seek, speed change, etc.)."""

    event_type: str
    timestamp_ms: float | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class SessionFinalizeRequest(BaseModel):
    """Request body for finalizing an assisted playback session with all telemetry events."""

    playback_events: list[PlaybackEventCreate] = Field(default_factory=list)
    reps: list[RepEventCreate] = Field(default_factory=list)
    form_errors: list[FormErrorCreate] = Field(default_factory=list)
    ended_at: datetime | None = None


class CorrectionRequest(BaseModel):
    """Request body for generating supplementary form correction from joint angles."""

    exercise_id: UUID
    exercise_name: str
    joint: str
    angle: float
    current_timestamp_ms: float | None = None
    persona: AssistantPersona = AssistantPersona.SUPPORTIVE



class RuntimeObservationContext(BaseModel):
    """Real-time pose and tracking context from the playback client."""

    pose_available: bool = False
    pose_confidence: float | None = None
    observation_capability: Literal["not_available", "available", "low_confidence"] = "not_available"
    latest_form_error: dict[str, Any] | None = None
    latest_rep_event: dict[str, Any] | None = None
    notes: str | None = None


class QARequest(BaseModel):
    """Request body for a user question to the FitA11y assistant.

    The assistant answers in the context of the current YouTube video
    playback position and trainer instruction events.
    """

    question: str
    video_id: str | UUID | None = None
    session_id: str | UUID | None = None
    current_timestamp_ms: float | None = None
    persona: AssistantPersona = AssistantPersona.SUPPORTIVE
    session_context: dict[str, Any] | None = Field(default_factory=dict)
    runtime_observation_context: RuntimeObservationContext | None = None


class QAResponse(BaseModel):
    """Response returned from the assistant Q&A engine."""

    answer_text: str
    answer_kind: Literal["video_grounded", "self_observation_boundary", "general_guidance", "safety_boundary", "fallback"]
    provider: str
    model: str | None = None
    grounding_sources: list[str] = Field(default_factory=list)
    spoken_safe: bool = True
    fallback_reason: str | None = None
    diagnostics_ref: str | None = None

    # Backward compatibility with AssistantCue schema
    text: str | None = None
    persona: AssistantPersona | None = None
    modality: FeedbackModality | None = None
    priority: str | None = None
    timestamp_ms: float | None = None


class UserSettingsUpdate(BaseModel):
    """Request body for updating user assistant, voice, and feedback settings."""

    assistant_persona: AssistantPersona | None = None
    voice_settings: dict[str, Any] | None = None
    feedback_modalities: list[FeedbackModality] | None = None
    audio_coexistence: AudioCoexistenceSettings | None = None
    haptic_preferences: HapticPreferences | None = None


class HapticTestRequest(BaseModel):
    """Request body for firing a haptic sleeve test pulse."""

    sleeve_side: SleeveSide


class HapticTriggerRequest(BaseModel):
    """Request body for triggering a named haptic/spatial assistance cue pattern."""

    sleeve_sides: list[SleeveSide] | None = None
    pattern_name: str | None = None
    intensity: float
    cue_type: str | None = None
    vibration_id: str | None = None
    limbs: list[HapticLimb] | None = None


class HapticPattern(BaseModel):
    """Available haptic pattern description with metadata."""

    name: str
    label: str
    purpose: str
    duration_ms: int
    pulse_count: int
    default_intensity: float
    replace_with: str = "haptic_hardware_provider"
    metadata: dict[str, Any] = Field(default_factory=dict)


class HapticTestResponse(BaseModel):
    """Response returned from a successful calibration/test pulse."""

    success: bool
    sleeve_side: SleeveSide
    message: str
    source: str = "prototype"
    provider: str = "prototype_haptic"
    replace_with: str = "haptic_hardware_provider"


class HapticTriggerResponse(BaseModel):
    """Response returned from triggering a haptic pattern."""

    status: str
    pattern_name: str | None = None
    sleeve_sides: list[SleeveSide] | None = None
    intensity: float
    source: str = "prototype"
    provider: str = "prototype_haptic"
    replace_with: str = "haptic_hardware_provider"
    cue_type: str | None = None
    selected_vibration_id: str | None = None
    selected_wav: str | None = None
    target_limbs: list[HapticLimb] | None = None
    bhaptics_event_name: str | None = None



class TranscriptArtifact(BaseModel):
    """Developer analysis artifact for raw/segmented video transcript."""

    video_id: str
    caption_status: str
    transcript: str
    transcript_segments: list[dict]
    created_at: str


# Import and re-export Cue Plan schemas to maintain canonical app models namespace
from app.models.cue_plan_schemas import (
    CueSourceType,
    CuePriority,
    CueIntent,
    InterruptionPolicyHint,
    CueModality,
    CuePlanValidationWarning,
    CuePlanGenerationMetadata,
    CueTextVariants,
    CueCandidate,
    ExerciseCueDescription,
    TrainerInstructionSummary,
    CuePlan,
)
