"""Unit tests for SidecarService provider routing, validation, and fallback handling."""

from __future__ import annotations

import tempfile
import uuid
import unittest
from unittest.mock import patch, MagicMock

from app.core.config import settings
from app.core.job_store import JobRecord, job_store
from app.models.schemas import ProcessingStage
from app.services.sidecar_service import sidecar_service
from app.services.ai.errors import AIProviderAPIError, AIProviderResponseParseError


class TestSidecarService(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.original_data_dir = settings.PROTOTYPE_DATA_DIR
        cls.temp_dir = tempfile.TemporaryDirectory()
        settings.PROTOTYPE_DATA_DIR = cls.temp_dir.name
        
        # Re-initialize/clear the store so it points to the temp directory
        job_store._jobs.clear()
        job_store._load_from_disk()

    @classmethod
    def tearDownClass(cls):
        settings.PROTOTYPE_DATA_DIR = cls.original_data_dir
        cls.temp_dir.cleanup()
        
        # Restore the real data directory jobs
        job_store._jobs.clear()
        job_store._load_from_disk()

    def setUp(self):
        job_store._jobs.clear()
        from app.services.ai.gemini_client import gemini_client
        gemini_client._client = None

    @patch("app.services.sidecar_service.settings")
    def test_provider_fallback_when_key_missing(self, mock_settings):
        """Verify that provider falls back to prototype when key is missing."""
        mock_settings.AI_PROVIDER = "gemini"
        mock_settings.GEMINI_API_KEY = ""

        job = JobRecord(
            video_id=str(uuid.uuid4()),
            youtube_url="https://youtube.com/watch?v=12345678901",
            youtube_id="12345678901",
            duration=300.0
        )
        job_store._jobs[job.video_id] = job
        manifest = sidecar_service.generate_sidecar(job, "some transcript")
        self.assertEqual(manifest.youtube_id, job.youtube_id)
        self.assertTrue(len(manifest.exercise_timeline_anchors) > 0)
        self.assertEqual(job.sidecar_provider, "prototype")
        self.assertIn("api_key_missing", job.sidecar_fallback_reason)

    @patch("app.services.sidecar_service.settings")
    def test_gemini_caption_availability_checks(self, mock_settings):
        """Verify Gemini mode falls back before model call when captions are missing."""
        mock_settings.AI_PROVIDER = "gemini"
        mock_settings.GEMINI_API_KEY = "fake_key"

        job = JobRecord(
            video_id=str(uuid.uuid4()),
            youtube_url="https://youtube.com/watch?v=12345678901",
            youtube_id="12345678901",
            duration=300.0,
            caption_status="captions_unavailable"
        )
        job_store._jobs[job.video_id] = job
        manifest = sidecar_service.generate_sidecar(job, "")
        self.assertEqual(job.sidecar_provider, "prototype")
        self.assertIn("captions_missing", job.sidecar_fallback_reason)

    @patch("app.services.sidecar_providers.gemini_sidecar.provider.GeminiSidecarProvider.generate_manifest")
    @patch("app.services.sidecar_service.settings")
    def test_gemini_fallback_on_api_error(self, mock_settings, mock_generate):
        """Verify fallback behavior and reason logging when Gemini provider raises AIProviderAPIError."""
        mock_settings.AI_PROVIDER = "gemini"
        mock_settings.GEMINI_API_KEY = "fake-key"
        mock_generate.side_effect = AIProviderAPIError("Quota exceeded")

        job = JobRecord(
            video_id=str(uuid.uuid4()),
            youtube_url="https://youtube.com/watch?v=12345678901",
            youtube_id="12345678901",
            duration=300.0,
            caption_status="captions_found"
        )
        job_store._jobs[job.video_id] = job

        manifest = sidecar_service.generate_sidecar(job, "Some transcript content")
        self.assertEqual(job.sidecar_provider, "prototype")
        self.assertEqual(job.sidecar_fallback_reason, "model_error: The AI provider failed to generate a response")

    @patch("app.services.sidecar_providers.gemini_sidecar.provider.GeminiSidecarProvider.generate_manifest")
    @patch("app.services.sidecar_service.settings")
    def test_gemini_fallback_on_parse_error(self, mock_settings, mock_generate):
        """Verify fallback behavior and reason logging when Gemini provider raises AIProviderResponseParseError."""
        mock_settings.AI_PROVIDER = "gemini"
        mock_settings.GEMINI_API_KEY = "fake-key"
        mock_generate.side_effect = AIProviderResponseParseError("AI response schema conversion failed")

        job = JobRecord(
            video_id=str(uuid.uuid4()),
            youtube_url="https://youtube.com/watch?v=12345678901",
            youtube_id="12345678901",
            duration=300.0,
            caption_status="captions_found"
        )
        job_store._jobs[job.video_id] = job

        manifest = sidecar_service.generate_sidecar(job, "Some transcript content")
        self.assertEqual(job.sidecar_provider, "prototype")
        self.assertEqual(job.sidecar_fallback_reason, "model_error: AI response schema conversion failed")

    @patch("app.services.preprocessing_service.get_youtube_transcript")
    @patch("app.services.preprocessing_service.fetch_youtube_metadata")
    @patch("app.services.preprocessing_service.save_manifest_to_disk")
    def test_preprocessing_completes_in_prototype_mode(self, mock_save, mock_meta, mock_transcript):
        """Verify that pipeline completes successfully in prototype mode."""
        mock_meta.return_value = {
            "title": "Valid Workout",
            "channel_name": "Test Coach",
            "thumbnail_url": "http://img.png",
            "duration": 150.0,
        }
        mock_transcript.return_value = ([], "", "captions_unavailable")

        from app.services.preprocessing_service import run_assistance_preparation

        job = job_store.create_job("https://youtube.com/watch?v=12345678901")
        run_assistance_preparation(job.video_id, job.youtube_url)

        updated_job = job_store.get_job(job.video_id)
        self.assertEqual(updated_job.stage, ProcessingStage.COMPLETED)
        self.assertTrue(mock_save.called)

    @patch("app.services.preprocessing_service.settings")
    @patch("app.services.preprocessing_service.get_youtube_transcript")
    @patch("app.services.preprocessing_service.fetch_youtube_metadata")
    def test_offline_prototype_mode_bypasses_get_youtube_transcript(self, mock_meta, mock_transcript, mock_settings):
        """Verify that pipeline in offline prototype mode bypasses get_youtube_transcript completely."""
        mock_settings.AI_PROVIDER = "prototype"
        mock_meta.return_value = {
            "title": "Valid Workout",
            "channel_name": "Test Coach",
            "thumbnail_url": "http://img.png",
            "duration": 150.0,
        }

        from app.services.preprocessing_service import run_assistance_preparation
        job = job_store.create_job("https://youtube.com/watch?v=12345678901")
        run_assistance_preparation(job.video_id, job.youtube_url)

        mock_transcript.assert_not_called()
        updated_job = job_store.get_job(job.video_id)
        self.assertEqual(updated_job.caption_status, "skipped_offline_prototype")

    @patch("app.routers.preprocessing.load_manifest_from_disk")
    @patch("app.routers.preprocessing.sidecar_service.generate_sidecar")
    def test_manifest_fallback_regeneration_passes_segments(self, mock_generate, mock_load):
        """Verify route fallback regeneration passes job transcript_segments to generate_sidecar."""
        mock_load.return_value = None

        job = JobRecord(
            video_id=str(uuid.uuid4()),
            youtube_url="https://youtube.com/watch?v=12345678901",
            youtube_id="12345678901",
            transcript="Full text transcript",
            transcript_segments=[{"start_ms": 0.0, "end_ms": 1000.0, "text": "Hello"}]
        )
        job_store._jobs[job.video_id] = job

        from app.routers.preprocessing import get_sidecar_manifest
        import asyncio
        asyncio.run(get_sidecar_manifest(uuid.UUID(job.video_id)))

        mock_generate.assert_called_once_with(
            job,
            "Full text transcript",
            [{"start_ms": 0.0, "end_ms": 1000.0, "text": "Hello"}]
        )


if __name__ == "__main__":
    unittest.main()
