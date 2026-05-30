"""Text-to-speech service stubs for FitA11y assistant cues.

Synthesizes speech for the assistant's supplementary cues (corrections,
pacing nudges, motivation). The TTS output coexists with the YouTube
trainer's audio according to the user's audio coexistence settings.
"""

from collections.abc import AsyncGenerator
from typing import Any


def synthesize(text: str, voice_settings: dict[str, Any]) -> bytes:
    """Synthesize speech audio bytes for an assistant cue."""
    raise NotImplementedError("TODO: implement")


async def stream_synthesis(text: str, voice_settings: dict[str, Any]) -> AsyncGenerator[bytes, None]:
    """Stream synthesized speech audio chunks for an assistant cue."""
    raise NotImplementedError("TODO: implement")
