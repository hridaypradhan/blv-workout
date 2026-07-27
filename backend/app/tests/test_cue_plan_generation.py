"""Unit tests for AI-assisted cue plan generation, validation, and API routes."""

from __future__ import annotations

import tempfile
import uuid
import unittest
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock

from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.job_store import JobRecord, job_store
from app.models.schemas import AssistanceSidecarManifest, ProcessingStage
from app.core.storage import get_artifact_storage
from app.models.cue_plan_schemas import CuePlan
from app.services.sidecar_service import sidecar_service
from app.services.cue_plan_service import cue_plan_service
from app.services.cue_plan_store import load_cue_plan_from_disk, save_cue_plan_to_disk, delete_cue_plan_from_disk
from app.services.sidecar_manifest_store import save_manifest_to_disk, delete_manifest_from_disk
from app.core.prototype_persistence import load_json_store, delete_json_store
from app.services.cue_plan_validator import validate_and_clamp_cue_plan
from app.main import app

client = TestClient(app)


class TestCuePlanGeneration(unittest.TestCase):

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
        settings.AI_DIAGNOSTICS_ENABLED = True

    def tearDown(self):
        settings.AI_PROVIDER = self.original_ai_provider
        settings.GEMINI_API_KEY = self.original_api_key
        settings.AI_DIAGNOSTICS_ENABLED = self.original_diagnostics_enabled

    def test_prototype_cue_plan_generation(self):
        """Verify deterministic prototype cue plan generation builds valid candidates from sidecar."""
        settings.AI_PROVIDER = "prototype"
        
        job = JobRecord(
            video_id=str(uuid.uuid4()),
            youtube_url="https://youtube.com/watch?v=12345678901",
            youtube_id="12345678901",
            duration=300.0,
            caption_status="skipped_offline_prototype"
        )
        job_store._jobs[job.video_id] = job
        
        # Generate sidecar manifest first
        sidecar = sidecar_service.generate_sidecar(job, "")
        self.assertIsNotNone(sidecar)
        
        # Generate cue plan
        cue_plan = cue_plan_service.generate_cue_plan(job, sidecar)
        self.assertIsNotNone(cue_plan)
        self.assertEqual(cue_plan.generation_metadata.provider, "prototype")
        self.assertIsNotNone(cue_plan.pre_session_overview)
        self.assertTrue(len(cue_plan.cue_candidates) > 0)
        
        # Check generated diagnostics JSON file
        diag_path = f"ai_diagnostics/cue_plan_{job.video_id}.json"
        diag = load_json_store(diag_path)
        self.assertIsNotNone(diag)
        self.assertEqual(diag["provider"], "prototype")
        self.assertIsNone(diag["model"])
        self.assertEqual(diag["cue_candidate_count"], len(cue_plan.cue_candidates))
        self.assertEqual(diag["validation_warning_count"], 0)
        
        # Ensure no sensitive keys/transcripts in diagnostics
        for k, v in diag.items():
            self.assertNotIn("secret", k.lower())
            self.assertNotIn("api_key", k.lower())
            if isinstance(v, str):
                self.assertNotIn("GEMINI_API_KEY", v)
                self.assertNotIn("transcript", v.lower())
                self.assertNotIn("prompt", v.lower())
                
        # Clean up files
        delete_json_store(diag_path)
        delete_cue_plan_from_disk(job.video_id)

    @patch("app.services.ai.gemini_client.gemini_client.generate_structured_content")
    def test_gemini_cue_plan_generation_mocked(self, mock_generate):
        """Verify Gemini cue plan provider executes structured API call and adapts it correctly."""
        settings.AI_PROVIDER = "gemini"
        settings.GEMINI_API_KEY = "dummy_key"
        
        mock_generate.return_value = {
            "pre_session_overview": "This is a mocked Gemini overview.",
            "exercise_descriptions": [
                {
                    "exercise_anchor_id": "anchor-123",
                    "name": "Bicep Curls",
                    "accessible_description": "Perform curls lifting weights to shoulder level."
                }
            ],
            "cue_candidates": [
                {
                    "id": "cue-001",
                    "exercise_anchor_id": "anchor-123",
                    "source_type": "exercise_anchor",
                    "source_ref": "timeline",
                    "start_ms": 1000.0,
                    "end_ms": 5000.0,
                    "priority": "medium",
                    "intent": "setup_orientation",
                    "allowed_modalities": ["audio"],
                    "text_variants": {
                        "brief": "Get ready.",
                        "moderate": "Prepare your dumbbells for curls.",
                        "detailed": "Get ready to perform bicep curls. Keep feet hip-width apart."
                    },
                    "haptic_cue_ref": None,
                    "interruption_policy_hint": "safe_gap_only"
                }
            ],
            "trainer_instruction_summaries": []
        }
        
        job = JobRecord(
            video_id=str(uuid.uuid4()),
            youtube_url="https://youtube.com/watch?v=12345678901",
            youtube_id="12345678901",
            duration=300.0,
            caption_status="captions_found"
        )
        job_store._jobs[job.video_id] = job
        
        sidecar = sidecar_service.generate_sidecar(job, "Dummy transcript")
        
        cue_plan = cue_plan_service.generate_cue_plan(job, sidecar)
        self.assertIsNotNone(cue_plan)
        self.assertEqual(cue_plan.generation_metadata.provider, "gemini")
        self.assertEqual(cue_plan.generation_metadata.model, settings.GEMINI_MODEL)
        self.assertEqual(cue_plan.pre_session_overview, "This is a mocked Gemini overview.")
        self.assertEqual(len(cue_plan.cue_candidates), 1)
        self.assertEqual(cue_plan.cue_candidates[0].text_variants.moderate, "Prepare your dumbbells for curls.")
        
        # Clean up
        delete_json_store(f"ai_diagnostics/cue_plan_{job.video_id}.json")
        delete_cue_plan_from_disk(job.video_id)

    def test_gemini_cue_plan_fallback_on_missing_key(self):
        """Verify that Gemini cue plan falls back to prototype when GEMINI_API_KEY is empty."""
        settings.AI_PROVIDER = "gemini"
        settings.GEMINI_API_KEY = "" # Missing key trigger
        
        job = JobRecord(
            video_id=str(uuid.uuid4()),
            youtube_url="https://youtube.com/watch?v=12345678901",
            youtube_id="12345678901",
            duration=150.0,
            caption_status="captions_found"
        )
        job_store._jobs[job.video_id] = job
        
        sidecar = sidecar_service.generate_sidecar(job, "Dummy transcript")
        cue_plan = cue_plan_service.generate_cue_plan(job, sidecar)
        
        self.assertIsNotNone(cue_plan)
        self.assertEqual(cue_plan.generation_metadata.provider, "prototype")
        self.assertEqual(cue_plan.generation_metadata.fallback_reason, "api_key_missing")

    def test_cue_plan_diagnostics_disabled(self):
        """Verify no diagnostics file is written when AI_DIAGNOSTICS_ENABLED is False."""
        settings.AI_PROVIDER = "prototype"
        settings.AI_DIAGNOSTICS_ENABLED = False
        
        job = JobRecord(
            video_id=str(uuid.uuid4()),
            youtube_url="https://youtube.com/watch?v=12345678901",
            youtube_id="12345678901",
            duration=300.0,
            caption_status="skipped_offline_prototype"
        )
        job_store._jobs[job.video_id] = job
        
        sidecar = sidecar_service.generate_sidecar(job, "")
        cue_plan = cue_plan_service.generate_cue_plan(job, sidecar)
        
        diag_path = f"ai_diagnostics/cue_plan_{job.video_id}.json"
        diag = load_json_store(diag_path)
        self.assertIsNone(diag)
        
        # Clean up
        delete_cue_plan_from_disk(job.video_id)

    def test_cue_plan_inspection_route(self):
        """Verify the GET inspection endpoint returns correct statistics and is side-effect-free."""
        video_uuid = str(uuid.uuid4())
        
        # Try inspection when not persisted -> 404
        resp = client.get(f"/api/preprocessing/cue-plan/{video_uuid}/inspection")
        self.assertEqual(resp.status_code, 404)
        
        # Persist a mock cue plan
        cue_plan = CuePlan(
            video_id=uuid.UUID(video_uuid),
            youtube_id="12345678901",
            pre_session_overview="Overview",
            exercise_descriptions=[],
            cue_candidates=[],
            trainer_instruction_summaries=[]
        )
        save_cue_plan_to_disk(video_uuid, cue_plan)
        
        # GET inspection
        resp = client.get(f"/api/preprocessing/cue-plan/{video_uuid}/inspection")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["video_id"], video_uuid)
        self.assertEqual(data["cue_candidate_count"], 0)
        
        # GET main cue plan route
        resp = client.get(f"/api/preprocessing/cue-plan/{video_uuid}")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["pre_session_overview"], "Overview")
        
        # Clean up
        delete_cue_plan_from_disk(video_uuid)

    def test_delete_prepared_video_deletes_all_artifacts(self):
        """Verify deleting a prepared video removes manifest, diagnostics, cue plan, and cue diagnostics."""
        job = JobRecord(
            video_id=str(uuid.uuid4()),
            youtube_url="https://youtube.com/watch?v=12345678901",
            youtube_id="12345678901",
            duration=200.0,
            caption_status="skipped_offline_prototype",
            stage=ProcessingStage.COMPLETED
        )
        job_store._jobs[job.video_id] = job
        
        # Generate and save manifest & diagnostics
        sidecar = sidecar_service.generate_sidecar(job, "")
        save_manifest_to_disk(job.video_id, sidecar)
        
        # Generate and save cue plan & diagnostics
        cue_plan = cue_plan_service.generate_cue_plan(job, sidecar)
        
        # Check artifacts exist using storage abstraction
        storage = get_artifact_storage()
        self.assertIsNotNone(storage.load_manifest(job.video_id))
        self.assertIsNotNone(storage.load_sidecar_diagnostics(job.video_id))
        self.assertIsNotNone(storage.load_cue_plan(job.video_id))
        self.assertIsNotNone(storage.load_cue_plan_diagnostics(job.video_id))
        
        # Call DELETE endpoint
        resp = client.delete(f"/api/preprocessing/{job.video_id}")
        self.assertEqual(resp.status_code, 200)
        
        # Verify all artifacts deleted from storage abstraction
        self.assertIsNone(storage.load_manifest(job.video_id))
        self.assertIsNone(storage.load_sidecar_diagnostics(job.video_id))
        self.assertIsNone(storage.load_cue_plan(job.video_id))
        self.assertIsNone(storage.load_cue_plan_diagnostics(job.video_id))

    def test_old_sidecar_only_prepared_videos_still_work(self):
        """Verify that older videos that only have sidecar manifests on disk still load successfully, yielding a 404 for cue-plan."""
        video_uuid = str(uuid.uuid4())
        
        # Create and store mock job in job_store to prevent 404 on manifest lookup
        job = JobRecord(
            video_id=video_uuid,
            youtube_url="https://youtube.com/watch?v=12345678901",
            youtube_id="12345678901",
            duration=120.0,
            caption_status="captions_found"
        )
        job_store._jobs[video_uuid] = job
        
        # Mocking old sidecar manifest save
        manifest = AssistanceSidecarManifest(
            video_id=uuid.UUID(video_uuid),
            youtube_id="12345678901",
        )
        save_manifest_to_disk(video_uuid, manifest)
        
        # Fetch manifest -> succeeds
        resp = client.get(f"/api/preprocessing/manifest/{video_uuid}")
        self.assertEqual(resp.status_code, 200)
        
        # Fetch cue plan -> yields 404
        resp = client.get(f"/api/preprocessing/cue-plan/{video_uuid}")
        self.assertEqual(resp.status_code, 404)
        
        # Clean up
        delete_manifest_from_disk(video_uuid)

    def test_gemini_adapter_normalization(self):
        """Verify that Gemini adapter normalizes predictable aliases to canonical values before validation."""
        from app.services.cue_plan_providers.gemini_cue_plan.schema import CuePlanGemini, CueCandidateGemini, CueTextVariantsGemini, ExerciseCueDescriptionGemini
        from app.services.cue_plan_providers.gemini_cue_plan.adapter import convert_gemini_to_canonical
        from app.services.cue_plan_validator import validate_and_clamp_cue_plan

        # Create a Gemini DTO response using aliases
        gemini_plan_dto = CuePlanGemini(
            pre_session_overview="This is a test overview.",
            exercise_descriptions=[
                ExerciseCueDescriptionGemini(
                    exercise_anchor_id="anchor-1",
                    name="Test Exercise",
                    accessible_description="accessible descriptive text"
                )
            ],
            cue_candidates=[
                CueCandidateGemini(
                    id="cue-alias-1",
                    exercise_anchor_id="anchor-1",
                    source_type="speaking_opportunity",  # should normalize to speaking_window
                    source_ref="ref-1",
                    start_ms=1000.0,
                    end_ms=4000.0,
                    priority="high",
                    intent="form_correction",  # should normalize to form_reminder
                    allowed_modalities=["voice", "tactile"],  # should normalize to ["audio", "haptic"]
                    text_variants=CueTextVariantsGemini(moderate="Hold your core tight."),
                    haptic_cue_ref="reps",
                    interruption_policy_hint="allow"  # should normalize to safe_gap_only
                ),
                CueCandidateGemini(
                    id="cue-alias-2",
                    exercise_anchor_id="anchor-1",
                    source_type="speaking_opportunity_map",  # should normalize to speaking_window
                    source_ref="ref-2",
                    start_ms=5000.0,
                    end_ms=8000.0,
                    priority="medium",
                    intent="setup",  # should normalize to setup_orientation
                    allowed_modalities=["speech"],  # should normalize to ["audio"]
                    text_variants=CueTextVariantsGemini(moderate="Get in position."),
                    haptic_cue_ref="reps",
                    interruption_policy_hint="duck"  # should normalize to duck_speak
                ),
                CueCandidateGemini(
                    id="cue-alias-3",
                    exercise_anchor_id="anchor-1",
                    source_type="speech_window",  # should normalize to speaking_window
                    source_ref="ref-3",
                    start_ms=9000.0,
                    end_ms=12000.0,
                    priority="low",
                    intent="transition",  # should normalize to transition_notice
                    allowed_modalities=["vibration"],  # should normalize to ["haptic"]
                    text_variants=CueTextVariantsGemini(moderate="Switch sides."),
                    haptic_cue_ref="reps",
                    interruption_policy_hint="pause"  # should normalize to pause_then_speak
                ),
                CueCandidateGemini(
                    id="cue-alias-4",
                    exercise_anchor_id="anchor-1",
                    source_type="form_correction",  # should normalize to form_risk
                    source_ref="ref-4",
                    start_ms=13000.0,
                    end_ms=16000.0,
                    priority="medium",
                    intent="repeat_instruction",  # should normalize to trainer_instruction_repeat
                    allowed_modalities=["audio"],
                    text_variants=CueTextVariantsGemini(moderate="Trainer repeat."),
                    haptic_cue_ref=None,
                    interruption_policy_hint="allowed"  # should normalize to safe_gap_only
                )
            ],
            trainer_instruction_summaries=[]
        )

        # 1. Run conversion through adapter
        canonical_dict = convert_gemini_to_canonical(gemini_plan_dto, "12345678901")

        # Verify adapter-level conversions before validation
        candidates = canonical_dict["cue_candidates"]
        self.assertEqual(len(candidates), 4)

        # Candidate 1 assertions
        c1 = candidates[0]
        self.assertEqual(c1["source_type"], "speaking_window")
        self.assertEqual(c1["intent"], "form_reminder")
        self.assertEqual(c1["allowed_modalities"], ["audio", "haptic"])
        self.assertEqual(c1["interruption_policy_hint"], "safe_gap_only")

        # Candidate 2 assertions
        c2 = candidates[1]
        self.assertEqual(c2["source_type"], "speaking_window")
        self.assertEqual(c2["intent"], "setup_orientation")
        self.assertEqual(c2["allowed_modalities"], ["audio"])
        self.assertEqual(c2["interruption_policy_hint"], "duck_speak")

        # Candidate 3 assertions
        c3 = candidates[2]
        self.assertEqual(c3["source_type"], "speaking_window")
        self.assertEqual(c3["intent"], "transition_notice")
        self.assertEqual(c3["allowed_modalities"], ["haptic"])
        self.assertEqual(c3["interruption_policy_hint"], "pause_then_speak")

        # Candidate 4 assertions
        c4 = candidates[3]
        self.assertEqual(c4["source_type"], "form_risk")
        self.assertEqual(c4["intent"], "trainer_instruction_repeat")
        self.assertEqual(c4["interruption_policy_hint"], "safe_gap_only")

        # 2. Run validator on this normalized output to check it produces zero vocabulary warnings
        validation_res = validate_and_clamp_cue_plan(
            cue_plan_dict=canonical_dict,
            video_duration_seconds=120.0,
            video_uuid=uuid.uuid4()
        )

        self.assertIsNotNone(validation_res.cue_plan)
        # Verify warnings count is 0 for these aliases
        warning_codes = [w.code for w in validation_res.warnings]
        self.assertNotIn("invalid_source_type", warning_codes)
        self.assertNotIn("invalid_intent_sanitized", warning_codes)
        self.assertNotIn("invalid_policy_sanitized", warning_codes)
        self.assertNotIn("invalid_modality_dropped", warning_codes)
        
        # Verify the candidate count is still 4 (none dropped due to validation)
        self.assertEqual(len(validation_res.cue_plan.cue_candidates), 4)


if __name__ == "__main__":
    unittest.main()
