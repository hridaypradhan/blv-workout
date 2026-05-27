"""Thread-safe in-memory store for active workout sessions."""

import threading
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.models.schemas import Session, RepEvent, FormError


class SessionStore:
    """Thread-safe in-memory store for workout sessions."""

    def __init__(self) -> None:
        self._sessions: dict[uuid.UUID, Session] = {}
        self._lock = threading.Lock()

    def create_session(self, user_id: uuid.UUID, video_id: uuid.UUID) -> Session:
        """Create a new session and store it in-memory."""
        session_id = uuid.uuid4()
        session = Session(
            id=session_id,
            user_id=user_id,
            video_id=video_id,
            started_at=datetime.now(timezone.utc),
            ended_at=None,
            reps=[],
            form_errors=[],
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
        """Record a completed repetition for the specified session."""
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
        """Record a detected form error for the specified session."""
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None or session.ended_at is not None:
                return False

            # Add to the session form errors list
            session.form_errors.append(form_error)
            return True

    def end_session(self, session_id: uuid.UUID) -> bool:
        """Mark a session as ended and generate a dummy/fallback summary."""
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
            session.summary = (
                f"Workout completed! You performed {total_reps} repetitions with "
                f"{total_errors} form corrections. Great effort keeping up with the pacing coach!"
            )
            return True


# Module-level singleton
session_store = SessionStore()
