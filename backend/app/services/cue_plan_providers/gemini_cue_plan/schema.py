"""Gemini structured output models for cue plan generation.

These schemas use basic types to be fully compatible with the Gemini API
structured schema capabilities (avoiding enums, complex unions, or arbitrary dicts).
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class CueTextVariantsGemini(BaseModel):
    """Simple text variants schema."""

    brief: Optional[str] = None
    moderate: str
    detailed: Optional[str] = None


class CueCandidateGemini(BaseModel):
    """Simple cue candidate schema for Gemini API structured response."""

    id: str
    exercise_anchor_id: Optional[str] = None
    source_type: str  # exercise_anchor, trainer_instruction, speaking_window, form_risk, haptic_profile
    source_ref: Optional[str] = None
    start_ms: float
    end_ms: float
    priority: str  # low, medium, high
    intent: str  # setup_orientation, movement_description, form_reminder, pacing_reminder, transition_notice, trainer_instruction_repeat, haptic_prompt
    allowed_modalities: list[str]  # e.g., ["audio", "haptic"]
    text_variants: Optional[CueTextVariantsGemini] = None
    haptic_cue_ref: Optional[str] = None
    interruption_policy_hint: str  # haptic_only, safe_gap_only, pause_then_speak, duck_speak


class ExerciseCueDescriptionGemini(BaseModel):
    """Simple exercise description schema."""

    exercise_anchor_id: str
    name: str
    accessible_description: str


class TrainerInstructionSummaryGemini(BaseModel):
    """Simple trainer instruction summary schema."""

    source_event_id: Optional[str] = None
    start_ms: float
    end_ms: float
    summary: str


class CuePlanGemini(BaseModel):
    """Main structured response schema for Gemini cue plan generation."""

    pre_session_overview: str
    exercise_descriptions: list[ExerciseCueDescriptionGemini]
    cue_candidates: list[CueCandidateGemini]
    trainer_instruction_summaries: list[TrainerInstructionSummaryGemini]
