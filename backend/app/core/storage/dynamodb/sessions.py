import json
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Any
from uuid import UUID

from app.core.config import settings
from app.core.storage import aws_client
from app.core.storage.interfaces import SessionStorage
from app.models.schemas import (
    Session,
    RepEvent,
    FormError,
    PlaybackEvent,
)
from app.core.storage.dynamodb.utils import (
    python_to_dynamodb,
    dynamodb_to_python,
)
from app.core.session_summary import generate_session_summary
from boto3.dynamodb.conditions import Key


class DynamoDBSessionStorage(SessionStorage):
    """DynamoDB implementation for workout Assisted Playback Sessions."""

    def __init__(self) -> None:
        self._dynamodb = None

    @property
    def table(self):
        if self._dynamodb is None:
            self._dynamodb = aws_client.get_dynamodb_resource()
        return self._dynamodb.Table(settings.DYNAMODB_SESSIONS_TABLE)

    @property
    def events_table(self):
        if self._dynamodb is None:
            self._dynamodb = aws_client.get_dynamodb_resource()
        return self._dynamodb.Table(settings.DYNAMODB_SESSION_EVENTS_TABLE)

    def create_session(
        self,
        user_id: UUID,
        video_id: UUID,
        video_title: Optional[str] = None
    ) -> Session:
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

        item = json.loads(session.model_dump_json())
        item.pop("reps", None)
        item.pop("form_errors", None)
        item.pop("playback_events", None)
        item["session_id"] = item.pop("id")
        item = python_to_dynamodb(item)
        self.table.put_item(Item=item)
        return session

    def get_session(self, session_id: UUID) -> Optional[Session]:
        response = self.table.get_item(Key={"session_id": str(session_id)})
        item = response.get("Item")
        if item is None:
            return None

        item = dynamodb_to_python(item)
        item["id"] = item.pop("session_id")
        
        # Query session events from events table
        events_resp = self.events_table.query(
            KeyConditionExpression=Key("session_id").eq(str(session_id))
        )
        event_items = events_resp.get("Items", [])

        reps = []
        form_errors_with_ts = []
        playback_events = []

        for ev in event_items:
            ev = dynamodb_to_python(ev)
            t = ev.get("type")
            if t == "rep":
                reps.append(RepEvent.model_validate(ev.get("rep_event")))
            elif t == "error":
                parts = ev.get("event_key", "").split("#")
                ts_str = parts[1] if len(parts) > 1 else datetime.now(timezone.utc).isoformat()
                try:
                    ts = datetime.fromisoformat(ts_str)
                except ValueError:
                    ts = datetime.now(timezone.utc)
                form_errors_with_ts.append((ts, FormError.model_validate(ev.get("form_error"))))
            elif t == "playback":
                playback_events.append(PlaybackEvent.model_validate(ev.get("playback_event")))

        reps.sort(key=lambda r: r.timestamp)
        playback_events.sort(key=lambda p: p.timestamp_ms or 0.0)
        form_errors_with_ts.sort(key=lambda x: x[0])
        form_errors = [x[1] for x in form_errors_with_ts]

        item["reps"] = [json.loads(r.model_dump_json()) for r in reps]
        item["form_errors"] = [json.loads(f.model_dump_json()) for f in form_errors]
        item["playback_events"] = [json.loads(p.model_dump_json()) for p in playback_events]

        return Session.model_validate(item)

    def session_exists_and_active(self, session_id: UUID) -> bool:
        response = self.table.get_item(Key={"session_id": str(session_id)})
        item = response.get("Item")
        if item is None:
            return False
        item = dynamodb_to_python(item)
        return item.get("ended_at") is None

    def finalize_session(
        self,
        session_id: UUID,
        playback_events: List[Any],
        reps: List[Any],
        form_errors: List[Any],
        ended_at: Optional[datetime] = None
    ) -> bool:
        if not self.session_exists_and_active(session_id):
            return False

        # 1. Batch write events to events table
        with self.events_table.batch_writer() as batch:
            for ev in playback_events:
                event_type = ev.get("event_type") if isinstance(ev, dict) else getattr(ev, "event_type", "")
                timestamp_ms = ev.get("timestamp_ms") if isinstance(ev, dict) else getattr(ev, "timestamp_ms", 0.0)
                metadata = ev.get("metadata") if isinstance(ev, dict) else getattr(ev, "metadata", {})

                ts_ms = timestamp_ms or 0.0
                event_id = str(uuid.uuid4())

                playback_event = PlaybackEvent(
                    event_type=event_type,
                    timestamp_ms=ts_ms,
                    metadata=metadata or {}
                )

                event_key = f"playback#{ts_ms:012.3f}#{event_id}"
                item = {
                    "session_id": str(session_id),
                    "event_key": event_key,
                    "type": "playback",
                    "playback_event": python_to_dynamodb(json.loads(playback_event.model_dump_json()))
                }
                batch.put_item(Item=item)

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

                ts_iso = ts.isoformat()
                event_id = str(uuid.uuid4())

                rep_event = RepEvent(
                    id=UUID(event_id) if isinstance(event_id, UUID) else UUID(str(event_id)),
                    session_id=session_id,
                    exercise_id=UUID(str(exercise_id)),
                    rep_count=rep_count,
                    timestamp=ts,
                    metadata=metadata or {}
                )

                event_key = f"rep#{ts_iso}#{event_id}"
                item = {
                    "session_id": str(session_id),
                    "event_key": event_key,
                    "type": "rep",
                    "rep_event": python_to_dynamodb(json.loads(rep_event.model_dump_json()))
                }
                batch.put_item(Item=item)

            for err in form_errors:
                exercise_id = err.get("exercise_id") if isinstance(err, dict) else getattr(err, "exercise_id")
                form_err_data = err.get("form_error") if isinstance(err, dict) else getattr(err, "form_error")
                timestamp_val = err.get("timestamp") if isinstance(err, dict) else getattr(err, "timestamp", None)

                if isinstance(form_err_data, dict):
                    form_error_obj = FormError.model_validate(form_err_data)
                else:
                    form_error_obj = form_err_data

                ts = timestamp_val or datetime.now(timezone.utc)
                if isinstance(ts, str):
                    try:
                        ts = datetime.fromisoformat(ts)
                    except ValueError:
                        ts = datetime.now(timezone.utc)
                elif not isinstance(ts, datetime):
                    ts = datetime.now(timezone.utc)

                ts_iso = ts.isoformat()
                event_id = str(uuid.uuid4())

                event_key = f"error#{ts_iso}#{event_id}"
                item = {
                    "session_id": str(session_id),
                    "event_key": event_key,
                    "type": "error",
                    "form_error": python_to_dynamodb(json.loads(form_error_obj.model_dump_json()))
                }
                batch.put_item(Item=item)

        # 2. Update session metadata and generate summary
        response = self.table.get_item(Key={"session_id": str(session_id)})
        session_item = response.get("Item")
        if session_item is None:
            return False

        session_item = dynamodb_to_python(session_item)
        session_item["id"] = session_item.pop("session_id")

        reps_validated = []
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

            reps_validated.append(RepEvent(
                id=uuid.uuid4(),
                session_id=session_id,
                exercise_id=UUID(str(exercise_id)),
                rep_count=rep_count,
                timestamp=ts,
                metadata=metadata or {}
            ))

        form_errors_validated = []
        for err in form_errors:
            form_err_data = err.get("form_error") if isinstance(err, dict) else getattr(err, "form_error")
            if isinstance(form_err_data, dict):
                form_error_obj = FormError.model_validate(form_err_data)
            else:
                form_error_obj = form_err_data
            form_errors_validated.append(form_error_obj)

        playback_events_validated = []
        for ev in playback_events:
            event_type = ev.get("event_type") if isinstance(ev, dict) else getattr(ev, "event_type", "")
            timestamp_ms = ev.get("timestamp_ms") if isinstance(ev, dict) else getattr(ev, "timestamp_ms", 0.0)
            metadata = ev.get("metadata") if isinstance(ev, dict) else getattr(ev, "metadata", {})

            playback_events_validated.append(PlaybackEvent(
                event_type=event_type,
                timestamp_ms=timestamp_ms,
                metadata=metadata or {}
            ))

        session_item["reps"] = [json.loads(r.model_dump_json()) for r in reps_validated]
        session_item["form_errors"] = [json.loads(f.model_dump_json()) for f in form_errors_validated]
        session_item["playback_events"] = [json.loads(p.model_dump_json()) for p in playback_events_validated]

        session = Session.model_validate(session_item)
        session.ended_at = ended_at or datetime.now(timezone.utc)

        session.reps_count = len(reps_validated)
        session.form_errors_count = len(form_errors_validated)

        assistant_cues = 0
        haptic_cues = 0
        p_events = 0
        for evt in playback_events_validated:
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

        session.summary = generate_session_summary(session)

        save_item = json.loads(session.model_dump_json())
        save_item.pop("reps", None)
        save_item.pop("form_errors", None)
        save_item.pop("playback_events", None)
        save_item["session_id"] = save_item.pop("id")
        save_item = python_to_dynamodb(save_item)
        self.table.put_item(Item=save_item)
        return True

    def list_sessions(self, user_id: UUID, include_active: bool = False) -> List[Session]:
        response = self.table.query(
            IndexName="UserIdStartedAtIndex",
            KeyConditionExpression=Key("user_id").eq(str(user_id)),
            ScanIndexForward=False
        )
        items = response.get("Items", [])

        sessions = []
        for item in items:
            item = dynamodb_to_python(item)
            item["id"] = item.pop("session_id")

            # Avoid heavy queries by populating empty lists for listing
            item["reps"] = []
            item["form_errors"] = []
            item["playback_events"] = []

            session = Session.model_validate(item)
            if include_active or session.ended_at is not None:
                sessions.append(session)

        def sort_key(s: Session):
            return s.ended_at if s.ended_at is not None else s.started_at

        return sorted(sessions, key=sort_key, reverse=True)
