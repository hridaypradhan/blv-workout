import json
import unittest
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock
from uuid import UUID, uuid4

from app.core.config import settings
from app.core.storage.dynamodb import (
    DynamoDBUserStorage,
    DynamoDBJobStorage,
    DynamoDBSessionStorage,
    DynamoDBSessionEventStorage,
    PROTOTYPE_USER_ID,
)
from app.models.schemas import (
    User,
    UserSettingsUpdate,
    Session,
    FormError,
    PlaybackEvent,
    RepEvent,
    ProcessingStage,
    AssistantPersona,
    FeedbackModality,
)
from app.core.job_store import JobRecord


class TestDynamoDBStorage(unittest.TestCase):

    def setUp(self) -> None:
        self.mock_dynamodb = MagicMock()
        self.mock_table = MagicMock()
        self.mock_events_table = MagicMock()

        # Map tables
        def get_table(name):
            if name == settings.DYNAMODB_SESSION_EVENTS_TABLE:
                return self.mock_events_table
            return self.mock_table

        self.mock_dynamodb.Table.side_effect = get_table

        self.get_dynamodb_patcher = patch(
            "app.core.storage.aws_client.get_dynamodb_resource",
            return_value=self.mock_dynamodb
        )
        self.get_dynamodb_patcher.start()

    def tearDown(self) -> None:
        self.get_dynamodb_patcher.stop()

    def test_user_storage_get_and_register(self) -> None:
        storage = DynamoDBUserStorage()
        user_id = uuid4()
        user_data = {
            "user_id": str(user_id),
            "email": "test@fita11y.com",
            "name": "Test User",
            "assistant_persona": "supportive",
            "voice_settings": {"tts_rate": 1.0, "voice_id": "system"},
            "feedback_modalities": ["audio"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        # Test get missing
        self.mock_table.get_item.return_value = {}
        res = storage.get_user(user_id)
        self.assertIsNone(res)

        # Test get existing
        self.mock_table.get_item.return_value = {"Item": user_data}
        res = storage.get_user(user_id)
        self.assertIsNotNone(res)
        self.assertEqual(res.email, "test@fita11y.com")

        # Test register
        user = User(
            id=user_id,
            email="new@fita11y.com",
            name="New User",
            assistant_persona=AssistantPersona.DIRECT,
            feedback_modalities=[FeedbackModality.AUDIO],
        )
        registered = storage.register_user(user)
        self.mock_table.put_item.assert_called_once()
        self.assertEqual(registered.email, "new@fita11y.com")

    def test_user_storage_prototype_seeding(self) -> None:
        storage = DynamoDBUserStorage()
        self.mock_table.get_item.return_value = {}
        
        # Requesting prototype user seeds it
        res = storage.get_user(PROTOTYPE_USER_ID)
        self.assertIsNotNone(res)
        self.assertEqual(res.id, PROTOTYPE_USER_ID)
        self.assertEqual(res.email, "prototype.user@fita11y.local")
        self.mock_table.put_item.assert_called_once()

    def test_user_storage_update_settings(self) -> None:
        storage = DynamoDBUserStorage()
        user_id = uuid4()
        user_data = {
            "user_id": str(user_id),
            "email": "test@fita11y.com",
            "name": "Test User",
            "assistant_persona": "supportive",
            "voice_settings": {"tts_rate": 1.0, "voice_id": "system"},
            "feedback_modalities": ["audio"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self.mock_table.get_item.return_value = {"Item": user_data}

        update = UserSettingsUpdate(
            assistant_persona=AssistantPersona.DIRECT,
            feedback_modalities=[FeedbackModality.HAPTIC],
        )
        updated = storage.update_user_settings(user_id, update)
        self.assertIsNotNone(updated)
        self.assertEqual(updated.assistant_persona, AssistantPersona.DIRECT)
        self.assertEqual(updated.feedback_modalities, [FeedbackModality.HAPTIC])

    def test_job_storage_crud(self) -> None:
        storage = DynamoDBJobStorage()
        youtube_url = "https://youtube.com/watch?v=12345678901"

        # Create
        job = storage.create_job(youtube_url)
        self.assertEqual(job.youtube_url, youtube_url)
        self.mock_table.put_item.assert_called_once()
        # Verify put_item payload does not contain transcript or transcript_segments
        called_kwargs = self.mock_table.put_item.call_args[1]
        self.assertNotIn("transcript", called_kwargs["Item"])
        self.assertNotIn("transcript_segments", called_kwargs["Item"])
        
        # Get
        job_dict = job.to_dict()
        job_dict["library_partition"] = "JOBS"
        self.mock_table.get_item.return_value = {"Item": job_dict}
        retrieved = storage.get_job(job.video_id)
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.video_id, job.video_id)

        # Update stage
        storage.update_stage(
            job.video_id,
            ProcessingStage.TRANSCRIBING,
            transcript="Large transcript",
            transcript_segments=[{"text": "Hello"}]
        )
        self.assertEqual(self.mock_table.put_item.call_count, 2)
        # Verify update_stage put_item payload does not contain transcript or transcript_segments
        called_kwargs_update = self.mock_table.put_item.call_args[1]
        self.assertNotIn("transcript", called_kwargs_update["Item"])
        self.assertNotIn("transcript_segments", called_kwargs_update["Item"])

        # Delete
        self.mock_table.get_item.return_value = {"Item": job_dict}
        deleted = storage.delete_job(job.video_id)
        self.assertTrue(deleted)
        self.mock_table.delete_item.assert_called_once_with(Key={"video_id": job.video_id})

    def test_session_storage_and_events(self) -> None:
        storage = DynamoDBSessionStorage()
        user_id = uuid4()
        video_id = uuid4()
        session_id = uuid4()

        # Mock database session response
        session_data = {
            "session_id": str(session_id),
            "user_id": str(user_id),
            "video_id": str(video_id),
            "video_title": "Active Workout Session",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "ended_at": None,
            "summary": None,
        }
        self.mock_table.get_item.return_value = {"Item": session_data}

        # Mock database events response
        rep_event = RepEvent(
            id=uuid4(),
            session_id=session_id,
            exercise_id=uuid4(),
            rep_count=3,
            timestamp=datetime.now(timezone.utc),
            metadata={}
        )
        self.mock_events_table.query.return_value = {
            "Items": [
                {
                    "session_id": str(session_id),
                    "event_key": "rep#2026-06-16T00:00:00#123",
                    "type": "rep",
                    "rep_event": json.loads(rep_event.model_dump_json())
                }
            ]
        }

        # Get session gathers the events
        session = storage.get_session(session_id)
        self.assertIsNotNone(session)
        self.assertEqual(len(session.reps), 1)
        self.assertEqual(session.reps[0].rep_count, 3)

    def test_session_event_storage_adding_events(self) -> None:
        storage = DynamoDBSessionEventStorage()
        session_id = uuid4()
        exercise_id = uuid4()

        active_session = Session(
            id=session_id,
            user_id=uuid4(),
            video_id=uuid4(),
            started_at=datetime.now(timezone.utc),
            ended_at=None,
            reps=[],
            form_errors=[],
            playback_events=[],
            summary=None
        )

        with patch.object(storage.session_storage, "get_session", return_value=active_session):
            # Add rep
            res = storage.add_rep(session_id, exercise_id, 5)
            self.assertTrue(res)
            self.mock_events_table.put_item.assert_called_once()
            
            # Add form error
            err = FormError(
                joint="hip",
                observed_angle=25.0,
                expected_range=(10.0, 20.0),
                severity="medium",
                message="Stand taller"
            )
            res_err = storage.add_form_error(session_id, err)
            self.assertTrue(res_err)
            
            # Add playback event
            res_pb = storage.add_playback_event(session_id, "play", 1500.0)
            self.assertTrue(res_pb)
            self.assertEqual(self.mock_events_table.put_item.call_count, 3)

    def test_user_decimal_serialization(self) -> None:
        storage = DynamoDBUserStorage()
        user_id = uuid4()
        user = User(
            id=user_id,
            email="decimal@fita11y.com",
            name="Decimal User",
            voice_settings={"tts_rate": 1.25, "voice_id": "system"},
            assistant_persona=AssistantPersona.DIRECT,
            feedback_modalities=[FeedbackModality.AUDIO],
        )
        storage.register_user(user)
        called_args, called_kwargs = self.mock_table.put_item.call_args
        put_item_payload = called_kwargs.get("Item")
        
        # Verify user_id is passed and id is not present
        self.assertIn("user_id", put_item_payload)
        self.assertEqual(put_item_payload["user_id"], str(user_id))
        self.assertNotIn("id", put_item_payload)

        # Assert float in nested dict was converted to Decimal
        from decimal import Decimal
        self.assertIsInstance(put_item_payload["voice_settings"]["tts_rate"], Decimal)
        self.assertEqual(put_item_payload["voice_settings"]["tts_rate"], Decimal("1.25"))

        # Assert read path maps Decimal back to float and maps user_id to id
        self.mock_table.get_item.return_value = {"Item": put_item_payload}
        retrieved = storage.get_user(user_id)
        self.assertIsInstance(retrieved.voice_settings["tts_rate"], float)
        self.assertEqual(retrieved.voice_settings["tts_rate"], 1.25)
        self.assertEqual(retrieved.id, user_id)

    def test_session_decimal_serialization(self) -> None:
        storage = DynamoDBSessionStorage()
        user_id = uuid4()
        video_id = uuid4()
        
        # Test session creation key mapping
        session = storage.create_session(
            user_id=user_id,
            video_id=video_id,
            video_title="Workout With Floats"
        )
        called_args, called_kwargs = self.mock_table.put_item.call_args
        put_item_payload = called_kwargs.get("Item")
        self.assertIn("session_id", put_item_payload)
        self.assertEqual(put_item_payload["session_id"], str(session.id))
        self.assertNotIn("id", put_item_payload)
        
        # Mock event queries with floats (observed_angle, expected_range, timestamp_ms)
        from decimal import Decimal
        mock_events = [
            {
                "session_id": str(session.id),
                "event_key": "error#2026-06-16T00:00:00#123",
                "type": "error",
                "form_error": {
                    "joint": "knee",
                    "observed_angle": Decimal("72.5"),
                    "expected_range": [Decimal("75.0"), Decimal("180.0")],
                    "severity": "medium",
                    "message": "Too deep"
                }
            },
            {
                "session_id": str(session.id),
                "event_key": "playback#000000001500#456",
                "type": "playback",
                "playback_event": {
                    "event_type": "play",
                    "timestamp_ms": Decimal("1500.5"),
                    "metadata": {"speed": Decimal("1.25")}
                }
            }
        ]
        self.mock_table.get_item.return_value = {"Item": put_item_payload}
        self.mock_events_table.query.return_value = {"Items": mock_events}
        
        retrieved = storage.get_session(session.id)
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.id, session.id)
        
        # Check float conversions in nested form_errors
        self.assertEqual(len(retrieved.form_errors), 1)
        self.assertIsInstance(retrieved.form_errors[0].observed_angle, float)
        self.assertEqual(retrieved.form_errors[0].observed_angle, 72.5)
        self.assertEqual(retrieved.form_errors[0].expected_range, (75.0, 180.0))
        
        # Check float conversions in nested playback_events
        self.assertEqual(len(retrieved.playback_events), 1)
        self.assertIsInstance(retrieved.playback_events[0].timestamp_ms, float)
        self.assertEqual(retrieved.playback_events[0].timestamp_ms, 1500.5)
        self.assertEqual(retrieved.playback_events[0].metadata["speed"], 1.25)

    def test_session_event_storage_missing_or_ended_session_fails(self) -> None:
        event_storage = DynamoDBSessionEventStorage()
        session_id = uuid4()
        exercise_id = uuid4()

        # Mock session_storage.get_session to return None (missing)
        with patch.object(event_storage.session_storage, "get_session", return_value=None):
            res_rep = event_storage.add_rep(session_id, exercise_id, 3)
            self.assertFalse(res_rep)
            
            err = FormError(
                joint="hip",
                observed_angle=25.0,
                expected_range=(10.0, 20.0),
                severity="medium",
                message="Stand taller"
            )
            res_err = event_storage.add_form_error(session_id, err)
            self.assertFalse(res_err)
            
            res_pb = event_storage.add_playback_event(session_id, "play", 1500.0)
            self.assertFalse(res_pb)

        # Mock session_storage.get_session to return ended session
        ended_session = Session(
            id=session_id,
            user_id=uuid4(),
            video_id=uuid4(),
            started_at=datetime.now(timezone.utc),
            ended_at=datetime.now(timezone.utc),
            reps=[],
            form_errors=[],
            playback_events=[],
            summary="Ended workout"
        )
        with patch.object(event_storage.session_storage, "get_session", return_value=ended_session):
            res_rep = event_storage.add_rep(session_id, exercise_id, 3)
            self.assertFalse(res_rep)
            
            res_err = event_storage.add_form_error(session_id, err)
            self.assertFalse(res_err)
            
            res_pb = event_storage.add_playback_event(session_id, "play", 1500.0)
            self.assertFalse(res_pb)
