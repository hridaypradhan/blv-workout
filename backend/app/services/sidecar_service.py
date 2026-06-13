"""Sidecar manifest generation coordinator service for FitA11y."""

from __future__ import annotations

import logging
import uuid
from typing import Any

from app.core.config import settings
from datetime import datetime, timezone
from app.models.schemas import AssistanceSidecarManifest, SidecarGenerationMetadata, SidecarValidationWarning
from app.services.sidecar_providers.base import SidecarGenerationInput
from app.services.sidecar_providers.prototype import PrototypeSidecarProvider
from app.services.sidecar_providers.registry import (
    normalize_provider_name,
    resolve_sidecar_provider,
)
from app.services.ai.errors import (
    AIProviderError,
    AIProviderAPIError,
)
from app.services.sidecar_providers.gemini_sidecar.prompt import PROMPT_VERSION as GEMINI_PROMPT_VERSION
from app.services.sidecar_providers.gemini_sidecar.schema import SCHEMA_VERSION as GEMINI_SCHEMA_VERSION
from app.services.sidecar_providers.prototype import (
    PROMPT_VERSION as PROTOTYPE_PROMPT_VERSION,
    SCHEMA_VERSION as PROTOTYPE_SCHEMA_VERSION,
)
from app.services.sidecar_validator import validate_and_clamp_sidecar_manifest_with_warnings
from app.core.job_store import job_store, JobRecord
from app.core.prototype_persistence import save_json_store

logger = logging.getLogger(__name__)


