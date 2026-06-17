import json
import unittest
from unittest.mock import patch, MagicMock
from uuid import uuid4
import botocore.exceptions

from app.core.config import settings
from app.core.storage import get_artifact_storage
from app.core.storage.s3_artifacts import S3GeneratedArtifactStorage
from app.models.schemas import AssistanceSidecarManifest
from app.models.cue_plan_schemas import CuePlan


class TestS3GeneratedArtifactStorage(unittest.TestCase):

    def setUp(self) -> None:
        self.mock_s3 = MagicMock()
        self.get_s3_patcher = patch(
            "app.core.storage.aws_client.get_s3_client",
            return_value=self.mock_s3
        )
        self.get_s3_patcher.start()

        self.original_provider = settings.STORAGE_PROVIDER
        # Clear singleton
        from app.core.storage import factory
        factory._artifact_storage = None

    def tearDown(self) -> None:
        self.get_s3_patcher.stop()
        settings.STORAGE_PROVIDER = self.original_provider
        from app.core.storage import factory
        factory._artifact_storage = None

    def test_factory_resolves_s3_storage(self) -> None:
        settings.STORAGE_PROVIDER = "dynamodb"
        storage = get_artifact_storage()
        self.assertIsInstance(storage, S3GeneratedArtifactStorage)

    def test_load_manifest_success(self) -> None:
        storage = S3GeneratedArtifactStorage()
        video_id = str(uuid4())
        manifest_data = {
            "youtube_id": "12345678901",
            "exercise_timeline_anchors": [],
            "trainer_instruction_events": [],
            "speaking_opportunity_map": [],
            "form_risk_templates": [],
            "haptic_spatial_cue_profiles": [],
            "beat_timestamps": [],
            "expected_movement_windows": {}
        }

        # Mock get_object response body
        mock_body = MagicMock()
        mock_body.read.return_value = json.dumps(manifest_data).encode("utf-8")
        self.mock_s3.get_object.return_value = {"Body": mock_body}

        res = storage.load_manifest(video_id)
        self.assertIsNotNone(res)
        self.assertEqual(res.youtube_id, "12345678901")
        self.mock_s3.get_object.assert_called_once_with(
            Bucket=settings.ARTIFACTS_BUCKET,
            Key=f"manifests/{video_id}.json"
        )

    def test_load_manifest_not_found(self) -> None:
        storage = S3GeneratedArtifactStorage()
        video_id = str(uuid4())

        # Mock ClientError for NoSuchKey
        err_response = {"Error": {"Code": "NoSuchKey", "Message": "Not Found"}}
        self.mock_s3.get_object.side_effect = botocore.exceptions.ClientError(
            err_response, "GetObject"
        )

        res = storage.load_manifest(video_id)
        self.assertIsNone(res)

    def test_save_manifest(self) -> None:
        storage = S3GeneratedArtifactStorage()
        video_id = str(uuid4())
        manifest = AssistanceSidecarManifest(
            youtube_id="12345678901",
            exercise_timeline_anchors=[],
            trainer_instruction_events=[],
            speaking_opportunity_map=[],
            form_risk_templates=[],
            haptic_spatial_cue_profiles=[],
            beat_timestamps=[],
            expected_movement_windows={}
        )

        storage.save_manifest(video_id, manifest)
        self.mock_s3.put_object.assert_called_once()
        called_args, called_kwargs = self.mock_s3.put_object.call_args
        self.assertEqual(called_kwargs["Bucket"], settings.ARTIFACTS_BUCKET)
        self.assertEqual(called_kwargs["Key"], f"manifests/{video_id}.json")
        self.assertEqual(called_kwargs["ContentType"], "application/json")

    def test_delete_manifest_success(self) -> None:
        storage = S3GeneratedArtifactStorage()
        video_id = str(uuid4())

        res = storage.delete_manifest(video_id)
        self.assertTrue(res)
        self.mock_s3.delete_object.assert_called_once_with(
            Bucket=settings.ARTIFACTS_BUCKET,
            Key=f"manifests/{video_id}.json"
        )

    def test_cue_plan_crud(self) -> None:
        storage = S3GeneratedArtifactStorage()
        video_id = str(uuid4())
        cue_plan = CuePlan(
            youtube_id="12345678901",
            pre_session_overview="Workout overview details",
            cue_candidates=[],
            exercise_descriptions=[],
            trainer_instruction_summaries=[]
        )

        # Save
        storage.save_cue_plan(video_id, cue_plan)
        self.mock_s3.put_object.assert_called_once()

        # Load success
        mock_body = MagicMock()
        mock_body.read.return_value = cue_plan.model_dump_json().encode("utf-8")
        self.mock_s3.get_object.return_value = {"Body": mock_body}
        loaded = storage.load_cue_plan(video_id)
        self.assertIsNotNone(loaded)
        self.assertEqual(loaded.youtube_id, "12345678901")

        # Delete
        storage.delete_cue_plan(video_id)
        self.mock_s3.delete_object.assert_called_once()

    def test_diagnostics_crud(self) -> None:
        storage = S3GeneratedArtifactStorage()
        video_id = str(uuid4())
        diagnostics = {"provider": "gemini", "warning_count": 0}

        # Save sidecar diagnostics
        storage.save_sidecar_diagnostics(video_id, diagnostics)
        self.mock_s3.put_object.assert_called_once_with(
            Bucket=settings.ARTIFACTS_BUCKET,
            Key=f"diagnostics/sidecar/{video_id}.json",
            Body=json.dumps(diagnostics),
            ContentType="application/json"
        )

        # Load sidecar diagnostics
        mock_body = MagicMock()
        mock_body.read.return_value = json.dumps(diagnostics).encode("utf-8")
        self.mock_s3.get_object.return_value = {"Body": mock_body}
        loaded = storage.load_sidecar_diagnostics(video_id)
        self.assertEqual(loaded["provider"], "gemini")

        # Delete sidecar diagnostics
        storage.delete_sidecar_diagnostics(video_id)
        self.mock_s3.delete_object.assert_called_once_with(
            Bucket=settings.ARTIFACTS_BUCKET,
            Key=f"diagnostics/sidecar/{video_id}.json"
        )

        # Cue plan diagnostics
        self.mock_s3.put_object.reset_mock()
        self.mock_s3.get_object.reset_mock()
        self.mock_s3.delete_object.reset_mock()

        # Save
        storage.save_cue_plan_diagnostics(video_id, diagnostics)
        self.mock_s3.put_object.assert_called_once_with(
            Bucket=settings.ARTIFACTS_BUCKET,
            Key=f"diagnostics/cue-plan/{video_id}.json",
            Body=json.dumps(diagnostics),
            ContentType="application/json"
        )

        # Load
        mock_body = MagicMock()
        mock_body.read.return_value = json.dumps(diagnostics).encode("utf-8")
        self.mock_s3.get_object.return_value = {"Body": mock_body}
        loaded = storage.load_cue_plan_diagnostics(video_id)
        self.assertEqual(loaded["warning_count"], 0)

        # Delete
        storage.delete_cue_plan_diagnostics(video_id)
        self.mock_s3.delete_object.assert_called_once_with(
            Bucket=settings.ARTIFACTS_BUCKET,
            Key=f"diagnostics/cue-plan/{video_id}.json"
        )
