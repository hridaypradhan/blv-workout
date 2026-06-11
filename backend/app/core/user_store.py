"""Thread-safe in-memory store for user profiles and settings."""

from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from app.core.prototype_persistence import load_json_store, save_json_store

from app.models.schemas import (
    AssistantPersona,
    AssistantVerbosity,
    AudioCoexistenceSettings,
    FeedbackModality,
    InterruptionLevel,
    User,
    UserSettingsUpdate,
)

PROTOTYPE_USER_ID = UUID("00000000-0000-0000-0000-000000000001")


class UserStore:
    """Thread-safe in-memory store for user profiles and accessibility settings."""

    def __init__(self) -> None:
        self._users: dict[UUID, User] = {}
        self._lock = threading.Lock()
        self._load_from_disk()

    def _load_from_disk(self) -> None:
        """Load user profiles from local JSON store if enabled."""
        data = load_json_store("users.json")
        if data and isinstance(data, dict):
            with self._lock:
                for k, v in data.items():
                    try:
                        user_id = UUID(k)
                        user = User.model_validate(v)
                        self._users[user_id] = user
                    except Exception:
                        pass
        # Seed default prototype user if empty
        with self._lock:
            if not self._users:
                self._seed_prototype_user_locked()

    def _save_to_disk(self) -> None:
        """Save users to local JSON store if enabled. Assumes lock is held."""
        serialized_users = {}
        for k, v in self._users.items():
            serialized_users[str(k)] = json.loads(v.model_dump_json())
        save_json_store("users.json", serialized_users)

    def _seed_prototype_user(self) -> None:
        """Seed the default prototype user for local development."""
        with self._lock:
            self._seed_prototype_user_locked()

    def _seed_prototype_user_locked(self) -> None:
        """Seed the default prototype user, assumes lock is held."""
        if PROTOTYPE_USER_ID not in self._users:
            proto = User(
                id=PROTOTYPE_USER_ID,
                email="prototype.user@fita11y.local",
                name="Prototype User",
                assistant_persona=AssistantPersona.SUPPORTIVE,
                voice_settings={"tts_rate": 1.0, "voice_id": "system"},
                feedback_modalities=[FeedbackModality.AUDIO, FeedbackModality.HAPTIC],
                audio_coexistence=AudioCoexistenceSettings(
                    interruption_level=InterruptionLevel.BRIEF_SPEECH,
                    assistant_verbosity=AssistantVerbosity.MODERATE,
                    pause_before_speaking=True,
                    correction_frequency="medium",
                ),
                created_at=datetime.now(timezone.utc),
            )
            self._users[PROTOTYPE_USER_ID] = proto
            self._save_to_disk()

    def register_user(self, user: User) -> User:
        """Register a new user, generating an ID and created_at timestamp if missing."""
        user_id = user.id or uuid4()
        user.id = user_id
        if not user.created_at:
            user.created_at = datetime.now(timezone.utc)

        with self._lock:
            self._users[user_id] = user
            self._save_to_disk()
        return user

    def get_user(self, user_id: UUID) -> Optional[User]:
        """Retrieve a user profile by ID, auto-seeding if the prototype ID is requested."""
        with self._lock:
            user = self._users.get(user_id)
            if user is None and user_id == PROTOTYPE_USER_ID:
                self._seed_prototype_user_locked()
                user = self._users.get(PROTOTYPE_USER_ID)
            return user

    def update_user_settings(self, user_id: UUID, settings: UserSettingsUpdate) -> Optional[User]:
        """Update a user's settings by merging the provided preferences."""
        with self._lock:
            user = self._users.get(user_id)
            if user is None and user_id == PROTOTYPE_USER_ID:
                self._seed_prototype_user_locked()
                user = self._users.get(PROTOTYPE_USER_ID)

            if user is None:
                return None

            if settings.assistant_persona is not None:
                user.assistant_persona = settings.assistant_persona
            if settings.voice_settings is not None:
                user.voice_settings = settings.voice_settings
            if settings.feedback_modalities is not None:
                user.feedback_modalities = settings.feedback_modalities
            if settings.audio_coexistence is not None:
                # Merge coexistence fields if provided
                user.audio_coexistence = settings.audio_coexistence
            if settings.haptic_preferences is not None:
                user.haptic_preferences = settings.haptic_preferences

            self._save_to_disk()
            return user


# Module-level singleton
user_store = UserStore()
