"""Prototype assistant provider for FitA11y.

This module delivers deterministic responses for form correction, motivation,
and Q&A, using the AssistantCue schema. It represents the transition point
where Gemini AI will later generate dynamic assistance.
"""

from typing import Any
from uuid import UUID
from app.models.schemas import AssistantCue, AssistantPersona, FeedbackModality


def generate_correction(
    exercise_id: UUID,
    exercise_name: str,
    joint: str,
    angle: float,
    current_timestamp_ms: float | None,
    persona: AssistantPersona,
) -> AssistantCue:
    """Generate a brief, BLV-friendly supplementary form correction cue (prototype).

    Does not imply replacement of the primary trainer instructions.
    """
    joint_name = joint.replace("_", " ").lower()
    
    # Simple deterministic logic based on joint/angle
    if "knee" in joint_name:
        if angle < 80.0:
            cues = {
                AssistantPersona.SUPPORTIVE: f"Nice depth on the {exercise_name}, but remember to keep your chest up and follow the trainer's cue.",
                AssistantPersona.DIRECT: f"Deep squat: {angle:.0f}° knee flexion. Maintain upright trunk as shown in video.",
                AssistantPersona.ENERGETIC: f"Super low squat! Keep those knees tracking out and listen for the trainer's next rep count!",
                AssistantPersona.CALM: f"Knees are at {angle:.0f}° flexion. Gently push back up with steady breathing.",
            }
        else:
            cues = {
                AssistantPersona.SUPPORTIVE: f"You're doing great! Try sinking just a tiny bit lower in your squat if comfortable.",
                AssistantPersona.DIRECT: f"Squat: {angle:.0f}° knee flexion. Focus on hip hinge to descend.",
                AssistantPersona.ENERGETIC: f"Slightly shallow, let's see if we can get a bit deeper next time! You got this!",
                AssistantPersona.CALM: f"Gently deepen the squat range when you feel ready. Follow the trainer's pace.",
            }
    elif "elbow" in joint_name:
        if angle < 60.0:
            cues = {
                AssistantPersona.SUPPORTIVE: "Good flexion, focus on releasing the weight slowly down.",
                AssistantPersona.DIRECT: "Elbow flexed. Begin controlled extension phase.",
                AssistantPersona.ENERGETIC: "Feel the squeeze! Squeeze and extend smoothly!",
                AssistantPersona.CALM: "Hold the contraction briefly, then release with the trainer.",
            }
        else:
            cues = {
                AssistantPersona.SUPPORTIVE: "Let's curl the weight up towards the shoulder.",
                AssistantPersona.DIRECT: "Elbow extended. Initiate curl movement.",
                AssistantPersona.ENERGETIC: "Let's lift! Curl up strong!",
                AssistantPersona.CALM: "Slowly begin the flexion phase, keeping shoulders stable.",
            }
    else:
        # Fallback cue
        cues = {
            AssistantPersona.SUPPORTIVE: f"Focus on matching the trainer's posture and pace for the active exercise.",
            AssistantPersona.DIRECT: f"{joint.capitalize()} angle is {angle:.0f}°. Follow the video demonstration.",
            AssistantPersona.ENERGETIC: f"Keep that energy high! Focus on alignment and push!",
            AssistantPersona.CALM: f"Be mindful of your body alignment. Move smoothly with the trainer.",
        }

    text = cues.get(persona, cues[AssistantPersona.SUPPORTIVE])

    metadata = {
        "source": "prototype",
        "provider": "prototype_assistant",
        "replace_with": "gemini_service",
        "exercise_id": str(exercise_id),
        "exercise_name": exercise_name,
        "joint": joint,
        "angle": angle,
    }
    if current_timestamp_ms is not None:
        metadata["current_timestamp_ms"] = current_timestamp_ms

    return AssistantCue(
        text=text,
        persona=persona,
        modality=FeedbackModality.AUDIO,
        priority="normal",
        timestamp_ms=current_timestamp_ms,
        metadata=metadata,
    )


