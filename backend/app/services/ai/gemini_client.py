"""Gemini service client wrapper using Google GenAI SDK for transport only."""

from __future__ import annotations

import json
import logging
from typing import Any

from google import genai
from google.genai import types

from app.core.config import settings
from app.services.ai.errors import AIProviderAPIError, AIProviderResponseParseError

logger = logging.getLogger(__name__)


class GeminiClient:
    """Wrapper around the Google GenAI SDK client for transport operations."""
    
    def __init__(self) -> None:
        self._client = None
        
    @property
    def client(self) -> genai.Client:
        if self._client is None:
            api_key = settings.GEMINI_API_KEY
            if not api_key:
                raise ValueError("GEMINI_API_KEY is not set.")
            self._client = genai.Client(api_key=api_key)
        return self._client
        
    def generate_structured_content(
        self,
        system_instruction: str,
        prompt: str,
        response_schema: Any,
    ) -> dict[str, Any]:
        """Call Gemini SDK with system instruction, prompt, and structured schema."""
        model = settings.GEMINI_MODEL
        try:
            response = self.client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type='application/json',
                    response_schema=response_schema,
                    system_instruction=system_instruction,
                    temperature=0.1,
                )
            )
        except Exception as e:
            err_msg = str(e)
            logger.error("SDK generate_content failed: %s", err_msg)
            raise AIProviderAPIError(f"Gemini API call failed: {err_msg}")
            
        try:
            return json.loads(response.text)
        except Exception as e:
            truncated_text = response.text[:200] if response.text else ""
            logger.error("Failed to parse response JSON: %s. Truncated response text: %r", e, truncated_text)
            raise AIProviderResponseParseError(f"Failed to parse JSON response: {e}")


gemini_client = GeminiClient()

