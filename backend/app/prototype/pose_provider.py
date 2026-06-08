"""Prototype pose provider for FitA11y.

This module simulates time-varying joint angles and form error checks, representing
a placeholder for the live camera MediaPipe pose service.
"""

import math
from datetime import datetime
from typing import Any
from uuid import UUID
from app.models.schemas import FormError, RepEvent


def generate_prototype_pose_frame(
    timestamp_ms: float,
    exercise_name: str,
) -> dict[str, Any]:
    """Generate a prototype pose frame representing simulated body tracking coordinates."""
    return {
        "timestamp_ms": timestamp_ms,
        "exercise_name": exercise_name,
        "source": "prototype",
        "provider": "prototype_pose",
        "replace_with": "mediapipe_service",
        "landmarks": {
            "left_elbow": {"x": 0.5, "y": 0.6, "z": 0.1, "visibility": 0.99},
            "right_elbow": {"x": 0.5, "y": 0.6, "z": 0.1, "visibility": 0.99},
            "left_knee": {"x": 0.5, "y": 0.8, "z": 0.2, "visibility": 0.98},
            "right_knee": {"x": 0.5, "y": 0.8, "z": 0.2, "visibility": 0.98},
            "left_hip": {"x": 0.45, "y": 0.75, "z": 0.15, "visibility": 0.97},
            "right_hip": {"x": 0.55, "y": 0.75, "z": 0.15, "visibility": 0.97},
        },
    }


def generate_prototype_joint_angles(
    exercise_name: str,
    current_time_ms: float,
) -> dict[str, float]:
    """Generate deterministic joint angles that vary realistically over time.

    Simulates a repetitive cycle (e.g., 4 seconds per repetition).
    """
    # 4000ms per repetition cycle
    cycle_duration = 4000.0
    cycle = (current_time_ms % cycle_duration) / cycle_duration
    
    # Oscillation between 0.0 and 1.0
    phase = (math.sin(cycle * 2 * math.pi) + 1.0) / 2.0

    exercise_lower = exercise_name.lower()
    
    if "squat" in exercise_lower:
        # Knee angle oscillates between 78 degrees (deep squat) and 170 degrees (standing)
        knee_angle = 78.0 + (170.0 - 78.0) * phase
        hip_angle = 85.0 + (165.0 - 85.0) * phase
        return {
            "left_knee": knee_angle,
            "right_knee": knee_angle,
            "left_hip": hip_angle,
            "right_hip": hip_angle,
        }
    elif "curl" in exercise_lower:
        # Elbow angle oscillates between 35 degrees (fully flexed) and 165 degrees (extended)
        elbow_angle = 35.0 + (165.0 - 35.0) * phase
        return {
            "left_elbow": elbow_angle,
            "right_elbow": elbow_angle,
        }
    else:
        # Generic exercise body angles
        generic_angle = 80.0 + 80.0 * phase
        return {
            "left_elbow": generic_angle,
            "right_elbow": generic_angle,
            "left_knee": generic_angle,
            "right_knee": generic_angle,
        }


def generate_prototype_form_errors(
    exercise_name: str,
    joint_angles: dict[str, float],
) -> list[FormError]:
    """Analyze prototype joint angles and generate form error alerts if boundaries are violated."""
    errors = []
    exercise_lower = exercise_name.lower()

    if "squat" in exercise_lower:
        # Check if squats exceed acceptable deep threshold
        for knee in ["left_knee", "right_knee"]:
            if knee in joint_angles:
                angle = joint_angles[knee]
                # If knee angle is extremely low (caving/excessive depth warning)
                if angle < 75.0:
                    errors.append(
                        FormError(
                            joint=knee,
                            observed_angle=angle,
                            expected_range=(75.0, 180.0),
                            severity="medium",
                            message=f"Squat depth of {angle:.0f}° is slightly too deep. Try to control the range of motion.",
                        )
                    )
    elif "curl" in exercise_lower:
        for elbow in ["left_elbow", "right_elbow"]:
            if elbow in joint_angles:
                angle = joint_angles[elbow]
                # If elbow angle is not reaching full range
                if angle > 160.0:
                    errors.append(
                        FormError(
                            joint=elbow,
                            observed_angle=angle,
                            expected_range=(40.0, 160.0),
                            severity="low",
                            message=f"Elbow angle is {angle:.0f}°. Avoid locking out completely at the bottom.",
                        )
                    )

    return errors


def generate_prototype_rep_event(
    session_id: UUID,
    exercise_id: UUID,
    current_rep: int,
    timestamp: datetime,
) -> RepEvent:
    """Generate a prototype repetition event."""
    return RepEvent(
        session_id=session_id,
        exercise_id=exercise_id,
        rep_count=current_rep,
        timestamp=timestamp,
        metadata={
            "source": "prototype",
            "provider": "prototype_pose",
            "replace_with": "mediapipe_service",
            "confidence": 0.95,
        },
    )
