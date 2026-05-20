"""Workout session routes for FitA11y."""

from uuid import UUID

from fastapi import APIRouter

from app.models.schemas import FormErrorCreate, RepEventCreate, Session, SessionStartRequest

router = APIRouter()


@router.post("/start", response_model=Session)
async def start_session(payload: SessionStartRequest) -> Session:
    """Create a new workout session for a user and processed video."""
    raise NotImplementedError("TODO: implement")


@router.post("/{session_id}/rep", response_model=dict[str, str])
async def record_rep_completion(session_id: UUID, payload: RepEventCreate) -> dict[str, str]:
    """Record a repetition completion event for an active workout session."""
    raise NotImplementedError("TODO: implement")


@router.post("/{session_id}/form-error", response_model=dict[str, str])
async def record_form_error(session_id: UUID, payload: FormErrorCreate) -> dict[str, str]:
    """Record a detected form error event for an active workout session."""
    raise NotImplementedError("TODO: implement")


@router.post("/{session_id}/end", response_model=dict[str, str])
async def end_session(session_id: UUID) -> dict[str, str]:
    """End a workout session and trigger AI-generated summary creation."""
    raise NotImplementedError("TODO: implement")


@router.get("/{session_id}", response_model=Session)
async def get_session(session_id: UUID) -> Session:
    """Return stored workout session data by session identifier."""
    raise NotImplementedError("TODO: implement")
