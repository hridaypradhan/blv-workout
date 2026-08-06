"""Pure runtime decision model for assistant persona triggers and correction caps.

Evaluates factual exercise performance inputs (reps, pace, progress, form errors)
against persona policies and returns eligible trigger decisions.
"""

from typing import Literal, NamedTuple
from app.models.schemas import AssistantPersona
from app.services.personas.policy import (
    BEHIND_REPS,
    CHATTIEST_REPS_PER_MOTIVATION,
    FINAL_FRAC,
    TIME_MOTIVATION_BASE_S,
    WRAP_FORM_DIRTY,
    get_persona_policy,
)

TriggerType = Literal["milestone", "behind", "final", "wrap_strong", "wrap_hard", "wrap_form"]


class PersonaTriggerDecision(NamedTuple):
    trigger: TriggerType | None
    reason: str | None


class PersonaRuntimeEngine:
    """Tracks runtime exercise state and evaluates persona cue triggers and correction caps.

    Accepts explicit factual inputs only and returns eligible triggers. Does NOT mutate
    external playback state or enforce audio/haptic delivery authority.
    """

    def __init__(self, persona: AssistantPersona = AssistantPersona.GUIDE, timed: bool = False) -> None:
        self.persona = persona
        self.timed = timed
        self.policy = get_persona_policy(persona)

        # Per-exercise tracking state
        self._reps: int = 0
        self._dirty_reps: int = 0
        self._max_behind: int = 0
        self._behind_fired: bool = False
        self._final_fired: bool = False
        self._corrections_voiced: int = 0

        # Timed exercise interval
        self.seconds_per_motivation: float = (
            TIME_MOTIVATION_BASE_S * (self.policy.reps_per_motivation / float(CHATTIEST_REPS_PER_MOTIVATION))
        )
        self._next_timed_cue_s: float = self.seconds_per_motivation

    def reset_exercise(self, timed: bool = False, persona: AssistantPersona | None = None) -> None:
        """Reset state for a new exercise segment."""
        if persona is not None:
            self.persona = persona
            self.policy = get_persona_policy(persona)
        self.timed = timed

        self._reps = 0
        self._dirty_reps = 0
        self._max_behind = 0
        self._behind_fired = False
        self._final_fired = False
        self._corrections_voiced = 0

        self.seconds_per_motivation = (
            TIME_MOTIVATION_BASE_S * (self.policy.reps_per_motivation / float(CHATTIEST_REPS_PER_MOTIVATION))
        )
        self._next_timed_cue_s = self.seconds_per_motivation

    def can_voice_correction(self) -> bool:
        """Check whether a spoken correction can be voiced under the current persona cap."""
        if self._corrections_voiced < self.policy.max_corrections_per_exercise:
            self._corrections_voiced += 1
            return True
        return False

    @property
    def corrections_voiced_count(self) -> int:
        return self._corrections_voiced

    def note_form_error(self) -> None:
        """Record a form error / dirty rep for wrap calculations."""
        self._dirty_reps += 1

    def on_rep_completed(self, clean: bool, reps_behind: int | None = None, can_speak: bool = True) -> PersonaTriggerDecision:
        """Process a counted rep event and return any triggered cue decision."""
        self._reps += 1
        if not clean:
            self._dirty_reps += 1
        if reps_behind is not None:
            self._max_behind = max(self._max_behind, reps_behind)

        if not can_speak:
            return PersonaTriggerDecision(trigger=None, reason="can_speak_false")

        # Check 'behind' trigger first
        if not self.timed and not self._behind_fired and reps_behind is not None and reps_behind >= BEHIND_REPS:
            self._behind_fired = True
            return PersonaTriggerDecision(trigger="behind", reason=f"behind_{reps_behind}_reps")

        # Check milestone rep pacing
        if not self.timed and self._reps % self.policy.reps_per_motivation == 0:
            return PersonaTriggerDecision(trigger="milestone", reason=f"rep_{self._reps}_milestone")

        return PersonaTriggerDecision(trigger=None, reason=None)

    def on_progress(self, frac_done: float, elapsed_s: float | None = None, can_speak: bool = True) -> PersonaTriggerDecision:
        """Process frame/progress updates and return any triggered cue decision."""
        if not can_speak:
            return PersonaTriggerDecision(trigger=None, reason="can_speak_false")

        started = self._reps > 0 or self.timed
        if not self._final_fired and frac_done >= FINAL_FRAC and started:
            self._final_fired = True
            return PersonaTriggerDecision(trigger="final", reason=f"final_push_{int(frac_done * 100)}pct")

        if self.timed and elapsed_s is not None and elapsed_s >= self._next_timed_cue_s:
            # Advance past missed intervals without burst
            while self._next_timed_cue_s <= elapsed_s:
                self._next_timed_cue_s += self.seconds_per_motivation
            return PersonaTriggerDecision(trigger="milestone", reason=f"timed_milestone_{elapsed_s:.1f}s")

        return PersonaTriggerDecision(trigger=None, reason=None)

    def on_exercise_completed(self, completed_count: int) -> PersonaTriggerDecision:
        """Evaluate exercise wrap encouragement decision upon exercise completion."""
        if self.policy.encourage_every <= 0 or completed_count % self.policy.encourage_every != 0:
            return PersonaTriggerDecision(trigger=None, reason=f"encourage_every_{self.policy.encourage_every}_skip")

        if self._dirty_reps >= WRAP_FORM_DIRTY:
            return PersonaTriggerDecision(trigger="wrap_form", reason=f"wrap_form_{self._dirty_reps}_dirty_reps")

        if self.timed:
            return PersonaTriggerDecision(trigger="wrap_strong", reason="wrap_strong_timed_completed")

        if self._max_behind >= BEHIND_REPS or self._reps == 0:
            return PersonaTriggerDecision(trigger="wrap_hard", reason=f"wrap_hard_behind_{self._max_behind}_or_zero_reps")

        return PersonaTriggerDecision(trigger="wrap_strong", reason="wrap_strong_clean_pace")
