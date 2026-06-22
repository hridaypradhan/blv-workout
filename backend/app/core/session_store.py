"""Thread-safe in-memory store for assisted playback sessions."""

import json
import threading
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Any

from app.models.schemas import Session, RepEvent, FormError, PlaybackEvent
from app.core.prototype_persistence import load_json_store, save_json_store
from app.core.storage.interfaces import SessionStorage


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


class SessionStore(SessionStorage):
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

    def session_exists_and_active(self, session_id: uuid.UUID) -> bool:
        """Lightweight check to see if session exists and is active."""
        with self._lock:
            session = self._sessions.get(session_id)
            return session is not None and session.ended_at is None

    def finalize_session(
        self,
        session_id: uuid.UUID,
        playback_events: List[Any],
        reps: List[Any],
        form_errors: List[Any],
        ended_at: Optional[datetime] = None
    ) -> bool:
        """Finalize the session, saving all event lists in batch and updating status & summary."""
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None or session.ended_at is not None:
                return False

            session.ended_at = ended_at or datetime.now(timezone.utc)

            # Assign and validate all events lists
            session.playback_events = []
            for ev in playback_events:
                event_type = ev.get("event_type") if isinstance(ev, dict) else getattr(ev, "event_type", "")
                timestamp_ms = ev.get("timestamp_ms") if isinstance(ev, dict) else getattr(ev, "timestamp_ms", 0.0)
                metadata = ev.get("metadata") if isinstance(ev, dict) else getattr(ev, "metadata", {})

                session.playback_events.append(PlaybackEvent(
                    event_type=event_type,
                    timestamp_ms=timestamp_ms,
                    metadata=metadata or {}
                ))

            session.reps = []
            for rep in reps:
                exercise_id = rep.get("exercise_id") if isinstance(rep, dict) else getattr(rep, "exercise_id")
                rep_count = rep.get("rep_count") if isinstance(rep, dict) else getattr(rep, "rep_count")
                timestamp_val = rep.get("timestamp") if isinstance(rep, dict) else getattr(rep, "timestamp", None)
                metadata = rep.get("metadata") if isinstance(rep, dict) else getattr(rep, "metadata", {})

                ts = timestamp_val or datetime.now(timezone.utc)
                if isinstance(ts, str):
                    try:
                        ts = datetime.fromisoformat(ts)
                    except ValueError:
                        ts = datetime.now(timezone.utc)
                elif not isinstance(ts, datetime):
                    ts = datetime.now(timezone.utc)

                session.reps.append(RepEvent(
                    id=uuid.uuid4(),
                    session_id=session_id,
                    exercise_id=uuid.UUID(str(exercise_id)),
                    rep_count=rep_count,
                    timestamp=ts,
                    metadata=metadata or {}
                ))

            session.form_errors = []
            for err in form_errors:
                form_err_data = err.get("form_error") if isinstance(err, dict) else getattr(err, "form_error")
                if isinstance(form_err_data, dict):
                    form_error_obj = FormError.model_validate(form_err_data)
                else:
                    form_error_obj = form_err_data
                session.form_errors.append(form_error_obj)

            # Compute counts
            session.reps_count = len(session.reps)
            session.form_errors_count = len(session.form_errors)

            assistant_cues = 0
            haptic_cues = 0
            p_events = 0
            for evt in session.playback_events:
                t = evt.event_type
                if t in ("assistant_cue_delivered", "assistant_correction_delivered", "assistant_answer_delivered", "user_question_submitted"):
                    assistant_cues += 1
                elif t in ("haptic_cue_triggered", "haptic_cue_requested"):
                    haptic_cues += 1
                elif t in ("play", "pause", "seek", "speed_change", "ended"):
                    p_events += 1

            session.assistant_interactions_count = assistant_cues
            session.haptic_cues_count = haptic_cues
            session.playback_interactions_count = p_events

            from app.core.session_summary import generate_session_summary
            session.summary = generate_session_summary(session)

            self._save_to_disk()
            return True

    def list_sessions(self, user_id: uuid.UUID, include_active: bool = False) -> list[Session]:
        """List all sessions for a user, sorted newest first."""
        with self._lock:
            sessions = []
            for s in self._sessions.values():
                if s.user_id == user_id and (include_active or s.ended_at is not None):
                    s_copy = s.model_copy()
                    s_copy.reps = []
                    s_copy.form_errors = []
                    s_copy.playback_events = []
                    sessions.append(s_copy)
        # Sort newest first, using ended_at if present, fallback to started_at
        def sort_key(s: Session):
            val = s.ended_at if s.ended_at is not None else s.started_at
            return val

        sessions.sort(key=sort_key, reverse=True)
        return sessions


# Module-level singleton
session_store = SessionStore()
