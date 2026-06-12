"""Gemini sidecar provider strategy utilizing Gemini model structured outputs."""

from __future__ import annotations

from typing import Any

from app.services.ai.errors import AIProviderResponseParseError
from app.services.ai.gemini_client import gemini_client
from app.services.sidecar_providers.base import SidecarGenerationInput
from app.services.sidecar_providers.gemini_sidecar.prompt import build_gemini_prompt
from app.services.sidecar_providers.gemini_sidecar.schema import AssistanceSidecarManifestGemini
from app.services.sidecar_providers.gemini_sidecar.adapter import convert_gemini_to_canonical


class GeminiSidecarProvider:
    """Strategy that requests structured manifest DTOs from Gemini API and converts them."""

    def generate_manifest(
        self,
        input_data: SidecarGenerationInput,
    ) -> dict[str, Any]:
        """Calls Gemini API, adapts the list-of-objects structure back to dictionaries, and returns it."""
        system_instruction, prompt = build_gemini_prompt(input_data)
        
        raw_response = gemini_client.generate_structured_content(
            system_instruction=system_instruction,
            prompt=prompt,
            response_schema=AssistanceSidecarManifestGemini,
        )
        
        if not raw_response:
            raise AIProviderResponseParseError("Gemini model returned empty response")
            
        return convert_gemini_to_canonical(raw_response)
