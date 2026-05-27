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
    if lag_ratio <= 1.0:
        phrases = {
            CoachPersona.SUPPORTIVE: "Excellent pacing! Keep up the good work.",
            CoachPersona.DIRECT: "On pace. Continue.",
            CoachPersona.ENERGETIC: "Fantastic tempo! Keep moving!",
            CoachPersona.CALM: "Nice steady pace. Maintain this tempo."
        }
    elif lag_ratio <= 1.2:
        phrases = {
            CoachPersona.SUPPORTIVE: "You're doing great, but try to speed up just a little bit.",
            CoachPersona.DIRECT: "Slight lag. Increase speed.",
            CoachPersona.ENERGETIC: "A little slow! Pick up the pace slightly!",
            CoachPersona.CALM: "You are slightly behind. Gently find a bit more speed."
        }
    else:
        phrases = {
            CoachPersona.SUPPORTIVE: "Let's take it slow, take your time to finish the movement.",
            CoachPersona.DIRECT: "Significant lag. Focus on completing the exercise.",
            CoachPersona.ENERGETIC: "Don't rush, but let's try to close the gap!",
            CoachPersona.CALM: "Take a deep breath and match the pace when you are ready."
        }
    return phrases.get(persona, phrases[CoachPersona.SUPPORTIVE])



def generate_motivation(milestone_event: str, persona: CoachPersona) -> str:
    """Generate a motivational phrase for a workout milestone event."""
    raise NotImplementedError("TODO: implement")


def answer_question(question: str, session_context: dict[str, Any], persona: CoachPersona) -> str:
    """Answer a user question using session context and coach persona."""
    raise NotImplementedError("TODO: implement")


def generate_session_summary(session_data: dict[str, Any]) -> str:
    """Generate a natural-language summary for a completed workout session."""
    raise NotImplementedError("TODO: implement")
