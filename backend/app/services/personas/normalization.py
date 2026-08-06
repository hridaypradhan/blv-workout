"""Normalization helper for assistant personas.

Maps raw/legacy persona string values to canonical Maryam AssistantPersona values.
Canonical personas:
- cheerleader
- guide
- sergeant
"""

from typing import Any
from app.models.schemas import AssistantPersona

LEGACY_PERSONA_MAP: dict[str, AssistantPersona] = {
    "energetic": AssistantPersona.CHEERLEADER,
    "supportive": AssistantPersona.GUIDE,
    "calm": AssistantPersona.GUIDE,
    "direct": AssistantPersona.SERGEANT,
    "cheerleader": AssistantPersona.CHEERLEADER,
    "guide": AssistantPersona.GUIDE,
    "sergeant": AssistantPersona.SERGEANT,
}


def normalize_persona(raw_persona: Any) -> AssistantPersona:
    """Normalize a raw persona value to one of the canonical AssistantPersona values.

    Migration map:
    - energetic -> CHEERLEADER
    - supportive -> GUIDE
    - calm -> GUIDE
    - direct -> SERGEANT
    - missing / unknown / invalid -> GUIDE
    """
    if raw_persona is None:
        return AssistantPersona.GUIDE
    if isinstance(raw_persona, AssistantPersona):
        return raw_persona
    if isinstance(raw_persona, str):
        val = raw_persona.strip().lower()
        return LEGACY_PERSONA_MAP.get(val, AssistantPersona.GUIDE)
    return AssistantPersona.GUIDE
