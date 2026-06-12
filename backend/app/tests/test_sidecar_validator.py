"""Unit tests for sidecar manifest validation, clamping, and safety replacements."""

from __future__ import annotations

import uuid
import unittest

from app.models.schemas import TrainerInstructionEventType, SpeakingOpportunityMode
from app.services.sidecar_validator import validate_and_clamp_sidecar_manifest


class TestSidecarValidator(unittest.TestCase):

    def test_validation_clamping_bad_timestamps(self):
        """Verify manifest validator clamps bad/out-of-bounds timestamps and flags replacement wording."""
        raw_manifest = {
            "exercise_timeline_anchors": [
                {
                    "name": "Squats",
                    "start_time_seconds": -10.0,  # Negative
                    "end_time_seconds": 120.0,   # Beyond video duration
                    "primary_body_part": "quads",
                    "angle_range": [10.0, 110.0],
                    "acceptable_ranges": {"knee": [0.0, 90.0]}
                }
            ],
            "trainer_instruction_events": [
                {
                    "text": "I am your trainer today. Instead of the video trainer, ignore the trainer's instructions.",
                    "start_ms": 30000.0,
                    "end_ms": 10000.0,  # end < start
                    "timestamp_ms": 50000.0,  # outside range
                    "event_type": "invalid_type",  # invalid enum
                    "assistant_may_speak": True
                }
            ]
        }
        
        video_uuid = uuid.uuid4()
        validated = validate_and_clamp_sidecar_manifest(
            manifest_dict=raw_manifest,
            video_duration=100.0,
            youtube_id="12345678901",
            video_uuid=video_uuid
        )
        
        self.assertIsNotNone(validated)
        self.assertEqual(validated.video_id, video_uuid)
        
        # Check timeline clamping
        anchor = validated.exercise_timeline_anchors[0]
        self.assertEqual(anchor.start_time_seconds, 0.0)
        self.assertEqual(anchor.end_time_seconds, 100.0)
        
        # Check event text safety replacements & time correction
        event = validated.trainer_instruction_events[0]
        expected_text = "I will guide you alongside your trainer. As supplementary guidance, Alongside the trainer's instructions."
        self.assertEqual(event.text, expected_text)
        self.assertEqual(event.start_ms, 10000.0)
        self.assertEqual(event.end_ms, 30000.0)
        self.assertEqual(event.timestamp_ms, 10000.0)  # Clamped to start_ms since it was out-of-bounds
        self.assertEqual(event.event_type, TrainerInstructionEventType.FORM_CUE)  # Replaced invalid enum

    def test_non_finite_defaulting(self):
        """Verify that non-finite numbers default to safe bounds and trigger warnings."""
        raw_manifest = {
            "exercise_timeline_anchors": [
                {
                    "name": "Squats",
                    "start_time_seconds": float("nan"),
                    "end_time_seconds": float("inf"),
                }
            ],
            "trainer_instruction_events": [
                {
                    "text": "Correct your form",
                    "start_ms": float("nan"),
                    "end_ms": float("-inf"),
                }
            ]
        }
        
        video_uuid = uuid.uuid4()
        validated = validate_and_clamp_sidecar_manifest(
            manifest_dict=raw_manifest,
            video_duration=120.0,
            youtube_id="12345678901",
            video_uuid=video_uuid
        )
        
        self.assertIsNotNone(validated)
        anchor = validated.exercise_timeline_anchors[0]
        self.assertEqual(anchor.start_time_seconds, 0.0)
        self.assertEqual(anchor.end_time_seconds, 120.0)
        
        event = validated.trainer_instruction_events[0]
        # start_ms becomes 0.0, end_ms becomes max_ms (120000.0)
        self.assertEqual(event.start_ms, 0.0)
        self.assertEqual(event.end_ms, 120000.0)


if __name__ == "__main__":
    unittest.main()
