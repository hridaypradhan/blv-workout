"""Haptic feedback service stubs for FitA11y."""

from typing import Any

from app.models.schemas import SleeveSide


def get_pattern(pattern_name: str) -> dict[str, Any]:
    """Return a haptic pattern definition by pattern name."""
    raise NotImplementedError("TODO: implement")


def trigger_pattern(sleeve_side: SleeveSide, pattern: dict[str, Any], intensity: float) -> None:
    """Trigger a haptic pattern on a selected sleeve at the requested intensity."""
    raise NotImplementedError("TODO: implement")


def run_calibration_test(sleeve_side: SleeveSide) -> bool:
    """Run a calibration test pulse on a selected haptic sleeve."""
    raise NotImplementedError("TODO: implement")
