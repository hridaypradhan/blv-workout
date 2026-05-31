"""User profile and progress routes for FitA11y."""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.models.schemas import Session, User, UserSettingsUpdate

router = APIRouter()


@router.post("/register", response_model=User)
async def register_user(payload: User) -> User:
    """Create a new user profile with accessibility and assistant preferences."""
    raise HTTPException(status_code=501, detail="User profile registration is not implemented yet.")


@router.get("/{user_id}", response_model=User)
async def get_user_profile(user_id: UUID) -> User:
    """Return a user profile by user identifier."""
    raise HTTPException(status_code=501, detail="Retrieving user profiles is not implemented yet.")


@router.patch("/{user_id}/settings", response_model=User)
async def update_user_settings(user_id: UUID, payload: UserSettingsUpdate) -> User:
    """Update assistant persona, voice settings, audio coexistence, and feedback preferences."""
    raise HTTPException(status_code=501, detail="Updating user preferences is not implemented yet.")


@router.get("/{user_id}/history", response_model=list[Session])
async def get_user_history(user_id: UUID) -> list[Session]:
    """Return a user's past assisted playback sessions."""
    raise HTTPException(status_code=501, detail="Retrieving user session history is not implemented yet.")


@router.get("/{user_id}/progress/{exercise_id}", response_model=dict[str, Any])
async def get_exercise_progress(user_id: UUID, exercise_id: UUID) -> dict[str, Any]:
    """Return per-exercise tracked performance data for a user."""
    raise HTTPException(status_code=501, detail="Retrieving exercise progress tracking is not implemented yet.")

