"""Thread-safe in-memory store for assisted playback sessions."""

import threading
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.models.schemas import Session, RepEvent, FormError, PlaybackEvent


class SessionStore:
    """Thread-safe in-memory store for assisted playback sessions."""

    def __init__(self) -> None:
        self._sessions: dict[uuid.UUID, Session] = {}
        self._lock = threading.Lock()

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
            # Generate a deterministic session summary
            total_reps = len(session.reps)
            total_errors = len(session.form_errors)
            total_playback_events = len(session.playback_events)
            session.summary = (
                f"Session completed! You performed {total_reps} tracked repetitions with "
                f"{total_errors} form corrections. FitA11y delivered {total_playback_events} "
                f"playback interactions during your assisted workout. Great effort!"
            )
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
