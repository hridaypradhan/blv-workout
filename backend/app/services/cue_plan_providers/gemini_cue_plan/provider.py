"""Gemini cue plan provider utilizing Gemini model structured outputs."""

from __future__ import annotations

from typing import Any

from app.services.ai.errors import AIProviderResponseParseError
from app.services.ai.gemini_client import gemini_client
from app.services.cue_plan_providers.base import CuePlanProvider, CuePlanGenerationInput
from app.services.cue_plan_providers.gemini_cue_plan.prompt import SYSTEM_INSTRUCTION, build_cue_plan_prompt
from app.services.cue_plan_providers.gemini_cue_plan.schema import CuePlanGemini
from app.services.cue_plan_providers.gemini_cue_plan.adapter import convert_gemini_to_canonical


class GeminiCuePlanProvider(CuePlanProvider):
    """Strategy that requests structured CuePlan DTOs from Gemini API and adapts them."""

    def generate_cue_plan(self, input_data: CuePlanGenerationInput) -> dict[str, Any]:
        prompt = build_cue_plan_prompt(input_data)
        
        raw_response = gemini_client.generate_structured_content(
            system_instruction=SYSTEM_INSTRUCTION,
            prompt=prompt,
            response_schema=CuePlanGemini,
        )
        
        if not raw_response:
            raise AIProviderResponseParseError("Gemini model returned empty response for cue plan")
            
        # Parse the raw structured DTO as CuePlanGemini to ensure fields compile
        try:
            parsed_dto = CuePlanGemini.model_validate(raw_response)
        except Exception as exc:
            raise AIProviderResponseParseError(f"Gemini response structure mismatch: {exc}")
            
        return convert_gemini_to_canonical(parsed_dto, input_data.youtube_id)
