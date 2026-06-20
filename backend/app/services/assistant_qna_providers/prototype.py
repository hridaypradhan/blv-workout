"""Prototype assistant QnA provider for FitA11y."""

import logging
from typing import Any
from app.models.schemas import QARequest, QAResponse, AssistantPersona, FeedbackModality
from app.services.assistant_qna_providers.base import AssistantQnAProvider

logger = logging.getLogger(__name__)


class PrototypeAssistantQnAProvider(AssistantQnAProvider):
    """Deterministic fallback/prototype QnA provider strategy."""

    def answer_question(self, request: QARequest, grounded_context: dict[str, Any]) -> QAResponse:
        q_lower = request.question.lower()
        
        # 1. Medical/Safety checks
        if any(w in q_lower for w in ["pain", "hurt", "dizzy", "chest", "discomfort", "ache", "injury"]):
            answer = "If you feel any pain or discomfort, please stop the exercise immediately. I recommend resting and consulting a healthcare professional."
            kind = "safety_boundary"
            
        # 2. Self-observation questions checks (without actual pose)
        elif any(w in q_lower for w in ["see me", "look at", "check", "correct", "my form", "my knee", "my back", "am i doing", "is my", "how do i look", "check me", "knees right"]):
            pose_avail = False
            pose_confidence = None
            latest_form_error = None
            
            if request.runtime_observation_context:
                if request.runtime_observation_context.pose_available:
                    pose_avail = True
                pose_confidence = request.runtime_observation_context.pose_confidence
                latest_form_error = request.runtime_observation_context.latest_form_error
            
            # Treat missing or low pose confidence (< 0.5) as unavailable
            if not pose_avail or pose_confidence is None or (isinstance(pose_confidence, (int, float)) and pose_confidence < 0.5):
                kind = "self_observation_boundary"
                # Check current exercise to give a slightly customized general cue alternative
                curr_ex = grounded_context.get("current_exercise")
                ex_name = curr_ex["name"].lower() if (curr_ex and isinstance(curr_ex, dict) and curr_ex.get("name")) else None
                
                alt_text = "If you describe your body position or what you feel, I can offer general guidance."
                if ex_name and "squat" in ex_name:
                    alt_text = "Keep your knees tracking over your toes and weight on your heels. If you describe your position, I can check."
                elif ex_name and "curl" in ex_name:
                    alt_text = "Keep your elbows pinned close to your torso. If you describe your position, I can check."
                
                answer = f"I cannot see or check your form right now. {alt_text}"
            else:
                # If pose is available and confident
                kind = "video_grounded"
                if latest_form_error:
                    answer = f"The available pose signal reports a potential issue: {latest_form_error}. Keep following the trainer's cue."
                else:
                    answer = "I don't have a specific form warning from the available signal right now. Keep following the trainer's cue."
                
        # 3. Video-grounded / general questions
        elif any(w in q_lower for w in ["form", "how", "posture", "technique"]):
            kind = "general_guidance"
            curr_ex = grounded_context.get("current_exercise")
            ex_name = curr_ex["name"].lower() if (curr_ex and "name" in curr_ex) else None
            
            if ex_name and "squat" in ex_name:
                answer = "Keep your knees aligned over your toes and push up through your heels. Keep your chest up."
            elif ex_name and "curl" in ex_name:
                answer = "Keep your elbows stable at your sides, curl up fully, and release slowly."
            else:
                answer = "Maintain a stable core, breathe steadily, and move smoothly through the range of motion."
                
        elif any(w in q_lower for w in ["repeat", "say", "what did", "hear"]):
            kind = "video_grounded"
            # Get latest instruction from context
            inst = grounded_context.get("nearby_trainer_instructions")
            if inst:
                # Extract text of last one
                answer = f"The trainer said: '{inst[-1]}'."
            else:
                answer = "The trainer is explaining the movement setup. Listen closely to their instructions."
                
        elif any(w in q_lower for w in ["sleeve", "haptic", "vibrat", "vibe"]):
            kind = "general_guidance"
            answer = "Haptic sleeves vibrate to guide your pacing (continuous pulse) or alert you to form corrections (double pulse)."
            
        else:
            # Fallback default
            kind = "fallback"
            answer = "Continue following the trainer's voice. I will notify you if your form or pacing drifts."

        # Add persona styling if supportive/calm/etc.
        text_body = answer
        persona = request.persona or AssistantPersona.SUPPORTIVE
        if persona == AssistantPersona.ENERGETIC:
            text = f"Hey! {text_body.capitalize()} Let's keep up the great effort!"
        elif persona == AssistantPersona.CALM:
            text = f"Be mindful of this: {text_body} Keep your breathing steady."
        elif persona == AssistantPersona.DIRECT:
            text = f"Assistant update: {text_body}"
        else:
            text = f"Here is a quick tip: {text_body}"

        return QAResponse(
            answer_text=text,
            answer_kind=kind,
            provider="prototype",
            model=None,
            grounding_sources=[],
            spoken_safe=True,
            fallback_reason=None,
            diagnostics_ref=None,
            # Backward compatibility fields
            text=text,
            persona=persona,
            modality=FeedbackModality.AUDIO,
            priority="normal",
            timestamp_ms=request.current_timestamp_ms,
        )
