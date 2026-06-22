"""User profile and progress routes for FitA11y."""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.models.schemas import User, UserSettingsUpdate
from app.core.storage import get_user_storage

router = APIRouter()


@router.post("/register", response_model=User)
async def register_user(payload: User) -> User:
    """Create a new user profile with accessibility and assistant preferences."""
    return get_user_storage().register_user(payload)


@router.get("/{user_id}", response_model=User)
async def get_user_profile(user_id: UUID) -> User:
    """Return a user profile by user identifier."""
    user = get_user_storage().get_user(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User profile not found")
    return user


@router.patch("/{user_id}/settings", response_model=User)
async def update_user_settings(user_id: UUID, payload: UserSettingsUpdate) -> User:
    """Update assistant persona, voice settings, audio coexistence, and feedback preferences."""
    user = get_user_storage().update_user_settings(user_id, payload)
    if user is None:
        raise HTTPException(status_code=404, detail="User profile not found")
    return user

