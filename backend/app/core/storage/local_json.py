from typing import Optional
from app.core.storage.interfaces import GeneratedArtifactStorage
from app.models.schemas import AssistanceSidecarManifest
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
        save_json_store(f"ai_diagnostics/{video_id}.json", diagnostics)

    def delete_sidecar_diagnostics(self, video_id: str) -> bool:
        return delete_json_store(f"ai_diagnostics/{video_id}.json")

    def load_cue_plan_diagnostics(self, video_id: str) -> Optional[dict]:
        return load_json_store(f"ai_diagnostics/cue_plan_{video_id}.json")

    def save_cue_plan_diagnostics(self, video_id: str, diagnostics: dict) -> None:
        save_json_store(f"ai_diagnostics/cue_plan_{video_id}.json", diagnostics)

    def delete_cue_plan_diagnostics(self, video_id: str) -> bool:
        return delete_json_store(f"ai_diagnostics/cue_plan_{video_id}.json")
