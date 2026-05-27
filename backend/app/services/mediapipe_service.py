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
    if isinstance(frame, dict):
        if "angles" in frame and isinstance(frame["angles"], dict):
            angles = frame["angles"]
        else:
            angles = frame
        
        # Validate that it contains string keys and numeric values
        for k, v in angles.items():
            if not isinstance(k, str) or not isinstance(v, (int, float)):
                raise ValueError("Frame angles must contain string keys and numeric values.")
        return {str(k): float(v) for k, v in angles.items()}
    raise ValueError("Invalid frame format. Expected a dictionary representing pose data.")


def detect_rep(current_angle: float, thresholds: tuple[float, float]) -> bool:
    """Detect whether the current angle completes a repetition threshold crossing (bottom of motion)."""
    min_val, _ = thresholds
    return current_angle <= min_val


def detect_form_error(
    joint_angles: dict[str, float],
    acceptable_ranges: dict[str, tuple[float, float]],
) -> list[FormError]:
    """Detect form errors by comparing live joint angles to acceptable ranges."""
    errors = []
    for joint, angle in joint_angles.items():
        if joint in acceptable_ranges:
            min_val, max_val = acceptable_ranges[joint]
            if angle < min_val:
                diff = min_val - angle
            elif angle > max_val:
                diff = angle - max_val
            else:
                continue

            if diff <= 10.0:
                severity = "low"
            elif diff <= 25.0:
                severity = "medium"
            else:
                severity = "high"

            msg = f"{joint.replace('_', ' ').capitalize()} angle ({angle:.1f}°) is outside acceptable range [{min_val:.1f}°, {max_val:.1f}°] by {diff:.1f}°."
            
            errors.append(FormError(
                joint=joint,
                observed_angle=angle,
                expected_range=(min_val, max_val),
                severity=severity,
                message=msg
            ))
    return errors

