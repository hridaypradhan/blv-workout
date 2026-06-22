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

    def test_session_storage_finalize_session(self) -> None:
        storage = DynamoDBSessionStorage()
        session_id = uuid4()
        user_id = uuid4()
        video_id = uuid4()
        exercise_id = uuid4()

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

        # Set up mock batch writer
        mock_batch = MagicMock()
        mock_batch.__enter__.return_value = mock_batch
        self.mock_events_table.batch_writer.return_value = mock_batch

        reps = [
            {"exercise_id": str(exercise_id), "rep_count": 1, "timestamp": datetime.now(timezone.utc).isoformat(), "metadata": {}},
        ]
        form_errors = [
            {
                "exercise_id": str(exercise_id),
                "form_error": {
                    "joint": "left_knee",
                    "observed_angle": 120.0,
                    "expected_range": [0.0, 90.0],
                    "severity": "warning",
                    "message": "Knee alignment error"
                },
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        ]
        playback_events = [
            {"event_type": "play", "timestamp_ms": 100.0, "metadata": {}},
        ]

        success = storage.finalize_session(session_id, playback_events, reps, form_errors)
        self.assertTrue(success)
        self.assertEqual(mock_batch.put_item.call_count, 3)

    def test_session_exists_and_active(self) -> None:
        storage = DynamoDBSessionStorage()
        session_id = uuid4()

        # 1. Missing session
        self.mock_table.get_item.return_value = {}
        self.assertFalse(storage.session_exists_and_active(session_id))

        # 2. Active session
        self.mock_table.get_item.return_value = {
            "Item": {
                "session_id": str(session_id),
                "ended_at": None
            }
        }
        self.assertTrue(storage.session_exists_and_active(session_id))

        # 3. Ended session
        self.mock_table.get_item.return_value = {
            "Item": {
                "session_id": str(session_id),
                "ended_at": datetime.now(timezone.utc).isoformat()
            }
        }
        self.assertFalse(storage.session_exists_and_active(session_id))

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

    def test_session_storage_finalize_session_missing_fails(self) -> None:
        storage = DynamoDBSessionStorage()
        session_id = uuid4()

        # Mock table get_item to return None to simulate missing session
        self.mock_table.get_item.return_value = {}

        success = storage.finalize_session(session_id, [], [], [])
        self.assertFalse(success)

    def test_list_sessions_optimized(self) -> None:
        storage = DynamoDBSessionStorage()
        user_id = uuid4()

        # Mock database response for GSI query
        self.mock_table.query.return_value = {
            "Items": [
                {
                    "session_id": str(uuid4()),
                    "user_id": str(user_id),
                    "video_id": str(uuid4()),
                    "video_title": "Optimized Session 1",
                    "started_at": datetime.now(timezone.utc).isoformat(),
                    "ended_at": datetime.now(timezone.utc).isoformat(),
                    "summary": "Completed session summary.",
                    "reps_count": 5,
                    "form_errors_count": 2,
                    "assistant_interactions_count": 3,
                    "haptic_cues_count": 4,
                    "playback_interactions_count": 10
                }
            ]
        }

        sessions = storage.list_sessions(user_id)
        self.assertEqual(len(sessions), 1)
        session = sessions[0]
        self.assertEqual(session.video_title, "Optimized Session 1")
        self.assertEqual(session.reps_count, 5)
        self.assertEqual(session.form_errors_count, 2)
        # Verify that events table was NOT queried
        self.mock_events_table.query.assert_not_called()
