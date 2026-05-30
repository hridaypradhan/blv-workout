"""Haptic/spatial assistance cue service stubs for FitA11y.

Provides haptic feedback patterns that supplement the YouTube trainer's
instruction with tactile cues for form correction, pacing, and spatial
guidance.
"""

from typing import Any

from app.models.schemas import SleeveSide


def get_pattern(pattern_name: str) -> dict[str, Any]:
    """Return a haptic/spatial assistance cue pattern definition by name."""
    raise NotImplementedError("TODO: implement")


def trigger_pattern(sleeve_side: SleeveSide, pattern: dict[str, Any], intensity: float) -> None:
    """Trigger a haptic/spatial assistance cue pattern on a selected sleeve."""
    raise NotImplementedError("TODO: implement")


def run_calibration_test(sleeve_side: SleeveSide) -> bool:
    """Run a calibration test pulse on a selected haptic sleeve."""
    raise NotImplementedError("TODO: implement")
