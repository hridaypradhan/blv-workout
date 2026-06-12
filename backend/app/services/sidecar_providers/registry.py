"""Registry resolver helper for sidecar strategy providers."""

from __future__ import annotations

import logging

from app.services.sidecar_providers.base import SidecarProvider
from app.services.sidecar_providers.prototype import PrototypeSidecarProvider
from app.services.sidecar_providers.gemini_sidecar.provider import GeminiSidecarProvider

logger = logging.getLogger(__name__)


def normalize_provider_name(value: str) -> str:
    """Standardizes a provider name into a lowercase, stripped string."""
    if not value:
        return "prototype"
    return value.strip().lower()


def provider_requires_transcript(value: str) -> bool:
    """Returns True if the provider strategy requires an active subtitles transcript."""
    return normalize_provider_name(value) == "gemini"


def resolve_sidecar_provider(value: str) -> tuple[str, SidecarProvider]:
    """Resolves and returns the normalized provider name and corresponding SidecarProvider strategy.
    
    Falls back to PrototypeSidecarProvider if the provider is unknown/unsupported,
    logging a warning.
    """
    normalized = normalize_provider_name(value)
    if normalized == "gemini":
        return "gemini", GeminiSidecarProvider()
    elif normalized == "prototype":
        return "prototype", PrototypeSidecarProvider()
    else:
        logger.warning(
            "Unknown AI provider '%s' requested. Defaulting sidecar generation to prototype strategy.",
            value
        )
        return "prototype", PrototypeSidecarProvider()
