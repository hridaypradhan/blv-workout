"""User profile and progress routes for FitA11y."""

from typing import Any
from uuid import UUID

from fastapi import APIRouter

from app.models.schemas import Session, User, UserSettingsUpdate

router = APIRouter()


@router.post("/register", response_model=User)
async def register_user(payload: User) -> User:
    """Create a new user profile with accessibility preferences."""
    raise NotImplementedError("TODO: implement")


@router.get("/{user_id}", response_model=User)
async def get_user_profile(user_id: UUID) -> User:
    """Return a user profile by user identifier."""
    raise NotImplementedError("TODO: implement")


@router.patch("/{user_id}/settings", response_model=User)
async def update_user_settings(user_id: UUID, payload: UserSettingsUpdate) -> User:
    """Update coach persona, voice settings, and feedback preferences."""
    raise NotImplementedError("TODO: implement")


@router.get("/{user_id}/history", response_model=list[Session])
async def get_user_history(user_id: UUID) -> list[Session]:
    """Return a user's past workout sessions."""
    raise NotImplementedError("TODO: implement")


@router.get("/{user_id}/progress/{exercise_id}", response_model=dict[str, Any])
async def get_exercise_progress(user_id: UUID, exercise_id: UUID) -> dict[str, Any]:
    """Return per-exercise trend data for a user."""
    raise NotImplementedError("TODO: implement")
