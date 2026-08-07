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
    correction_kind: str | None = None,
    offender_angle: str | None = None,
    offender_joint: str | None = None,
) -> AssistantCue:
    """Generate a brief, BLV-friendly supplementary form correction cue (prototype).

    Does not imply replacement of the primary trainer instructions.
    """
    policy = get_persona_policy(persona)
    joint_display = offender_joint or joint.replace("_", " ").lower()

    if correction_kind == "depth":
        cues = {
            AssistantPersona.GUIDE: f"Go a bit deeper on your {exercise_name}; sink your hips further.",
            AssistantPersona.SERGEANT: f"Depth warning for {exercise_name}. Increase range of motion.",
            AssistantPersona.CHEERLEADER: f"You're doing awesome! Let's get a tiny bit lower on those {exercise_name} reps!",
        }
    elif correction_kind == "pacing_fast":
        cues = {
            AssistantPersona.GUIDE: "You're moving faster than the video; slow down and control each rep.",
            AssistantPersona.SERGEANT: "Pacing too fast. Slow down movement velocity to match video rhythm.",
            AssistantPersona.CHEERLEADER: "Whoa, fast moves! Take a breath, slow down, and control every rep!",
        }
    elif correction_kind == "pacing_slow":
        cues = {
            AssistantPersona.GUIDE: "Pick up the pace a little to stay with the workout.",
            AssistantPersona.SERGEANT: "Pacing behind. Increase cadence to maintain video pace.",
            AssistantPersona.CHEERLEADER: "Pick up the pace a bit! You've got this, let's keep moving!",
        }
    elif correction_kind == "position":
        cues = {
            AssistantPersona.GUIDE: f"Pay attention to your {joint_display} position; keep your body stable.",
            AssistantPersona.SERGEANT: f"Position error on {joint_display}. Re-align body posture as instructed.",
            AssistantPersona.CHEERLEADER: f"Steady your {joint_display} position; lock in your form and keep pushing!",
        }
    elif correction_kind == "symmetry":
        cues = {
            AssistantPersona.GUIDE: f"Even out your left and right {joint_display}; keep both sides matched.",
            AssistantPersona.SERGEANT: f"Bilateral asymmetry detected on {joint_display}. Equalize left and right extension.",
            AssistantPersona.CHEERLEADER: f"Keep both sides balanced! Match your left and right {joint_display}!",
        }
    elif "knee" in joint_display:
        if angle < 80.0:
            cues = {
                AssistantPersona.GUIDE: f"Nice depth on the {exercise_name}, but remember to keep your chest up.",
                AssistantPersona.SERGEANT: f"Deep squat: {angle:.0f} degree knee flexion. Maintain upright trunk.",
                AssistantPersona.CHEERLEADER: "Super low squat! Keep those knees tracking out and keep pushing!",
            }
        else:
            cues = {
                AssistantPersona.GUIDE: "You're doing great! Try sinking just a tiny bit lower in your squat if comfortable.",
                AssistantPersona.SERGEANT: f"Squat: {angle:.0f} degree knee flexion. Focus on hip hinge to descend.",
                AssistantPersona.CHEERLEADER: "Slightly shallow, let's see if we can get a bit deeper next time! You got this!",
            }
    elif "elbow" in joint_display:
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
        cues = {
            AssistantPersona.GUIDE: f"Focus on matching the posture and pace for {exercise_name}.",
            AssistantPersona.SERGEANT: f"{joint.capitalize()} angle is {angle:.0f} degrees. Maintain proper alignment.",
            AssistantPersona.CHEERLEADER: "Keep that energy high! Focus on alignment and push!",
        }

    text = cues.get(persona, cues[AssistantPersona.GUIDE])

    metadata = {
        "source": "prototype",
        "provider": "prototype_assistant",
        "fallback_reason": "Deterministic prototype assistant fallback active.",
        "replace_with": "ai_assistant_provider",
        "exercise_id": str(exercise_id),
        "exercise_name": exercise_name,
        "joint": joint,
        "angle": angle,
        "persona_policy": policy.name,
        "max_corrections_cap": policy.max_corrections_per_exercise,
    }
    if correction_kind is not None:
        metadata["correction_kind"] = correction_kind
    if offender_angle is not None:
        metadata["offender_angle"] = offender_angle
    if offender_joint is not None:
        metadata["offender_joint"] = offender_joint
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
