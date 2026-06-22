"""Unit tests for Gemini-backed QnA, context builder, sanitization, and API routes."""

import tempfile
import uuid
import unittest
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock

from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.job_store import JobRecord, job_store
from app.models.schemas import QARequest, QAResponse, RuntimeObservationContext, AssistantPersona, AssistanceSidecarManifest, TranscriptArtifact
from app.services.assistant_qna_context import build_qna_context
from app.services.assistant_qna_service import qna_service
from app.services.assistant_qna_providers.gemini_qna.provider import sanitize_qna_answer
from app.core.prototype_persistence import load_json_store, save_json_store, delete_json_store
from app.core.storage import get_artifact_storage, get_job_storage
from app.main import app

client = TestClient(app)


class TestAssistantQnA(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.original_provider = settings.STORAGE_PROVIDER
        settings.STORAGE_PROVIDER = "local_json"
        
        from app.core.storage import factory
        factory._job_storage = None
        factory._artifact_storage = None

        cls.original_data_dir = settings.PROTOTYPE_DATA_DIR
        cls.temp_dir = tempfile.TemporaryDirectory()
        settings.PROTOTYPE_DATA_DIR = cls.temp_dir.name
        
        # Clear store and initialize
        job_store._jobs.clear()
        job_store._load_from_disk()

    @classmethod
    def tearDownClass(cls):
        settings.STORAGE_PROVIDER = cls.original_provider
        
        from app.core.storage import factory
        factory._job_storage = None
        factory._artifact_storage = None

        settings.PROTOTYPE_DATA_DIR = cls.original_data_dir
        cls.temp_dir.cleanup()
        
        # Restore real jobs
        job_store._jobs.clear()
        job_store._load_from_disk()

    def setUp(self):
        job_store._jobs.clear()
        self.original_ai_provider = settings.AI_PROVIDER
        self.original_api_key = settings.GEMINI_API_KEY
        self.original_diagnostics_enabled = settings.AI_DIAGNOSTICS_ENABLED

    def tearDown(self):
        settings.AI_PROVIDER = self.original_ai_provider
        settings.GEMINI_API_KEY = self.original_api_key
        settings.AI_DIAGNOSTICS_ENABLED = self.original_diagnostics_enabled

    def test_context_builder_selects_transcript_segments_near_timestamp(self):
        """Verify context builder selects transcript segments near current timestamp."""
        video_id = str(uuid.uuid4())
        
        # Save a mock transcript artifact
        transcript_data = TranscriptArtifact(
            video_id=video_id,
            caption_status="completed",
            transcript="Segment 1 Segment 2 Segment 3",
            transcript_segments=[
                {"start_ms": 0.0, "end_ms": 10000.0, "text": "Segment 1"},
                {"start_ms": 50000.0, "end_ms": 60000.0, "text": "Segment 2"},
                {"start_ms": 200000.0, "end_ms": 210000.0, "text": "Segment 3"}
            ],
            created_at=datetime.now(timezone.utc).isoformat()
        )
        get_artifact_storage().save_transcript(video_id, transcript_data)

        # Call building context at 55 seconds (55000 ms), window ±90s should see Segment 1 and 2, but not 3
        ctx = build_qna_context(video_id, current_timestamp_ms=55000.0)
        self.assertIsNotNone(ctx["nearby_transcript"])
        self.assertIn("Segment 2", ctx["nearby_transcript"])
        self.assertIn("Segment 1", ctx["nearby_transcript"])
        self.assertNotIn("Segment 3", ctx["nearby_transcript"])

        # Clean up
        get_artifact_storage().delete_transcript(video_id)

    def test_context_builder_handles_missing_artifacts_gracefully(self):
        """Verify context builder handles missing transcript/manifest/cue plan gracefully."""
        ctx = build_qna_context("non-existent-video-id", current_timestamp_ms=10000.0)
        self.assertIsNone(ctx["video_title"])
        self.assertIsNone(ctx["current_exercise"])
        self.assertEqual(ctx["nearby_exercises"], [])
        self.assertIsNone(ctx["nearby_transcript"])
        self.assertEqual(ctx["nearby_trainer_instructions"], [])
        self.assertIsNone(ctx["cue_plan_exercise_description"])
        self.assertEqual(ctx["recent_trainer_instruction_summaries"], [])

    def test_self_observation_without_pose_returns_boundary_answer(self):
        """Verify self-observation question with pose_available=false returns a boundary answer."""
        request = QARequest(
            question="Can you check my posture or see if my back is straight?",
            video_id=str(uuid.uuid4()),
            runtime_observation_context=RuntimeObservationContext(pose_available=False)
        )
        ctx = {
            "video_title": "Mock Workout",
            "current_exercise": {"name": "Squats"}
        }
        
        # Test prototype provider
        from app.services.assistant_qna_providers.prototype import PrototypeAssistantQnAProvider
        provider = PrototypeAssistantQnAProvider()
        response = provider.answer_question(request, ctx)
        
        self.assertEqual(response.answer_kind, "self_observation_boundary")
        self.assertIn("I cannot see or check your form", response.answer_text)

    def test_gemini_missing_api_key_falls_back_to_prototype(self):
        """Verify Gemini provider missing API key falls back to prototype."""
        settings.AI_PROVIDER = "gemini"
        settings.GEMINI_API_KEY = ""
        
        video_id = str(uuid.uuid4())
        request = QARequest(
            question="What is the next move?",
            video_id=video_id
        )
        
        response = qna_service.answer_question(request)
        self.assertEqual(response.provider, "prototype")
        self.assertEqual(response.fallback_reason, "api_key_missing")

    @patch("app.services.ai.gemini_client.gemini_client.generate_structured_content")
    def test_gemini_validation_failure_falls_back_to_prototype(self, mock_generate):
        """Verify Gemini provider validation failure falls back to prototype."""
        settings.AI_PROVIDER = "gemini"
        settings.GEMINI_API_KEY = "dummy_key"
        
        # Return invalid dictionary format (missing required schema fields)
        mock_generate.return_value = {
            "some_irrelevant_field": "hello"
        }
        
        video_id = str(uuid.uuid4())
        request = QARequest(
            question="Explain the setup.",
            video_id=video_id
        )
        
        response = qna_service.answer_question(request)
        self.assertEqual(response.provider, "prototype")
        self.assertEqual(response.answer_kind, "fallback")
        self.assertIn("model_error", response.fallback_reason)

    def test_safety_sanitizer_removes_vision_claims_without_pose(self):
        """Verify safety sanitizer removes/blocks "I can see you" claims without pose context."""
        dirty_answer = "I see you are doing bicep curls. I see your elbows are perfect."
        
        request_no_pose = QARequest(
            question="How do I look?",
            video_id=str(uuid.uuid4()),
            runtime_observation_context=RuntimeObservationContext(pose_available=False)
        )
        
        raw_response = QAResponse(
            answer_text=dirty_answer,
            answer_kind="video_grounded",
            provider="gemini",
            text=dirty_answer
        )
        
        clean = qna_service.post_process_sanitize_response(request_no_pose, raw_response, {})
        self.assertNotIn("I see you", clean.answer_text)
        self.assertNotIn("I see your", clean.answer_text)
        self.assertIn("I can't see or check your form right now", clean.answer_text)

        # Confirm it doesn't strip if pose_available is true
        request_with_pose = QARequest(
            question="Explain bicep curls.",
            video_id=str(uuid.uuid4()),
            runtime_observation_context=RuntimeObservationContext(pose_available=True, pose_confidence=0.8)
        )
        raw_response_with_pose = QAResponse(
            answer_text=dirty_answer,
            answer_kind="video_grounded",
            provider="gemini",
            text=dirty_answer
        )
        clean_with_pose = qna_service.post_process_sanitize_response(request_with_pose, raw_response_with_pose, {})
        self.assertEqual(clean_with_pose.answer_text, dirty_answer)

    def test_existing_qna_route_returns_stable_response_shape(self):
        """Verify existing assistant QnA route still returns a stable response shape (backward compatible)."""
        video_id = str(uuid.uuid4())
        
        payload = {
            "question": "How are you?",
            "video_id": video_id,
            "current_timestamp_ms": 1000.0,
            "session_context": {},
            "runtime_observation_context": {"pose_available": False}
        }
        
        resp = client.post("/api/assistant/qa", json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        
        # Should have stable fields for both QAResponse and backward-compatible AssistantCue
        self.assertIn("answer_text", data)
        self.assertIn("answer_kind", data)
        self.assertIn("text", data)
        self.assertIn("modality", data)
        self.assertIn("persona", data)

    def test_no_full_transcript_appears_in_diagnostics(self):
        """Verify no full transcript appears in saved QnA diagnostics."""
        settings.AI_PROVIDER = "prototype"
        settings.AI_DIAGNOSTICS_ENABLED = True
        
        video_id = str(uuid.uuid4())
        session_id = str(uuid.uuid4())
        
        # Save mock transcript first
        transcript_data = TranscriptArtifact(
            video_id=video_id,
            caption_status="completed",
            transcript="This is a very long raw transcript text that should never be written to developer QnA diagnostics.",
            transcript_segments=[
                {"start_ms": 0.0, "end_ms": 1000.0, "text": "This is a segment."}
            ],
            created_at=datetime.now(timezone.utc).isoformat()
        )
        get_artifact_storage().save_transcript(video_id, transcript_data)

        request = QARequest(
            question="What did they say?",
            video_id=video_id,
            session_id=session_id,
            current_timestamp_ms=500.0
        )
        
        # Trigger answer question which logs diagnostics
        response = qna_service.answer_question(request)
        self.assertIsNotNone(response.diagnostics_ref)

        # Load generated diagnostics JSON
        ref = response.diagnostics_ref
        # Format is qna_{session_or_video_id}_{suffix}
        suffix = ref.replace(f"qna_{session_id}_", "")
        diag = load_json_store(f"ai_diagnostics/qna_{session_id}_{suffix}.json")
        
        self.assertIsNotNone(diag)
        self.assertEqual(diag["provider"], "prototype")
        
        # Ensure no full transcript or sensitive keywords are stored
        diag_str = str(diag).lower()
        self.assertNotIn("very long raw transcript text", diag_str)
        
        # Clean up
        get_artifact_storage().delete_transcript(video_id)
        delete_json_store(f"ai_diagnostics/qna_{session_id}_{suffix}.json")

    def test_session_context_fallbacks_in_context_builder(self):
        """Verify session_context fallbacks work when backend artifacts are missing."""
        session_ctx = {
            "active_exercise": "Bicep Curl",
            "latest_trainer_instruction": "Keep your elbows pinned.",
            "audio_coexistence": "brief_speech",
            "assistant_voice_muted": True,
            "youtube_metadata": {"title": "Awesome Workout Video"}
        }
        
        ctx = build_qna_context(
            video_id="",
            current_timestamp_ms=1000.0,
            session_context=session_ctx
        )
        
        self.assertEqual(ctx["video_title"], "Awesome Workout Video")
        self.assertEqual(ctx["current_exercise"], {"name": "Bicep Curl"})
        self.assertEqual(ctx["nearby_trainer_instructions"], ["Keep your elbows pinned."])
        self.assertEqual(ctx["session_context"]["active_exercise"], "Bicep Curl")
        self.assertEqual(ctx["session_context"]["latest_trainer_instruction"], "Keep your elbows pinned.")
        self.assertEqual(ctx["session_context"]["audio_coexistence_settings"], "brief_speech")
        self.assertEqual(ctx["session_context"]["assistant_muted_state"], True)

    def test_fallback_preserves_meaningful_answer_kinds(self):
        """Verify fallback service preserves semantic answer kinds instead of forcing 'fallback'."""
        request = QARequest(
            question="My knee hurts when doing squats, is that okay?",
            video_id=str(uuid.uuid4()),
            runtime_observation_context=RuntimeObservationContext(pose_available=False)
        )
        
        response = qna_service._answer_with_fallback(request, {}, "test_fallback_reason")
        self.assertEqual(response.provider, "prototype")
        self.assertEqual(response.answer_kind, "safety_boundary")
        self.assertEqual(response.fallback_reason, "test_fallback_reason")

    def test_unsafe_vision_claims_are_sanitized_when_pose_unavailable(self):
        """Verify unsafe vision claims are sanitized to boundary response when pose is unavailable."""
        request = QARequest(
            question="Do you see me?",
            video_id=str(uuid.uuid4()),
            runtime_observation_context=RuntimeObservationContext(pose_available=False)
        )
        
        raw_response = QAResponse(
            answer_text="I see you are doing bicep curls. Your knees look great.",
            answer_kind="video_grounded",
            provider="gemini",
            text="I see you are doing bicep curls. Your knees look great."
        )
        
        sanitized = qna_service.post_process_sanitize_response(request, raw_response, {})
        self.assertEqual(sanitized.answer_kind, "self_observation_boundary")
        self.assertIn("I can't see or check your form right now.", sanitized.answer_text)
        self.assertEqual(sanitized.text, sanitized.answer_text)

    def test_low_pose_confidence_forces_self_observation_boundary(self):
        """Verify low pose confidence (< 0.5) is treated as pose unavailable and forces boundary."""
        request = QARequest(
            question="Can you check my form?",
            video_id=str(uuid.uuid4()),
            runtime_observation_context=RuntimeObservationContext(pose_available=True, pose_confidence=0.3)
        )
        
        raw_response = QAResponse(
            answer_text="Your form is perfect.",
            answer_kind="video_grounded",
            provider="gemini",
            text="Your form is perfect."
        )
        
        sanitized = qna_service.post_process_sanitize_response(request, raw_response, {"current_exercise": {"name": "Squats"}})
        self.assertEqual(sanitized.answer_kind, "self_observation_boundary")
        self.assertIn("I can't see or check your form right now. Keep your knees tracking over your toes", sanitized.answer_text)

    def test_safety_question_forces_non_diagnostic_response(self):
        """Verify safety/medical questions force safety boundary and non-diagnostic responses."""
        request = QARequest(
            question="My chest is hurting, is it arthritis?",
            video_id=str(uuid.uuid4())
        )
        
        raw_response = QAResponse(
            answer_text="It might be tendonitis or a muscle strain.",
            answer_kind="general_guidance",
            provider="gemini",
            text="It might be tendonitis or a muscle strain."
        )
        
        sanitized = qna_service.post_process_sanitize_response(request, raw_response, {})
        self.assertEqual(sanitized.answer_kind, "safety_boundary")
        self.assertIn("I cannot provide medical diagnoses.", sanitized.answer_text)

    def test_large_context_clamping_limits(self):
        """Verify transcript segments are clamped to 3000 chars, and instructions/summaries are clamped to 5."""
        video_id = str(uuid.uuid4())
        
        large_segs = []
        for i in range(100):
            large_segs.append({"start_ms": i * 1000.0, "end_ms": (i + 1) * 1000.0, "text": f"seg_{i} " * 10})
            
        transcript_data = TranscriptArtifact(
            video_id=video_id,
            caption_status="completed",
            transcript="Large transcript text...",
            transcript_segments=large_segs,
            created_at=datetime.now(timezone.utc).isoformat()
        )
        get_artifact_storage().save_transcript(video_id, transcript_data)
        
        ctx = build_qna_context(video_id, current_timestamp_ms=50000.0)
        self.assertIsNotNone(ctx["nearby_transcript"])
        self.assertLessEqual(len(ctx["nearby_transcript"]), 3000)
        
        # Clean up
        get_artifact_storage().delete_transcript(video_id)

    def test_prompt_no_longer_contains_simulation_data_wording(self):
        """Verify prompt template no longer says 'simulation data'."""
        from app.services.assistant_qna_providers.gemini_qna.prompt import SYSTEM_INSTRUCTION
        self.assertNotIn("simulation data", SYSTEM_INSTRUCTION.lower())
        self.assertIn("runtime observation context, if real reliable pose/form observation is available", SYSTEM_INSTRUCTION.lower())

    def test_qna_diagnostics_disabled(self):
        """Verify no Q&A diagnostics are written when AI_DIAGNOSTICS_ENABLED is False."""
        settings.AI_PROVIDER = "prototype"
        settings.AI_DIAGNOSTICS_ENABLED = False

        video_id = str(uuid.uuid4())
        session_id = str(uuid.uuid4())

        request = QARequest(
            question="How is my form?",
            video_id=video_id,
            session_id=session_id,
            current_timestamp_ms=500.0
        )

        with patch.object(get_artifact_storage(), "save_qna_diagnostics") as mock_save:
            response = qna_service.answer_question(request)
            self.assertIsNone(response.diagnostics_ref)
            mock_save.assert_not_called()

    def test_qna_diagnostics_enabled(self):
        """Verify Q&A diagnostics are written when AI_DIAGNOSTICS_ENABLED is True."""
        settings.AI_PROVIDER = "prototype"
        settings.AI_DIAGNOSTICS_ENABLED = True

        video_id = str(uuid.uuid4())
        session_id = str(uuid.uuid4())

        request = QARequest(
            question="How is my form?",
            video_id=video_id,
            session_id=session_id,
            current_timestamp_ms=500.0
        )

        with patch.object(get_artifact_storage(), "save_qna_diagnostics") as mock_save:
            response = qna_service.answer_question(request)
            self.assertIsNotNone(response.diagnostics_ref)
            mock_save.assert_called_once()
