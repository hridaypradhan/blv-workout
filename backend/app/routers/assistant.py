"""Assistant routes for supplementary form correction, pacing, motivation, and Q&A.

The assistant is NOT the trainer — it provides brief, contextual, supplementary
cues alongside the original YouTube video. All corrections and motivations are
secondary to the creator's instruction.
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    AssistantCue,
    CorrectionRequest,
    MotivationRequest,
    PacingRequest,
    QARequest,
    AdaptivePacingRequest,
    AdaptivePacingResponse,
    RhythmPacingRequest,
    RhythmPacingResponse,
    AssistantPersona,
    AudioCoexistenceSettings,
)
from app.services import pacing_service
from app.prototype import assistant_provider
from app.services.cue_plan_runtime_service import cue_plan_runtime_service, RuntimeCueSelectionResponse
from typing import Optional, List
from pydantic import BaseModel

class RuntimeCueSelectionRequest(BaseModel):
    video_id: str
    current_time_ms: float
    coexistence_settings: AudioCoexistenceSettings
    assistant_muted: bool
    recently_delivered_cue_ids: Optional[List[str]] = None


router = APIRouter()


@router.post("/correction", response_model=AssistantCue)
async def generate_correction(payload: CorrectionRequest) -> AssistantCue:
    """Generate a supplementary form correction cue from joint angle data.

    This is a brief, contextual correction that supplements — never
    replaces — the trainer's own form instruction in the video.
    """
    return assistant_provider.generate_correction(
        exercise_id=payload.exercise_id,
        exercise_name=payload.exercise_name,
        joint=payload.joint,
        angle=payload.angle,
        current_timestamp_ms=payload.current_timestamp_ms,
        persona=payload.persona,
    )


@router.post("/pacing/adaptive", response_model=AdaptivePacingResponse)
async def generate_adaptive_pacing(payload: AdaptivePacingRequest) -> AdaptivePacingResponse:
    """Generate adaptive playback pacing adjustments.

    Playback actions map to YouTube IFrame commands (pause, play, set_speed).
    Rep adjustments are assistant tracking recommendations only — they never
    rewrite the trainer's workout.
    """
    response_dict = pacing_service.build_adaptive_response(
        session_id=str(payload.session_id),
        exercise_id=str(payload.exercise_id),
        exercise_name=payload.exercise_name,
        expected_duration=payload.expected_rep_duration_seconds or 4.0,
        rep_durations=payload.rep_durations_seconds or [],
        recent_lag_ratios=payload.recent_lag_ratios,
        completed_reps=payload.completed_reps,
        target_reps=payload.target_reps,
        recent_form_error_counts=payload.recent_form_error_counts or [],
        primary_sleeves=payload.primary_sleeves,
        current_playback_speed=payload.current_playback_speed,
        user_command=payload.user_command,
        persona=payload.persona
    )
    return AdaptivePacingResponse(**response_dict)


@router.post("/pacing/rhythm", response_model=RhythmPacingResponse)
async def generate_rhythm_pacing(payload: RhythmPacingRequest) -> RhythmPacingResponse:
    """Generate rhythmic pacing nudges based on beat timelines and user reps."""
    response_dict = pacing_service.build_rhythm_response(
        session_id=str(payload.session_id),
        exercise_id=str(payload.exercise_id),
        exercise_name=payload.exercise_name,
        beat_timestamps=payload.beat_timestamps_seconds,
        bpm=payload.bpm,
        expected_beats_per_rep=payload.expected_beats_per_rep,
        expected_rep_duration=payload.expected_rep_duration_seconds,
        rep_timestamps=payload.rep_timestamps_seconds,
        rep_durations=payload.rep_durations_seconds,
        persona=payload.persona
    )
    return RhythmPacingResponse(**response_dict)


@router.post("/pacing", response_model=AssistantCue)
async def generate_pacing_feedback(payload: PacingRequest) -> AssistantCue:
    """Generate a supplementary pacing cue based on repetition timing data."""
    decision = "slow_prompt" if payload.lag_ratio > 1.0 else "none"
    text = pacing_service.get_deterministic_assistant_message(decision, payload.persona)
    return AssistantCue(
        text=text,
        persona=payload.persona,
        metadata={"lag_ratio": payload.lag_ratio}
    )


@router.post("/motivation", response_model=AssistantCue)
async def generate_motivation(payload: MotivationRequest) -> AssistantCue:
    """Generate a low-priority motivational assistant cue for a milestone event."""
    return assistant_provider.generate_motivation(
        milestone_event=payload.milestone_event,
        persona=payload.persona,
    )


@router.post("/qa", response_model=AssistantCue)
async def answer_question(payload: QARequest) -> AssistantCue:
    """Answer a user question with awareness of current playback position.

    The assistant pauses or waits for a speaking opportunity before
    responding, respecting audio coexistence settings.
    """
    return assistant_provider.answer_question(
        question=payload.question,
        session_context=payload.session_context,
        current_timestamp_ms=payload.current_timestamp_ms,
        persona=payload.persona,
    )


@router.get("/form-risk-templates/{exercise_id}", response_model=list[str])
async def get_form_risk_templates(exercise_id: UUID) -> list[str]:
    """Return pre-generated form risk correction templates for an exercise.

    These templates are supplementary cues — not a replacement trainer script.
    """
    return assistant_provider.get_form_risk_templates(exercise_id)


@router.post("/cue-plan/select", response_model=RuntimeCueSelectionResponse)
async def select_cue_candidate(payload: RuntimeCueSelectionRequest) -> RuntimeCueSelectionResponse:
    """Selects the next eligible cue plan candidate deterministically based on playback state and settings.
    
    This endpoint does not call Gemini.
    """
    return cue_plan_runtime_service.select_cue(
        video_id=payload.video_id,
        current_time_ms=payload.current_time_ms,
        settings=payload.coexistence_settings,
        assistant_muted=payload.assistant_muted,
        recently_delivered_cue_ids=payload.recently_delivered_cue_ids,
    )

