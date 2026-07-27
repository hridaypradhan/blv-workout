import unittest
import sys
from app.services.haptics import event_contract

class TestHapticEventContract(unittest.TestCase):
    def test_canonical_mapping_resolution(self):
        # start -> assist_start
        self.assertEqual(event_contract.resolve_bhaptics_event(cue_type="start"), "assist_start")
        # finish -> assist_finish
        self.assertEqual(event_contract.resolve_bhaptics_event(cue_type="finish"), "assist_finish")
        # reps -> assist_reps
        self.assertEqual(event_contract.resolve_bhaptics_event(cue_type="reps"), "assist_reps")
        # speed_up -> assist_speed_up
        self.assertEqual(event_contract.resolve_bhaptics_event(cue_type="speed_up"), "assist_speed_up")
        # slow_down -> assist_slow_down
        self.assertEqual(event_contract.resolve_bhaptics_event(cue_type="slow_down"), "assist_slow_down")

    def test_explicit_event_name_preserved(self):
        self.assertEqual(
            event_contract.resolve_bhaptics_event(cue_type="start", explicit_bhaptics_event_name="my_explicit_event"),
            "my_explicit_event"
        )
        self.assertEqual(
            event_contract.resolve_bhaptics_event(explicit_bhaptics_event_name="my_explicit_event"),
            "my_explicit_event"
        )

    def test_unknown_cue_type_fallback(self):
        # Unknown cue type falls back to neutral assist_attention_double
        self.assertEqual(event_contract.resolve_bhaptics_event(cue_type="nonexistent_cue"), "assist_attention_double")
        self.assertEqual(event_contract.resolve_bhaptics_event(), "assist_attention_double")

    def test_deprecated_category_resolution(self):
        # per_rep_tick -> reps -> assist_reps
        self.assertEqual(event_contract.resolve_bhaptics_event(cue_type="per_rep_tick"), "assist_reps")
        # cooldown -> finish -> assist_finish
        self.assertEqual(event_contract.resolve_bhaptics_event(cue_type="cooldown"), "assist_finish")
        # countdown -> None
        self.assertIsNone(event_contract.resolve_bhaptics_event(cue_type="countdown"))
        # form_warning_above -> None
        self.assertIsNone(event_contract.resolve_bhaptics_event(cue_type="form_warning_above"))

    def test_valid_categories(self):
        valid = event_contract.get_canonical_haptic_categories()
        self.assertEqual(valid, {"start", "finish", "reps", "speed_up", "slow_down"})

    def test_vibration_id_mapping(self):
        # Should resolve candidate-specific bhaptics_event_name from manifest
        self.assertEqual(event_contract.resolve_bhaptics_event(vibration_id="start_high_01_v-09-11-4-3"), "assist_start_high_01")
        self.assertEqual(event_contract.resolve_bhaptics_event(vibration_id="finish_low_01_v-10-21-3-39"), "assist_finish_low_01")
        # Missing candidate should fallback to neutral assist_attention_double
        self.assertEqual(event_contract.resolve_bhaptics_event(vibration_id="nonexistent_999"), "assist_attention_double")

    def test_event_contract_no_prototype_imports(self):
        # Pop from sys.modules if present to verify it is not loaded on resolution
        sys.modules.pop("app.prototype.haptic_provider", None)
        event_contract.resolve_bhaptics_event(vibration_id="start_001")
        self.assertNotIn("app.prototype.haptic_provider", sys.modules)
