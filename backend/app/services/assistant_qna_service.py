"""Coordinator service for Assistant QnA."""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from app.core.config import settings
from app.core.storage import get_artifact_storage
from app.models.schemas import QARequest, QAResponse
from app.services.assistant_qna_context import build_qna_context
from app.services.assistant_qna_providers.registry import resolve_qna_provider, normalize_provider_name
from app.services.assistant_qna_providers.gemini_qna.prompt import PROMPT_VERSION as GEMINI_PROMPT_VERSION, SCHEMA_VERSION as GEMINI_SCHEMA_VERSION
from app.services.ai.errors import AIProviderAPIError, AIProviderResponseParseError

logger = logging.getLogger(__name__)


class AssistantQnAService:
    """Orchestrates assistant Q&A answering grounded in session workout context."""

    def answer_question(self, request: QARequest) -> QAResponse:
        """Answers a user question, coordinating grounded context building, provider selection, and fallback."""
        video_id_str = str(request.video_id) if request.video_id else ""
        
        # 1. Build context
        grounded_context = build_qna_context(video_id_str, request.current_timestamp_ms, request.session_context)

        provider_name = settings.AI_PROVIDER
        resolved_name, provider = resolve_qna_provider(provider_name)

        # 2. Check API key if Gemini requested
        if resolved_name == "gemini" and not settings.GEMINI_API_KEY:
            logger.warning("AI_PROVIDER is 'gemini' but GEMINI_API_KEY is missing. Falling back to prototype QnA.")
            return self._answer_with_fallback(request, grounded_context, "api_key_missing")

        # 3. Call the resolved provider
        try:
            response = provider.answer_question(request, grounded_context)
            if resolved_name == "gemini":
                response.model = settings.GEMINI_MODEL
            
            # Post-process and sanitize the final response
            response = self.post_process_sanitize_response(request, response, grounded_context)

            # Save diagnostics
            self._save_qna_diagnostics(
                request=request,
                response=response,
                grounded_context=grounded_context,
                fallback_reason=None
            )
            return response
        except (AIProviderAPIError, AIProviderResponseParseError) as exc:
            logger.warning("Gemini QnA provider failed: %s. Falling back to prototype.", exc)
            return self._answer_with_fallback(request, grounded_context, f"model_error: {exc}")
        except Exception as exc:
            logger.warning("Unexpected error during Gemini QnA: %s. Falling back to prototype.", exc)
            return self._answer_with_fallback(request, grounded_context, "model_error: Unknown error")

    def classify_question(self, question: str) -> str:
        q_lower = question.lower().strip()
        
        # 1. Safety/Medical
        safety_keywords = ["pain", "hurt", "dizzy", "chest", "discomfort", "ache", "injury", "medical", "doctor", "wound", "bleed"]
        if any(kw in q_lower for kw in safety_keywords):
            return "safety_medical"
            
        # 2. Self-observation/form-check
        self_obs_keywords = [
            "see me", "look at", "check", "correct", "my form", "my knee", "my back", 
            "am i doing", "is my", "are my", "how do i look", "check me", "my posture",
            "my hips", "my shoulders", "my elbows", "my knees", "knees right"
        ]
        if any(kw in q_lower for kw in self_obs_keywords):
            return "self_observation_form_check"
            
        # 3. Video-grounded
        video_keywords = ["say", "what did", "hear", "repeat", "next", "doing", "trainer"]
        if any(kw in q_lower for kw in video_keywords):
            return "video_grounded"
            
        return "general"

    def make_boundary_response(self, grounded_context: dict[str, Any]) -> str:
        curr_ex = grounded_context.get("current_exercise")
        ex_name = curr_ex["name"].lower() if (curr_ex and isinstance(curr_ex, dict) and curr_ex.get("name")) else None
        
        alt_text = "If you describe your body position or what you feel, I can offer general guidance."
        if ex_name:
            if "squat" in ex_name:
                alt_text = "Keep your knees tracking over your toes and weight on your heels. If you describe your position, I can check."
            elif "curl" in ex_name:
                alt_text = "Keep your elbows pinned close to your torso. If you describe your position, I can check."
                
        return f"I can't see or check your form right now. {alt_text}"

    def post_process_sanitize_response(self, request: QARequest, response: QAResponse, grounded_context: dict[str, Any]) -> QAResponse:
        pose_available = False
        pose_confidence = None
        if request.runtime_observation_context:
            pose_available = request.runtime_observation_context.pose_available
            pose_confidence = request.runtime_observation_context.pose_confidence

        # Treat low confidence (< 0.5) or missing confidence as unavailable
        if pose_available and (pose_confidence is None or (isinstance(pose_confidence, (int, float)) and pose_confidence < 0.5)):
            pose_available = False

        q_kind = self.classify_question(request.question)

        if q_kind == "safety_medical":
            response.answer_kind = "safety_boundary"
            medical_terms = ["diagnose", "tendonitis", "arthritis", "tear", "sprain", "fracture", "disease", "pathology", "meniscus"]
            if any(term in response.answer_text.lower() for term in medical_terms) or any(w in request.question.lower() for w in ["pain", "hurt", "dizzy", "chest", "discomfort", "ache", "injury"]):
                response.answer_text = "I cannot provide medical diagnoses. If you are experiencing pain or discomfort, please stop the exercise immediately, rest, and consult a medical professional."

        elif q_kind == "self_observation_form_check" and not pose_available:
            response.answer_kind = "self_observation_boundary"
            response.answer_text = self.make_boundary_response(grounded_context)

        elif not pose_available:
            # Check for unsafe vision claims regardless of question classification
            forbidden_claims = [
                "i can see you",
                "i see you",
                "i see your",
                "i can see your",
                "your knees look",
                "your back looks",
                "your form looks",
                "you are leaning",
                "your posture is",
                "your hips are",
                "your shoulders are",
            ]
            if any(claim in response.answer_text.lower() for claim in forbidden_claims):
                response.answer_kind = "self_observation_boundary"
                response.answer_text = self.make_boundary_response(grounded_context)

        # Sync backward compatibility fields
        response.text = response.answer_text
        return response

    def _answer_with_fallback(self, request: QARequest, grounded_context: dict[str, Any], fallback_reason: str) -> QAResponse:
        from app.services.assistant_qna_providers.prototype import PrototypeAssistantQnAProvider
        provider = PrototypeAssistantQnAProvider()
        
        response = provider.answer_question(request, grounded_context)
        response.fallback_reason = fallback_reason
        
        # Preserve original answer_kind if it is a specific semantic category, otherwise use fallback
        if response.answer_kind not in ["self_observation_boundary", "safety_boundary", "video_grounded", "general_guidance"]:
            response.answer_kind = "fallback"

        response.provider = "prototype"
        
        # Sanitize and sync fallback answer
        response = self.post_process_sanitize_response(request, response, grounded_context)
        
        # Save fallback diagnostics
        self._save_qna_diagnostics(
            request=request,
            response=response,
            grounded_context=grounded_context,
            fallback_reason=fallback_reason
        )
        return response

    def _save_qna_diagnostics(self, request: QARequest, response: QAResponse, grounded_context: dict[str, Any], fallback_reason: str | None) -> None:
        if not settings.AI_DIAGNOSTICS_ENABLED:
            return

        # Prepare context counts
        transcript_text = grounded_context.get("nearby_transcript") or ""
        context_counts = {
            "transcript_char_count": len(transcript_text),
            "nearby_trainer_instructions_count": len(grounded_context.get("nearby_trainer_instructions") or []),
            "recent_trainer_instruction_summaries_count": len(grounded_context.get("recent_trainer_instruction_summaries") or []),
            "nearby_exercises_count": len(grounded_context.get("nearby_exercises") or []),
        }

        # Developer logs must not include sensitive question text or full transcript transcripts.
        diagnostics_data = {
            "provider": response.provider,
            "model": response.model,
            "prompt_version": GEMINI_PROMPT_VERSION if response.provider == "gemini" else "prototype_v1",
            "schema_version": GEMINI_SCHEMA_VERSION if response.provider == "gemini" else "prototype_v1",
            "answer_kind": response.answer_kind,
            "fallback_reason": fallback_reason,
            "context_counts": context_counts,
            "question_length": len(request.question) if request.question else 0,
            "question_classification": self.classify_question(request.question) if request.question else "none",
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

        # Generate identifier and suffix
        session_or_video_id = str(request.session_id or request.video_id or "global")
        key_suffix = f"{int(datetime.now().timestamp())}_{uuid.uuid4()}"
        
        try:
            get_artifact_storage().save_qna_diagnostics(session_or_video_id, key_suffix, diagnostics_data)
            response.diagnostics_ref = f"qna_{session_or_video_id}_{key_suffix}"
            logger.info("Saved QnA AI diagnostics under ref: %s", response.diagnostics_ref)
        except Exception as exc:
            logger.warning("Failed to save QnA diagnostics: %s", exc)


qna_service = AssistantQnAService()
