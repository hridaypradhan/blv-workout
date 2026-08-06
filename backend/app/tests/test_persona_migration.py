"""Tests for Maryam canonical assistant persona contract and persistence migrations."""

import unittest
from unittest.mock import MagicMock, patch
from uuid import UUID, uuid4

from pydantic import ValidationError

from app.models.schemas import AssistantPersona, CorrectionRequest, QARequest, User
from app.services.personas.normalization import normalize_persona
from app.core.user_store import UserStore
from app.core.storage.dynamodb.users import DynamoDBUserStorage


class TestPersonaMigration(unittest.TestCase):
    """Test suite verifying canonical persona contract enforcement and data migration."""

    def test_canonical_enum_acceptance(self) -> None:
        """Verify CHEERLEADER, GUIDE, and SERGEANT are accepted across schemas."""
        u1 = User(email="test1@fita11y.local", name="U1", assistant_persona=AssistantPersona.CHEERLEADER)
        u2 = User(email="test2@fita11y.local", name="U2", assistant_persona=AssistantPersona.GUIDE)
        u3 = User(email="test3@fita11y.local", name="U3", assistant_persona=AssistantPersona.SERGEANT)

        self.assertEqual(u1.assistant_persona, AssistantPersona.CHEERLEADER)
        self.assertEqual(u2.assistant_persona, AssistantPersona.GUIDE)
        self.assertEqual(u3.assistant_persona, AssistantPersona.SERGEANT)

        req1 = CorrectionRequest(
            exercise_id=uuid4(),
            exercise_name="squat",
            joint="knee_left",
            angle=90.0,
            persona=AssistantPersona.CHEERLEADER,
        )
        self.assertEqual(req1.persona, AssistantPersona.CHEERLEADER)

        qa1 = QARequest(question="How is my form?", persona=AssistantPersona.SERGEANT)
        self.assertEqual(qa1.persona, AssistantPersona.SERGEANT)

    def test_rejection_of_legacy_api_enum_values(self) -> None:
        """Verify legacy persona strings (supportive, energetic, calm, direct) are rejected by API validation."""
        legacy_values = ["supportive", "energetic", "calm", "direct", "invalid_persona"]
        for legacy in legacy_values:
            with self.subTest(legacy=legacy):
                with self.assertRaises(ValidationError):
                    User(email="test@fita11y.local", name="Test", assistant_persona=legacy)  # type: ignore

                with self.assertRaises(ValidationError):
                    CorrectionRequest(
                        exercise_id=uuid4(),
                        exercise_name="squat",
                        joint="knee_left",
                        angle=90.0,
                        persona=legacy,  # type: ignore
                    )

                with self.assertRaises(ValidationError):
                    QARequest(question="How is my form?", persona=legacy)  # type: ignore

    def test_normalization_helper_mapping(self) -> None:
        """Verify normalize_persona mapping logic."""
        self.assertEqual(normalize_persona("energetic"), AssistantPersona.CHEERLEADER)
        self.assertEqual(normalize_persona("supportive"), AssistantPersona.GUIDE)
        self.assertEqual(normalize_persona("calm"), AssistantPersona.GUIDE)
        self.assertEqual(normalize_persona("direct"), AssistantPersona.SERGEANT)
        self.assertEqual(normalize_persona("cheerleader"), AssistantPersona.CHEERLEADER)
        self.assertEqual(normalize_persona("guide"), AssistantPersona.GUIDE)
        self.assertEqual(normalize_persona("sergeant"), AssistantPersona.SERGEANT)

        # Fallbacks for unknown or empty input
        self.assertEqual(normalize_persona(None), AssistantPersona.GUIDE)
        self.assertEqual(normalize_persona("unknown_val"), AssistantPersona.GUIDE)
        self.assertEqual(normalize_persona(""), AssistantPersona.GUIDE)

    @patch("app.core.user_store.load_json_store")
    def test_json_store_legacy_migration(self, mock_load_json_store: MagicMock) -> None:
        """Verify user_store converts legacy persisted JSON values to canonical personas before validation."""
        uid1 = str(uuid4())
        uid2 = str(uuid4())
        uid3 = str(uuid4())

        mock_load_json_store.return_value = {
            uid1: {
                "id": uid1,
                "email": "energetic@fita11y.local",
                "name": "Energetic User",
                "assistant_persona": "energetic",
            },
            uid2: {
                "id": uid2,
                "email": "supportive@fita11y.local",
                "name": "Supportive User",
                "assistant_persona": "supportive",
            },
            uid3: {
                "id": uid3,
                "email": "direct@fita11y.local",
                "name": "Direct User",
                "assistant_persona": "direct",
            },
        }

        store = UserStore()
        u1_obj = store.get_user(UUID(uid1))
        self.assertIsNotNone(u1_obj)
        self.assertEqual(u1_obj.assistant_persona, AssistantPersona.CHEERLEADER)

        u2_obj = store.get_user(UUID(uid2))
        self.assertIsNotNone(u2_obj)
        self.assertEqual(u2_obj.assistant_persona, AssistantPersona.GUIDE)

        u3_obj = store.get_user(UUID(uid3))
        self.assertIsNotNone(u3_obj)
        self.assertEqual(u3_obj.assistant_persona, AssistantPersona.SERGEANT)

    @patch("app.core.storage.aws_client.get_dynamodb_resource")
    def test_dynamodb_read_migration(self, mock_get_dynamodb: MagicMock) -> None:
        """Verify DynamoDB storage normalizes legacy assistant_persona strings upon read."""
        mock_table = MagicMock()
        mock_get_dynamodb.return_value.Table.return_value = mock_table

        storage = DynamoDBUserStorage()
        user_id = uuid4()
        legacy_item = {
            "user_id": str(user_id),
            "email": "legacy@fita11y.local",
            "name": "Legacy User",
            "assistant_persona": "calm",
        }
        mock_table.get_item.return_value = {"Item": legacy_item}

        user = storage.get_user(user_id)
        self.assertIsNotNone(user)
        self.assertEqual(user.assistant_persona, AssistantPersona.GUIDE)

    def test_guide_defaults(self) -> None:
        """Verify GUIDE is the default persona across all schema models."""
        user = User(email="default@fita11y.local", name="Default")
        self.assertEqual(user.assistant_persona, AssistantPersona.GUIDE)

        corr = CorrectionRequest(exercise_id=uuid4(), exercise_name="squat", joint="knee_left", angle=90.0)
        self.assertEqual(corr.persona, AssistantPersona.GUIDE)

        qa = QARequest(question="How do I do this?")
        self.assertEqual(qa.persona, AssistantPersona.GUIDE)


if __name__ == "__main__":
    unittest.main()
