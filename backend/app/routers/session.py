"""Assisted playback session routes for FitA11y.

Sessions track the user's performance and FitA11y's interventions during
embedded YouTube playback. The session does not contain a regenerated
workout - it records what happens while the user watches and follows
the original trainer's video.
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    Session,
    SessionStartRequest,
    SessionFinalizeRequest,
)
from app.core.storage import get_session_storage, get_job_storage

router = APIRouter()


@router.post("/start", response_model=Session)
async def start_session(payload: SessionStartRequest) -> Session:
    """Start an assisted playback session for a YouTube video and user."""
    job = get_job_storage().get_job(str(payload.video_id))
    video_title = job.title if job else None
    return get_session_storage().create_session(
        user_id=payload.user_id,
        video_id=payload.video_id,
        video_title=video_title
    )


@router.post("/{session_id}/finalize", response_model=dict[str, str])
async def finalize_session(session_id: UUID, payload: SessionFinalizeRequest) -> dict[str, str]:
    """Finalize an assisted playback session, saving all event lists in batch."""
    # 1. Verify session exists and is active
    if not get_session_storage().session_exists_and_active(session_id):
        raise HTTPException(
            status_code=400,
            detail="Session not found or already finalized."
        )

    # 2. Finalize session (persists events, marks ended, updates summaries)
    success = get_session_storage().finalize_session(
        session_id=session_id,
        playback_events=payload.playback_events,
        reps=payload.reps,
        form_errors=payload.form_errors,
        ended_at=payload.ended_at
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to finalize session.")
    return {"status": "finalized"}


@router.get("", response_model=list[Session])
async def list_sessions(user_id: UUID, include_active: bool = False) -> list[Session]:
    """List all completed (or active) sessions for a user, sorted newest first."""
    return get_session_storage().list_sessions(user_id, include_active)


@router.get("/{session_id}", response_model=Session)
async def get_session(session_id: UUID) -> Session:
    """Return stored assisted playback session data by session identifier."""
    session = get_session_storage().get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found.")
    return session
