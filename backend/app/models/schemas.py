"""Pydantic schemas and enums for the FitA11y backend API."""

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl


class ProcessingStage(str, Enum):
    """Pipeline stages for preprocessing a workout video."""

    SUBMITTED = "submitted"
    DOWNLOADING = "downloading"
    TRANSCRIBING = "transcribing"
    SEGMENTING = "segmenting"
    ANALYZING = "analyzing"
    GENERATING_MANIFEST = "generating_manifest"
    COMPLETED = "completed"
    FAILED = "failed"


class CoachPersona(str, Enum):
    """Available AI coach personas for FitA11y feedback."""

    SUPPORTIVE = "supportive"
    DIRECT = "direct"
    ENERGETIC = "energetic"
    CALM = "calm"


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


class YouTubeURL(BaseModel):
    """Request body containing a YouTube workout URL to preprocess."""

    url: HttpUrl


class User(BaseModel):
    """User profile and accessibility preferences."""

    id: UUID | None = None
    email: str
    name: str
    coach_persona: CoachPersona = CoachPersona.SUPPORTIVE
    voice_settings: dict[str, Any] = Field(default_factory=dict)
    feedback_modalities: list[FeedbackModality] = Field(default_factory=list)
    created_at: datetime | None = None


class Video(BaseModel):
    """Workout video metadata and preprocessing status."""

    id: UUID | None = None
    youtube_url: HttpUrl
    title: str | None = None
    local_path: str | None = None
    processing_stage: ProcessingStage = ProcessingStage.SUBMITTED
    transcript: str | None = None
    created_at: datetime | None = None


class HapticProfile(BaseModel):
    """Haptic guidance profile for an exercise."""

    exercise_name: str
    body_parts: list[str] = Field(default_factory=list)
    patterns: dict[str, Any] = Field(default_factory=dict)
    default_intensity: float | None = None


class Exercise(BaseModel):
    """Segmented exercise manifest entry for a processed video."""

    id: UUID | None = None
    video_id: UUID | None = None
    name: str
    start_time_seconds: float
    end_time_seconds: float
    brief_description: str | None = None
    detailed_description: str | None = None
    counting_joint: str | None = None
    angle_range: tuple[float, float] | None = None
    acceptable_ranges: dict[str, tuple[float, float]] = Field(default_factory=dict)
    haptic_profile: HapticProfile | None = None


class RepEvent(BaseModel):
    """Recorded repetition completion event during a workout session."""

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


class Session(BaseModel):
    """Workout session data for a user following a processed video."""

    id: UUID | None = None
    user_id: UUID
    video_id: UUID
    started_at: datetime | None = None
    ended_at: datetime | None = None
    reps: list[RepEvent] = Field(default_factory=list)
    form_errors: list[FormError] = Field(default_factory=list)
    summary: str | None = None


class SleeveStatus(BaseModel):
    """Runtime connection and readiness state for a haptic sleeve."""

    side: SleeveSide
    connected: bool
    battery_level: float | None = None
    firmware_version: str | None = None
    last_seen_at: datetime | None = None


class CoachMessage(BaseModel):
    """AI coach message with modality and persona metadata."""

    text: str
    persona: CoachPersona
    modality: FeedbackModality = FeedbackModality.AUDIO
    metadata: dict[str, Any] = Field(default_factory=dict)


class SessionStartRequest(BaseModel):
    """Request body for starting a workout session from a video."""

    user_id: UUID
    video_id: UUID


class RepEventCreate(BaseModel):
    """Request body for recording a completed repetition."""

    exercise_id: UUID
    rep_count: int
    timestamp: datetime | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class FormErrorCreate(BaseModel):
    """Request body for recording a form error event."""

    exercise_id: UUID
    form_error: FormError
    timestamp: datetime | None = None


class CorrectionRequest(BaseModel):
    """Request body for generating corrective coaching from joint angles."""

    exercise_id: UUID
    exercise_name: str
    joint: str
    angle: float
    persona: CoachPersona = CoachPersona.SUPPORTIVE


class PacingRequest(BaseModel):
    """Request body for pacing feedback based on repetition timing."""

    session_id: UUID
    exercise_id: UUID
    lag_ratio: float
    persona: CoachPersona = CoachPersona.SUPPORTIVE


class MotivationRequest(BaseModel):
    """Request body for milestone-based motivational coaching."""

    milestone_event: str
    persona: CoachPersona = CoachPersona.SUPPORTIVE


class QARequest(BaseModel):
    """Request body for a user question to the AI coach."""

    question: str
    session_context: dict[str, Any] = Field(default_factory=dict)
    persona: CoachPersona = CoachPersona.SUPPORTIVE


class UserSettingsUpdate(BaseModel):
    """Request body for updating user coach, voice, and feedback settings."""

    coach_persona: CoachPersona | None = None
    voice_settings: dict[str, Any] | None = None
    feedback_modalities: list[FeedbackModality] | None = None


class HapticTestRequest(BaseModel):
    """Request body for firing a haptic sleeve test pulse."""

    sleeve_side: SleeveSide


class HapticTriggerRequest(BaseModel):
    """Request body for triggering a named haptic pattern."""

    sleeve_sides: list[SleeveSide]
    pattern_name: str
    intensity: float


class PlaybackInstruction(BaseModel):
    """Playback speed adjustment commands for the player."""

    action: str
    suggested_speed: float | None = None


class HapticInstruction(BaseModel):
    """Haptic feedback instruction for sleeves."""

    enabled: bool
    pattern: str | None = None
    sleeves: list[SleeveSide] = Field(default_factory=list)
    intensity: float | None = None


class RepAdjustment(BaseModel):
    """Target rep adjustment recommendation."""

    original_target: int
    adjusted_target: int
    reason: str | None = None


class PacingMetrics(BaseModel):
    """Calculated metric inputs for adaptive video pacing."""

    latest_lag_ratio: float
    rolling_average_lag_ratio: float
    sustained_lag: bool
    recovery_detected: bool
    form_errors_increasing: bool


class AdaptivePacingRequest(BaseModel):
    """Request body for F3.5 Adaptive Video Pacing Control."""

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
    persona: CoachPersona = CoachPersona.SUPPORTIVE


class AdaptivePacingResponse(BaseModel):
    """Structured response body for F3.5 Adaptive Video Pacing Control."""

    feature: str = "adaptive_pacing"
    decision: str
    coach_message: str
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
    """Request body for F3.6 Beat & Rhythm Pacing Coach."""

    session_id: UUID
    exercise_id: UUID
    exercise_name: str
    beat_timestamps_seconds: list[float] | None = None
    bpm: float | None = None
    expected_beats_per_rep: int | None = None
    expected_rep_duration_seconds: float | None = None
    rep_timestamps_seconds: list[float] | None = None
    rep_durations_seconds: list[float] | None = None
    persona: CoachPersona = CoachPersona.SUPPORTIVE


class RhythmPacingResponse(BaseModel):
    """Structured response body for F3.6 Beat & Rhythm Pacing Coach."""

    feature: str = "rhythm_pacing"
    decision: str
    coach_message: str
    rhythm: RhythmMetrics
    reason: str

