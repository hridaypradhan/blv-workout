import json
import uuid
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from app.core.config import settings
from app.core.storage import aws_client
from app.core.storage.interfaces import SessionEventStorage
from app.models.schemas import (
    RepEvent,
    FormError,
    PlaybackEvent,
)
from app.core.storage.dynamodb.utils import python_to_dynamodb


class DynamoDBSessionEventStorage(SessionEventStorage):
    """DynamoDB implementation for Session Event telemetry storage."""

    def __init__(self) -> None:
        self._dynamodb = None
        self._session_storage = None

    @property
    def table(self):
        if self._dynamodb is None:
            self._dynamodb = aws_client.get_dynamodb_resource()
        return self._dynamodb.Table(settings.DYNAMODB_SESSION_EVENTS_TABLE)

    @property
    def session_storage(self):
        if self._session_storage is None:
            from app.core.storage.dynamodb.sessions import DynamoDBSessionStorage
            self._session_storage = DynamoDBSessionStorage()
        return self._session_storage

    def add_rep(
        self,
        session_id: UUID,
        exercise_id: UUID,
        rep_count: int,
        timestamp: Optional[datetime] = None,
        metadata: Optional[dict] = None
    ) -> bool:
        session = self.session_storage.get_session(session_id)
        if session is None or session.ended_at is not None:
            return False

        ts = timestamp or datetime.now(timezone.utc)
        ts_iso = ts.isoformat()
        event_id = str(uuid.uuid4())

        rep_event = RepEvent(
            id=UUID(event_id),
            session_id=session_id,
            exercise_id=exercise_id,
            rep_count=rep_count,
            timestamp=ts,
            metadata=metadata or {}
        )

        event_key = f"rep#{ts_iso}#{event_id}"
        rep_event_dict = json.loads(rep_event.model_dump_json())
        item = {
            "session_id": str(session_id),
            "event_key": event_key,
            "type": "rep",
            "rep_event": python_to_dynamodb(rep_event_dict)
        }
        self.table.put_item(Item=item)
        return True

    def add_form_error(self, session_id: UUID, form_error: FormError) -> bool:
        session = self.session_storage.get_session(session_id)
        if session is None or session.ended_at is not None:
            return False

        ts_iso = datetime.now(timezone.utc).isoformat()
        event_id = str(uuid.uuid4())

        event_key = f"error#{ts_iso}#{event_id}"
        form_error_dict = json.loads(form_error.model_dump_json())
        item = {
            "session_id": str(session_id),
            "event_key": event_key,
            "type": "error",
            "form_error": python_to_dynamodb(form_error_dict)
        }
        self.table.put_item(Item=item)
        return True

    def add_playback_event(
        self,
        session_id: UUID,
        event_type: str,
        timestamp_ms: Optional[float] = None,
        metadata: Optional[dict] = None
    ) -> bool:
        session = self.session_storage.get_session(session_id)
        if session is None or session.ended_at is not None:
            return False

        ts_ms = timestamp_ms or 0.0
        event_id = str(uuid.uuid4())

        playback_event = PlaybackEvent(
            event_type=event_type,
            timestamp_ms=ts_ms,
            metadata=metadata or {}
        )

        event_key = f"playback#{ts_ms:012.3f}#{event_id}"
        playback_event_dict = json.loads(playback_event.model_dump_json())
        item = {
            "session_id": str(session_id),
            "event_key": event_key,
            "type": "playback",
            "playback_event": python_to_dynamodb(playback_event_dict)
        }
        self.table.put_item(Item=item)
        return True
