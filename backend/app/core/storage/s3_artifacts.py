import json
import logging
from typing import Optional
import botocore.exceptions

from app.core.config import settings
from app.core.storage import aws_client
from app.core.storage.interfaces import GeneratedArtifactStorage
from app.models.schemas import AssistanceSidecarManifest, TranscriptArtifact
from app.models.cue_plan_schemas import CuePlan

logger = logging.getLogger(__name__)


class S3GeneratedArtifactStorage(GeneratedArtifactStorage):
    """S3 implementation of GeneratedArtifactStorage."""

    def __init__(self) -> None:
        self._s3_client = None

    @property
    def client(self):
        if self._s3_client is None:
            self._s3_client = aws_client.get_s3_client()
        return self._s3_client

    @property
    def bucket(self) -> str:
        return settings.ARTIFACTS_BUCKET

    def _load_json(self, key: str) -> Optional[dict]:
        try:
            response = self.client.get_object(Bucket=self.bucket, Key=key)
            content = response["Body"].read().decode("utf-8")
            return json.loads(content)
        except botocore.exceptions.ClientError as e:
            # Handle NoSuchKey or 404 client error
            error_code = e.response.get("Error", {}).get("Code")
            if error_code in ("NoSuchKey", "404"):
                return None
            logger.error(f"S3 get_object client error for key {key}: {e}")
            raise
        except Exception as e:
            # Also catch NoSuchKey from exceptions container if present
            if hasattr(self.client, "exceptions") and hasattr(self.client.exceptions, "NoSuchKey"):
                if isinstance(e, self.client.exceptions.NoSuchKey):
                    return None
            logger.error(f"S3 get_object error for key {key}: {e}")
            raise

    def _save_json(self, key: str, data: dict | str) -> None:
        if isinstance(data, dict):
            body = json.dumps(data)
        else:
            body = data
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=body,
            ContentType="application/json"
        )

    def _delete_object(self, key: str) -> bool:
        try:
            self.client.delete_object(Bucket=self.bucket, Key=key)
            return True
        except botocore.exceptions.ClientError as e:
            error_code = e.response.get("Error", {}).get("Code")
            if error_code in ("NoSuchKey", "404"):
                return False
            logger.error(f"S3 delete_object error for key {key}: {e}")
            return False

    def load_manifest(self, video_id: str) -> Optional[AssistanceSidecarManifest]:
        key = f"manifests/{video_id}.json"
        data = self._load_json(key)
        if data is None:
            return None
        return AssistanceSidecarManifest.model_validate(data)

    def save_manifest(self, video_id: str, manifest: AssistanceSidecarManifest) -> None:
        key = f"manifests/{video_id}.json"
        self._save_json(key, manifest.model_dump_json())

    def delete_manifest(self, video_id: str) -> bool:
        key = f"manifests/{video_id}.json"
        return self._delete_object(key)

    def load_cue_plan(self, video_id: str) -> Optional[CuePlan]:
        key = f"cue-plans/{video_id}.json"
        data = self._load_json(key)
        if data is None:
            return None
        return CuePlan.model_validate(data)

    def save_cue_plan(self, video_id: str, cue_plan: CuePlan) -> None:
        key = f"cue-plans/{video_id}.json"
        self._save_json(key, cue_plan.model_dump_json())

    def delete_cue_plan(self, video_id: str) -> bool:
        key = f"cue-plans/{video_id}.json"
        return self._delete_object(key)

    def load_sidecar_diagnostics(self, video_id: str) -> Optional[dict]:
        key = f"diagnostics/sidecar/{video_id}.json"
        return self._load_json(key)

    def save_sidecar_diagnostics(self, video_id: str, diagnostics: dict) -> None:
        key = f"diagnostics/sidecar/{video_id}.json"
        self._save_json(key, diagnostics)

    def delete_sidecar_diagnostics(self, video_id: str) -> bool:
        key = f"diagnostics/sidecar/{video_id}.json"
        return self._delete_object(key)

    def load_cue_plan_diagnostics(self, video_id: str) -> Optional[dict]:
        key = f"diagnostics/cue-plan/{video_id}.json"
        return self._load_json(key)

    def save_cue_plan_diagnostics(self, video_id: str, diagnostics: dict) -> None:
        key = f"diagnostics/cue-plan/{video_id}.json"
        self._save_json(key, diagnostics)

    def delete_cue_plan_diagnostics(self, video_id: str) -> bool:
        key = f"diagnostics/cue-plan/{video_id}.json"
        return self._delete_object(key)

    def save_qna_diagnostics(self, session_or_video_id: str, key_suffix: str, diagnostics: dict) -> None:
        key = f"diagnostics/qna/{session_or_video_id}/{key_suffix}.json"
        self._save_json(key, diagnostics)

    def load_transcript(self, video_id: str) -> Optional[TranscriptArtifact]:
        key = f"transcripts/{video_id}.json"
        data = self._load_json(key)
        if data is None:
            return None
        return TranscriptArtifact.model_validate(data)

    def save_transcript(self, video_id: str, transcript_data: TranscriptArtifact) -> None:
        key = f"transcripts/{video_id}.json"
        self._save_json(key, transcript_data.model_dump_json())

    def delete_transcript(self, video_id: str) -> bool:
        key = f"transcripts/{video_id}.json"
        return self._delete_object(key)

