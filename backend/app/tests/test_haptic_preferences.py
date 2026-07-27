import unittest
from typing import get_args
from app.models import schemas, haptic_schemas

class TestHapticPreferencesSchema(unittest.TestCase):
    def test_schema_class_identity(self):
        """Assert that schemas.HapticPreferences IS haptic_schemas.HapticPreferences."""
        self.assertIs(schemas.HapticPreferences, haptic_schemas.HapticPreferences)

    def test_user_model_field_annotation_identity(self):
        """Assert User and UserSettingsUpdate use the canonical class."""
        self.assertIs(
            schemas.User.model_fields["haptic_preferences"].annotation,
            haptic_schemas.HapticPreferences
        )
        
        # UserSettingsUpdate annotation is HapticPreferences | None
        annotation = schemas.UserSettingsUpdate.model_fields["haptic_preferences"].annotation
        args = get_args(annotation)
        self.assertTrue(haptic_schemas.HapticPreferences in args)

    def test_direct_and_nested_validation_identity(self):
        """Assert direct validation and nested User validation produce identical normalized preferences."""
        raw_legacy = {
            "per_rep_tick": "reps_high_01_v-09-16-1-43",
            "cooldown": "finish_high_01_v-09-10-12-2",
            "countdown": "invalid_id",
            "form_warning_above": "invalid_id",
            "speed_up": "speed_up_high_01_v-09-10-3-52",
        }
        
        direct_prefs = haptic_schemas.HapticPreferences.model_validate(raw_legacy)
        user = schemas.User(
            email="test@example.com",
            name="Test User",
            haptic_preferences=raw_legacy,
        )

        self.assertIsInstance(user.haptic_preferences, haptic_schemas.HapticPreferences)
        self.assertEqual(direct_prefs.model_dump(), user.haptic_preferences.model_dump())

    def test_legacy_migration_paths(self):
        """Verify per_rep_tick/per_rep -> reps, cooldown -> finish, countdown/form_warning_above removed."""
        raw_legacy = {
            "per_rep": "reps_high_01_v-09-16-1-43",
            "cooldown": "finish_high_01_v-09-10-12-2",
            "countdown": "countdown_001",
            "form_warning_above": "form_warning_above_001",
        }
        prefs = haptic_schemas.HapticPreferences.model_validate(raw_legacy)
        dumped = prefs.model_dump()

        self.assertEqual(set(dumped.keys()), {"start", "finish", "reps", "speed_up", "slow_down"})
        self.assertEqual(dumped["reps"], "reps_high_01_v-09-16-1-43")
        self.assertEqual(dumped["finish"], "finish_high_01_v-09-10-12-2")
        self.assertNotIn("per_rep", dumped)
        self.assertNotIn("cooldown", dumped)
        self.assertNotIn("countdown", dumped)
        self.assertNotIn("form_warning_above", dumped)

    def test_invalid_candidate_reset_to_defaults(self):
        """Invalid candidate ID is reset to default."""
        raw_invalid = {"start": "invalid_start_id", "reps": "finish_high_01_v-09-10-12-2"}
        prefs = haptic_schemas.HapticPreferences.model_validate(raw_invalid)
        
        self.assertEqual(prefs.start, haptic_schemas.DEFAULT_HAPTIC_CATEGORY_IDS["start"])
        # Cross-category ID (finish candidate assigned to reps) must fall back to default
        self.assertEqual(prefs.reps, haptic_schemas.DEFAULT_HAPTIC_CATEGORY_IDS["reps"])
