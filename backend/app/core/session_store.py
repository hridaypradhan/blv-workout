"""Thread-safe in-memory store for assisted playback sessions."""

import json
import threading
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.models.schemas import Session, RepEvent, FormError, PlaybackEvent
from app.core.prototype_persistence import load_json_store, save_json_store


class SessionStore:
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

            # Count the specific recorded events
            total_reps = len(session.reps)
            total_errors = len(session.form_errors)

            plays = 0
            pauses = 0
            seeks = 0
            speed_changes = 0
            assistant_cues = 0
            assistant_qa_answers = 0
            assistant_corrections = 0
            failed_qa_answers = 0
            haptic_cue_requests = 0
            haptic_cue_triggers = 0
            haptic_cue_failures = 0
            repeats = 0
            skips = 0
            user_questions = 0

            for event in session.playback_events:
                t = event.event_type
                if t == "play":
                    plays += 1
                elif t == "pause":
                    pauses += 1
                elif t == "seek":
                    seeks += 1
                elif t == "speed_change":
                    speed_changes += 1
                elif t == "assistant_cue_delivered":
                    assistant_cues += 1
                elif t == "assistant_correction_delivered":
                    assistant_corrections += 1
                elif t == "assistant_answer_delivered":
                    assistant_qa_answers += 1
                elif t == "assistant_answer_failed":
                    failed_qa_answers += 1
                elif t == "haptic_cue_requested":
                    haptic_cue_requests += 1
                elif t == "haptic_cue_triggered":
                    haptic_cue_triggers += 1
                elif t == "haptic_cue_failed":
                    haptic_cue_failures += 1
                elif t == "trainer_instruction_repeated":
                    repeats += 1
                elif t == "section_skipped":
                    skips += 1
                elif t == "user_question_submitted":
                    user_questions += 1

            # Build summary
            # FitA11y supplemented the trainer with:
            supplement_parts = []
            
            # Cues: sum up assistant cues
            all_assistant_cues = assistant_cues + assistant_corrections + assistant_qa_answers
            if all_assistant_cues > 0:
                supplement_parts.append(f"{all_assistant_cues} assistant cue{'s' if all_assistant_cues != 1 else ''}")
            
            # Haptic cues: triggered if >0, otherwise requested
            haptic_count = haptic_cue_triggers if haptic_cue_triggers > 0 else haptic_cue_requests
            if haptic_count > 0:
                supplement_parts.append(f"{haptic_count} haptic cue{'s' if haptic_count != 1 else ''}")
            
            # Reps and form warnings
            reps_count = total_reps if total_reps > 0 else sum(1 for e in session.playback_events if e.event_type == "prototype_rep_detected")
            errors_count = total_errors if total_errors > 0 else sum(1 for e in session.playback_events if e.event_type == "prototype_form_error_detected")

            if reps_count > 0:
                supplement_parts.append(f"{reps_count} tracked rep{'s' if reps_count != 1 else ''}")
            if errors_count > 0:
                supplement_parts.append(f"{errors_count} form warning{'s' if errors_count != 1 else ''}")

            if supplement_parts:
                if len(supplement_parts) == 1:
                    supp_text = supplement_parts[0]
                else:
                    supp_text = ", ".join(supplement_parts[:-1]) + f", and {supplement_parts[-1]}"
                supp_sentence = f"FitA11y supplemented the trainer with {supp_text}."
            else:
                supp_sentence = "FitA11y supplemented your session with real-time feedback."

            # User actions: repeats, skips, and questions asked
            user_parts = []
            if repeats > 0:
                user_parts.append(f"repeated {repeats} trainer instruction{'s' if repeats != 1 else ''}")
            if skips > 0:
                user_parts.append(f"skipped {skips} section{'s' if skips != 1 else ''}")
            if user_questions > 0:
                user_parts.append(f"asked {user_questions} question{'s' if user_questions != 1 else ''}")

            if user_parts:
                if len(user_parts) == 1:
                    user_text = user_parts[0]
                else:
                    user_text = ", ".join(user_parts[:-1]) + f", and {user_parts[-1]}"
                user_sentence = f" You {user_text}."
            else:
                user_sentence = ""

            session.summary = f"Assisted playback session completed. {supp_sentence}{user_sentence}"
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
