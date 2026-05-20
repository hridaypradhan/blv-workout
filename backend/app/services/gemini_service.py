"""Gemini AI service stubs for FitA11y."""

from typing import Any

from app.models.schemas import CoachPersona, Exercise, HapticProfile


def segment_exercises(video_path: str, transcript: str) -> list[Exercise]:
    """Segment a workout video and transcript into structured exercise entries."""
    raise NotImplementedError("TODO: implement")


def generate_descriptions(exercise: Exercise) -> dict[str, str]:
    """Generate brief and detailed BLV-friendly descriptions for an exercise."""
    raise NotImplementedError("TODO: implement")


def evaluate_counting_joint(exercise_name: str, joint: str, angle_range: tuple[float, float]) -> dict[str, Any]:
    """Evaluate whether a joint and angle range are suitable for repetition counting."""
    raise NotImplementedError("TODO: implement")


def generate_haptic_profile(exercise_name: str, body_parts: list[str]) -> HapticProfile:
    """Generate a haptic feedback profile for an exercise and target body parts."""
    raise NotImplementedError("TODO: implement")


def generate_correction_templates(exercise_name: str) -> list[str]:
    """Generate reusable correction phrases for an exercise."""
    raise NotImplementedError("TODO: implement")


def generate_correction(exercise: Exercise, joint: str, angle: float, persona: CoachPersona) -> str:
    """Generate a real-time correction phrase for a joint angle and coach persona."""
    raise NotImplementedError("TODO: implement")


def generate_pacing_feedback(lag_ratio: float, persona: CoachPersona) -> str:
    """Generate pacing feedback based on a user's timing lag ratio."""
    raise NotImplementedError("TODO: implement")


def generate_motivation(milestone_event: str, persona: CoachPersona) -> str:
    """Generate a motivational phrase for a workout milestone event."""
    raise NotImplementedError("TODO: implement")


def answer_question(question: str, session_context: dict[str, Any], persona: CoachPersona) -> str:
    """Answer a user question using session context and coach persona."""
    raise NotImplementedError("TODO: implement")


def generate_session_summary(session_data: dict[str, Any]) -> str:
    """Generate a natural-language summary for a completed workout session."""
    raise NotImplementedError("TODO: implement")
