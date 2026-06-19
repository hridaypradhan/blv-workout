"""Unit tests verifying the preprocessing storage integration behaviors in the preprocessing router and sidecar service."""

import importlib
import unittest
from unittest.mock import patch, MagicMock
from uuid import uuid4
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.core.job_store import JobRecord
from app.services.sidecar_service import sidecar_service
from app.models.schemas import AssistanceSidecarManifest, TranscriptArtifact

class TestPreprocessingStorageIntegration(unittest.TestCase):
    """Verifies preprocessing job and artifact lifecycle integration across storage providers."""

    def test_imports_and_no_name_error(self):
        """Verify that modules reload without import errors, SyntaxErrors, or NameErrors."""
        try:
            importlib.reload(importlib.import_module("app.routers.preprocessing"))
            importlib.reload(importlib.import_module("app.services.sidecar_service"))
        except Exception as e:
            self.fail(f"Module reloading failed due to an import or syntax/name error: {e}")

    @patch("app.routers.preprocessing.get_job_storage")
    def test_preprocessing_router_uses_active_storage_for_submit(self, mock_get_job_storage):
        """Verify the /submit route uses the active storage provider to register new jobs."""
        mock_store = MagicMock()
        mock_job = JobRecord(
            video_id=str(uuid4()),
            youtube_url="https://youtube.com/watch?v=12345678901",
            youtube_id="12345678901",
            duration=300.0
        )
        mock_store.create_job.return_value = mock_job
        mock_get_job_storage.return_value = mock_store

        client = TestClient(app)
        with patch("app.routers.preprocessing.run_assistance_preparation") as mock_run:
            response = client.post(
                "/api/preprocessing/submit",
                json={"url": "https://youtube.com/watch?v=12345678901"}
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), {"video_id": mock_job.video_id})
            mock_store.create_job.assert_called_once_with("https://youtube.com/watch?v=12345678901")
            mock_run.assert_called_once()

    @patch("app.routers.preprocessing.get_job_storage")
    def test_preprocessing_router_uses_active_storage_for_status(self, mock_get_job_storage):
        """Verify the /status route retrieves job metadata from the active storage provider."""
        mock_store = MagicMock()
        video_id = str(uuid4())
        mock_job = JobRecord(
            video_id=video_id,
            youtube_url="https://youtube.com/watch?v=12345678901",
            youtube_id="12345678901",
            duration=300.0
        )
        mock_store.get_job.return_value = mock_job
        mock_get_job_storage.return_value = mock_store

        client = TestClient(app)
        response = client.get(f"/api/preprocessing/status/{video_id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["video_id"], video_id)
        mock_store.get_job.assert_called_once_with(video_id)

    @patch("app.routers.preprocessing.get_job_storage")
    def test_preprocessing_router_uses_active_storage_for_events(self, mock_get_job_storage):
        """Verify the SSE events loop queries the active storage provider for progress updates."""
        from app.models.schemas import ProcessingStage
        mock_store = MagicMock()
        video_id = str(uuid4())
        mock_job = JobRecord(
            video_id=video_id,
            youtube_url="https://youtube.com/watch?v=12345678901",
            youtube_id="12345678901",
            duration=300.0
        )
        mock_job.stage = ProcessingStage.COMPLETED
        mock_store.get_job.return_value = mock_job
        mock_get_job_storage.return_value = mock_store

        client = TestClient(app)
        with client.stream("GET", f"/api/preprocessing/events/{video_id}") as response:
            self.assertEqual(response.status_code, 200)
            mock_store.get_job.assert_any_call(video_id)

    @patch("app.services.sidecar_service.get_job_storage")
    @patch("app.services.sidecar_service.settings")
    def test_sidecar_service_uses_active_storage(self, mock_settings, mock_get_job_storage):
        """Verify that the sidecar generator updates job progress stages in the active storage provider."""
        mock_settings.AI_PROVIDER = "gemini"
        mock_settings.GEMINI_API_KEY = ""  # Force api_key_missing fallback to test updates
        mock_settings.AI_DIAGNOSTICS_ENABLED = False

        mock_store = MagicMock()
        mock_get_job_storage.return_value = mock_store

        job = JobRecord(
            video_id=str(uuid4()),
            youtube_url="https://youtube.com/watch?v=12345678901",
            youtube_id="12345678901",
            duration=300.0
        )

        manifest = sidecar_service.generate_sidecar(job, "some transcript")
        self.assertIsNotNone(manifest)
        mock_store.update_stage.assert_called_with(
            job.video_id,
            job.stage,
            sidecar_provider='prototype',
            sidecar_fallback_reason='api_key_missing: GEMINI_API_KEY is not configured',
        )

    @patch("app.routers.preprocessing.get_job_storage")
    @patch("app.routers.preprocessing.get_artifact_storage")
    def test_delete_prepared_video_deletes_all_artifact_categories(
        self, mock_get_artifact_storage, mock_get_job_storage
    ):
        """Verify that DELETE endpoint cleanses job metadata, manifest, diagnostics, and transcript artifacts."""
        mock_job_store = MagicMock()
        mock_artifact_store = MagicMock()
        
        mock_job_store.delete_job.return_value = True
        mock_get_job_storage.return_value = mock_job_store
        mock_get_artifact_storage.return_value = mock_artifact_store
        
        video_id = str(uuid4())
        client = TestClient(app)
        
        response = client.delete(f"/api/preprocessing/{video_id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "deleted", "video_id": video_id})
        
        mock_job_store.delete_job.assert_called_once_with(video_id)
        mock_artifact_store.delete_manifest.assert_called_once_with(video_id)
        mock_artifact_store.delete_sidecar_diagnostics.assert_called_once_with(video_id)
        mock_artifact_store.delete_cue_plan.assert_called_once_with(video_id)
        mock_artifact_store.delete_cue_plan_diagnostics.assert_called_once_with(video_id)
        mock_artifact_store.delete_transcript.assert_called_once_with(video_id)

    @patch("app.routers.preprocessing.get_job_storage")
    @patch("app.routers.preprocessing.get_artifact_storage")
    @patch("app.routers.preprocessing.sidecar_service")
    def test_get_sidecar_manifest_fallback_loads_transcript_artifact(
        self, mock_sidecar_service, mock_get_artifact_storage, mock_get_job_storage
    ):
        """Verify get_sidecar_manifest resolves missing inline transcripts by loading transcript artifacts."""
        mock_job_store = MagicMock()
        mock_artifact_store = MagicMock()
        
        video_id = str(uuid4())
        mock_job = JobRecord(
            video_id=video_id,
            youtube_url="https://youtube.com/watch?v=12345678901",
            youtube_id="12345678901",
            duration=300.0,
            transcript=None,
            transcript_segments=None
        )
        
        mock_job_store.get_job.return_value = mock_job
        mock_get_job_storage.return_value = mock_job_store
        
        mock_artifact_store.load_manifest.return_value = None
        mock_artifact_store.load_transcript.return_value = TranscriptArtifact(
            video_id=video_id,
            caption_status="acquired",
            transcript="Stored transcript text",
            transcript_segments=[{"text": "stored segment"}],
            created_at="2026-06-18T22:00:00Z"
        )
        mock_get_artifact_storage.return_value = mock_artifact_store
        
        dummy_manifest = AssistanceSidecarManifest(
            youtube_id="12345678901",
            exercise_timeline_anchors=[],
            trainer_instruction_events=[],
            speaking_opportunity_map=[],
            form_risk_templates=[],
            haptic_spatial_cue_profiles=[],
            beat_timestamps=[],
            expected_movement_windows={}
        )
        mock_sidecar_service.generate_sidecar.return_value = dummy_manifest
        
        client = TestClient(app)
        response = client.get(f"/api/preprocessing/manifest/{video_id}")
        self.assertEqual(response.status_code, 200)
        
        mock_artifact_store.load_transcript.assert_called_once_with(video_id)
        mock_sidecar_service.generate_sidecar.assert_called_once_with(
            mock_job,
            "Stored transcript text",
            [{"text": "stored segment"}]
        )

    def test_local_json_fallback_active_by_default(self):
        """Ensure local_json defaults are configured correctly and active by default."""
        from app.core.storage import get_job_storage, get_artifact_storage
        from app.core.job_store import JobStore
        from app.core.storage.local_json import LocalJsonGeneratedArtifactStorage
        from app.core.storage import factory
        
        original_provider = settings.STORAGE_PROVIDER
        
        factory._job_storage = None
        factory._artifact_storage = None
        
        try:
            settings.STORAGE_PROVIDER = "local_json"
            job_store = get_job_storage()
            artifact_store = get_artifact_storage()
            
            self.assertIsInstance(job_store, JobStore)
            self.assertIsInstance(artifact_store, LocalJsonGeneratedArtifactStorage)
        finally:
            settings.STORAGE_PROVIDER = original_provider
            factory._job_storage = None
            factory._artifact_storage = None

if __name__ == "__main__":
    unittest.main()