def generate_motivation(
    milestone_event: str,
    persona: AssistantPersona,
) -> AssistantCue:
    """Generate a low-priority, supplementary motivational encouragement cue."""
    event_clean = milestone_event.replace("_", " ").lower()

    motivation_phrases = {
        AssistantPersona.SUPPORTIVE: {
            "halfway": "You're halfway through this exercise! Splendid effort, keep it up!",
            "rep_10": "Double digits! 10 repetitions down. You are doing fantastic!",
            "streak_5": "Five clean repetitions in a row! Excellent form consistency.",
            "session_start": "Welcome to your assisted playback session. Follow the trainer's voice and let's get moving!",
            "session_end": "Workout completed! Wonderful dedication. Rest and hydrate.",
            "default": f"Amazing job reaching the {event_clean} milestone! Keep going!",
        },
        AssistantPersona.DIRECT: {
            "halfway": "Halfway milestone reached. Maintain form.",
            "rep_10": "10 repetitions completed. Continue routine.",
            "streak_5": "Form consistency streak at 5 reps.",
            "session_start": "Session started. Listen to primary trainer cues.",
            "session_end": "Session completed. Good job.",
            "default": f"Milestone: {event_clean} completed.",
        },
        AssistantPersona.ENERGETIC: {
            "halfway": "Halfway there! Keep that fire burning, let's crush the rest!",
            "rep_10": "Boom! 10 reps in the books! You are absolutely killing it!",
            "streak_5": "5 in a row! That is what I call flawless form! Let's go!",
            "session_start": "Session active! Let's bring the hype and smash this workout!",
            "session_end": "Booya! You finished the entire session! High five!",
            "default": f"Aw yeah! {event_clean} down! Let's keep this momentum!",
        },
        AssistantPersona.CALM: {
            "halfway": "Halfway complete. Feel the rhythm of your movement.",
            "rep_10": "10 repetitions. Stay centered and continue breathing deeply.",
            "streak_5": "Five steady reps. Appreciate the alignment of your body.",
            "session_start": "Beginning session. Find a comfortable pace alongside the trainer.",
            "session_end": "Session concluded. Take a deep breath and relax.",
            "default": f"Mindfully acknowledging the {event_clean} milestone.",
        },
    }

    persona_phrases = motivation_phrases.get(persona, motivation_phrases[AssistantPersona.SUPPORTIVE])
    text = persona_phrases.get(milestone_event, persona_phrases["default"])

    return AssistantCue(
        text=text,
        persona=persona,
        modality=FeedbackModality.AUDIO,
        priority="low",  # Low-priority supplementary encouragement
        timestamp_ms=None,
        metadata={
            "source": "prototype",
            "provider": "prototype_assistant",
            "replace_with": "gemini_service",
            "milestone_event": milestone_event,
        },
    )


def answer_question(
    question: str,
    session_context: dict[str, Any],
    current_timestamp_ms: float | None,
    persona: AssistantPersona,
) -> AssistantCue:
    """Answer a user question with concise, context-aware prototype guidance."""
    active_exercise = session_context.get("active_exercise")
    latest_trainer_instruction = session_context.get("latest_trainer_instruction")
    current_section = session_context.get("current_section")

    q_lower = question.lower()
    context_parts = []
    
    if active_exercise:
        context_parts.append(f"during the active exercise '{active_exercise}'")
    if latest_trainer_instruction:
        context_parts.append(f"just after the trainer instruction '{latest_trainer_instruction}'")
    if current_section:
        context_parts.append(f"in the '{current_section}' part of the video")

    context_prefix = ""
    if context_parts:
        context_prefix = "Based on your workout context (" + ", ".join(context_parts) + "): "

    # Provide concise answer depending on question keywords
    if "form" in q_lower or "how" in q_lower or "posture" in q_lower:
        if active_exercise and "squat" in active_exercise.lower():
            answer = "keep your knees aligned over your toes and push up through your heels. Keep your chest up."
        else:
            answer = "maintain a stable core and ensure you move smoothly through the range of motion."
    elif "repeat" in q_lower or "what" in q_lower or "say" in q_lower:
        if latest_trainer_instruction:
            answer = f"the trainer said: '{latest_trainer_instruction}'."
        else:
            answer = "the trainer is detailing the setup for the movement. Listen to their guidance."
    elif "sleeve" in q_lower or "haptic" in q_lower or "vibe" in q_lower:
        answer = "haptic sleeves vibrate to guide your pacing (continuous pulse) or alert you to form corrections (double pulse)."
    else:
        # Generic fallback
        answer = "continue following the trainer's voice. I will notify you if your form or pacing drifts."

    text_body = f"{context_prefix}{answer}"

    # Add persona styling
    if persona == AssistantPersona.ENERGETIC:
        text = f"Hey! {text_body.capitalize()} Let's keep up the great effort!"
    elif persona == AssistantPersona.CALM:
        text = f"Be mindful of this: {text_body} Keep your breathing steady."
    elif persona == AssistantPersona.DIRECT:
        text = f"Assistant update: {text_body}"
    else:
        text = f"Here is a quick tip: {text_body}"

    metadata = {
        "source": "prototype",
        "provider": "prototype_assistant",
        "replace_with": "gemini_service",
        "session_context_used": bool(session_context),
        "question": question,
    }
    if current_timestamp_ms is not None:
        metadata["current_timestamp_ms"] = current_timestamp_ms

    return AssistantCue(
        text=text,
        persona=persona,
        modality=FeedbackModality.AUDIO,
        priority="normal",
        timestamp_ms=current_timestamp_ms,
        metadata=metadata,
    )


def get_form_risk_templates(exercise_id: UUID) -> list[str]:
    """Return a deterministic list of form risk warning templates for the exercise.

    These are supplementary cues to help blind users anticipate form challenges.
    """
    # A generic but highly useful set of risk warnings since we don't have DB persistence
    return [
        "Lower back arching: Focus on bracing the abdominal wall.",
        "Knees collapsing inward: Press knees outward to engage the glutes.",
        "Weight shift to toes: Press heels down to stabilize base of support.",
        "Excessive pacing lag: Follow the trainer's counting beat.",
    ]
