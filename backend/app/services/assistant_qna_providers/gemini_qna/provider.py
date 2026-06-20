"""Gemini assistant QnA provider strategy."""

import logging
import re
from typing import Any

from app.services.ai.errors import AIProviderAPIError, AIProviderResponseParseError
from app.services.ai.gemini_client import gemini_client
from app.services.assistant_qna_providers.base import AssistantQnAProvider
from app.services.assistant_qna_providers.gemini_qna.prompt import SYSTEM_INSTRUCTION, build_qna_prompt
from app.services.assistant_qna_providers.gemini_qna.schema import GeminiQnAResponse
from app.models.schemas import QARequest, QAResponse, AssistantPersona, FeedbackModality

logger = logging.getLogger(__name__)


def sanitize_qna_answer(text: str) -> str:
    """Clamps Gemini's answer length if necessary and strips whitespace."""
    if not text:
        return ""
    
    text = text.strip()
    if len(text) > 300:
        text = text[:297].strip() + "..."
        
    return text


class GeminiAssistantQnAProvider(AssistantQnAProvider):
    """QnA provider that queries Gemini model using structured output schemas."""

    def answer_question(self, request: QARequest, grounded_context: dict[str, Any]) -> QAResponse:
        # Determine observation available
        pose_available = False
        obs_context = None
        if request.runtime_observation_context:
            pose_available = request.runtime_observation_context.pose_available
            obs_context = request.runtime_observation_context.model_dump()

        persona_str = request.persona.value if request.persona else "supportive"
        prompt = build_qna_prompt(request.question, grounded_context, obs_context, persona_str)

        # Call Gemini SDK client using structured JSON
        raw_response = gemini_client.generate_structured_content(
            system_instruction=SYSTEM_INSTRUCTION,
            prompt=prompt,
            response_schema=GeminiQnAResponse,
        )

        if not raw_response:
            raise AIProviderResponseParseError("Gemini model returned empty response for QnA")

        try:
            parsed_dto = GeminiQnAResponse.model_validate(raw_response)
        except Exception as exc:
            raise AIProviderResponseParseError(f"Gemini response structure mismatch: {exc}")

        # Sanitize answer text (length clamp and stripping)
        sanitized_text = sanitize_qna_answer(parsed_dto.answer_text)

        # Map to canonical QAResponse
        return QAResponse(
            answer_text=sanitized_text,
            answer_kind=parsed_dto.answer_kind,
            provider="gemini",
            model=None, # will be populated by service layer
            grounding_sources=parsed_dto.grounding_sources,
            spoken_safe=parsed_dto.spoken_safe,
            fallback_reason=None,
            diagnostics_ref=None,
            # Backward compatibility fields
            text=sanitized_text,
            persona=request.persona or AssistantPersona.SUPPORTIVE,
            modality=FeedbackModality.AUDIO,
            priority="normal",
            timestamp_ms=request.current_timestamp_ms,
        )
