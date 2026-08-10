"""Focused tests for runtime cue selection."""

import tempfile
import unittest
import uuid

from app.core.config import settings
from app.models.cue_plan_schemas import (
    CueCandidate,
    CueIntent,
    CueModality,
    CuePlan,
    CuePriority,
    CueSourceType,
    CueTextVariants,
    InterruptionPolicyHint,
)
from app.models.schemas import (
    AssistantVerbosity,
    AudioCoexistenceSettings,
)
from app.services.cue_plan_runtime_service import cue_plan_runtime_service
from app.services.cue_plan_store import (
    delete_cue_plan_from_disk,
    save_cue_plan_to_disk,
)


class TestCuePlanRuntime(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from app.core.storage import factory

        cls.original_provider = settings.STORAGE_PROVIDER
        settings.STORAGE_PROVIDER = "local_json"
        cls.original_data_dir = settings.PROTOTYPE_DATA_DIR
        cls.temp_dir = tempfile.TemporaryDirectory()
        settings.PROTOTYPE_DATA_DIR = cls.temp_dir.name
        factory._artifact_storage = None

    @classmethod
    def tearDownClass(cls):
        from app.core.storage import factory

        settings.STORAGE_PROVIDER = cls.original_provider
        settings.PROTOTYPE_DATA_DIR = cls.original_data_dir
        factory._artifact_storage = None
        cls.temp_dir.cleanup()

    def test_runtime_selection_rules(self):
        video_uuid = str(uuid.uuid4())
        cue_plan = CuePlan(
            video_id=uuid.UUID(video_uuid),
            youtube_id="12345678901",
            pre_session_overview="Overview",
            exercise_descriptions=[],
            cue_candidates=[
                CueCandidate(
                    id="low-priority-earlier",
                    source_type=CueSourceType.EXERCISE_ANCHOR,
                    start_ms=1000.0,
                    end_ms=5000.0,
                    priority=CuePriority.LOW,
                    intent=CueIntent.SETUP_ORIENTATION,
                    allowed_modalities=[CueModality.AUDIO],
                    text_variants=CueTextVariants(
                        brief="Low brief",
                        moderate="Low moderate",
                        detailed="Low detailed",
                    ),
                    interruption_policy_hint=InterruptionPolicyHint.SAFE_GAP_ONLY,
                ),
                CueCandidate(
                    id="high-priority-later",
                    source_type=CueSourceType.EXERCISE_ANCHOR,
                    start_ms=2000.0,
                    end_ms=6000.0,
                    priority=CuePriority.HIGH,
                    intent=CueIntent.SETUP_ORIENTATION,
                    allowed_modalities=[CueModality.AUDIO],
                    text_variants=CueTextVariants(
                        brief="High brief",
                        moderate="High moderate",
                        detailed="High detailed",
                    ),
                    interruption_policy_hint=InterruptionPolicyHint.SAFE_GAP_ONLY,
                ),
                CueCandidate(
                    id="pause-hint-cue",
                    source_type=CueSourceType.EXERCISE_ANCHOR,
                    start_ms=1500.0,
                    end_ms=5500.0,
                    priority=CuePriority.HIGH,
                    intent=CueIntent.SETUP_ORIENTATION,
                    allowed_modalities=[CueModality.AUDIO],
                    text_variants=CueTextVariants(
                        brief="Pause brief",
                        moderate="Pause moderate",
                        detailed="Pause detailed",
                    ),
                    interruption_policy_hint=InterruptionPolicyHint.PAUSE_THEN_SPEAK,
                ),
                CueCandidate(
                    id="duckspeak-cue",
                    source_type=CueSourceType.EXERCISE_ANCHOR,
                    start_ms=1000.0,
                    end_ms=5000.0,
                    priority=CuePriority.HIGH,
                    intent=CueIntent.MOVEMENT_DESCRIPTION,
                    allowed_modalities=[CueModality.AUDIO],
                    text_variants=CueTextVariants(
                        brief="Duck brief",
                        moderate="Duck moderate",
                        detailed="Duck detailed",
                    ),
                    haptic_cue_ref="duck_haptic_ref",
                    interruption_policy_hint=InterruptionPolicyHint.DUCKSPEAK,
                ),
                CueCandidate(
                    id="haptic-only-cue",
                    source_type=CueSourceType.HAPTIC_PROFILE,
                    start_ms=1000.0,
                    end_ms=5000.0,
                    priority=CuePriority.MEDIUM,
                    intent=CueIntent.HAPTIC_PROMPT,
                    allowed_modalities=[CueModality.HAPTIC],
                    text_variants=None,
                    haptic_cue_ref="per_rep_tick",
                    interruption_policy_hint=InterruptionPolicyHint.HAPTIC_ONLY,
                ),
            ],
        )
        save_cue_plan_to_disk(video_uuid, cue_plan)
        self.addCleanup(delete_cue_plan_from_disk, video_uuid)

        speech = AudioCoexistenceSettings(
            assistant_verbosity=AssistantVerbosity.MODERATE,
            pause_before_speaking=False,
        )
        result = cue_plan_runtime_service.select_cue(
            video_uuid, 2500.0, speech, True
        )
        self.assertTrue(result.should_deliver)
        self.assertEqual(result.cue_id, "haptic-only-cue")
        self.assertEqual(result.modality, "haptic")
        self.assertIsNone(result.text)

        result = cue_plan_runtime_service.select_cue(
            video_uuid, 2500.0, speech, False
        )
        self.assertTrue(result.should_deliver)

        pause = AudioCoexistenceSettings(
            assistant_verbosity=AssistantVerbosity.MODERATE,
            pause_before_speaking=True,
        )
        result = cue_plan_runtime_service.select_cue(
            video_uuid, 2500.0, pause, False
        )
        self.assertEqual(result.cue_id, "pause-hint-cue")
        self.assertEqual(
            result.recommended_playback_action, "pause_before_speaking"
        )

        result = cue_plan_runtime_service.select_cue(
            video_uuid,
            2500.0,
            speech,
            False,
            ["high-priority-later", "pause-hint-cue"],
        )
        self.assertEqual(result.cue_id, "duckspeak-cue")

        result = cue_plan_runtime_service.select_cue(
            video_uuid, 2500.0, speech, False, ["pause-hint-cue", "duckspeak-cue"]
        )
        self.assertEqual(result.cue_id, "high-priority-later")
        self.assertEqual(result.text, "High moderate")

        detailed = AudioCoexistenceSettings(
            assistant_verbosity=AssistantVerbosity.DETAILED,
            pause_before_speaking=False,
        )
        result = cue_plan_runtime_service.select_cue(
            video_uuid,
            2500.0,
            detailed,
            False,
            ["high-priority-later", "pause-hint-cue"],
        )
        self.assertTrue(result.should_deliver)
        self.assertEqual(result.cue_id, "duckspeak-cue")
        self.assertEqual(result.recommended_playback_action, "duck_audio")
        self.assertEqual(result.haptic_cue_ref, "duck_haptic_ref")
        self.assertEqual(result.modality, CueModality.AUDIO)
        self.assertEqual(
            result.interruption_policy_hint, InterruptionPolicyHint.DUCKSPEAK
        )


if __name__ == "__main__":
    unittest.main()
