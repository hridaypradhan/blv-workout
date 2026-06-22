from typing import Optional
from app.core.storage.interfaces import GeneratedArtifactStorage
from app.models.schemas import AssistanceSidecarManifest, TranscriptArtifact
from app.models.cue_plan_schemas import CuePlan
from app.services.sidecar_manifest_store import (
    load_manifest_from_disk,
    save_manifest_to_disk,
    delete_manifest_from_disk,
)
from app.services.cue_plan_store import (
    load_cue_plan_from_disk,
    save_cue_plan_to_disk,
    delete_cue_plan_from_disk,
)
from app.core.prototype_persistence import (
    load_json_store,
    save_json_store,
    delete_json_store,
)


class LocalJsonGeneratedArtifactStorage(GeneratedArtifactStorage):
    """Local JSON implementation of GeneratedArtifactStorage."""

    def load_manifest(self, video_id: str) -> Optional[AssistanceSidecarManifest]:
        return load_manifest_from_disk(video_id)

    def save_manifest(self, video_id: str, manifest: AssistanceSidecarManifest) -> None:
        save_manifest_to_disk(video_id, manifest)

    def delete_manifest(self, video_id: str) -> bool:
        return delete_manifest_from_disk(video_id)

    def load_cue_plan(self, video_id: str) -> Optional[CuePlan]:
        return load_cue_plan_from_disk(video_id)

    def save_cue_plan(self, video_id: str, cue_plan: CuePlan) -> None:
        save_cue_plan_to_disk(video_id, cue_plan)

    def delete_cue_plan(self, video_id: str) -> bool:
        return delete_cue_plan_from_disk(video_id)

    def load_sidecar_diagnostics(self, video_id: str) -> Optional[dict]:
        return load_json_store(f"ai_diagnostics/{video_id}.json")

    def save_sidecar_diagnostics(self, video_id: str, diagnostics: dict) -> None:
        from app.core.config import settings
        if not settings.AI_DIAGNOSTICS_ENABLED:
            return
        save_json_store(f"ai_diagnostics/{video_id}.json", diagnostics)

    def delete_sidecar_diagnostics(self, video_id: str) -> bool:
        return delete_json_store(f"ai_diagnostics/{video_id}.json")

    def load_cue_plan_diagnostics(self, video_id: str) -> Optional[dict]:
        return load_json_store(f"ai_diagnostics/cue_plan_{video_id}.json")

    def save_cue_plan_diagnostics(self, video_id: str, diagnostics: dict) -> None:
        from app.core.config import settings
        if not settings.AI_DIAGNOSTICS_ENABLED:
            return
        save_json_store(f"ai_diagnostics/cue_plan_{video_id}.json", diagnostics)

    def delete_cue_plan_diagnostics(self, video_id: str) -> bool:
        return delete_json_store(f"ai_diagnostics/cue_plan_{video_id}.json")

    def save_qna_diagnostics(self, session_or_video_id: str, key_suffix: str, diagnostics: dict) -> None:
        from app.core.config import settings
        if not settings.AI_DIAGNOSTICS_ENABLED:
            return
        save_json_store(f"ai_diagnostics/qna_{session_or_video_id}_{key_suffix}.json", diagnostics)

    def load_transcript(self, video_id: str) -> Optional[TranscriptArtifact]:
        data = load_json_store(f"transcripts/{video_id}.json")
        if data is None:
            return None
        return TranscriptArtifact.model_validate(data)

    def save_transcript(self, video_id: str, transcript_data: TranscriptArtifact) -> None:
        save_json_store(f"transcripts/{video_id}.json", transcript_data.model_dump(mode="json"))

    def delete_transcript(self, video_id: str) -> bool:
        return delete_json_store(f"transcripts/{video_id}.json")

