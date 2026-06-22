"""Assistant routes for supplementary form correction and Q&A.

The assistant is NOT the trainer — it provides brief, contextual, supplementary
cues alongside the original YouTube video. All corrections are secondary to the
creator's instruction.
"""

from fastapi import APIRouter

from app.models.schemas import (
    AssistantCue,
    CorrectionRequest,
    QARequest,
    QAResponse,
)
from app.prototype import assistant_provider
from app.services.assistant_qna_service import qna_service

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


@router.post("/qa", response_model=QAResponse)
async def answer_question(payload: QARequest) -> QAResponse:
    """Answer a user question with awareness of current playback position.

    The assistant pauses or waits for a speaking opportunity before
    responding, respecting audio coexistence settings.
    """
    return qna_service.answer_question(payload)
