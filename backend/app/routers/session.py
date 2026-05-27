"""Workout session routes for FitA11y."""

from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.models.schemas import FormErrorCreate, RepEventCreate, Session, SessionStartRequest
from app.core.session_store import session_store

router = APIRouter()


@router.post("/start", response_model=Session)
async def start_session(payload: SessionStartRequest) -> Session:
    """Create a new workout session for a user and processed video."""
    return session_store.create_session(payload.user_id, payload.video_id)


@router.post("/{session_id}/rep", response_model=dict[str, str])
async def record_rep_completion(session_id: UUID, payload: RepEventCreate) -> dict[str, str]:
    """Record a repetition completion event for an active workout session."""
    success = session_store.add_rep(
        session_id=session_id,
        exercise_id=payload.exercise_id,
        rep_count=payload.rep_count,
        timestamp=payload.timestamp,
        metadata=payload.metadata
    )
    if not success:
        raise HTTPException(status_code=400, detail="Failed to record rep. Session not found or already ended.")
    return {"status": "recorded"}


@router.post("/{session_id}/form-error", response_model=dict[str, str])
async def record_form_error(session_id: UUID, payload: FormErrorCreate) -> dict[str, str]:
    """Record a detected form error event for an active workout session."""
    success = session_store.add_form_error(
        session_id=session_id,
        form_error=payload.form_error
    )
    if not success:
        raise HTTPException(status_code=400, detail="Failed to record form error. Session not found or already ended.")
    return {"status": "recorded"}


@router.post("/{session_id}/end", response_model=dict[str, str])
async def end_session(session_id: UUID) -> dict[str, str]:
    """End a workout session and trigger AI-generated summary creation."""
    success = session_store.end_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found.")
    return {"status": "ended"}


@router.get("/{session_id}", response_model=Session)
async def get_session(session_id: UUID) -> Session:
    """Return stored workout session data by session identifier."""
    session = session_store.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found.")
    return session

