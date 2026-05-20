"""MediaPipe pose analysis service stubs for FitA11y."""

from typing import Any

from app.models.schemas import FormError


def extract_joint_angles(video_segment_path: str) -> dict[str, list[float]]:
    """Extract joint angle time series from a workout video segment."""
    raise NotImplementedError("TODO: implement")


def identify_counting_joint(angle_ranges: dict[str, tuple[float, float]]) -> tuple[str, float, float]:
    """Identify the most useful joint and range for repetition counting."""
    raise NotImplementedError("TODO: implement")


def calculate_live_angles(frame: Any) -> dict[str, float]:
    """Calculate current joint angles from a live camera frame."""
    raise NotImplementedError("TODO: implement")


def detect_rep(current_angle: float, thresholds: tuple[float, float]) -> bool:
    """Detect whether the current angle completes a repetition threshold crossing."""
    raise NotImplementedError("TODO: implement")


def detect_form_error(
    joint_angles: dict[str, float],
    acceptable_ranges: dict[str, tuple[float, float]],
) -> list[FormError]:
    """Detect form errors by comparing live joint angles to acceptable ranges."""
    raise NotImplementedError("TODO: implement")
