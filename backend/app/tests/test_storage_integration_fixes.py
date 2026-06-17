"""Unit tests verifying the storage integration fixes in the preprocessing router and sidecar service."""

import importlib
import unittest
from unittest.mock import patch, MagicMock
from uuid import uuid4
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.core.job_store import JobRecord
from app.services.sidecar_service import sidecar_service
from app.models.schemas import AssistanceSidecarManifest

class TestStorageIntegrationFixes(unittest.TestCase):

    def test_imports_and_no_name_error(self):
        """Dynamic reload of modules to guarantee no SyntaxError or NameError (e.g. missing Optional)."""
        try:
            importlib.reload(importlib.import_module("app.routers.preprocessing"))
            importlib.reload(importlib.import_module("app.services.sidecar_service"))
        except Exception as e:
            self.fail(f"Module reloading failed due to an import or syntax/name error: {e}")

    @patch("app.routers.preprocessing.get_job_storage")
    def test_preprocessing_router_uses_active_storage_for_submit(self, mock_get_job_storage):
        """Verify the /submit route uses get_job_storage() rather than a singleton."""
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
        """Verify the /status route uses get_job_storage() rather than a singleton."""
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
        """Verify the /events route uses get_job_storage() rather than a singleton."""
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
        # We can just open a stream and close it
        with client.stream("GET", f"/api/preprocessing/events/{video_id}") as response:
            self.assertEqual(response.status_code, 200)
            mock_store.get_job.assert_any_call(video_id)

    @patch("app.services.sidecar_service.get_job_storage")
    @patch("app.services.sidecar_service.settings")
    def test_sidecar_service_uses_active_storage(self, mock_settings, mock_get_job_storage):
        """Verify sidecar_service updates stages through get_job_storage() not singleton."""
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
        # Should have called update_stage on the mock_store, not local singleton
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
        """Verify that DELETE endpoint removes job metadata and all artifact types from storage."""
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
        
        # Verify job is deleted from storage
        mock_job_store.delete_job.assert_called_once_with(video_id)
        
        # Verify all artifact types are cleaned up from storage
        mock_artifact_store.delete_manifest.assert_called_once_with(video_id)
        mock_artifact_store.delete_sidecar_diagnostics.assert_called_once_with(video_id)
        mock_artifact_store.delete_cue_plan.assert_called_once_with(video_id)
        mock_artifact_store.delete_cue_plan_diagnostics.assert_called_once_with(video_id)

    def test_local_json_fallback_active_by_default(self):
        """Ensure local_json defaults are configured correctly and active by default."""
        from app.core.storage import get_job_storage, get_artifact_storage
        from app.core.job_store import JobStore
        from app.core.storage.local_json import LocalJsonGeneratedArtifactStorage
        from app.core.storage import factory
        
        original_provider = settings.STORAGE_PROVIDER
        
        # Reset factory global state
        factory._job_storage = None
        factory._artifact_storage = None
        
        try:
            settings.STORAGE_PROVIDER = "local_json"
            job_store = get_job_storage()
            artifact_store = get_artifact_storage()
            
            self.assertIsInstance(job_store, JobStore)
            self.assertIsInstance(artifact_store, LocalJsonGeneratedArtifactStorage)
        finally:
            # Restore state
            settings.STORAGE_PROVIDER = original_provider
            factory._job_storage = None
            factory._artifact_storage = None

if __name__ == "__main__":
    unittest.main()
