"""Prototype assistant provider for FitA11y.

This module delivers deterministic responses for form correction, motivation,
and Q&A, using the AssistantCue schema. It represents the transition point
where Gemini AI will later generate dynamic assistance.
"""

from typing import Any
from uuid import UUID
from app.models.schemas import AssistantCue, AssistantPersona, FeedbackModality
from app.services.personas.policy import get_persona_policy


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
    policy = get_persona_policy(persona)
    joint_name = joint.replace("_", " ").lower()
    
    # Simple deterministic logic based on joint/angle
    if "knee" in joint_name:
        if angle < 80.0:
            cues = {
                AssistantPersona.GUIDE: f"Nice depth on the {exercise_name}, but remember to keep your chest up and follow the trainer's cue.",
                AssistantPersona.SERGEANT: f"Deep squat: {angle:.0f}° knee flexion. Maintain upright trunk as shown in video.",
                AssistantPersona.CHEERLEADER: f"Super low squat! Keep those knees tracking out and listen for the trainer's next rep count!",
            }
        else:
            cues = {
                AssistantPersona.GUIDE: f"You're doing great! Try sinking just a tiny bit lower in your squat if comfortable.",
                AssistantPersona.SERGEANT: f"Squat: {angle:.0f}° knee flexion. Focus on hip hinge to descend.",
                AssistantPersona.CHEERLEADER: f"Slightly shallow, let's see if we can get a bit deeper next time! You got this!",
            }
    elif "elbow" in joint_name:
        if angle < 60.0:
            cues = {
                AssistantPersona.GUIDE: "Good flexion, focus on releasing the weight slowly down.",
                AssistantPersona.SERGEANT: "Elbow flexed. Begin controlled extension phase.",
                AssistantPersona.CHEERLEADER: "Feel the squeeze! Squeeze and extend smoothly!",
            }
        else:
            cues = {
                AssistantPersona.GUIDE: "Let's curl the weight up towards the shoulder.",
                AssistantPersona.SERGEANT: "Elbow extended. Initiate curl movement.",
                AssistantPersona.CHEERLEADER: "Let's lift! Curl up strong!",
            }
    else:
        # Fallback cue
        cues = {
            AssistantPersona.GUIDE: f"Focus on matching the trainer's posture and pace for the active exercise.",
            AssistantPersona.SERGEANT: f"{joint.capitalize()} angle is {angle:.0f}°. Follow the video demonstration.",
            AssistantPersona.CHEERLEADER: f"Keep that energy high! Focus on alignment and push!",
        }

    text = cues.get(persona, cues[AssistantPersona.GUIDE])

    metadata = {
        "source": "prototype",
        "provider": "prototype_assistant",
        "replace_with": "ai_assistant_provider",
        "exercise_id": str(exercise_id),
        "exercise_name": exercise_name,
        "joint": joint,
        "angle": angle,
        "persona_policy": policy.name,
        "max_corrections_cap": policy.max_corrections_per_exercise,
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
    if persona == AssistantPersona.CHEERLEADER:
        text = f"Hey! {text_body.capitalize()} Let's keep up the great effort!"
    elif persona == AssistantPersona.SERGEANT:
        text = f"Assistant update: {text_body}"
    else:
        text = f"Here is a quick tip: {text_body}"

    metadata = {
        "source": "prototype",
        "provider": "prototype_assistant",
        "replace_with": "ai_assistant_provider",
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
