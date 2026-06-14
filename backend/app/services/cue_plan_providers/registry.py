"""Registry resolver helper for cue plan providers."""

from __future__ import annotations

import logging

from app.services.cue_plan_providers.base import CuePlanProvider
from app.services.cue_plan_providers.prototype import PrototypeCuePlanProvider
from app.services.cue_plan_providers.gemini_cue_plan.provider import GeminiCuePlanProvider

logger = logging.getLogger(__name__)


def normalize_provider_name(value: str) -> str:
    """Standardizes a provider name into a lowercase, stripped string."""
    if not value:
        return "prototype"
    return value.strip().lower()


def resolve_cue_plan_provider(value: str) -> tuple[str, CuePlanProvider]:
    """Resolves and returns the normalized provider name and corresponding CuePlanProvider strategy.

    Falls back to PrototypeCuePlanProvider if the provider is unknown/unsupported,
    logging a warning.
    """
    normalized = normalize_provider_name(value)
    if normalized == "gemini":
        return "gemini", GeminiCuePlanProvider()
    elif normalized == "prototype":
        return "prototype", PrototypeCuePlanProvider()
    else:
        logger.warning(
            "Unknown AI cue plan provider '%s' requested. Defaulting to prototype strategy.",
            value
        )
        return "prototype", PrototypeCuePlanProvider()
