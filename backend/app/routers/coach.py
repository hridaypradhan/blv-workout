"""AI coach routes for corrections, pacing, motivation, and Q&A."""

from uuid import UUID

from fastapi import APIRouter

from app.models.schemas import CoachMessage, CorrectionRequest, MotivationRequest, PacingRequest, QARequest

router = APIRouter()


@router.post("/correction", response_model=CoachMessage)
async def generate_correction(payload: CorrectionRequest) -> CoachMessage:
    """Receive joint angle data and return a corrective coaching phrase."""
    raise NotImplementedError("TODO: implement")


@router.post("/pacing", response_model=CoachMessage)
async def generate_pacing_feedback(payload: PacingRequest) -> CoachMessage:
    """Receive repetition timing data and return pacing feedback."""
    raise NotImplementedError("TODO: implement")


@router.post("/motivation", response_model=CoachMessage)
async def generate_motivation(payload: MotivationRequest) -> CoachMessage:
    """Receive a milestone event and return a motivational coaching phrase."""
    raise NotImplementedError("TODO: implement")


@router.post("/qa", response_model=CoachMessage)
async def answer_question(payload: QARequest) -> CoachMessage:
    """Receive a user question and return an AI coach answer."""
    raise NotImplementedError("TODO: implement")


@router.get("/correction-templates/{exercise_id}", response_model=list[str])
async def get_correction_templates(exercise_id: UUID) -> list[str]:
    """Return pre-generated correction templates for an exercise."""
    raise NotImplementedError("TODO: implement")
