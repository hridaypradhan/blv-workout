"""Canonical Maryam assistant persona policies and tone guidance for FitA11y.

Defines the fixed policy constants for Maryam's three canonical personas:
- cheerleader
- guide
- sergeant
"""

from typing import NamedTuple
from app.models.schemas import AssistantPersona


class PersonaPolicyConfig(NamedTuple):
    name: str
    reps_per_motivation: int
    max_corrections_per_exercise: int
    encourage_every: int
    wrap_style: str
    tone: str


PERSONA_POLICIES: dict[AssistantPersona, PersonaPolicyConfig] = {
    AssistantPersona.CHEERLEADER: PersonaPolicyConfig(
        name="cheerleader",
        reps_per_motivation=4,
        max_corrections_per_exercise=1,
        encourage_every=1,
        wrap_style=(
            "pure celebration — cheer the finished exercise like a victory "
            "and carry the excitement into the next one"
        ),
        tone=(
            "an exuberant cheerleader who celebrates every bit of effort "
            "loudly, uses exclamations, and makes the user feel unstoppable"
        ),
    ),
    AssistantPersona.GUIDE: PersonaPolicyConfig(
        name="guide",
        reps_per_motivation=7,
        max_corrections_per_exercise=2,
        encourage_every=2,
        wrap_style=(
            "a warm, brief acknowledgement of the work just done and calm "
            "confidence heading into what's next"
        ),
        tone=(
            "a steady, warm coach who encourages without overdoing it — "
            "supportive, confident, no shouting"
        ),
    ),
    AssistantPersona.SERGEANT: PersonaPolicyConfig(
        name="sergeant",
        reps_per_motivation=10,
        max_corrections_per_exercise=3,
        encourage_every=3,
        wrap_style=(
            "brisk but genuinely encouraging, always with concrete technical "
            "guidance the user can act on next time"
        ),
        tone=(
            "a disciplined drill sergeant: terse, commanding, no-nonsense, in "
            "short punchy phrases — tough but fair, with flashes of genuine "
            "encouragement when it's earned, never insulting"
        ),
    ),
}

# Fixed Maryam thresholds
BEHIND_REPS: int = 2
FINAL_FRAC: float = 0.8
WRAP_FORM_DIRTY: int = 2
TIME_MOTIVATION_BASE_S: float = 6.0
CHATTIEST_REPS_PER_MOTIVATION: int = 4


def get_persona_policy(persona: AssistantPersona) -> PersonaPolicyConfig:
    """Retrieve policy configuration for a given AssistantPersona."""
    return PERSONA_POLICIES.get(persona, PERSONA_POLICIES[AssistantPersona.GUIDE])
