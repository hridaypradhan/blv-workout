"""Registry resolver for assistant QnA providers."""

from __future__ import annotations

import logging

from app.services.assistant_qna_providers.base import AssistantQnAProvider
from app.services.assistant_qna_providers.prototype import PrototypeAssistantQnAProvider

logger = logging.getLogger(__name__)


def normalize_provider_name(value: str) -> str:
    """Standardizes a provider name into a lowercase, stripped string."""
    if not value:
        return "prototype"
    return value.strip().lower()


def resolve_qna_provider(value: str) -> tuple[str, AssistantQnAProvider]:
    """Resolves and returns the normalized provider name and corresponding AssistantQnAProvider strategy."""
    normalized = normalize_provider_name(value)
    if normalized == "gemini":
        try:
            from app.services.assistant_qna_providers.gemini_qna.provider import GeminiAssistantQnAProvider
            return "gemini", GeminiAssistantQnAProvider()
        except ImportError as e:
            logger.error("Failed to import GeminiAssistantQnAProvider: %s. Falling back to prototype.", e)
            return "prototype", PrototypeAssistantQnAProvider()
    elif normalized == "prototype":
        return "prototype", PrototypeAssistantQnAProvider()
    else:
        logger.warning(
            "Unknown AI QnA provider '%s' requested. Defaulting to prototype strategy.",
            value
        )
        return "prototype", PrototypeAssistantQnAProvider()
