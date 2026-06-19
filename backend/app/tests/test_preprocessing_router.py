"""Unit tests for the preprocessing router, specifically verifying DELETE route behavior."""

import os
import tempfile
import uuid
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.core.job_store import job_store
from app.core.prototype_persistence import save_json_store, load_json_store


class TestPreprocessingRouter(unittest.TestCase):

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
        
        # Re-initialize/clear the store so it points to the temp directory
        job_store._jobs.clear()
        job_store._load_from_disk()
        
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        settings.STORAGE_PROVIDER = cls.original_provider
        from app.core.storage import factory
        factory._job_storage = None
        factory._artifact_storage = None

        settings.PROTOTYPE_DATA_DIR = cls.original_data_dir
        cls.temp_dir.cleanup()
        
        # Restore the real data directory jobs
        job_store._jobs.clear()
        job_store._load_from_disk()

    def setUp(self):
        job_store._jobs.clear()

    def test_get_processing_status_payload(self):
        """Verify status response includes cue-plan status and hides transcripts."""
        job = job_store.create_job("https://youtube.com/watch?v=12345678901")
        video_id = job.video_id
        job_store.update_stage(
            video_id,
            job.stage,
            cue_plan_provider="gemini",
            cue_plan_fallback_reason="none",
            transcript="This is a very long transcript that should be hidden.",
            transcript_segments=[{"text": "Hello"}]
        )

        response = self.client.get(f"/api/preprocessing/status/{video_id}")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Verify cue plan fields are included
        self.assertEqual(data["cue_plan_provider"], "gemini")
        self.assertEqual(data["cue_plan_fallback_reason"], "none")
        
        # Verify transcript/segments are completely absent
        self.assertNotIn("transcript", data)
        self.assertNotIn("transcript_segments", data)

    def test_list_jobs_payload_omits_transcripts(self):
        """Verify listing jobs does not expose raw transcripts or transcript segments."""
        job = job_store.create_job("https://youtube.com/watch?v=12345678901")
        video_id = job.video_id
        job_store.update_stage(
            video_id,
            job.stage,
            youtube_id="12345678901",
            title="My Workout",
            transcript="Large transcript",
            transcript_segments=[{"text": "segment"}]
        )

        response = self.client.get("/api/preprocessing/jobs")
        self.assertEqual(response.status_code, 200)
        jobs = response.json()
        self.assertTrue(len(jobs) > 0)
        
        # Check first job
        target_job = next(j for j in jobs if j["video_id"] == video_id)
        self.assertNotIn("transcript", target_job)
        self.assertNotIn("transcript_segments", target_job)

    def test_delete_prepared_video_success(self):
        """Prove deleting a prepared video deletes the job, manifest, and transcript artifact."""
        # 1. Create a job
        job = job_store.create_job("https://youtube.com/watch?v=12345678901")
        video_id = job.video_id
        
        # 2. Write a dummy manifest and transcript JSON files
        manifest_filename = f"manifest_{video_id}.json"
        transcript_filename = f"transcripts/{video_id}.json"
        save_json_store(manifest_filename, {"dummy_manifest": True})
        save_json_store(transcript_filename, {"dummy_transcript": True})
        
        # Verify they exist
        self.assertIsNotNone(load_json_store(manifest_filename))
        self.assertIsNotNone(load_json_store(transcript_filename))
        
        # 3. Call the DELETE route
        response = self.client.delete(f"/api/preprocessing/{video_id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "deleted", "video_id": video_id})
        
        # 4. Prove job is deleted from store
        self.assertIsNone(job_store.get_job(video_id))
        
        # 5. Prove files are deleted from disk
        self.assertIsNone(load_json_store(manifest_filename))
        self.assertIsNone(load_json_store(transcript_filename))

    def test_delete_prepared_video_404(self):
        """Prove 404 behavior remains unchanged for missing jobs."""
        random_uuid = str(uuid.uuid4())
        response = self.client.delete(f"/api/preprocessing/{random_uuid}")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Video not found."})

    @patch("app.routers.preprocessing.delete_manifest_from_disk")
    def test_delete_prepared_video_calls_manifest_delete(self, mock_delete_manifest):
        """Prove deleting a prepared video calls delete_manifest_from_disk function."""
        job = job_store.create_job("https://youtube.com/watch?v=12345678901")
        video_id = job.video_id
        
        response = self.client.delete(f"/api/preprocessing/{video_id}")
        self.assertEqual(response.status_code, 200)
        
        # Prove delete_manifest_from_disk was called with correct video_id
        mock_delete_manifest.assert_called_once_with(video_id)


if __name__ == "__main__":
    unittest.main()

