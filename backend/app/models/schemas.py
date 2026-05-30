"""Pydantic schemas and enums for the FitA11y backend API.

FitA11y is an assistive playback companion for BLV users. The YouTuber
remains the trainer of record — FitA11y provides supplementary assistance
(form correction, motivation, haptic/spatial cues, Q&A) alongside the
original embedded YouTube video.
"""

from datetime import datetime
from enum import Enum
from typing import Any
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
    patterns: dict[str, Any] = Field(default_factory=dict)
    default_intensity: float | None = None


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
    expected_movement_windows: dict[str, Any] = Field(default_factory=dict)
    form_risk_templates: list[FormRiskTemplate] = Field(default_factory=list)
    haptic_spatial_cue_profiles: list[HapticSpatialCueProfile] = Field(default_factory=list)
    beat_timestamps: list[float] = Field(default_factory=list)
    speaking_opportunity_map: list[SpeakingOpportunityWindow] = Field(default_factory=list)
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
    started_at: datetime | None = None
    ended_at: datetime | None = None
    reps: list[RepEvent] = Field(default_factory=list)
    form_errors: list[FormError] = Field(default_factory=list)
    playback_events: list[PlaybackEvent] = Field(default_factory=list)
    summary: str | None = None


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


class CorrectionRequest(BaseModel):
    """Request body for generating supplementary form correction from joint angles."""

    exercise_id: UUID
    exercise_name: str
    joint: str
    angle: float
    current_timestamp_ms: float | None = None
    persona: AssistantPersona = AssistantPersona.SUPPORTIVE


class PacingRequest(BaseModel):
    """Request body for pacing feedback based on repetition timing."""

    session_id: UUID
    exercise_id: UUID
    lag_ratio: float
    persona: AssistantPersona = AssistantPersona.SUPPORTIVE


class MotivationRequest(BaseModel):
    """Request body for low-priority motivational assistant cue."""

    milestone_event: str
    persona: AssistantPersona = AssistantPersona.SUPPORTIVE


class QARequest(BaseModel):
    """Request body for a user question to the FitA11y assistant.

    The assistant answers in the context of the current YouTube video
    playback position and trainer instruction events.
    """

    question: str
    session_context: dict[str, Any] = Field(default_factory=dict)
    current_timestamp_ms: float | None = None
    persona: AssistantPersona = AssistantPersona.SUPPORTIVE


class UserSettingsUpdate(BaseModel):
    """Request body for updating user assistant, voice, and feedback settings."""

    assistant_persona: AssistantPersona | None = None
    voice_settings: dict[str, Any] | None = None
    feedback_modalities: list[FeedbackModality] | None = None
    audio_coexistence: AudioCoexistenceSettings | None = None


class HapticTestRequest(BaseModel):
    """Request body for firing a haptic sleeve test pulse."""

    sleeve_side: SleeveSide


class HapticTriggerRequest(BaseModel):
    """Request body for triggering a named haptic/spatial assistance cue pattern."""

    sleeve_sides: list[SleeveSide]
    pattern_name: str
    intensity: float


# ---------------------------------------------------------------------------
# Playback & Pacing Instruction Models
# ---------------------------------------------------------------------------

class PlaybackInstruction(BaseModel):
    """YouTube IFrame playback adjustment commands (pause, play, seek, set_speed)."""

    action: str  # pause, play, seek, set_speed
    suggested_speed: float | None = None


class HapticInstruction(BaseModel):
    """Haptic/spatial assistance cue instruction for sleeves."""

    enabled: bool
    pattern: str | None = None
    sleeves: list[SleeveSide] = Field(default_factory=list)
    intensity: float | None = None


class RepAdjustment(BaseModel):
    """Assistant tracking target adjustment recommendation.

    This is a recommendation only — FitA11y never rewrites the trainer's
    workout. The original video continues unchanged.
    """

    original_target: int
    assistant_tracking_target: int
    reason: str | None = None


class PacingMetrics(BaseModel):
    """Calculated metric inputs for adaptive playback pacing."""

    latest_lag_ratio: float
    rolling_average_lag_ratio: float
    sustained_lag: bool
    recovery_detected: bool
    form_errors_increasing: bool


class AdaptivePacingRequest(BaseModel):
    """Request body for adaptive playback pacing control."""

    session_id: UUID
    exercise_id: UUID
    exercise_name: str
    expected_rep_duration_seconds: float | None = None
    rep_durations_seconds: list[float] | None = None
    recent_lag_ratios: list[float] | None = None
    completed_reps: int = 0
    target_reps: int | None = None
    recent_form_error_counts: list[int] | None = None
    primary_sleeves: list[SleeveSide] = Field(default_factory=list)
    current_playback_speed: float = 1.0
    user_command: str | None = None
    persona: AssistantPersona = AssistantPersona.SUPPORTIVE


class AdaptivePacingResponse(BaseModel):
    """Structured response body for adaptive playback pacing control.

    Playback actions map to YouTube IFrame commands. Rep adjustments
    are assistant tracking recommendations only.
    """

    feature: str = "adaptive_pacing"
    decision: str
    assistant_message: str
    playback: PlaybackInstruction
    haptic: HapticInstruction
    rep_adjustment: RepAdjustment | None = None
    metrics: PacingMetrics
    reason: str


class RhythmMetrics(BaseModel):
    """Calculated rhythm drift and variance metrics."""

    expected_rep_duration_seconds: float
    user_average_rep_duration_seconds: float
    drift_ratio: float
    drift_percent: float
    irregularity_score: float


class RhythmPacingRequest(BaseModel):
    """Request body for beat & rhythm pacing assistant."""

    session_id: UUID
    exercise_id: UUID
    exercise_name: str
    beat_timestamps_seconds: list[float] | None = None
    bpm: float | None = None
    expected_beats_per_rep: int | None = None
    expected_rep_duration_seconds: float | None = None
    rep_timestamps_seconds: list[float] | None = None
    rep_durations_seconds: list[float] | None = None
    persona: AssistantPersona = AssistantPersona.SUPPORTIVE


class RhythmPacingResponse(BaseModel):
    """Structured response body for beat & rhythm pacing assistant."""

    feature: str = "rhythm_pacing"
    decision: str
    assistant_message: str
    rhythm: RhythmMetrics
    reason: str
