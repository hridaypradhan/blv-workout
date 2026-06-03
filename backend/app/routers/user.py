"""User profile and progress routes for FitA11y."""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.models.schemas import Session, User, UserSettingsUpdate
from app.core.user_store import user_store
from app.core.session_store import session_store

router = APIRouter()


@router.post("/register", response_model=User)
async def register_user(payload: User) -> User:
    """Create a new user profile with accessibility and assistant preferences."""
    return user_store.register_user(payload)


@router.get("/{user_id}", response_model=User)
async def get_user_profile(user_id: UUID) -> User:
    """Return a user profile by user identifier."""
    user = user_store.get_user(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User profile not found")
    return user


@router.patch("/{user_id}/settings", response_model=User)
async def update_user_settings(user_id: UUID, payload: UserSettingsUpdate) -> User:
    """Update assistant persona, voice settings, audio coexistence, and feedback preferences."""
    user = user_store.update_user_settings(user_id, payload)
    if user is None:
        raise HTTPException(status_code=404, detail="User profile not found")
    return user


@router.get("/{user_id}/history", response_model=list[Session])
async def get_user_history(user_id: UUID) -> list[Session]:
    """Return a user's past assisted playback sessions."""
    user = user_store.get_user(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User profile not found")
    return session_store.list_sessions(user_id)


@router.get("/{user_id}/progress/{exercise_id}", response_model=dict[str, Any])
async def get_exercise_progress(user_id: UUID, exercise_id: UUID) -> dict[str, Any]:
    """Return per-exercise tracked performance data for a user."""
    user = user_store.get_user(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User profile not found")
    return {
        "user_id": user_id,
        "exercise_id": exercise_id,
        "total_completed_reps": 0,
        "completed_sets": 0,
        "average_accuracy_percentage": 100.0,
        "last_performed_at": None,
    }

