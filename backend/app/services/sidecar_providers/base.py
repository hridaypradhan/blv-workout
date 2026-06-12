"""Protocol definition for sidecar manifest generation providers and input DTO."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol, Any


@dataclass(frozen=True)
class SidecarGenerationInput:
    """Input DTO containing all necessary data to generate an assistance sidecar manifest."""

    video_id: str
    youtube_url: str
    youtube_id: str
    title: str
    channel_name: str
    duration_seconds: float
    transcript_text: str = ""
    transcript_segments: list[dict[str, Any]] = field(default_factory=list)
    caption_status: str = ""


class SidecarProvider(Protocol):
    """Protocol that all sidecar manifest generation strategies must implement."""

    def generate_manifest(
        self,
        input_data: SidecarGenerationInput,
    ) -> dict[str, Any]:
        """Generates a raw or adapted manifest dictionary structure for a given input."""
        ...
