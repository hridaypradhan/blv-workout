"""Text-to-speech service stubs for FitA11y."""

from collections.abc import AsyncGenerator
from typing import Any


def synthesize(text: str, voice_settings: dict[str, Any]) -> bytes:
    """Synthesize speech audio bytes from text and voice settings."""
    raise NotImplementedError("TODO: implement")


async def stream_synthesis(text: str, voice_settings: dict[str, Any]) -> AsyncGenerator[bytes, None]:
    """Stream synthesized speech audio chunks from text and voice settings."""
    raise NotImplementedError("TODO: implement")
