"""Assistance preparation pipeline service for FitA11y.

Orchestrates the metadata and manifest preparation stages for imported videos.
"""

from __future__ import annotations

import logging
import time

from app.core.config import settings
from app.core.job_store import job_store
from app.models.schemas import ProcessingStage
from app.services.youtube_service import (
    YouTubeMetadataError,
    parse_youtube_id,
    fetch_youtube_metadata,
)
from app.services.transcript_service import get_youtube_transcript
from app.services.sidecar_service import sidecar_service
from app.services.sidecar_manifest_store import save_manifest_to_disk
from app.services.sidecar_providers.registry import provider_requires_transcript

logger = logging.getLogger(__name__)


def run_assistance_preparation(video_id: str, youtube_url: str) -> None:
    try:
        # Stage: fetching_metadata
        job_store.update_stage(video_id, ProcessingStage.FETCHING_METADATA)
        
        youtube_id = parse_youtube_id(youtube_url)
        metadata = fetch_youtube_metadata(youtube_url)
        
        job_store.update_stage(
            video_id,
            ProcessingStage.FETCHING_METADATA,
            youtube_id=youtube_id,
            title=metadata.get("title"),
            channel_name=metadata.get("channel_name"),
            thumbnail_url=metadata.get("thumbnail_url"),
            duration=metadata.get("duration"),
        )
        
        job = job_store.get_job(video_id)
        if not job:
            logger.error('Job %s not found in store, aborting preprocessing.', video_id)
            return
            
        # Stage: transcribing
        job_store.update_stage(video_id, ProcessingStage.TRANSCRIBING)
        
        segments = []
        full_transcript = ''
        caption_status = 'skipped_offline_prototype'
        
        if provider_requires_transcript(settings.AI_PROVIDER):
            segments, full_transcript, caption_status = get_youtube_transcript(youtube_url, video_id)
            job_store.update_stage(
                video_id,
                ProcessingStage.TRANSCRIBING,
                transcript=full_transcript,
                transcript_segments=segments,
                caption_status=caption_status,
            )
        else:
            job_store.update_stage(
                video_id,
                ProcessingStage.TRANSCRIBING,
                transcript='',
                caption_status='skipped_offline_prototype',
            )
            
        logger.info('Transcript acquisition status for %s: %s', video_id, caption_status)
        
        # NOTE: The intermediate sleeps below are deliberately introduced mock delay stages.
        # They satisfy the frontend's step-by-step UI loading progress indicator,
        # as Gemini/offline processing actually generates the manifest in a single step.
        
        # Stage: anchoring_timeline
        job_store.update_stage(video_id, ProcessingStage.ANCHORING_TIMELINE)
        time.sleep(0.5)
        
        # Stage: classifying_trainer_instructions
        job_store.update_stage(video_id, ProcessingStage.CLASSIFYING_TRAINER_INSTRUCTIONS)
        time.sleep(0.5)
        
        # Stage: analyzing_movement_windows
        job_store.update_stage(video_id, ProcessingStage.ANALYZING_MOVEMENT_WINDOWS)
        time.sleep(0.5)
        
        # Stage: generating_sidecar_manifest
        job_store.update_stage(video_id, ProcessingStage.GENERATING_SIDECAR_MANIFEST)
        
        job = job_store.get_job(video_id)
        manifest = sidecar_service.generate_sidecar(job, full_transcript, segments)
        save_manifest_to_disk(video_id, manifest)
        
        # Stage: completed
        job_store.update_stage(video_id, ProcessingStage.COMPLETED)
        logger.info('Assistance preparation completed for video %s', video_id)
        
    except YouTubeMetadataError as exc:
        logger.error('Assistance preparation failed for video %s: %s', video_id, exc)
        job_store.update_stage(
            video_id,
            ProcessingStage.FAILED,
            error=str(exc)
        )
    except Exception as exc:
        logger.exception('Unexpected error in assistance preparation for video %s', video_id)
        job_store.update_stage(
            video_id,
            ProcessingStage.FAILED,
            error=f"Unexpected error: {exc}"
        )
