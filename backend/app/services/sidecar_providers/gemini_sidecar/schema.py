"""Pydantic schemas for the Gemini sidecar developer-mode responses.

These models replace direct dictionary and tuple annotations with safe nested
objects/lists to avoid emitting prefixItems or additionalProperties in the generated
JSON Schema.
"""

from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field
from app.models.schemas import TrainerInstructionEventType, SpeakingOpportunityMode

SCHEMA_VERSION = "sidecar_schema_v1"


class JointAcceptableRangeGemini(BaseModel):
    joint: str
    min_degrees: float
    max_degrees: float


class HapticPatternMappingGemini(BaseModel):
    cue_name: str
    pattern_name: str


class ExpectedMovementWindowGemini(BaseModel):
    exercise_name: str
    start_seconds: float
    end_seconds: float


class AngleRangeGemini(BaseModel):
    min_degrees: float
    max_degrees: float


class ExerciseTimelineAnchorGemini(BaseModel):
    name: str
    start_time_seconds: float
    end_time_seconds: float
    primary_body_part: Optional[str] = None
    secondary_body_parts: list[str] = Field(default_factory=list)
    description_internal: Optional[str] = None
    description_accessible: Optional[str] = None
    counting_joint: Optional[str] = None
    angle_range: Optional[AngleRangeGemini] = None
    acceptable_ranges: list[JointAcceptableRangeGemini] = Field(default_factory=list)


class TrainerInstructionEventGemini(BaseModel):
    timestamp_ms: Optional[float] = None
    start_ms: Optional[float] = None
    end_ms: Optional[float] = None
    text: str
    event_type: TrainerInstructionEventType = TrainerInstructionEventType.FORM_CUE
    assistant_may_speak: bool = False


class SpeakingOpportunityWindowGemini(BaseModel):
    start_ms: float
    end_ms: float
    duration_ms: Optional[float] = None
    mode: SpeakingOpportunityMode = SpeakingOpportunityMode.HAPTIC_ONLY
    context: Optional[str] = None


class FormRiskTemplateGemini(BaseModel):
    exercise_name: str
    joint: str
    risk_description: Optional[str] = None
    correction_cue: Optional[str] = None


class HapticSpatialCueProfileGemini(BaseModel):
    exercise_name: str
    body_parts: list[str] = Field(default_factory=list)
    patterns: list[HapticPatternMappingGemini] = Field(default_factory=list)
    default_intensity: Optional[float] = None


class AssistanceSidecarManifestGemini(BaseModel):
    exercise_timeline_anchors: list[ExerciseTimelineAnchorGemini] = Field(default_factory=list)
    trainer_instruction_events: list[TrainerInstructionEventGemini] = Field(default_factory=list)
    expected_movement_windows: list[ExpectedMovementWindowGemini] = Field(default_factory=list)
    form_risk_templates: list[FormRiskTemplateGemini] = Field(default_factory=list)
    haptic_spatial_cue_profiles: list[HapticSpatialCueProfileGemini] = Field(default_factory=list)
    beat_timestamps: list[float] = Field(default_factory=list)
    speaking_opportunity_map: list[SpeakingOpportunityWindowGemini] = Field(default_factory=list)
