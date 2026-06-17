import json
import uuid
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from app.core.config import settings
from app.core.storage import aws_client
from app.core.storage.interfaces import UserStorage
from app.models.schemas import (
    User,
    UserSettingsUpdate,
    AssistantPersona,
    FeedbackModality,
    AudioCoexistenceSettings,
    InterruptionLevel,
    AssistantVerbosity,
)
from app.core.storage.dynamodb.utils import python_to_dynamodb, dynamodb_to_python

PROTOTYPE_USER_ID = UUID("00000000-0000-0000-0000-000000000001")


class DynamoDBUserStorage(UserStorage):
    """DynamoDB implementation for User accessibility profile storage."""

    def __init__(self) -> None:
        self._dynamodb = None

    @property
    def table(self):
        if self._dynamodb is None:
            self._dynamodb = aws_client.get_dynamodb_resource()
        return self._dynamodb.Table(settings.DYNAMODB_USERS_TABLE)

    def _seed_prototype_user(self, table) -> User:
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
        item = json.loads(proto.model_dump_json())
        # Map Pydantic id to DynamoDB key user_id
        item["user_id"] = item.pop("id")
        item = python_to_dynamodb(item)
        table.put_item(Item=item)
        return proto

    def register_user(self, user: User) -> User:
        if not user.id:
            user.id = uuid.uuid4()
        if not user.created_at:
            user.created_at = datetime.now(timezone.utc)
        item = json.loads(user.model_dump_json())
        # Map Pydantic id to DynamoDB key user_id
        item["user_id"] = item.pop("id")
        item = python_to_dynamodb(item)
        self.table.put_item(Item=item)
        return user

    def get_user(self, user_id: UUID) -> Optional[User]:
        response = self.table.get_item(Key={"user_id": str(user_id)})
        item = response.get("Item")
        if item is None:
            if user_id == PROTOTYPE_USER_ID:
                return self._seed_prototype_user(self.table)
            return None
        
        # Deserialize decimals and restore key
        item = dynamodb_to_python(item)
        item["id"] = item.pop("user_id")
        return User.model_validate(item)

    def update_user_settings(self, user_id: UUID, settings: UserSettingsUpdate) -> Optional[User]:
        user = self.get_user(user_id)
        if user is None:
            return None

        if settings.assistant_persona is not None:
            user.assistant_persona = settings.assistant_persona
        if settings.voice_settings is not None:
            user.voice_settings = settings.voice_settings
        if settings.feedback_modalities is not None:
            user.feedback_modalities = settings.feedback_modalities
        if settings.audio_coexistence is not None:
            user.audio_coexistence = settings.audio_coexistence
        if settings.haptic_preferences is not None:
            user.haptic_preferences = settings.haptic_preferences

        item = json.loads(user.model_dump_json())
        # Map Pydantic id to DynamoDB key user_id
        item["user_id"] = item.pop("id")
        item = python_to_dynamodb(item)
        self.table.put_item(Item=item)
        return user