class SidecarService:
    """Orchestrates manifest generation according to system config (Gemini vs prototype)."""
    
    def generate_sidecar(
        self,
        job: JobRecord,
        transcript_text: str,
        transcript_segments: list[dict[str, Any]] | None = None,
    ) -> AssistanceSidecarManifest:
        provider_name = settings.AI_PROVIDER
        resolved_name, provider = resolve_sidecar_provider(provider_name)
        video_uuid = uuid.UUID(job.video_id)
        youtube_id = job.youtube_id or ''
        duration = job.duration or 600.0
        
        # 1. Handle unknown/unsupported provider names
        if resolved_name == 'prototype' and normalize_provider_name(provider_name) != 'prototype':
            job_store.update_stage(
                job.video_id,
                job.stage,
                sidecar_provider='prototype',
                sidecar_fallback_reason=f"unknown_provider: Provider '{provider_name}' is not supported. Defaulting to prototype.",
            )
            return self._generate_prototype_fallback(job, 'unknown_provider')
            
        # 2. Fallback check for missing Gemini API Key when Gemini is configured
        if resolved_name == 'gemini' and not settings.GEMINI_API_KEY:
            logger.warning("AI_PROVIDER is configured to 'gemini' but GEMINI_API_KEY is not set. Falling back to prototype.")
            job_store.update_stage(
                job.video_id,
                job.stage,
                sidecar_provider='prototype',
                sidecar_fallback_reason='api_key_missing: GEMINI_API_KEY is not configured',
            )
            return self._generate_prototype_fallback(job, 'api_key_missing: GEMINI_API_KEY is not configured')
            
        # 3. Fallback check for missing or empty transcript when Gemini is configured
        if resolved_name == 'gemini':
            cap_status = job.caption_status or ''
            if cap_status in ('captions_unavailable', 'transcript_generation_failed') or not transcript_text.strip():
                logger.warning('Captions unavailable or empty. Falling back to prototype.')
                job_store.update_stage(
                    job.video_id,
                    job.stage,
                    sidecar_provider='prototype',
                    sidecar_fallback_reason=f"captions_missing: Captions are unavailable or empty (status: {cap_status})"
                )
                return self._generate_prototype_fallback(job, f"captions_missing: Captions are unavailable or empty (status: {cap_status})")
        
        # 4. Construct input DTO
        input_data = SidecarGenerationInput(
            video_id=job.video_id,
            youtube_url=job.youtube_url,
            youtube_id=youtube_id,
            title=job.title or 'YouTube Video',
            channel_name=job.channel_name or 'Creator',
            duration_seconds=duration,
            transcript_text=transcript_text,
            transcript_segments=transcript_segments or [],
            caption_status=job.caption_status or '',
        )
        
        try:
            logger.info("Executing sidecar provider strategy for video: %s", job.video_id)
            manifest_dict = provider.generate_manifest(input_data)
        except AIProviderAPIError as exc:
            logger.warning('Gemini API call failed: %s. Falling back to prototype.', exc)
            job_store.update_stage(
                job.video_id,
                job.stage,
                sidecar_provider='prototype',
                sidecar_fallback_reason='model_error: The AI provider failed to generate a response',
            )
            return self._generate_prototype_fallback(job, 'model_error')
        except AIProviderError as exc:
            logger.warning('Gemini response mapping/parsing failed: %s. Falling back to prototype.', exc)
            job_store.update_stage(
                job.video_id,
                job.stage,
                sidecar_provider='prototype',
                sidecar_fallback_reason=f'model_error: {exc}',
            )
            return self._generate_prototype_fallback(job, 'model_error')
        except Exception as exc:
            logger.warning('Unknown error during sidecar generation: %s. Falling back to prototype.', exc)
            job_store.update_stage(
                job.video_id,
                job.stage,
                sidecar_provider='prototype',
                sidecar_fallback_reason='model_error: Unknown generation error occurred',
            )
            return self._generate_prototype_fallback(job, 'model_error')
            
        # 5. Perform verification and clamping
        validation_result = validate_and_clamp_sidecar_manifest_with_warnings(
            manifest_dict=manifest_dict,
            video_duration=duration,
            youtube_id=youtube_id,
            video_uuid=video_uuid,
        )
        manifest = validation_result.manifest
        warnings = validation_result.warnings
        
        if manifest is not None:
            if resolved_name == 'gemini':
                metadata = SidecarGenerationMetadata(
                    provider="gemini",
                    model=settings.GEMINI_MODEL,
                    prompt_version=GEMINI_PROMPT_VERSION,
                    schema_version=GEMINI_SCHEMA_VERSION,
                    generated_at=datetime.now(timezone.utc),
                    caption_status=job.caption_status,
                    fallback_reason=None,
                    validation_warning_count=len(warnings)
                )
            else:
                metadata = SidecarGenerationMetadata(
                    provider="prototype",
                    model=None,
                    prompt_version=PROTOTYPE_PROMPT_VERSION,
                    schema_version=PROTOTYPE_SCHEMA_VERSION,
                    generated_at=datetime.now(timezone.utc),
                    caption_status=job.caption_status or "skipped_offline_prototype",
                    fallback_reason=None,
                    validation_warning_count=len(warnings)
                )
            manifest.generation_metadata = metadata
            manifest.validation_warnings = warnings
            
            # Save developer diagnostics
            self._save_diagnostics(
                job=job,
                manifest=manifest,
                provider=metadata.provider,
                model=metadata.model,
                prompt_version=metadata.prompt_version,
                schema_version=metadata.schema_version,
                caption_status=metadata.caption_status,
                fallback_reason=None,
                warnings=warnings
            )
            
            logger.info('Successfully validated and built sidecar manifest for %s', job.video_id)
            job_store.update_stage(
                job.video_id,
                job.stage,
                sidecar_provider=resolved_name,
                sidecar_fallback_reason=None,
            )
            return manifest
        else:
            logger.warning('Manifest output failed validation/timestamp constraints. Falling back to prototype.')
            job_store.update_stage(
                job.video_id,
                job.stage,
                sidecar_provider='prototype',
                sidecar_fallback_reason='validation_failed: Generated manifest did not pass validation rules',
            )
            return self._generate_prototype_fallback(job, 'validation_failed')
            
    def _generate_prototype_fallback(self, job: JobRecord, fallback_reason: str) -> AssistanceSidecarManifest:
        provider = PrototypeSidecarProvider()
        input_data = SidecarGenerationInput(
            video_id=job.video_id,
            youtube_url=job.youtube_url,
            youtube_id=job.youtube_id or '',
            title=job.title or 'YouTube Video',
            channel_name=job.channel_name or 'Creator',
            duration_seconds=job.duration or 600.0,
            transcript_text="",
            transcript_segments=[],
            caption_status=job.caption_status or '',
        )
        manifest_dict = provider.generate_manifest(input_data)
        
        video_uuid = uuid.UUID(job.video_id)
        youtube_id = job.youtube_id or ''
        duration = job.duration or 600.0
        
        validation_result = validate_and_clamp_sidecar_manifest_with_warnings(
            manifest_dict=manifest_dict,
            video_duration=duration,
            youtube_id=youtube_id,
            video_uuid=video_uuid,
        )
        manifest = validation_result.manifest
        warnings = validation_result.warnings
        
        if manifest is None:
            # Absolute fallback if validator somehow fails (should not happen for prototype)
            from app.services.mock_manifest_service import build_deterministic_sidecar_manifest
            manifest = build_deterministic_sidecar_manifest(job)
            warnings = []
            
        metadata = SidecarGenerationMetadata(
            provider="prototype",
            model=None,
            prompt_version=PROTOTYPE_PROMPT_VERSION,
            schema_version=PROTOTYPE_SCHEMA_VERSION,
            generated_at=datetime.now(timezone.utc),
            caption_status=job.caption_status or "skipped_offline_prototype",
            fallback_reason=fallback_reason,
            validation_warning_count=len(warnings)
        )
        manifest.generation_metadata = metadata
        manifest.validation_warnings = warnings
        
        # Save developer diagnostics
        self._save_diagnostics(
            job=job,
            manifest=manifest,
            provider=metadata.provider,
            model=metadata.model,
            prompt_version=metadata.prompt_version,
            schema_version=metadata.schema_version,
            caption_status=metadata.caption_status,
            fallback_reason=fallback_reason,
            warnings=warnings
        )
        
        logger.info('Fallback prototype manifest built due to: %s', fallback_reason)
        return manifest

    def _save_diagnostics(
        self,
        job: JobRecord,
        manifest: AssistanceSidecarManifest,
        provider: str,
        model: str | None,
        prompt_version: str,
        schema_version: str,
        caption_status: str | None,
        fallback_reason: str | None = None,
        warnings: list[SidecarValidationWarning] | None = None
    ) -> None:
        """Saves a structured, developer-oriented diagnostics JSON summary file under the ignored prototype data directory."""
        if not settings.AI_DIAGNOSTICS_ENABLED:
            return

        # Sanitize fallback reason (only high-level code/type)
        sanitized_fallback = None
        if fallback_reason:
            if ":" in fallback_reason:
                sanitized_fallback = fallback_reason.split(":", 1)[0].strip()
            else:
                sanitized_fallback = fallback_reason.strip()

        # Sanity timeline counts
        anchors_out_of_order = 0
        prev_start = -1.0
        for anchor in manifest.exercise_timeline_anchors:
            if anchor.start_time_seconds < prev_start:
                anchors_out_of_order += 1
            prev_start = anchor.start_time_seconds

        anchors_with_zero_duration = sum(
            1 for a in manifest.exercise_timeline_anchors if a.end_time_seconds <= a.start_time_seconds
        )
        instruction_events_without_timestamps = sum(
            1 for e in manifest.trainer_instruction_events if e.timestamp_ms is None
        )
        speaking_windows_with_zero_duration = sum(
            1 for w in manifest.speaking_opportunity_map if w.end_ms <= w.start_ms
        )

        diagnostics_data = {
            "provider": provider,
            "model": model,
            "prompt_version": prompt_version,
            "schema_version": schema_version,
            "caption_status": caption_status,
            "fallback_reason": sanitized_fallback,
            "validation_warning_count": len(warnings) if warnings else 0,
            "manifest_counts": {
                "exercise_timeline_anchors": len(manifest.exercise_timeline_anchors),
                "trainer_instruction_events": len(manifest.trainer_instruction_events),
                "speaking_opportunity_windows": len(manifest.speaking_opportunity_map),
                "form_risk_templates": len(manifest.form_risk_templates),
                "haptic_spatial_cue_profiles": len(manifest.haptic_spatial_cue_profiles),
                "beat_timestamps": len(manifest.beat_timestamps),
                "expected_movement_windows": len(manifest.expected_movement_windows),
            },
            "timeline_sanity_counts": {
                "anchors_out_of_order": anchors_out_of_order,
                "anchors_with_zero_duration": anchors_with_zero_duration,
                "instruction_events_without_timestamps": instruction_events_without_timestamps,
                "speaking_windows_with_zero_duration": speaking_windows_with_zero_duration,
            },
            "generated_at": datetime.now(timezone.utc).isoformat()
        }

        save_json_store(f"ai_diagnostics/{job.video_id}.json", diagnostics_data)
        logger.info("Saved AI diagnostics summary to disk persistence for video %s", job.video_id)


sidecar_service = SidecarService()


