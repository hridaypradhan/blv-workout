"""Thread-safe in-memory store for assisted playback sessions."""

import json
import threading
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.models.schemas import Session, RepEvent, FormError, PlaybackEvent
from app.core.prototype_persistence import load_json_store, save_json_store
from app.core.storage.interfaces import SessionStorage, SessionEventStorage


class SessionEventNames:
    PLAY = "play"
    PAUSE = "pause"
    SEEK = "seek"
    SPEED_CHANGE = "speed_change"
    ASSISTANT_CUE_DELIVERED = "assistant_cue_delivered"
    ASSISTANT_CORRECTION_DELIVERED = "assistant_correction_delivered"
    ASSISTANT_ANSWER_DELIVERED = "assistant_answer_delivered"
    ASSISTANT_ANSWER_FAILED = "assistant_answer_failed"
    HAPTIC_CUE_REQUESTED = "haptic_cue_requested"
    HAPTIC_CUE_TRIGGERED = "haptic_cue_triggered"
    HAPTIC_CUE_FAILED = "haptic_cue_failed"
    TRAINER_INSTRUCTION_REPEATED = "trainer_instruction_repeated"
    SECTION_SKIPPED = "section_skipped"
    USER_QUESTION_SUBMITTED = "user_question_submitted"
    PROTOTYPE_REP_DETECTED = "prototype_rep_detected"
    PROTOTYPE_FORM_ERROR_DETECTED = "prototype_form_error_detected"


class SessionStore(SessionStorage, SessionEventStorage):
    """Thread-safe in-memory store for assisted playback sessions."""

    def __init__(self) -> None:
        self._sessions: dict[uuid.UUID, Session] = {}
        self._lock = threading.Lock()
        self._load_from_disk()

    def _load_from_disk(self) -> None:
        """Load sessions from local JSON store if enabled."""
        data = load_json_store("sessions.json")
        if data and isinstance(data, dict):
            with self._lock:
                for k, v in data.items():
                    try:
                        session_id = uuid.UUID(k)
                        session = Session.model_validate(v)
                        self._sessions[session_id] = session
                    except Exception:
                        pass

    def _save_to_disk(self) -> None:
        """Save sessions to local JSON store if enabled. Assumes lock is held."""
        serialized_sessions = {}
        for k, v in self._sessions.items():
            serialized_sessions[str(k)] = json.loads(v.model_dump_json())
        save_json_store("sessions.json", serialized_sessions)

    def create_session(
        self,
        user_id: uuid.UUID,
        video_id: uuid.UUID,
        video_title: Optional[str] = None
    ) -> Session:
        """Create a new assisted playback session and store it in-memory."""
        session_id = uuid.uuid4()
        session = Session(
            id=session_id,
            user_id=user_id,
            video_id=video_id,
            video_title=video_title,
            started_at=datetime.now(timezone.utc),
            ended_at=None,
            reps=[],
            form_errors=[],
            playback_events=[],
            summary=None
        )
        with self._lock:
            self._sessions[session_id] = session
            self._save_to_disk()
        return session

    def get_session(self, session_id: uuid.UUID) -> Optional[Session]:
        """Look up a session by its session_id."""
        with self._lock:
            return self._sessions.get(session_id)

    def add_rep(
        self,
        session_id: uuid.UUID,
        exercise_id: uuid.UUID,
        rep_count: int,
        timestamp: Optional[datetime] = None,
        metadata: Optional[dict] = None
    ) -> bool:
        """Record a tracked repetition for the specified assisted playback session."""
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None or session.ended_at is not None:
                return False

            rep_event = RepEvent(
                id=uuid.uuid4(),
                session_id=session_id,
                exercise_id=exercise_id,
                rep_count=rep_count,
                timestamp=timestamp or datetime.now(timezone.utc),
                metadata=metadata or {}
            )
            session.reps.append(rep_event)
            self._save_to_disk()
            return True

    def add_form_error(
        self,
        session_id: uuid.UUID,
        form_error: FormError
    ) -> bool:
        """Record a detected form error for the specified assisted playback session."""
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None or session.ended_at is not None:
                return False

            # Add to the session form errors list
            session.form_errors.append(form_error)
            self._save_to_disk()
            return True

    def add_playback_event(
        self,
        session_id: uuid.UUID,
        event_type: str,
        timestamp_ms: Optional[float] = None,
        metadata: Optional[dict] = None
    ) -> bool:
        """Record a playback interaction (pause, play, seek, speed change, etc.)."""
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None or session.ended_at is not None:
                return False

            event = PlaybackEvent(
                event_type=event_type,
                timestamp_ms=timestamp_ms,
                metadata=metadata or {}
            )
            session.playback_events.append(event)
            self._save_to_disk()
            return True

    def end_session(self, session_id: uuid.UUID) -> bool:
        """Mark an assisted playback session as ended and generate a summary."""
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                return False
            if session.ended_at is not None:
                return True

            session.ended_at = datetime.now(timezone.utc)

            from app.core.session_summary import generate_session_summary
            session.summary = generate_session_summary(session)
            
            self._save_to_disk()
            return True

    def list_sessions(self, user_id: uuid.UUID, include_active: bool = False) -> list[Session]:
        """List all sessions for a user, sorted newest first."""
        with self._lock:
            sessions = [
                s for s in self._sessions.values()
                if s.user_id == user_id and (include_active or s.ended_at is not None)
            ]
        # Sort newest first, using ended_at if present, fallback to started_at
        def sort_key(s: Session):
            val = s.ended_at if s.ended_at is not None else s.started_at
            return val

        sessions.sort(key=sort_key, reverse=True)
        return sessions


# Module-level singleton
session_store = SessionStore()
