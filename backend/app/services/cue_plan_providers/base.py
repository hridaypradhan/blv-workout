"""Base class and DTO inputs for all cue plan providers."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel
from app.models.schemas import AssistanceSidecarManifest


class CuePlanGenerationInput(BaseModel):
    """Input parameters passed to cue plan providers to build candidate cues."""

    video_id: str
    youtube_id: str
    duration_seconds: float
    sidecar_manifest: AssistanceSidecarManifest


class CuePlanProvider(ABC):
    """Abstract base class interface that all Cue Plan providers must implement."""

    @abstractmethod
    def generate_cue_plan(self, input_data: CuePlanGenerationInput) -> dict[str, Any]:
        """Generates raw cue plan data dictionary from sidecar manifest details.

        This output dictionary must map to the CuePlan schema before validation.
        """
        pass
