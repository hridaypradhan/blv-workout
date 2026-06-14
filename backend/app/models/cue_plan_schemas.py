"""Pydantic schemas and enums for the FitA11y Cue Plan.

These schemas define the structure of the AI-assisted cue plan generated
from a sidecar manifest, providing candidate cues to the session runtime.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class CueSourceType(str, Enum):
    """Source component from the sidecar manifest that triggered this cue."""

    EXERCISE_ANCHOR = "exercise_anchor"
    TRAINER_INSTRUCTION = "trainer_instruction"
    SPEAKING_WINDOW = "speaking_window"
    FORM_RISK = "form_risk"
    HAPTIC_PROFILE = "haptic_profile"


class CuePriority(str, Enum):
    """Visual or auditory priority level of the cue candidate."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class CueIntent(str, Enum):
    """The logical objective of the cue candidate."""

    SETUP_ORIENTATION = "setup_orientation"
    MOVEMENT_DESCRIPTION = "movement_description"
    FORM_REMINDER = "form_reminder"
    PACING_REMINDER = "pacing_reminder"
    TRANSITION_NOTICE = "transition_notice"
    TRAINER_INSTRUCTION_REPEAT = "trainer_instruction_repeat"
    HAPTIC_PROMPT = "haptic_prompt"


class InterruptionPolicyHint(str, Enum):
    """Recommended rule for how the cue should interact with the trainer's audio."""

    HAPTIC_ONLY = "haptic_only"
    SAFE_GAP_ONLY = "safe_gap_only"
    PAUSE_THEN_SPEAK = "pause_then_speak"
    DUCKSPEAK = "duck_speak"


class CueModality(str, Enum):
    """Supported modalities for cue candidates."""

    AUDIO = "audio"
    HAPTIC = "haptic"



class CuePlanValidationWarning(BaseModel):
    """Warning produced during validation/clamping of a cue plan."""

    code: str
    message: str
    path: str | None = None


class CuePlanGenerationMetadata(BaseModel):
    """Metadata detailing how this cue plan was generated."""

    provider: str
    model: str | None = None
    prompt_version: str
    schema_version: str
    source_sidecar_provider: str | None = None
    source_sidecar_prompt_version: str | None = None
    source_sidecar_schema_version: str | None = None
    generated_at: datetime
    fallback_reason: str | None = None
    validation_warning_count: int = 0


class CueTextVariants(BaseModel):
    """Multi-length string variants for supplementary speech synthesis."""

    brief: str | None = None
    moderate: str
    detailed: str | None = None


class CueCandidate(BaseModel):
    """A single candidate assistance cue proposed for delivery in the playback runtime."""

    id: str
    exercise_anchor_id: str | None = None
    source_type: CueSourceType
    source_ref: str | None = None
    start_ms: float
    end_ms: float
    priority: CuePriority
    intent: CueIntent
    allowed_modalities: list[CueModality] = Field(default_factory=list)
    text_variants: CueTextVariants | None = None
    haptic_cue_ref: str | None = None
    interruption_policy_hint: InterruptionPolicyHint


class ExerciseCueDescription(BaseModel):
    """Accessible exercise overview information."""

    exercise_anchor_id: str
    name: str
    accessible_description: str


class TrainerInstructionSummary(BaseModel):
    """A brief repeat summary of an important trainer instruction event."""

    source_event_id: str | None = None
    start_ms: float
    end_ms: float
    summary: str


class CuePlan(BaseModel):
    """The complete, candidate-rich AI-assisted cue plan for a prepared video."""

    video_id: UUID | None = None
    youtube_id: str | None = None
    generation_metadata: CuePlanGenerationMetadata | None = None
    pre_session_overview: str
    exercise_descriptions: list[ExerciseCueDescription] = Field(default_factory=list)
    cue_candidates: list[CueCandidate] = Field(default_factory=list)
    trainer_instruction_summaries: list[TrainerInstructionSummary] = Field(default_factory=list)
    validation_warnings: list[CuePlanValidationWarning] = Field(default_factory=list)
    created_at: datetime | None = None
