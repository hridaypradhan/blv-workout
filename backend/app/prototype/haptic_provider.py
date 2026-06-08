"""Prototype haptic provider for FitA11y.

This module stores the available haptic patterns library and handles test
and trigger logic deterministically, validating parameters without communicating
with actual sleeve hardware.
"""

from typing import Any
from app.models.schemas import (
    HapticPattern,
    HapticTestResponse,
    HapticTriggerResponse,
    SleeveSide,
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
        message=f"Prototype calibration test pulse fired successfully on the {sleeve_side.value} sleeve.",
        source="prototype",
        provider="prototype_haptic",
        replace_with="haptic_hardware_provider",
    )


def trigger_pattern(
    sleeve_sides: list[SleeveSide],
    pattern_name: str,
    intensity: float,
) -> HapticTriggerResponse:
    """Simulate triggering a haptic pattern on selected sleeve sides with specified intensity."""
    return HapticTriggerResponse(
        status="success",
        pattern_name=pattern_name,
        sleeve_sides=sleeve_sides,
        intensity=intensity,
        source="prototype",
        provider="prototype_haptic",
        replace_with="haptic_hardware_provider",
    )
