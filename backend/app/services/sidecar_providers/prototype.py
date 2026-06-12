"""Prototype sidecar provider that yields offline, deterministic manifests."""

from __future__ import annotations

from typing import Any

from app.services.mock_manifest_service import build_deterministic_sidecar_manifest
from app.services.sidecar_providers.base import SidecarGenerationInput


class PrototypeSidecarProvider:
    """Strategy for offline deterministic mock sidecar generation."""

    def generate_manifest(
        self,
        input_data: SidecarGenerationInput,
    ) -> dict[str, Any]:
        """Returns the deterministic prototype manifest serialized to a dictionary."""
        manifest = build_deterministic_sidecar_manifest(input_data)
        return manifest.model_dump(mode="json")
