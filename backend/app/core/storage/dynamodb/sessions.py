import json
import uuid
from datetime import datetime, timezone
from typing import Optional, List
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

    def end_session(self, session_id: UUID) -> bool:
        session = self.get_session(session_id)
        if session is None:
            return False
        if session.ended_at is not None:
            return True

        session.ended_at = datetime.now(timezone.utc)
        session.summary = generate_session_summary(session)

        item = json.loads(session.model_dump_json())
        item.pop("reps", None)
        item.pop("form_errors", None)
        item.pop("playback_events", None)
        item["session_id"] = item.pop("id")
        item = python_to_dynamodb(item)
        self.table.put_item(Item=item)
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
            s_id = UUID(item["session_id"])
            session = self.get_session(s_id)
            if session:
                if include_active or session.ended_at is not None:
                    sessions.append(session)

        def sort_key(s: Session):
            return s.ended_at if s.ended_at is not None else s.started_at

        return sorted(sessions, key=sort_key, reverse=True)
