"""Gemini AI service stubs for FitA11y assistance sidecar generation.

These functions support the assistance preparation pipeline and runtime
assistant features. They generate supplementary data for the sidecar
manifest — they do NOT create a replacement trainer script or shadow
workout.
"""

from typing import Any

from app.models.schemas import (
    AssistantPersona,
    ExerciseTimelineAnchor,
    FormRiskTemplate,
    HapticSpatialCueProfile,
    SpeakingOpportunityWindow,
    TrainerInstructionEvent,
)


def generate_exercise_timeline_anchors(
    transcript: str, video_duration_seconds: float
) -> list[ExerciseTimelineAnchor]:
    """Identify exercise segments in the trainer's video and return timeline anchors.

    These anchors describe *where* exercises occur in the original video
    so FitA11y can provide contextual assistance — they do NOT represent
    a regenerated workout.

    TODO: Implement using Gemini analysis of transcript + video content.
    """
    raise NotImplementedError("TODO: implement exercise timeline anchoring")


def generate_accessible_descriptions(
    anchor: ExerciseTimelineAnchor,
) -> dict[str, str]:
    """Generate internal and accessibility descriptions for a timeline anchor.

    These descriptions are used by the sidecar for assistive purposes —
    they are NOT read aloud as a replacement for the trainer's instruction.

    TODO: Implement using Gemini.
    """
    raise NotImplementedError("TODO: implement description generation")


def classify_trainer_instruction_events(
    transcript: str,
) -> list[TrainerInstructionEvent]:
    """Classify the trainer's spoken instructions by type.

    This enables FitA11y to identify when the trainer is giving form cues,
    counting reps, encouraging, or resting — so the assistant knows when
    it may speak (speaking opportunity windows).

    TODO: Implement using Gemini analysis of transcript.
    """
    raise NotImplementedError("TODO: implement trainer instruction classification")


def generate_speaking_opportunity_map(
    trainer_events: list[TrainerInstructionEvent],
    video_duration_seconds: float,
) -> list[SpeakingOpportunityWindow]:
    """Generate a map of windows where the assistant may deliver cues.

    The assistant should avoid talking over the trainer. This map
    identifies gaps, silences, and moments suitable for brief haptic-only
    or ducked speech delivery.

    TODO: Implement — may also use deterministic gap detection.
    """
    raise NotImplementedError("TODO: implement speaking opportunity map generation")


def evaluate_counting_joint(
    exercise_name: str, joint: str, angle_range: tuple[float, float]
) -> dict[str, Any]:
    """Evaluate whether a joint and angle range are suitable for repetition counting."""
    raise NotImplementedError("TODO: implement")


def generate_haptic_spatial_cue_profile(
    exercise_name: str, body_parts: list[str]
) -> HapticSpatialCueProfile:
    """Generate a haptic/spatial cue profile for an exercise and target body parts."""
    raise NotImplementedError("TODO: implement")


def generate_form_risk_templates(exercise_name: str) -> list[FormRiskTemplate]:
    """Generate supplementary form risk correction templates for an exercise.

    These templates are brief, contextual cues — NOT a replacement
    trainer script.

    TODO: Implement using Gemini.
    """
    raise NotImplementedError("TODO: implement form risk template generation")


def generate_correction(
    exercise_name: str,
    joint: str,
    angle: float,
    persona: AssistantPersona,
) -> str:
    """Generate a real-time supplementary correction cue for a joint angle.

    The correction supplements — never replaces — the trainer's own
    form instruction in the video.
    """
    raise NotImplementedError("TODO: implement")


def generate_pacing_feedback(lag_ratio: float, persona: AssistantPersona) -> str:
    """Generate supplementary pacing feedback based on a user's timing lag ratio."""
    if lag_ratio <= 1.0:
        phrases = {
            AssistantPersona.SUPPORTIVE: "Excellent pacing! Keep it up.",
            AssistantPersona.DIRECT: "On pace. Continue.",
            AssistantPersona.ENERGETIC: "Fantastic tempo! Keep moving!",
            AssistantPersona.CALM: "Nice steady pace. Maintain this tempo."
        }
    elif lag_ratio <= 1.2:
        phrases = {
            AssistantPersona.SUPPORTIVE: "You're doing great, but try to speed up just a little bit.",
            AssistantPersona.DIRECT: "Slight lag. Increase speed.",
            AssistantPersona.ENERGETIC: "A little slow! Pick up the pace slightly!",
            AssistantPersona.CALM: "You are slightly behind. Gently find a bit more speed."
        }
    else:
        phrases = {
            AssistantPersona.SUPPORTIVE: "Let's take it slow, take your time to finish the movement.",
            AssistantPersona.DIRECT: "Significant lag. Focus on completing the exercise.",
            AssistantPersona.ENERGETIC: "Don't rush, but let's try to close the gap!",
            AssistantPersona.CALM: "Take a deep breath and match the pace when you are ready."
        }
    return phrases.get(persona, phrases[AssistantPersona.SUPPORTIVE])


def generate_motivation(milestone_event: str, persona: AssistantPersona) -> str:
    """Generate a low-priority motivational cue for a milestone event."""
    raise NotImplementedError("TODO: implement")


def answer_question(
    question: str,
    session_context: dict[str, Any],
    current_timestamp_ms: float | None,
    persona: AssistantPersona,
) -> str:
    """Answer a user question using session context, current playback position,
    and trainer instruction context.

    The assistant responds in the context of what the trainer is currently
    showing/saying in the video at the given timestamp.
    """
    raise NotImplementedError("TODO: implement")


def generate_session_summary(session_data: dict[str, Any]) -> str:
    """Generate a natural-language summary for a completed assisted playback session."""
    raise NotImplementedError("TODO: implement")
