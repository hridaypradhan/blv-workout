"""Unit tests for the Gemini response-to-canonical adapter."""

from __future__ import annotations

import unittest

from app.services.sidecar_providers.gemini_sidecar.adapter import convert_gemini_to_canonical


class TestGeminiSidecarAdapter(unittest.TestCase):

    def test_gemini_schema_conversion_to_canonical(self):
        """Verify that the Gemini-safe list-of-objects structures convert back to canonical dict/list formats."""
        gemini_response_dict = {
            "exercise_timeline_anchors": [
                {
                    "name": "Squats",
                    "start_time_seconds": 0.0,
                    "end_time_seconds": 60.0,
                    "angle_range": {"min_degrees": 10.0, "max_degrees": 110.0},
                    "acceptable_ranges": [
                        {"joint": "knee", "min_degrees": 0.0, "max_degrees": 90.0}
                    ]
                }
            ],
            "expected_movement_windows": [
                {"exercise_name": "Squats", "start_seconds": 10.0, "end_seconds": 50.0}
            ],
            "haptic_spatial_cue_profiles": [
                {
                    "exercise_name": "Squats",
                    "patterns": [
                        {"cue_name": "start_rep", "pattern_name": "double_pulse"}
                    ]
                }
            ]
        }
        
        manifest_dict = convert_gemini_to_canonical(gemini_response_dict)
        
        self.assertIsNotNone(manifest_dict)
        
        anchor = manifest_dict["exercise_timeline_anchors"][0]
        self.assertEqual(anchor["angle_range"], [10.0, 110.0])
        self.assertEqual(anchor["acceptable_ranges"], {"knee": [0.0, 90.0]})
        
        self.assertEqual(manifest_dict["expected_movement_windows"], {"Squats": [10.0, 50.0]})
        
        profile = manifest_dict["haptic_spatial_cue_profiles"][0]
        self.assertEqual(profile["patterns"], {"start_rep": "double_pulse"})


if __name__ == "__main__":
    unittest.main()
