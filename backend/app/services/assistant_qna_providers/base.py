"""Base class for all assistant QnA providers."""

from abc import ABC, abstractmethod
from typing import Any
from app.models.schemas import QARequest, QAResponse


class AssistantQnAProvider(ABC):
    """Abstract base class that all assistant QnA provider strategies must implement."""

    @abstractmethod
    def answer_question(self, request: QARequest, grounded_context: dict[str, Any]) -> QAResponse:
        """Generates an answer to the user's question using grounded context and settings."""
        pass
