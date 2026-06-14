"""Cue plan generation coordinator service for FitA11y."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from app.core.config import settings
from app.core.job_store import job_store, JobRecord
from app.models.cue_plan_schemas import CuePlan, CuePlanGenerationMetadata
from app.models.schemas import AssistanceSidecarManifest
from app.services.cue_plan_providers.base import CuePlanGenerationInput
from app.services.cue_plan_providers.registry import (
    normalize_provider_name,
    resolve_cue_plan_provider,
)
from app.services.ai.errors import (
    AIProviderError,
    AIProviderAPIError,
)
from app.services.cue_plan_providers.gemini_cue_plan.prompt import (
    PROMPT_VERSION as GEMINI_PROMPT_VERSION,
    SCHEMA_VERSION as GEMINI_SCHEMA_VERSION,
)
from app.services.cue_plan_providers.prototype import (
    PROMPT_VERSION as PROTOTYPE_PROMPT_VERSION,
    SCHEMA_VERSION as PROTOTYPE_SCHEMA_VERSION,
)
from app.services.cue_plan_validator import validate_and_clamp_cue_plan
from app.services.cue_plan_store import save_cue_plan_to_disk
from app.core.prototype_persistence import save_json_store

logger = logging.getLogger(__name__)


def sanitize_fallback_reason(reason: str | None) -> str | None:
    """Extracts only the high-level code/type to prevent leaking detailed error messages/API secrets."""
    if not reason:
        return None
    if ":" in reason:
        return reason.split(":", 1)[0].strip()
    return reason.strip()


class CuePlanService:
    """Orchestrates candidate cue plan generation according to settings and sidecar manifest data."""

    def generate_cue_plan(
        self,
        job: JobRecord,
        sidecar_manifest: AssistanceSidecarManifest,
    ) -> CuePlan:
        """Generates, validates, and persists a CuePlan for a prepared video.

        If Gemini is requested but fails or lacks API keys, falls back to prototype.
        """
        provider_name = settings.AI_PROVIDER
        resolved_name, provider = resolve_cue_plan_provider(provider_name)
        duration = job.duration or 600.0
        
        # 1. Unknown provider handling
        if resolved_name == "prototype" and normalize_provider_name(provider_name) != "prototype":
            job_store.update_stage(
                job.video_id,
                job.stage,
                cue_plan_provider="prototype",
                cue_plan_fallback_reason=f"unknown_provider: Cue plan provider '{provider_name}' not supported. Defaulting to prototype.",
            )
            return self._generate_prototype_fallback(job, sidecar_manifest, "unknown_provider")
            
        # 2. Missing Gemini API key check
        if resolved_name == "gemini" and not settings.GEMINI_API_KEY:
            logger.warning("AI_PROVIDER is 'gemini' but GEMINI_API_KEY is missing. Bypassing to prototype cue plan fallback.")
            job_store.update_stage(
                job.video_id,
                job.stage,
                cue_plan_provider="prototype",
                cue_plan_fallback_reason="api_key_missing: GEMINI_API_KEY is not configured",
            )
            return self._generate_prototype_fallback(job, sidecar_manifest, "api_key_missing")
            
        # 3. Construct provider input DTO
        input_data = CuePlanGenerationInput(
            video_id=job.video_id,
            youtube_id=job.youtube_id or "",
            duration_seconds=duration,
            sidecar_manifest=sidecar_manifest,
        )
        
        try:
            logger.info("Generating candidate cue plan for video %s using provider: %s", job.video_id, resolved_name)
            raw_dict = provider.generate_cue_plan(input_data)
        except AIProviderAPIError as exc:
            logger.warning("Gemini cue plan API call failed: %s. Falling back to prototype.", exc)
            job_store.update_stage(
                job.video_id,
                job.stage,
                cue_plan_provider="prototype",
                cue_plan_fallback_reason="model_error: API transport call failed",
            )
            return self._generate_prototype_fallback(job, sidecar_manifest, "model_error")
        except AIProviderError as exc:
            logger.warning("Gemini cue plan structured parsing failed: %s. Falling back to prototype.", exc)
            job_store.update_stage(
                job.video_id,
                job.stage,
                cue_plan_provider="prototype",
                cue_plan_fallback_reason=f"model_error: {exc}",
            )
            return self._generate_prototype_fallback(job, sidecar_manifest, "model_error")
        except Exception as exc:
            logger.warning("Unexpected error during Gemini cue plan generation: %s. Falling back to prototype.", exc)
            job_store.update_stage(
                job.video_id,
                job.stage,
                cue_plan_provider="prototype",
                cue_plan_fallback_reason="model_error: Unknown error occurred during execution",
            )
            return self._generate_prototype_fallback(job, sidecar_manifest, "model_error")
            
        # 4. Perform schema validation and safety clamping
        import uuid
        validation_result = validate_and_clamp_cue_plan(
            cue_plan_dict=raw_dict,
            video_duration_seconds=duration,
            video_uuid=uuid.UUID(job.video_id),
        )
        
        cue_plan = validation_result.cue_plan
        warnings = validation_result.warnings
        
        if cue_plan is not None:
            sidecar_meta = sidecar_manifest.generation_metadata
            metadata = CuePlanGenerationMetadata(
                provider="gemini" if resolved_name == "gemini" else "prototype",
                model=settings.GEMINI_MODEL if resolved_name == "gemini" else None,
                prompt_version=GEMINI_PROMPT_VERSION if resolved_name == "gemini" else PROTOTYPE_PROMPT_VERSION,
                schema_version=GEMINI_SCHEMA_VERSION if resolved_name == "gemini" else PROTOTYPE_SCHEMA_VERSION,
                source_sidecar_provider=sidecar_meta.provider if sidecar_meta else None,
                source_sidecar_prompt_version=sidecar_meta.prompt_version if sidecar_meta else None,
                source_sidecar_schema_version=sidecar_meta.schema_version if sidecar_meta else None,
                generated_at=datetime.now(timezone.utc),
                fallback_reason=None,
                validation_warning_count=len(warnings),
            )
            cue_plan.generation_metadata = metadata
            cue_plan.validation_warnings = warnings
            
            # Persist cue plan JSON
            save_cue_plan_to_disk(job.video_id, cue_plan)
            
            # Persist developer diagnostics JSON
            self._save_diagnostics(
                video_id=job.video_id,
                cue_plan=cue_plan,
                provider=metadata.provider,
                model=metadata.model,
                prompt_version=metadata.prompt_version,
                schema_version=metadata.schema_version,
                source_meta=sidecar_meta,
                fallback_reason=None,
                validation_warning_count=len(warnings),
            )
            
            job_store.update_stage(
                job.video_id,
                job.stage,
                cue_plan_provider=resolved_name,
                cue_plan_fallback_reason=None,
            )
            logger.info("Successfully validated and built CuePlan for video %s", job.video_id)
            return cue_plan
        else:
            logger.warning("CuePlan validation failed. Bypassing to prototype fallback.")
            job_store.update_stage(
                job.video_id,
                job.stage,
                cue_plan_provider="prototype",
                cue_plan_fallback_reason="validation_failed: Validator returned None",
            )
            return self._generate_prototype_fallback(job, sidecar_manifest, "validation_failed")

    def _generate_prototype_fallback(
        self,
        job: JobRecord,
        sidecar_manifest: AssistanceSidecarManifest,
        fallback_reason: str,
    ) -> CuePlan:
        from app.services.cue_plan_providers.prototype import PrototypeCuePlanProvider
        provider = PrototypeCuePlanProvider()
        duration = job.duration or 600.0
        
        input_data = CuePlanGenerationInput(
            video_id=job.video_id,
            youtube_id=job.youtube_id or "",
            duration_seconds=duration,
            sidecar_manifest=sidecar_manifest,
        )
        raw_dict = provider.generate_cue_plan(input_data)
        
        import uuid
        validation_result = validate_and_clamp_cue_plan(
            cue_plan_dict=raw_dict,
            video_duration_seconds=duration,
            video_uuid=uuid.UUID(job.video_id),
        )
        
        cue_plan = validation_result.cue_plan
        warnings = validation_result.warnings
        
        if cue_plan is None:
            # Absolute recovery model fallback in case validation completely breaks (should not happen)
            cue_plan = CuePlan(
                video_id=uuid.UUID(job.video_id),
                youtube_id=job.youtube_id,
                pre_session_overview="Deterministic recovery cue plan.",
            )
            warnings = []
            
        sidecar_meta = sidecar_manifest.generation_metadata
        metadata = CuePlanGenerationMetadata(
            provider="prototype",
            model=None,
            prompt_version=PROTOTYPE_PROMPT_VERSION,
            schema_version=PROTOTYPE_SCHEMA_VERSION,
            source_sidecar_provider=sidecar_meta.provider if sidecar_meta else None,
            source_sidecar_prompt_version=sidecar_meta.prompt_version if sidecar_meta else None,
            source_sidecar_schema_version=sidecar_meta.schema_version if sidecar_meta else None,
            generated_at=datetime.now(timezone.utc),
            fallback_reason=fallback_reason,
            validation_warning_count=len(warnings),
        )
        cue_plan.generation_metadata = metadata
        cue_plan.validation_warnings = warnings
        
        # Persist fallback cue plan
        save_cue_plan_to_disk(job.video_id, cue_plan)
        
        # Persist fallback developer diagnostics
        self._save_diagnostics(
            video_id=job.video_id,
            cue_plan=cue_plan,
            provider=metadata.provider,
            model=metadata.model,
            prompt_version=metadata.prompt_version,
            schema_version=metadata.schema_version,
            source_meta=sidecar_meta,
            fallback_reason=fallback_reason,
            validation_warning_count=len(warnings),
        )
        
        logger.info("Persisted prototype fallback cue plan for video %s due to: %s", job.video_id, fallback_reason)
        return cue_plan

    def _save_diagnostics(
        self,
        video_id: str,
        cue_plan: CuePlan,
        provider: str,
        model: str | None,
        prompt_version: str,
        schema_version: str,
        source_meta: Any | None,
        fallback_reason: str | None,
        validation_warning_count: int,
    ) -> None:
        """Saves a developer diagnostics JSON report under prototype data directory."""
        if not settings.AI_DIAGNOSTICS_ENABLED:
            return
            
        diagnostics_data = {
            "provider": provider,
            "model": model,
            "prompt_version": prompt_version,
            "schema_version": schema_version,
            "source_sidecar_provider": source_meta.provider if source_meta else None,
            "source_sidecar_prompt_version": source_meta.prompt_version if source_meta else None,
            "source_sidecar_schema_version": source_meta.schema_version if source_meta else None,
            "cue_candidate_count": len(cue_plan.cue_candidates),
            "exercise_description_count": len(cue_plan.exercise_descriptions),
            "trainer_instruction_summary_count": len(cue_plan.trainer_instruction_summaries),
            "validation_warning_count": validation_warning_count,
            "fallback_reason": sanitize_fallback_reason(fallback_reason),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
        
        save_json_store(f"ai_diagnostics/cue_plan_{video_id}.json", diagnostics_data)
        logger.info("Saved cue plan AI diagnostics summary for video %s", video_id)


cue_plan_service = CuePlanService()
