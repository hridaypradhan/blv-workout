"""Tests for Maryam canonical persona policies and runtime decision engine."""

import unittest
from uuid import uuid4

from app.models.schemas import AssistantPersona
from app.prototype.assistant_provider import generate_correction
from app.services.personas.policy import (
    BEHIND_REPS,
    FINAL_FRAC,
    PERSONA_POLICIES,
    TIME_MOTIVATION_BASE_S,
    WRAP_FORM_DIRTY,
    get_persona_policy,
)
from app.services.personas.runtime import PersonaRuntimeEngine


class TestPersonaPolicy(unittest.TestCase):
    """Unit tests for persona policy constants, runtime triggers, and provider tone integration."""

    def test_persona_policy_constants(self) -> None:
        """Verify exact persona policy parameters for Maryam's canonical personas."""
        c_policy = get_persona_policy(AssistantPersona.CHEERLEADER)
        g_policy = get_persona_policy(AssistantPersona.GUIDE)
        s_policy = get_persona_policy(AssistantPersona.SERGEANT)

        # Cheerleader
        self.assertEqual(c_policy.reps_per_motivation, 4)
        self.assertEqual(c_policy.max_corrections_per_exercise, 1)
        self.assertEqual(c_policy.encourage_every, 1)

        # Guide
        self.assertEqual(g_policy.reps_per_motivation, 7)
        self.assertEqual(g_policy.max_corrections_per_exercise, 2)
        self.assertEqual(g_policy.encourage_every, 2)

        # Sergeant
        self.assertEqual(s_policy.reps_per_motivation, 10)
        self.assertEqual(s_policy.max_corrections_per_exercise, 3)
        self.assertEqual(s_policy.encourage_every, 3)

        # Fixed thresholds
        self.assertEqual(BEHIND_REPS, 2)
        self.assertEqual(FINAL_FRAC, 0.8)
        self.assertEqual(WRAP_FORM_DIRTY, 2)
        self.assertEqual(TIME_MOTIVATION_BASE_S, 6.0)

    def test_runtime_engine_rep_milestones(self) -> None:
        """Verify rep-based milestone triggers for each persona."""
        engine_cheer = PersonaRuntimeEngine(persona=AssistantPersona.CHEERLEADER)
        for i in range(1, 4):
            d = engine_cheer.on_rep_completed(clean=True, reps_behind=0)
            self.assertIsNone(d.trigger)
        d4 = engine_cheer.on_rep_completed(clean=True, reps_behind=0)
        self.assertEqual(d4.trigger, "milestone")

        engine_guide = PersonaRuntimeEngine(persona=AssistantPersona.GUIDE)
        for i in range(1, 7):
            d = engine_guide.on_rep_completed(clean=True, reps_behind=0)
            self.assertIsNone(d.trigger)
        d7 = engine_guide.on_rep_completed(clean=True, reps_behind=0)
        self.assertEqual(d7.trigger, "milestone")

        engine_sergeant = PersonaRuntimeEngine(persona=AssistantPersona.SERGEANT)
        for i in range(1, 10):
            d = engine_sergeant.on_rep_completed(clean=True, reps_behind=0)
            self.assertIsNone(d.trigger)
        d10 = engine_sergeant.on_rep_completed(clean=True, reps_behind=0)
        self.assertEqual(d10.trigger, "milestone")

    def test_runtime_engine_behind_trigger(self) -> None:
        """Verify 'behind' trigger fires when user is >= 2 reps behind instructor."""
        engine = PersonaRuntimeEngine(persona=AssistantPersona.GUIDE)

        # Rep 1: 1 rep behind -> no behind trigger
        d1 = engine.on_rep_completed(clean=True, reps_behind=1)
        self.assertIsNone(d1.trigger)

        # Rep 2: 2 reps behind -> 'behind' trigger fires
        d2 = engine.on_rep_completed(clean=True, reps_behind=2)
        self.assertEqual(d2.trigger, "behind")
        self.assertIn("behind_2_reps", d2.reason or "")

        # Rep 3: still behind -> should NOT re-fire behind trigger (fires once per exercise)
        d3 = engine.on_rep_completed(clean=True, reps_behind=3)
        self.assertIsNone(d3.trigger)

    def test_runtime_engine_final_trigger(self) -> None:
        """Verify 'final' trigger fires once at >= 80% progress if exercise started."""
        engine = PersonaRuntimeEngine(persona=AssistantPersona.GUIDE)

        # Not started -> no final trigger
        d_early = engine.on_progress(frac_done=0.85)
        self.assertIsNone(d_early.trigger)

        # Start exercise with 1 rep
        engine.on_rep_completed(clean=True)

        # >= 80% -> final trigger fires
        d_final = engine.on_progress(frac_done=0.82)
        self.assertEqual(d_final.trigger, "final")

        # Subsequent progress check -> does not re-fire
        d_later = engine.on_progress(frac_done=0.90)
        self.assertIsNone(d_later.trigger)

    def test_runtime_engine_wrap_outcomes_and_evidence(self) -> None:
        """Verify wrap outcome selection logic based on dirty reps and pace."""
        # Case 1: wrap_form (dirty_reps >= 2)
        engine_form = PersonaRuntimeEngine(persona=AssistantPersona.CHEERLEADER)
        engine_form.on_rep_completed(clean=False)
        engine_form.on_rep_completed(clean=False)
        d_form = engine_form.on_exercise_completed(completed_count=1)
        self.assertEqual(d_form.trigger, "wrap_form")

        # Case 2: wrap_hard (max_behind >= 2)
        engine_hard = PersonaRuntimeEngine(persona=AssistantPersona.CHEERLEADER)
        engine_hard.on_rep_completed(clean=True, reps_behind=3)
        d_hard = engine_hard.on_exercise_completed(completed_count=1)
        self.assertEqual(d_hard.trigger, "wrap_hard")

        # Case 3: wrap_strong (clean pace)
        engine_strong = PersonaRuntimeEngine(persona=AssistantPersona.CHEERLEADER)
        engine_strong.on_rep_completed(clean=True, reps_behind=0)
        d_strong = engine_strong.on_exercise_completed(completed_count=1)
        self.assertEqual(d_strong.trigger, "wrap_strong")

    def test_runtime_engine_encourage_every_pacing(self) -> None:
        """Verify encourage_every pacing for exercise wraps across personas."""
        # Guide: encourage_every = 2
        engine_guide = PersonaRuntimeEngine(persona=AssistantPersona.GUIDE)
        engine_guide.on_rep_completed(clean=True)
        d_ex1 = engine_guide.on_exercise_completed(completed_count=1)
        self.assertIsNone(d_ex1.trigger)

        d_ex2 = engine_guide.on_exercise_completed(completed_count=2)
        self.assertEqual(d_ex2.trigger, "wrap_strong")

        # Sergeant: encourage_every = 3
        engine_sergeant = PersonaRuntimeEngine(persona=AssistantPersona.SERGEANT)
        engine_sergeant.on_rep_completed(clean=True)
        self.assertIsNone(engine_sergeant.on_exercise_completed(completed_count=1).trigger)
        self.assertIsNone(engine_sergeant.on_exercise_completed(completed_count=2).trigger)
        self.assertEqual(engine_sergeant.on_exercise_completed(completed_count=3).trigger, "wrap_strong")

    def test_correction_caps_and_reset(self) -> None:
        """Verify spoken correction caps per exercise and reset behavior."""
        # Cheerleader max corrections = 1
        engine_c = PersonaRuntimeEngine(persona=AssistantPersona.CHEERLEADER)
        self.assertTrue(engine_c.can_voice_correction())
        self.assertFalse(engine_c.can_voice_correction())

        # Reset exercise restores cap
        engine_c.reset_exercise()
        self.assertTrue(engine_c.can_voice_correction())

        # Sergeant max corrections = 3
        engine_s = PersonaRuntimeEngine(persona=AssistantPersona.SERGEANT)
        self.assertTrue(engine_s.can_voice_correction())
        self.assertTrue(engine_s.can_voice_correction())
        self.assertTrue(engine_s.can_voice_correction())
        self.assertFalse(engine_s.can_voice_correction())

    def test_timed_exercise_milestones_and_no_burst(self) -> None:
        """Verify timed exercise milestone intervals and burst prevention after missed time."""
        # Cheerleader: reps_per_motivation = 4 -> seconds_per_motivation = 6.0 * (4/4) = 6.0s
        engine = PersonaRuntimeEngine(persona=AssistantPersona.CHEERLEADER, timed=True)

        d_early = engine.on_progress(frac_done=0.1, elapsed_s=3.0)
        self.assertIsNone(d_early.trigger)

        d_tick1 = engine.on_progress(frac_done=0.2, elapsed_s=6.0)
        self.assertEqual(d_tick1.trigger, "milestone")

        # Simulate large elapsed time jump (missed opportunities)
        d_jump = engine.on_progress(frac_done=0.5, elapsed_s=20.0)
        self.assertEqual(d_jump.trigger, "milestone")

        # Immediately check next second: should return None (no burst of 20s backed-up cues)
        d_next = engine.on_progress(frac_done=0.55, elapsed_s=21.0)
        self.assertIsNone(d_next.trigger)

    def test_provider_metadata_persona_policy_integration(self) -> None:
        """Verify generate_correction includes persona policy metadata."""
        cue = generate_correction(
            exercise_id=uuid4(),
            exercise_name="squat",
            joint="knee_left",
            angle=110.0,
            current_timestamp_ms=1000.0,
            persona=AssistantPersona.CHEERLEADER,
        )
        self.assertEqual(cue.metadata.get("persona_policy"), "cheerleader")
        self.assertEqual(cue.metadata.get("max_corrections_cap"), 1)


if __name__ == "__main__":
    unittest.main()
