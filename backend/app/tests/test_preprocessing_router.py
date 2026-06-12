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
        cls.original_data_dir = settings.PROTOTYPE_DATA_DIR
        cls.temp_dir = tempfile.TemporaryDirectory()
        settings.PROTOTYPE_DATA_DIR = cls.temp_dir.name
        
        # Re-initialize/clear the store so it points to the temp directory
        job_store._jobs.clear()
        job_store._load_from_disk()
        
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        settings.PROTOTYPE_DATA_DIR = cls.original_data_dir
        cls.temp_dir.cleanup()
        
        # Restore the real data directory jobs
        job_store._jobs.clear()
        job_store._load_from_disk()

    def setUp(self):
        job_store._jobs.clear()

    def test_delete_prepared_video_success(self):
        """Prove deleting a prepared video deletes the job and attempts to delete the manifest."""
        # 1. Create a job
        job = job_store.create_job("https://youtube.com/watch?v=12345678901")
        video_id = job.video_id
        
        # 2. Write a dummy manifest JSON file
        manifest_filename = f"manifest_{video_id}.json"
        save_json_store(manifest_filename, {"dummy_manifest": True})
        
        # Verify it exists
        self.assertIsNotNone(load_json_store(manifest_filename))
        
        # 3. Call the DELETE route
        response = self.client.delete(f"/api/preprocessing/{video_id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "deleted", "video_id": video_id})
        
        # 4. Prove job is deleted from store
        self.assertIsNone(job_store.get_job(video_id))
        
        # 5. Prove manifest file is deleted from disk
        self.assertIsNone(load_json_store(manifest_filename))

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
