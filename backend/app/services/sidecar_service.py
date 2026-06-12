"""Sidecar manifest generation coordinator service for FitA11y."""

from __future__ import annotations

import logging
import uuid
from typing import Any

from app.core.config import settings
from app.models.schemas import AssistanceSidecarManifest
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
from app.services.sidecar_validator import validate_and_clamp_sidecar_manifest
from app.core.job_store import job_store, JobRecord

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
        manifest = validate_and_clamp_sidecar_manifest(
            manifest_dict=manifest_dict,
            video_duration=duration,
            youtube_id=youtube_id,
            video_uuid=video_uuid,
        )
        
        if manifest is not None:
            logger.info('Successfully validated and built sidecar manifest for %s', job.video_id)
            job_store.update_stage(
                job.video_id,
                job.stage,
                sidecar_provider=provider_name,
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
        
        manifest = validate_and_clamp_sidecar_manifest(
            manifest_dict=manifest_dict,
            video_duration=duration,
            youtube_id=youtube_id,
            video_uuid=video_uuid,
        )
        if manifest is None:
            # Absolute fallback if validator somehow fails (should not happen for prototype)
            from app.services.mock_manifest_service import build_deterministic_sidecar_manifest
            manifest = build_deterministic_sidecar_manifest(job)
            
        logger.info('Fallback prototype manifest built due to: %s', fallback_reason)
        return manifest


sidecar_service = SidecarService()


