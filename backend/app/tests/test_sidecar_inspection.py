"""Unit tests for AI sidecar metadata tracking, validation warnings, and inspection endpoint."""

from __future__ import annotations

import tempfile
import uuid
import unittest
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock

from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.job_store import JobRecord, job_store
from app.models.schemas import (
    AssistanceSidecarManifest,
    ProcessingStage,
    TrainerInstructionEventType,
)
from app.services.sidecar_service import sidecar_service
from app.services.sidecar_validator import (
    validate_and_clamp_sidecar_manifest_with_warnings,
    validate_and_clamp_sidecar_manifest,
    SidecarValidationResult,
)
from app.services.sidecar_manifest_store import save_manifest_to_disk, delete_manifest_from_disk
from app.core.prototype_persistence import load_json_store, delete_json_store
from app.main import app

client = TestClient(app)


class TestSidecarInspection(unittest.TestCase):

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
        self.original_provider = settings.STORAGE_PROVIDER
        settings.STORAGE_PROVIDER = "local_json"
        from app.core.storage import factory
        factory._job_storage = None
        factory._artifact_storage = None

        job_store._jobs.clear()
        self.original_ai_provider = settings.AI_PROVIDER
        self.original_api_key = settings.GEMINI_API_KEY
        self.original_diagnostics_enabled = settings.AI_DIAGNOSTICS_ENABLED

    def tearDown(self):
        settings.AI_PROVIDER = self.original_ai_provider
        settings.GEMINI_API_KEY = self.original_api_key
        settings.AI_DIAGNOSTICS_ENABLED = self.original_diagnostics_enabled

        settings.STORAGE_PROVIDER = self.original_provider
        from app.core.storage import factory
        factory._job_storage = None
        factory._artifact_storage = None

    def test_metadata_added_for_prototype_sidecars(self):
        """Verify generation metadata is added for normal prototype sidecars."""
        settings.AI_PROVIDER = "prototype"
        
        job = JobRecord(
            video_id=str(uuid.uuid4()),
            youtube_url="https://youtube.com/watch?v=12345678901",
            youtube_id="12345678901",
            duration=150.0,
            caption_status="skipped_offline_prototype"
        )
        job_store._jobs[job.video_id] = job
        
        manifest = sidecar_service.generate_sidecar(job, "")
        self.assertIsNotNone(manifest.generation_metadata)
        self.assertEqual(manifest.generation_metadata.provider, "prototype")
        self.assertIsNone(manifest.generation_metadata.model)
        self.assertEqual(manifest.generation_metadata.prompt_version, "prototype_deterministic_v1")
        self.assertEqual(manifest.generation_metadata.schema_version, "sidecar_schema_v1")
        self.assertEqual(manifest.generation_metadata.validation_warning_count, 0)
        self.assertEqual(len(manifest.validation_warnings), 0)

    @patch("app.services.sidecar_providers.gemini_sidecar.provider.GeminiSidecarProvider.generate_manifest")
    def test_metadata_added_for_gemini_sidecars_mocked(self, mock_generate):
        """Verify generation metadata is populated for mocked Gemini sidecar output."""
        settings.AI_PROVIDER = "gemini"
        settings.GEMINI_API_KEY = "test_gemini_key"
        
        mock_generate.return_value = {
            "exercise_timeline_anchors": [
                {
                    "name": "Squats",
                    "start_time_seconds": 10.0,
                    "end_time_seconds": 30.0,
                }
            ],
            "trainer_instruction_events": [],
            "expected_movement_windows": {},
            "form_risk_templates": [],
            "haptic_spatial_cue_profiles": [],
            "beat_timestamps": [],
            "speaking_opportunity_map": []
        }
        
        job = JobRecord(
            video_id=str(uuid.uuid4()),
            youtube_url="https://youtube.com/watch?v=12345678901",
            youtube_id="12345678901",
            duration=100.0,
            caption_status="captions_found"
        )
        job_store._jobs[job.video_id] = job
        
        manifest = sidecar_service.generate_sidecar(job, "Dummy transcript text")
        
        self.assertIsNotNone(manifest.generation_metadata)
        self.assertEqual(manifest.generation_metadata.provider, "gemini")
        self.assertEqual(manifest.generation_metadata.model, settings.GEMINI_MODEL)
        self.assertEqual(manifest.generation_metadata.prompt_version, "gemini_sidecar_v1")
        self.assertEqual(manifest.generation_metadata.schema_version, "sidecar_schema_v1")
        self.assertEqual(manifest.generation_metadata.caption_status, "captions_found")

    def test_old_manifest_without_metadata_loads(self):
        """Verify that older manifests lacking generation_metadata still load correctly."""
        raw_manifest_data = {
            "video_id": str(uuid.uuid4()),
            "youtube_id": "12345678901",
            "exercise_timeline_anchors": [],
            "trainer_instruction_events": [],
            "expected_movement_windows": {},
            "form_risk_templates": [],
            "haptic_spatial_cue_profiles": [],
            "beat_timestamps": [],
            "speaking_opportunity_map": [],
            "created_at": "2026-06-12T12:00:00Z"
        }
        
        # Load from pydantic to check compatibility
        manifest = AssistanceSidecarManifest.model_validate(raw_manifest_data)
        self.assertIsNone(manifest.generation_metadata)
        self.assertEqual(manifest.validation_warnings, [])

    def test_validation_warnings_produced_for_bad_payloads(self):
        """Verify validation helper catches bad timestamps, swaps, and invalid enums as warnings."""
        raw_bad_data = {
            "exercise_timeline_anchors": [
                {
                    "name": "", # Defaulted
                    "start_time_seconds": float("nan"), # Defaulted
                    "end_time_seconds": float("inf"), # Defaulted
                    "angle_range": [10.0], # Dropped invalid length
                    "acceptable_ranges": {"knee": [0.0]} # Dropped invalid length
                }
            ],
            "trainer_instruction_events": [
                {
                    "text": "Correct your form",
                    "start_ms": 20000.0,
                    "end_ms": 10000.0, # Swapped
                    "timestamp_ms": 50000.0, # Out-of-bounds, reset to start
                    "event_type": "some_invalid_enum", # Defaulted
                }
            ],
            "speaking_opportunity_map": [
                {
                    "start_ms": float("nan"), # Dropped
                    "end_ms": 5000.0,
                    "mode": "invalid_mode"
                }
            ],
            "form_risk_templates": [
                {
                    "exercise_name": "", # Dropped
                    "joint": "hip"
                }
            ],
            "haptic_spatial_cue_profiles": [
                {
                    "exercise_name": "", # Dropped
                    "body_parts": ["left"]
                }
            ],
            "beat_timestamps": [
                float("nan") # Dropped
            ]
        }
        
        video_uuid = uuid.uuid4()
        res = validate_and_clamp_sidecar_manifest_with_warnings(
            manifest_dict=raw_bad_data,
            video_duration=120.0,
            youtube_id="12345678901",
            video_uuid=video_uuid
        )
        
        self.assertIsNotNone(res.manifest)
        self.assertTrue(len(res.warnings) > 0)
        
        warning_codes = [w.code for w in res.warnings]
        self.assertIn("anchor_name_defaulted", warning_codes)
        self.assertIn("anchor_timestamp_defaulted", warning_codes)
        self.assertIn("invalid_angle_range_dropped", warning_codes)
        self.assertIn("invalid_acceptable_range_dropped", warning_codes)
        self.assertIn("instruction_start_end_swapped", warning_codes)
        self.assertIn("instruction_timestamp_clamped", warning_codes)
        self.assertIn("invalid_event_type_defaulted", warning_codes)
        self.assertIn("speaking_window_dropped", warning_codes)
        self.assertIn("form_risk_template_dropped", warning_codes)
        self.assertIn("haptic_profile_dropped", warning_codes)
        self.assertIn("beat_timestamp_dropped", warning_codes)

    def test_inspection_endpoint(self):
        """Verify the GET inspection endpoint returns correct statistics and lacks secrets/transcripts."""
        settings.AI_PROVIDER = "prototype"
        
        job = JobRecord(
            video_id=str(uuid.uuid4()),
            youtube_url="https://youtube.com/watch?v=12345678901",
            youtube_id="12345678901",
            duration=300.0,
            caption_status="skipped_offline_prototype",
            title="Workout Video",
            channel_name="Workout Trainer",
            stage=ProcessingStage.COMPLETED
        )
        job_store._jobs[job.video_id] = job
        
        # Pre-generate manifest and save it to mock disk persistence
        manifest = sidecar_service.generate_sidecar(job, "")
        save_manifest_to_disk(job.video_id, manifest)
        
        # Test request
        response = client.get(f"/api/preprocessing/manifest/{job.video_id}/inspection")
        self.assertEqual(response.status_code, 200)
        
        data = response.json()
        self.assertEqual(data["video_id"], job.video_id)
        self.assertEqual(data["youtube_id"], "12345678901")
        self.assertEqual(data["provider"], "prototype")
        self.assertIsNone(data["model"])
        self.assertEqual(data["prompt_version"], "prototype_deterministic_v1")
        self.assertEqual(data["schema_version"], "sidecar_schema_v1")
        self.assertEqual(data["caption_status"], "skipped_offline_prototype")
        self.assertIsNone(data["fallback_reason"])
        self.assertEqual(data["validation_warning_count"], 0)
        
        # Check counts
        self.assertEqual(data["counts"]["exercise_timeline_anchors"], len(manifest.exercise_timeline_anchors))
        self.assertEqual(data["counts"]["trainer_instruction_events"], len(manifest.trainer_instruction_events))
        
        # Check basic timeline sanity fields
        self.assertEqual(data["basic_timeline_sanity"]["duration_seconds"], 300.0)
        self.assertEqual(data["basic_timeline_sanity"]["anchors_out_of_order_count"], 0)
        
        # Ensure secret and raw text fields are NOT present
        self.assertNotIn("transcript", data)
        self.assertNotIn("prompt", data)
        self.assertNotIn("api_key", data)
        self.assertNotIn("api", data)
        self.assertNotIn("key", data)
        
        # Clean up mock file
        delete_manifest_from_disk(job.video_id)

    def test_gemini_fallback_records_metadata(self):
        """Verify fallback triggers prototype generation but records the gemini fallback reason in metadata."""
        settings.AI_PROVIDER = "gemini"
        settings.GEMINI_API_KEY = "" # Missing key
        
        job = JobRecord(
            video_id=str(uuid.uuid4()),
            youtube_url="https://youtube.com/watch?v=12345678901",
            youtube_id="12345678901",
            duration=300.0,
            caption_status="captions_found"
        )
        job_store._jobs[job.video_id] = job
        
        manifest = sidecar_service.generate_sidecar(job, "transcript text")
        
        self.assertIsNotNone(manifest.generation_metadata)
        self.assertEqual(manifest.generation_metadata.provider, "prototype")
        self.assertIsNone(manifest.generation_metadata.model)
        self.assertIn("api_key_missing", manifest.generation_metadata.fallback_reason)
        self.assertEqual(job.sidecar_provider, "prototype")
        self.assertIn("api_key_missing", job.sidecar_fallback_reason)

    def test_inspection_endpoint_missing_manifest_returns_404(self):
        """Verify that GET inspection endpoint returns 404 when manifest is missing from disk."""
        fake_uuid = str(uuid.uuid4())
        response = client.get(f"/api/preprocessing/manifest/{fake_uuid}/inspection")
        self.assertEqual(response.status_code, 404)
        self.assertIn("not found on disk", response.json()["detail"])

    @patch("app.routers.preprocessing.sidecar_service.generate_sidecar")
    def test_inspection_endpoint_does_not_generate_sidecar(self, mock_generate):
        """Verify that GET inspection endpoint loads from disk only and never generates on the fly."""
        fake_uuid = str(uuid.uuid4())
        response = client.get(f"/api/preprocessing/manifest/{fake_uuid}/inspection")
        self.assertEqual(response.status_code, 404)
        mock_generate.assert_not_called()

    def test_warning_previews_do_not_leak_trainer_caption_text(self):
        """Verify warnings preview contains code/path/message but never trainer/caption text."""
        raw_bad_data = {
            "trainer_instruction_events": [
                {
                    "text": "Keep your back straight and do not look down",
                    "start_ms": 20000.0,
                    "end_ms": 10000.0, # Swapped
                }
            ]
        }
        
        video_uuid = uuid.uuid4()
        res = validate_and_clamp_sidecar_manifest_with_warnings(
            manifest_dict=raw_bad_data,
            video_duration=120.0,
            youtube_id="12345678901",
            video_uuid=video_uuid
        )
        
        self.assertIsNotNone(res.manifest)
        self.assertTrue(len(res.warnings) > 0)
        
        # Ensure warnings preview has details but doesn't leak text snippet "Keep your back" or "look down"
        for w in res.warnings:
            self.assertIsNotNone(w.code)
            self.assertIsNotNone(w.message)
            self.assertIsNotNone(w.path)
            self.assertNotIn("Keep your back", w.message)
            self.assertNotIn("look down", w.message)

    def test_provider_name_normalization_trimming(self):
        """Verify settings.AI_PROVIDER = ' Gemini ' is stored and serialized as 'gemini' in job store and metadata."""
        settings.AI_PROVIDER = " Gemini "
        settings.GEMINI_API_KEY = "test_gemini_key"
        
        job = JobRecord(
            video_id=str(uuid.uuid4()),
            youtube_url="https://youtube.com/watch?v=12345678901",
            youtube_id="12345678901",
            duration=150.0,
            caption_status="captions_found"
        )
        job_store._jobs[job.video_id] = job
        
        # Mock strategy returned dictionary
        mock_manifest_dict = {
            "exercise_timeline_anchors": [],
            "trainer_instruction_events": [],
            "expected_movement_windows": {},
            "form_risk_templates": [],
            "haptic_spatial_cue_profiles": [],
            "beat_timestamps": [],
            "speaking_opportunity_map": []
        }
        
        with patch("app.services.sidecar_providers.gemini_sidecar.provider.GeminiSidecarProvider.generate_manifest", return_value=mock_manifest_dict):
            manifest = sidecar_service.generate_sidecar(job, "Dummy transcript")
            
        self.assertEqual(manifest.generation_metadata.provider, "gemini")
        self.assertEqual(job.sidecar_provider, "gemini")

    def test_diagnostics_written_for_prototype(self):
        """Verify diagnostics JSON file is written for Prototype provider and has safe content."""
        settings.AI_PROVIDER = "prototype"
        settings.AI_DIAGNOSTICS_ENABLED = True
        
        job = JobRecord(
            video_id=str(uuid.uuid4()),
            youtube_url="https://youtube.com/watch?v=12345678901",
            youtube_id="12345678901",
            duration=200.0,
            caption_status="skipped_offline_prototype"
        )
        job_store._jobs[job.video_id] = job
        
        # Make sure old diagnostics file is deleted
        delete_json_store(f"ai_diagnostics/{job.video_id}.json")
        
        manifest = sidecar_service.generate_sidecar(job, "")
        
        # Load and check diagnostics
        diag = load_json_store(f"ai_diagnostics/{job.video_id}.json")
        self.assertIsNotNone(diag)
        self.assertEqual(diag["provider"], "prototype")
        self.assertIsNone(diag["model"])
        self.assertEqual(diag["prompt_version"], "prototype_deterministic_v1")
        self.assertEqual(diag["schema_version"], "sidecar_schema_v1")
        self.assertEqual(diag["caption_status"], "skipped_offline_prototype")
        self.assertIsNone(diag["fallback_reason"])
        self.assertEqual(diag["validation_warning_count"], 0)
        self.assertIn("manifest_counts", diag)
        self.assertIn("timeline_sanity_counts", diag)
        self.assertIn("generated_at", diag)
        
        # Ensure no transcripts, prompts, or api keys leak
        forbidden_keys = {"transcript", "prompt", "api_key", "secret", "gemini_key", "youtube_key"}
        for k in diag.keys():
            self.assertNotIn(k.lower(), forbidden_keys)
            
        # Ensure no actual transcripts, prompts, or api keys are in values
        for k, v in diag.items():
            if isinstance(v, str):
                self.assertNotIn("AI_PROVIDER", v)
                self.assertNotIn("GEMINI_API_KEY", v)
                self.assertNotIn("API_KEY", v)
                self.assertNotIn("transcript", v.lower())
                self.assertNotIn("prompt", v.lower())
            
        # Clean up
        delete_json_store(f"ai_diagnostics/{job.video_id}.json")

    @patch("app.services.sidecar_providers.gemini_sidecar.provider.GeminiSidecarProvider.generate_manifest")
    def test_diagnostics_written_for_gemini(self, mock_generate):
        """Verify diagnostics JSON file is written for Gemini provider and has safe content."""
        settings.AI_PROVIDER = "gemini"
        settings.GEMINI_API_KEY = "test_gemini_key"
        settings.AI_DIAGNOSTICS_ENABLED = True
        
        mock_generate.return_value = {
            "exercise_timeline_anchors": [],
            "trainer_instruction_events": [],
            "expected_movement_windows": {},
            "form_risk_templates": [],
            "haptic_spatial_cue_profiles": [],
            "beat_timestamps": [],
            "speaking_opportunity_map": []
        }
        
        job = JobRecord(
            video_id=str(uuid.uuid4()),
            youtube_url="https://youtube.com/watch?v=12345678901",
            youtube_id="12345678901",
            duration=120.0,
            caption_status="captions_found"
        )
        job_store._jobs[job.video_id] = job
        
        delete_json_store(f"ai_diagnostics/{job.video_id}.json")
        
        manifest = sidecar_service.generate_sidecar(job, "Dummy transcript")
        
        diag = load_json_store(f"ai_diagnostics/{job.video_id}.json")
        self.assertIsNotNone(diag)
        self.assertEqual(diag["provider"], "gemini")
        self.assertEqual(diag["model"], settings.GEMINI_MODEL)
        self.assertEqual(diag["prompt_version"], "gemini_sidecar_v1")
        self.assertEqual(diag["schema_version"], "sidecar_schema_v1")
        self.assertEqual(diag["caption_status"], "captions_found")
        self.assertIsNone(diag["fallback_reason"])
        
        # Clean up
        delete_json_store(f"ai_diagnostics/{job.video_id}.json")

    def test_diagnostics_written_for_fallback(self):
        """Verify diagnostics JSON file is written for fallback (prototype) and has safe content."""
        settings.AI_PROVIDER = "gemini"
        settings.GEMINI_API_KEY = "" # Bypasses to fallback
        settings.AI_DIAGNOSTICS_ENABLED = True
        
        job = JobRecord(
            video_id=str(uuid.uuid4()),
            youtube_url="https://youtube.com/watch?v=12345678901",
            youtube_id="12345678901",
            duration=200.0,
            caption_status="captions_found"
        )
        job_store._jobs[job.video_id] = job
        
        delete_json_store(f"ai_diagnostics/{job.video_id}.json")
        
        manifest = sidecar_service.generate_sidecar(job, "Some transcript text")
        
        diag = load_json_store(f"ai_diagnostics/{job.video_id}.json")
        self.assertIsNotNone(diag)
        self.assertEqual(diag["provider"], "prototype") # Resolved provider is prototype fallback
        self.assertEqual(diag["fallback_reason"], "api_key_missing") # Sanitized from "api_key_missing: GEMINI_API_KEY is not configured"
        self.assertEqual(diag["caption_status"], "captions_found")
        
        # Clean up
        delete_json_store(f"ai_diagnostics/{job.video_id}.json")

    def test_diagnostics_not_written_when_disabled(self):
        """Verify no diagnostics file is written when AI_DIAGNOSTICS_ENABLED is False."""
        settings.AI_PROVIDER = "prototype"
        settings.AI_DIAGNOSTICS_ENABLED = False
        
        job = JobRecord(
            video_id=str(uuid.uuid4()),
            youtube_url="https://youtube.com/watch?v=12345678901",
            youtube_id="12345678901",
            duration=200.0,
            caption_status="skipped_offline_prototype"
        )
        job_store._jobs[job.video_id] = job
        
        delete_json_store(f"ai_diagnostics/{job.video_id}.json")
        
        manifest = sidecar_service.generate_sidecar(job, "")
        
        diag = load_json_store(f"ai_diagnostics/{job.video_id}.json")
        self.assertIsNone(diag)

    def test_diagnostics_deleted_on_job_delete(self):
        """Verify diagnostics JSON file is deleted when the preprocessing job is deleted."""
        settings.AI_PROVIDER = "prototype"
        settings.AI_DIAGNOSTICS_ENABLED = True
        
        job = JobRecord(
            video_id=str(uuid.uuid4()),
            youtube_url="https://youtube.com/watch?v=12345678901",
            youtube_id="12345678901",
            duration=200.0,
            caption_status="skipped_offline_prototype",
            stage=ProcessingStage.COMPLETED
        )
        job_store._jobs[job.video_id] = job
        
        # Pre-generate manifest and diagnostics
        manifest = sidecar_service.generate_sidecar(job, "")
        save_manifest_to_disk(job.video_id, manifest)
        
        # Check diagnostics exist
        diag_path = f"ai_diagnostics/{job.video_id}.json"
        self.assertIsNotNone(load_json_store(diag_path))
        
        # Call DELETE endpoint
        response = client.delete(f"/api/preprocessing/{job.video_id}")
        self.assertEqual(response.status_code, 200)
        
        # Verify diagnostics file is deleted
        self.assertIsNone(load_json_store(diag_path))


if __name__ == "__main__":
    unittest.main()
