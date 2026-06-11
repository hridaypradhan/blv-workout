"""Prototype haptic provider for FitA11y.

This module stores the available haptic patterns library and handles test
and trigger logic deterministically, validating parameters without communicating
with actual sleeve hardware.
"""

import os
import json
from typing import Any
from app.models.schemas import (
    HapticPattern,
    HapticTestResponse,
    HapticTriggerResponse,
    SleeveSide,
    HapticLimb,
    HapticVibrationCandidate,
)

HAPTIC_PATTERNS = {
    "double_pulse": HapticPattern(
        name="double_pulse",
        label="Double Pulse Nudge",
        purpose="General alert or minor form correction nudge",
        duration_ms=600,
        pulse_count=2,
        default_intensity=0.7,
        replace_with="haptic_hardware_provider",
    ),
    "single_long_pulse": HapticPattern(
        name="single_long_pulse",
        label="Single Long Pulse Alert",
        purpose="Warning or correction for sustained form deviation",
        duration_ms=1000,
        pulse_count=1,
        default_intensity=0.8,
        replace_with="haptic_hardware_provider",
    ),
    "continuous_vibe": HapticPattern(
        name="continuous_vibe",
        label="Continuous Vibration Feedback",
        purpose="Active pacing guidance matching the rep duration",
        duration_ms=2000,
        pulse_count=1,
        default_intensity=0.5,
        replace_with="haptic_hardware_provider",
    ),
    "short_success_pulse": HapticPattern(
        name="short_success_pulse",
        label="Short Success Pulse",
        purpose="Confirmation of a successfully completed rep",
        duration_ms=250,
        pulse_count=1,
        default_intensity=0.6,
        replace_with="haptic_hardware_provider",
    ),
    "left_spatial_hint": HapticPattern(
        name="left_spatial_hint",
        label="Left Spatial Hint",
        purpose="Directional nudge to adjust posture toward the left side",
        duration_ms=400,
        pulse_count=1,
        default_intensity=0.7,
        replace_with="haptic_hardware_provider",
    ),
    "right_spatial_hint": HapticPattern(
        name="right_spatial_hint",
        label="Right Spatial Hint",
        purpose="Directional nudge to adjust posture toward the right side",
        duration_ms=400,
        pulse_count=1,
        default_intensity=0.7,
        replace_with="haptic_hardware_provider",
    ),
}


def load_manifest() -> list[HapticVibrationCandidate]:
    """Locate and load the generated vibration manifest JSON file."""
    possible_paths = [
        # Relative to backend/
        "../frontend/public/haptics/manifest.json",
        # Relative to this file
        os.path.join(os.path.dirname(__file__), "../../../frontend/public/haptics/manifest.json"),
    ]
    for path in possible_paths:
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    data = json.load(f)
                    return [HapticVibrationCandidate.model_validate(x) for x in data]
            except Exception as e:
                print(f"Error parsing haptic manifest at {path}: {e}")
    return []


# Cache manifest list
_manifest_cache: list[HapticVibrationCandidate] = load_manifest()


def get_manifest() -> list[HapticVibrationCandidate]:
    """Return the list of all WAV vibration candidates in the manifest."""
    global _manifest_cache
    if not _manifest_cache:
        _manifest_cache = load_manifest()
    return _manifest_cache


def get_patterns() -> dict[str, HapticPattern]:
    """Return the complete library of available prototype haptic patterns."""
    return HAPTIC_PATTERNS


def get_pattern(pattern_name: str) -> HapticPattern | None:
    """Look up a prototype haptic pattern by name."""
    return HAPTIC_PATTERNS.get(pattern_name)


def test_sleeve(sleeve_side: SleeveSide) -> HapticTestResponse:
    """Return success-like prototype output for a test calibration pulse."""
    return HapticTestResponse(
        success=True,
        sleeve_side=sleeve_side,
        message=f"Dry-run calibration test pulse simulated on the {sleeve_side.value} sleeve.",
        source="prototype",
        provider="bhaptics_dry_run",
        replace_with="haptic_hardware_provider",
    )


def trigger_pattern(
    sleeve_sides: list[SleeveSide] | None = None,
    pattern_name: str | None = None,
    intensity: float = 0.5,
    cue_type: str | None = None,
    vibration_id: str | None = None,
    limbs: list[HapticLimb] | None = None,
) -> HapticTriggerResponse:
    """Simulate triggering a haptic pattern on selected sleeve sides with specified intensity."""
    manifest = get_manifest()
    selected_entry = None

    if vibration_id:
        selected_entry = next((c for c in manifest if c.id == vibration_id), None)
        if selected_entry and not cue_type:
            cue_type = selected_entry.cue_type
    elif cue_type:
        selected_entry = next((c for c in manifest if c.cue_type == cue_type), None)
        if selected_entry:
            vibration_id = selected_entry.id

    selected_wav = selected_entry.source_wav if selected_entry else None
    bhaptics_event = selected_entry.bhaptics_event_name if selected_entry else None

    # Map sleeve_sides to target_limbs if target_limbs not provided
    target_limbs = limbs
    if not target_limbs:
        target_limbs = []
        if sleeve_sides:
            for side in sleeve_sides:
                if side == SleeveSide.LEFT:
                    target_limbs.extend([HapticLimb.LEFT_ARM, HapticLimb.LEFT_LEG])
                elif side == SleeveSide.RIGHT:
                    target_limbs.extend([HapticLimb.RIGHT_ARM, HapticLimb.RIGHT_LEG])
                elif side == SleeveSide.BOTH:
                    target_limbs.extend([
                        HapticLimb.LEFT_ARM, HapticLimb.RIGHT_ARM,
                        HapticLimb.LEFT_LEG, HapticLimb.RIGHT_LEG
                    ])
    # Map limbs back to sleeve_sides for compatibility
    resolved_sleeve_sides = sleeve_sides
    if not resolved_sleeve_sides:
        if limbs:
            sides = set()
            for limb in limbs:
                if limb.value.startswith("left"):
                    sides.add(SleeveSide.LEFT)
                elif limb.value.startswith("right"):
                    sides.add(SleeveSide.RIGHT)
            resolved_sleeve_sides = list(sides)
            if len(resolved_sleeve_sides) == 2:
                resolved_sleeve_sides = [SleeveSide.BOTH]
        if not resolved_sleeve_sides:
            resolved_sleeve_sides = [SleeveSide.BOTH]

    return HapticTriggerResponse(
        status="would_trigger",
        pattern_name=pattern_name or (selected_entry.label if selected_entry else None) or "unknown",
        sleeve_sides=resolved_sleeve_sides,
        intensity=intensity,
        source="prototype",
        provider="bhaptics_dry_run",
        replace_with="haptic_hardware_provider",
        cue_type=cue_type,
        selected_vibration_id=vibration_id,
        selected_wav=selected_wav,
        target_limbs=target_limbs,
        bhaptics_event_name=bhaptics_event
    )
