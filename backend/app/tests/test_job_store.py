"""Unit tests for local prototype job store persistence, filtering, and deduplication."""

from __future__ import annotations

import os
import tempfile
import uuid
import unittest
from datetime import datetime, timezone, timedelta

from app.core.config import settings
from app.core.job_store import JobRecord, job_store
from app.models.schemas import ProcessingStage


class TestJobStore(unittest.TestCase):

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

    def test_env_example_safety(self):
        """Verify that .env.example contains only placeholders and no real keys."""
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        example_path = os.path.join(base_dir, ".env.example")
        self.assertTrue(os.path.exists(example_path), f"Example env file not found at: {example_path}")
        with open(example_path, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("GEMINI_API_KEY=your_key_here", content)
        self.assertNotIn("AI_PROVIDER=gemini", content)

    def test_job_record_includes_metadata_fields(self):
        """Verify JobRecord correctly exports, loads, and initializes Gemini-related metadata fields."""
        job = JobRecord(
            video_id="test-vid",
            youtube_url="https://youtube.com/watch?v=12345678901",
            transcript="Sample",
            sidecar_provider="gemini",
            sidecar_fallback_reason="Error",
            caption_status="captions_found",
            transcript_segments=[{"start_ms": 1.0}]
        )
        data = job.to_dict()
        self.assertEqual(data["transcript"], "Sample")
        self.assertEqual(data["sidecar_provider"], "gemini")
        self.assertEqual(data["sidecar_fallback_reason"], "Error")
        self.assertEqual(data["caption_status"], "captions_found")
        self.assertEqual(data["transcript_segments"], [{"start_ms": 1.0}])

    def test_clearing_sidecar_fallback_reason(self):
        """Verify JobStore.update_stage can explicitly clear metadata fields using UNSET sentinel."""
        job = job_store.create_job("https://youtube.com/watch?v=12345678901")
        job_store.update_stage(
            job.video_id,
            ProcessingStage.COMPLETED,
            sidecar_provider="gemini",
            sidecar_fallback_reason="Prior error"
        )
        
        updated = job_store.get_job(job.video_id)
        self.assertEqual(updated.sidecar_fallback_reason, "Prior error")
        
        # Clear fallback reason explicitly to None
        job_store.update_stage(
            job.video_id,
            ProcessingStage.COMPLETED,
            sidecar_fallback_reason=None
        )
        
        updated = job_store.get_job(job.video_id)
        self.assertIsNone(updated.sidecar_fallback_reason)

    def test_test_isolation_does_not_write_to_real_dir(self):
        """Verify that testing environment is isolated and does not use the default storage directory."""
        self.assertNotEqual(settings.PROTOTYPE_DATA_DIR, ".prototype_data")
        self.assertTrue(settings.PROTOTYPE_DATA_DIR.startswith(tempfile.gettempdir()))

    def test_job_store_filters_stale_submitted_jobs(self):
        """Verify that stale submitted jobs (> 10 mins) are filtered out, while recent ones remain."""
        recent_job = job_store.create_job("https://youtube.com/watch?v=abcdefghij1")
        job_store.update_stage(
            recent_job.video_id,
            ProcessingStage.SUBMITTED,
            youtube_id="abcdefghij1",
            title="Valid Workout",
        )
        
        stale_job = job_store.create_job("https://youtube.com/watch?v=abcdefghij2")
        job_store.update_stage(
            stale_job.video_id,
            ProcessingStage.SUBMITTED,
            youtube_id="abcdefghij2",
            title="Valid Workout",
        )
        stale_job.created_at = (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat()
        job_store._save_to_disk()

        jobs = job_store.list_jobs()
        self.assertIn(recent_job.video_id, [j.video_id for j in jobs])
        self.assertNotIn(stale_job.video_id, [j.video_id for j in jobs])

    def test_job_store_filters_test_workout_jobs(self):
        """Verify that known test and placeholder titles are filtered out."""
        real_job = job_store.create_job("https://youtube.com/watch?v=abcdefghij1")
        job_store.update_stage(
            real_job.video_id,
            ProcessingStage.COMPLETED,
            youtube_id="abcdefghij1",
            title="Valid Real Workout",
        )
        
        test_job = job_store.create_job("https://youtube.com/watch?v=abcdefghij2")
        job_store.update_stage(
            test_job.video_id,
            ProcessingStage.COMPLETED,
            youtube_id="abcdefghij2",
            title="Test Workout",
        )
        
        untitled_job = job_store.create_job("https://youtube.com/watch?v=abcdefghij3")
        job_store.update_stage(
            untitled_job.video_id,
            ProcessingStage.COMPLETED,
            youtube_id="abcdefghij3",
            title="Untitled Video",
        )

        jobs = job_store.list_jobs()
        video_ids = [j.video_id for j in jobs]
        self.assertIn(real_job.video_id, video_ids)
        self.assertNotIn(test_job.video_id, video_ids)
        self.assertNotIn(untitled_job.video_id, video_ids)

    def test_job_store_old_completed_jobs_remain_visible(self):
        """Verify that valid completed jobs created more than 30 minutes ago remain visible indefinitely."""
        old_completed_job = job_store.create_job("https://youtube.com/watch?v=abcdefghij1")
        job_store.update_stage(
            old_completed_job.video_id,
            ProcessingStage.COMPLETED,
            youtube_id="abcdefghij1",
            title="Old Valid Completed Workout",
        )
        old_completed_job.created_at = (datetime.now(timezone.utc) - timedelta(hours=10)).isoformat()
        job_store._save_to_disk()

        jobs = job_store.list_jobs()
        video_ids = [j.video_id for j in jobs]
        self.assertIn(old_completed_job.video_id, video_ids)

    def test_job_store_stale_inprogress_jobs_are_filtered(self):
        """Verify that stale in-progress jobs (e.g. transcribing created > 30 minutes ago) are filtered."""
        recent_inprogress = job_store.create_job("https://youtube.com/watch?v=abcdefghij1")
        job_store.update_stage(
            recent_inprogress.video_id,
            ProcessingStage.TRANSCRIBING,
            youtube_id="abcdefghij1",
            title="Workout",
        )
        
        stale_inprogress = job_store.create_job("https://youtube.com/watch?v=abcdefghij2")
        job_store.update_stage(
            stale_inprogress.video_id,
            ProcessingStage.TRANSCRIBING,
            youtube_id="abcdefghij2",
            title="Workout",
        )
        stale_inprogress.created_at = (datetime.now(timezone.utc) - timedelta(minutes=31)).isoformat()
        job_store._save_to_disk()

        jobs = job_store.list_jobs()
        video_ids = [j.video_id for j in jobs]
        self.assertIn(recent_inprogress.video_id, video_ids)
        self.assertNotIn(stale_inprogress.video_id, video_ids)

    def test_job_store_filters_internal_code_error_failed_jobs(self):
        """Verify that failed jobs caused by internal code errors are filtered out immediately."""
        real_failure = job_store.create_job("https://youtube.com/watch?v=abcdefghij1")
        job_store.update_stage(
            real_failure.video_id,
            ProcessingStage.FAILED,
            error="Could not extract metadata"
        )
        
        type_error_job = job_store.create_job("https://youtube.com/watch?v=abcdefghij2")
        job_store.update_stage(
            type_error_job.video_id,
            ProcessingStage.FAILED,
            error="TypeError: JobStore.update_stage() got an unexpected keyword argument"
        )

        jobs = job_store.list_jobs()
        video_ids = [j.video_id for j in jobs]
        self.assertIn(real_failure.video_id, video_ids)
        self.assertNotIn(type_error_job.video_id, video_ids)

    def test_job_store_keeps_recent_user_facing_failed_jobs(self):
        """Verify that recent user-facing failed jobs are kept for 30 minutes, but filtered after."""
        recent_failed = job_store.create_job("https://youtube.com/watch?v=abcdefghij1")
        job_store.update_stage(
            recent_failed.video_id,
            ProcessingStage.FAILED,
            error="Could not extract metadata"
        )
        
        stale_failed = job_store.create_job("https://youtube.com/watch?v=abcdefghij2")
        job_store.update_stage(
            stale_failed.video_id,
            ProcessingStage.FAILED,
            error="Could not extract metadata"
        )
        stale_failed.created_at = (datetime.now(timezone.utc) - timedelta(minutes=31)).isoformat()
        job_store._save_to_disk()

        jobs = job_store.list_jobs()
        video_ids = [j.video_id for j in jobs]
        self.assertIn(recent_failed.video_id, video_ids)
        self.assertNotIn(stale_failed.video_id, video_ids)

    def test_job_store_deduplicates_by_youtube_id(self):
        """Verify that duplicate jobs collapse to the highest priority single card."""
        completed_job = job_store.create_job("https://youtube.com/watch?v=abcdefghij1")
        job_store.update_stage(
            completed_job.video_id,
            ProcessingStage.COMPLETED,
            youtube_id="abcdefghij1",
            title="Valid Completed Workout",
        )
        
        failed_job = job_store.create_job("https://youtube.com/watch?v=abcdefghij1")
        job_store.update_stage(
            failed_job.video_id,
            ProcessingStage.FAILED,
            error="Invalid metadata"
        )

        jobs = job_store.list_jobs()
        matching_jobs = [j for j in jobs if j.youtube_id == "abcdefghij1"]
        self.assertEqual(len(matching_jobs), 1)
        self.assertEqual(matching_jobs[0].video_id, completed_job.video_id)


if __name__ == "__main__":
    unittest.main()
