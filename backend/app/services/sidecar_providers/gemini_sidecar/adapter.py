"""Adapter layer to convert Gemini response schema DTO/dict into canonical manifest formats."""

from __future__ import annotations

import copy
from typing import Any
from app.services.ai.errors import AIProviderSchemaConversionError


def convert_gemini_to_canonical(response_dict: dict[str, Any]) -> dict[str, Any]:
    """Converts the developer API-safe Gemini structures back into standard Python structures.
    
    Creates a deep copy of the input to avoid in-place mutations. Returns lists instead of tuples
    for float ranges to maintain JSON array serialization safety.
    """
    try:
        result = copy.deepcopy(response_dict)
    except Exception as exc:
        raise AIProviderSchemaConversionError(f"Failed to copy Gemini response: {exc}")
        
    try:
        # 1. exercise_timeline_anchors: angle_range & acceptable_ranges
        raw_anchors = result.get("exercise_timeline_anchors", [])
        for anchor in raw_anchors:
            # angle_range
            ar = anchor.get("angle_range")
            if isinstance(ar, dict):
                min_deg = ar.get("min_degrees")
                max_deg = ar.get("max_degrees")
                if min_deg is not None and max_deg is not None:
                    anchor["angle_range"] = [float(min_deg), float(max_deg)]
            elif ar is not None:
                anchor["angle_range"] = None

            # acceptable_ranges
            ranges_list = anchor.get("acceptable_ranges", [])
            ranges_dict = {}
            if isinstance(ranges_list, list):
                for entry in ranges_list:
                    if isinstance(entry, dict):
                        joint = entry.get("joint")
                        min_deg = entry.get("min_degrees")
                        max_deg = entry.get("max_degrees")
                        if joint is not None and min_deg is not None and max_deg is not None:
                            ranges_dict[str(joint)] = [float(min_deg), float(max_deg)]
            anchor["acceptable_ranges"] = ranges_dict
            
        # 2. haptic_spatial_cue_profiles: patterns
        raw_profiles = result.get("haptic_spatial_cue_profiles", [])
        for profile in raw_profiles:
            patterns_list = profile.get("patterns", [])
            patterns_dict = {}
            if isinstance(patterns_list, list):
                for entry in patterns_list:
                    if isinstance(entry, dict):
                        cue = entry.get("cue_name")
                        pattern = entry.get("pattern_name")
                        if cue is not None and pattern is not None:
                            patterns_dict[str(cue)] = str(pattern)
            profile["patterns"] = patterns_dict
            
        # 3. expected_movement_windows
        windows_list = result.get("expected_movement_windows", [])
        windows_dict = {}
        if isinstance(windows_list, list):
            for entry in windows_list:
                if isinstance(entry, dict):
                    ex_name = entry.get("exercise_name")
                    start_sec = entry.get("start_seconds")
                    end_sec = entry.get("end_seconds")
                    if ex_name is not None and start_sec is not None and end_sec is not None:
                        windows_dict[str(ex_name)] = [float(start_sec), float(end_sec)]
        result["expected_movement_windows"] = windows_dict
        
        return result
    except Exception as exc:
        raise AIProviderSchemaConversionError(f"Error during adaptation of Gemini schema: {exc}")
