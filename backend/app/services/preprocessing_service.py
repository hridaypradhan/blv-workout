"""Assistance preparation pipeline service for FitA11y.

Orchestrates the metadata and manifest preparation stages for imported videos.
"""

from __future__ import annotations

import logging
from app.core.job_store import job_store
from app.models.schemas import ProcessingStage
from app.services.youtube_service import (
    YouTubeMetadataError,
    parse_youtube_id,
    fetch_youtube_metadata,
)

logger = logging.getLogger(__name__)


def run_assistance_preparation(video_id: str, youtube_url: str) -> None:
    """Background task: fetch metadata, prepare sidecar manifest, update job state.

    At current maturity, this pipeline:
    1. Validates the YouTube URL and extracts the video ID
    2. Fetches YouTube metadata (oEmbed first, with temporary yt-dlp duration lookup)
    3. Stores metadata in the job record
    4. Marks the job completed after metadata/stub stages, and the manifest endpoint
       returns deterministic prototype sidecar data.

    Future stages (TODO - AI sidecar generation is still TODO):
    - Transcribe trainer audio (Whisper)
    - Anchor exercise timeline (Gemini)
    - Classify trainer instruction events (Gemini)
    - Analyze expected movement windows (MediaPipe)
    - Generate full sidecar manifest using AI models
    """

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

        # Stage: transcribing (TODO: Whisper/caption analysis)
        job_store.update_stage(video_id, ProcessingStage.TRANSCRIBING)
        # TODO: Extract transcript from captions or transient audio

        # Stage: anchoring_timeline (TODO: Gemini exercise segmentation)
        job_store.update_stage(video_id, ProcessingStage.ANCHORING_TIMELINE)
        # TODO: generate_exercise_timeline_anchors()

        # Stage: classifying_trainer_instructions (TODO: Gemini classification)
        job_store.update_stage(video_id, ProcessingStage.CLASSIFYING_TRAINER_INSTRUCTIONS)
        # TODO: classify_trainer_instruction_events()

        # Stage: analyzing_movement_windows (TODO: MediaPipe analysis)
        job_store.update_stage(video_id, ProcessingStage.ANALYZING_MOVEMENT_WINDOWS)
        # TODO: Analyze expected movement windows for sidecar

        # Stage: generating_sidecar_manifest
        job_store.update_stage(video_id, ProcessingStage.GENERATING_SIDECAR_MANIFEST)
        # TODO: Assemble full AssistanceSidecarManifest

        # Stage: completed
        job_store.update_stage(video_id, ProcessingStage.COMPLETED)
        logger.info("Assistance preparation completed for video %s", video_id)

    except YouTubeMetadataError as exc:
        logger.error("Assistance preparation failed for video %s: %s", video_id, exc)
        job_store.update_stage(
            video_id, ProcessingStage.FAILED, error=str(exc)
        )
    except Exception as exc:
        logger.exception("Unexpected error in assistance preparation for video %s", video_id)
        job_store.update_stage(
            video_id, ProcessingStage.FAILED, error=f"Unexpected error: {exc}"
        )
