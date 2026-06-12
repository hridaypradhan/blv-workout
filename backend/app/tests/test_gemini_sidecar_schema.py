"""Unit tests verifying Gemini developer-mode response schemas."""

from __future__ import annotations

import unittest

from typing import Any
from app.services.sidecar_providers.gemini_sidecar.schema import (
    AssistanceSidecarManifestGemini,
    ExerciseTimelineAnchorGemini,
    HapticSpatialCueProfileGemini,
)


class TestGeminiSidecarSchema(unittest.TestCase):

    def test_gemini_schema_no_dict_or_tuple_fields(self):
        """Verify that Gemini-specific response schema models do not use dict or tuple type annotations."""
        for model in (AssistanceSidecarManifestGemini, ExerciseTimelineAnchorGemini, HapticSpatialCueProfileGemini):
            for field_name, field_info in model.model_fields.items():
                annotation_str = str(field_info.annotation)
                self.assertNotIn("dict", annotation_str.lower(), f"Field {field_name} in {model.__name__} must not use dict type.")
                self.assertNotIn("tuple", annotation_str.lower(), f"Field {field_name} in {model.__name__} must not use tuple type.")

    def test_gemini_schema_no_additional_properties_or_prefix_items_recursively(self):
        """Verify that generated JSON schema for AssistanceSidecarManifestGemini contains no additionalProperties or prefixItems."""
        schema = AssistanceSidecarManifestGemini.model_json_schema()
        self.assert_no_key_recursively(schema, ["additionalProperties", "prefixItems"])

    def assert_no_key_recursively(self, schema_element: Any, forbidden_keys: list[str]):
        if isinstance(schema_element, dict):
            for key, val in schema_element.items():
                self.assertNotIn(
                    key, 
                    forbidden_keys, 
                    f"Forbidden key '{key}' found in JSON schema: {schema_element}"
                )
                self.assert_no_key_recursively(val, forbidden_keys)
        elif isinstance(schema_element, list):
            for item in schema_element:
                self.assert_no_key_recursively(item, forbidden_keys)


if __name__ == "__main__":
    unittest.main()
