"""Unit tests for cue plan validator and sanitization logic."""

import unittest
import uuid
from app.services.cue_plan_validator import validate_and_clamp_cue_plan


class TestCuePlanValidation(unittest.TestCase):

    def test_cue_plan_validator_invalid_enums_and_modalities(self):
        """Verify validator drops or sanitizes candidates with invalid enums or modalities without crashing."""
        raw_bad_enums = {
            "pre_session_overview": "Pre session overview text" * 40,  # > 800 chars -> should truncate
            "exercise_descriptions": [
                {
                    "exercise_anchor_id": "valid-id",
                    "name": "Bicep Curls",
                    "accessible_description": "accessible descriptive text" * 30  # > 500 chars -> should truncate
                }
            ],
            "cue_candidates": [
                {
                    "id": "cue-modality-bad",
                    "source_type": "exercise_anchor",
                    "start_ms": 1000.0,
                    "end_ms": 5000.0,
                    "priority": "medium",
                    "intent": "setup_orientation",
                    "allowed_modalities": ["invalid_modality", "audio"],  # "invalid_modality" should trigger warning, "audio" kept
                    "text_variants": {"moderate": "Valid moderate text"},
                    "interruption_policy_hint": "safe_gap_only"
                },
                {
                    "id": "cue-modality-all-bad",
                    "source_type": "exercise_anchor",
                    "start_ms": 1000.0,
                    "end_ms": 5000.0,
                    "priority": "medium",
                    "intent": "setup_orientation",
                    "allowed_modalities": ["totally_invalid"],  # should drop entire candidate
                    "text_variants": {"moderate": "Valid moderate text"},
                    "interruption_policy_hint": "safe_gap_only"
                },
                {
                    "id": "cue-priority-bad",
                    "source_type": "exercise_anchor",
                    "start_ms": 1000.0,
                    "end_ms": 5000.0,
                    "priority": "super-high-invalid",  # should default to medium
                    "intent": "setup_orientation",
                    "allowed_modalities": ["audio"],
                    "text_variants": {"moderate": "Valid moderate text"},
                    "interruption_policy_hint": "safe_gap_only"
                },
                {
                    "id": "cue-intent-bad",
                    "source_type": "exercise_anchor",
                    "start_ms": 1000.0,
                    "end_ms": 5000.0,
                    "priority": "medium",
                    "intent": "non-existent-intent",  # should default to movement_description
                    "allowed_modalities": ["audio"],
                    "text_variants": {"moderate": "Valid moderate text"},
                    "interruption_policy_hint": "safe_gap_only"
                },
                {
                    "id": "cue-source-bad",
                    "source_type": "invalid-source-type-nonexistent",  # should drop candidate
                    "start_ms": 1000.0,
                    "end_ms": 5000.0,
                    "priority": "medium",
                    "intent": "setup_orientation",
                    "allowed_modalities": ["audio"],
                    "text_variants": {"moderate": "Valid moderate text"},
                    "interruption_policy_hint": "safe_gap_only"
                },
                {
                    "id": "cue-hint-bad",
                    "source_type": "exercise_anchor",
                    "start_ms": 1000.0,
                    "end_ms": 5000.0,
                    "priority": "medium",
                    "intent": "setup_orientation",
                    "allowed_modalities": ["audio"],
                    "text_variants": {"moderate": "Valid moderate text"},
                    "interruption_policy_hint": "unsupported-hint-value"  # should default to safe_gap_only
                },
                {
                    "id": "cue-haptic-no-ref",
                    "source_type": "exercise_anchor",
                    "start_ms": 1000.0,
                    "end_ms": 5000.0,
                    "priority": "medium",
                    "intent": "setup_orientation",
                    "allowed_modalities": ["haptic"],  # haptic only but no haptic_cue_ref -> should drop
                    "text_variants": {"moderate": "Valid moderate text"},
                    "haptic_cue_ref": None,
                    "interruption_policy_hint": "haptic_only"
                }
            ],
            "trainer_instruction_summaries": []
        }
        
        res = validate_and_clamp_cue_plan(raw_bad_enums, 120.0, uuid.uuid4())
        clamped_plan = res.cue_plan
        warnings = res.warnings
        
        self.assertIsNotNone(clamped_plan)
        self.assertTrue(len(warnings) > 0)
        self.assertTrue(len(clamped_plan.pre_session_overview) <= 800)
        self.assertTrue(len(clamped_plan.exercise_descriptions[0].accessible_description) <= 500)
        
        candidate_ids = [c.id for c in clamped_plan.cue_candidates]
        self.assertIn("cue-modality-bad", candidate_ids)
        self.assertNotIn("cue-modality-all-bad", candidate_ids)
        self.assertIn("cue-priority-bad", candidate_ids)
        self.assertIn("cue-intent-bad", candidate_ids)
        self.assertNotIn("cue-source-bad", candidate_ids)
        self.assertIn("cue-hint-bad", candidate_ids)
        self.assertNotIn("cue-haptic-no-ref", candidate_ids)
        
        # Check specific clamped properties
        for c in clamped_plan.cue_candidates:
            if c.id == "cue-modality-bad":
                self.assertEqual(c.allowed_modalities, ["audio"])
            elif c.id == "cue-priority-bad":
                self.assertEqual(c.priority, "medium")
            elif c.id == "cue-intent-bad":
                self.assertEqual(c.intent, "movement_description")
            elif c.id == "cue-hint-bad":
                self.assertEqual(c.interruption_policy_hint, "safe_gap_only")

    def test_cue_plan_validator_sanitizes_deprecated_and_invalid_haptic_refs(self):
        """Verify validator sanitizes legacy and invalid haptic refs against canonical categories."""
        raw = {
            "pre_session_overview": "Overview text.",
            "exercise_descriptions": [],
            "cue_candidates": [
                {
                    "id": "cand-start-ok",
                    "source_type": "exercise_anchor",
                    "start_ms": 1000.0,
                    "end_ms": 5000.0,
                    "priority": "medium",
                    "intent": "setup_orientation",
                    "allowed_modalities": ["audio", "haptic"],
                    "text_variants": {"moderate": "Start exercise"},
                    "haptic_cue_ref": "start",
                    "interruption_policy_hint": "safe_gap_only"
                },
                {
                    "id": "cand-per-rep-migrated",
                    "source_type": "exercise_anchor",
                    "start_ms": 6000.0,
                    "end_ms": 8000.0,
                    "priority": "medium",
                    "intent": "pacing_reminder",
                    "allowed_modalities": ["haptic"],
                    "text_variants": {"moderate": "Tick"},
                    "haptic_cue_ref": "per_rep_tick",
                    "interruption_policy_hint": "haptic_only"
                },
                {
                    "id": "cand-cooldown-migrated",
                    "source_type": "exercise_anchor",
                    "start_ms": 9000.0,
                    "end_ms": 10000.0,
                    "priority": "medium",
                    "intent": "transition_notice",
                    "allowed_modalities": ["audio", "haptic"],
                    "text_variants": {"moderate": "Finish exercise"},
                    "haptic_cue_ref": "cooldown",
                    "interruption_policy_hint": "safe_gap_only"
                },
                {
                    "id": "cand-countdown-audio",
                    "source_type": "exercise_anchor",
                    "start_ms": 11000.0,
                    "end_ms": 12000.0,
                    "priority": "medium",
                    "intent": "transition_notice",
                    "allowed_modalities": ["audio"],
                    "text_variants": {"moderate": "3 2 1"},
                    "haptic_cue_ref": "countdown",
                    "interruption_policy_hint": "safe_gap_only"
                },
                {
                    "id": "cand-haptic-only-bad",
                    "source_type": "exercise_anchor",
                    "start_ms": 13000.0,
                    "end_ms": 14000.0,
                    "priority": "medium",
                    "intent": "haptic_prompt",
                    "allowed_modalities": ["haptic"],
                    "text_variants": {"moderate": "Form alert"},
                    "haptic_cue_ref": "form_warning_above",
                    "interruption_policy_hint": "haptic_only"
                }
            ],
            "trainer_instruction_summaries": []
        }

        res = validate_and_clamp_cue_plan(raw, 120.0, uuid.uuid4())
        plan = res.cue_plan
        candidates_by_id = {c.id: c for c in plan.cue_candidates}

        self.assertIn("cand-start-ok", candidates_by_id)
        self.assertEqual(candidates_by_id["cand-start-ok"].haptic_cue_ref, "start")

        self.assertIn("cand-per-rep-migrated", candidates_by_id)
        self.assertEqual(candidates_by_id["cand-per-rep-migrated"].haptic_cue_ref, "reps")

        self.assertIn("cand-cooldown-migrated", candidates_by_id)
        self.assertEqual(candidates_by_id["cand-cooldown-migrated"].haptic_cue_ref, "finish")

        self.assertIn("cand-countdown-audio", candidates_by_id)
        self.assertIsNone(candidates_by_id["cand-countdown-audio"].haptic_cue_ref)

        self.assertNotIn("cand-haptic-only-bad", candidates_by_id)

    def test_cue_plan_validator_sanitizes_forbidden_observation_phrases(self):
        """Verify validator flags or sanitizes forbidden self-observation and medical phrases."""
        raw = {
            "pre_session_overview": "You are diagnosed with severe asthma.",
            "exercise_descriptions": [
                {
                    "exercise_anchor_id": "anchor-1",
                    "name": "Bicep Curls",
                    "accessible_description": "I can see you doing curls well."
                }
            ],
            "cue_candidates": [
                {
                    "id": "cue-001",
                    "source_type": "exercise_anchor",
                    "start_ms": 1000.0,
                    "end_ms": 5000.0,
                    "priority": "medium",
                    "intent": "setup_orientation",
                    "allowed_modalities": ["audio"],
                    "text_variants": {
                        "brief": "I notice that your arm is bent.",
                        "moderate": "I am observing your posture.",
                        "detailed": "My camera sees your hips."
                    },
                    "interruption_policy_hint": "safe_gap_only"
                },
                {
                    "id": "cue-004",
                    "source_type": "exercise_anchor",
                    "start_ms": 6000.0,
                    "end_ms": 10000.0,
                    "priority": "medium",
                    "intent": "form_reminder",
                    "allowed_modalities": ["audio"],
                    "text_variants": {
                        "moderate": "We can diagnose your knee pain."
                    },
                    "interruption_policy_hint": "safe_gap_only"
                }
            ],
            "trainer_instruction_summaries": []
        }

        res = validate_and_clamp_cue_plan(raw, 120.0, uuid.uuid4())
        plan = res.cue_plan
        warnings = res.warnings
        
        self.assertTrue(len(warnings) > 0)
        self.assertTrue(any("diagnos" in w.message.lower() for w in warnings))
        self.assertNotIn("I can see you", plan.exercise_descriptions[0].accessible_description)

        cand1 = next((c for c in plan.cue_candidates if c.id == "cue-001"), None)
        self.assertIsNotNone(cand1)

        cand4 = next((c for c in plan.cue_candidates if c.id == "cue-004"), None)
        self.assertIsNone(cand4)
