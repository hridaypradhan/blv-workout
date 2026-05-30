"""Assistance preparation routes for FitA11y — preparing sidecar manifests
for YouTube workout videos.

The assistance preparation pipeline fetches YouTube metadata, analyzes the
trainer's audio/video content, and produces an AssistanceSidecarManifest
that enables contextual, supplementary assistance during embedded playback.
The original YouTube video is never downloaded for local playback.
"""

from __future__ import annotations

import asyncio
import json
import logging
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.core.job_store import job_store, JobRecord
from app.models.schemas import AssistanceSidecarManifest, ProcessingStage, YouTubeURL
from app.services.youtube_service import (
    YouTubeMetadataError,
    fetch_youtube_metadata,
    parse_youtube_id,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _run_assistance_preparation(video_id: str, youtube_url: str) -> None:
    """Background task: fetch metadata, prepare sidecar manifest, update job state.

    At current maturity, this pipeline:
    1. Validates the YouTube URL and extracts the video ID
    2. Fetches YouTube metadata (stub/placeholder)
    3. Stores metadata in the job record
    4. Marks the job as completed with an empty sidecar manifest

    Future stages (TODO):
    - Transcribe trainer audio (Whisper)
    - Anchor exercise timeline (Gemini)
    - Classify trainer instruction events (Gemini)
    - Analyze expected movement windows (MediaPipe)
    - Generate full sidecar manifest
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


def _job_to_status_dict(job: JobRecord) -> dict:
    """Convert a JobRecord to the status response payload."""
    return {
        "video_id": job.video_id,
        "youtube_id": job.youtube_id,
        "stage": job.stage.value,
        "error": job.error,
        "title": job.title,
        "channel_name": job.channel_name,
        "thumbnail_url": job.thumbnail_url,
        "duration": job.duration,
        "created_at": job.created_at,
    }


@router.post("/submit", response_model=dict)
async def submit_video(
    payload: YouTubeURL, background_tasks: BackgroundTasks
) -> dict:
    """Accept a YouTube URL and start the assistance preparation pipeline."""
    url_str = str(payload.url)

    # Basic YouTube URL validation
    if not any(
        host in url_str
        for host in ("youtube.com", "youtu.be", "youtube-nocookie.com")
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid YouTube URL. Please provide a valid youtube.com or youtu.be link.",
        )

    job = job_store.create_job(url_str)
    background_tasks.add_task(_run_assistance_preparation, job.video_id, url_str)

    return {"video_id": job.video_id}


@router.get("/status/{video_id}")
async def get_processing_status(video_id: UUID) -> dict:
    """Return the current assistance preparation status for a submitted video."""
    job = job_store.get_job(str(video_id))
    if job is None:
        raise HTTPException(status_code=404, detail="Video not found.")
    return _job_to_status_dict(job)


@router.get("/events/{video_id}")
async def stream_events(video_id: UUID) -> StreamingResponse:
    """Server-Sent Events endpoint for real-time assistance preparation updates."""
    job = job_store.get_job(str(video_id))
    if job is None:
        raise HTTPException(status_code=404, detail="Video not found.")

    async def event_generator():
        vid = str(video_id)
        last_stage = None

        while True:
            job = job_store.get_job(vid)
            if job is None:
                # Job was deleted
                yield f"data: {json.dumps({'stage': 'deleted', 'error': 'Job was deleted'})}\n\n"
                break

            current_stage = job.stage
            payload = _job_to_status_dict(job)

            if current_stage != last_stage:
                # Stage changed — emit update event
                yield f"event: status\ndata: {json.dumps(payload)}\n\n"
                last_stage = current_stage

                if current_stage in (
                    ProcessingStage.COMPLETED,
                    ProcessingStage.FAILED,
                ):
                    break
            else:
                # Heartbeat to keep connection alive
                yield f": heartbeat\n\n"

            await asyncio.sleep(1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/manifest/{video_id}", response_model=AssistanceSidecarManifest)
async def get_sidecar_manifest(video_id: UUID) -> AssistanceSidecarManifest:
    """Return the assistance sidecar manifest for a prepared YouTube video.

    At current maturity, returns an empty manifest — full sidecar generation
    (exercise anchors, trainer events, movement windows) is not yet implemented.
    """
    job = job_store.get_job(str(video_id))
    if job is None:
        raise HTTPException(status_code=404, detail="Video not found.")
    return AssistanceSidecarManifest(
        video_id=UUID(job.video_id) if job.video_id else None,
        youtube_id=job.youtube_id,
    )


@router.delete("/{video_id}")
async def delete_prepared_video(video_id: UUID) -> dict:
    """Remove a prepared video and its assistance artifacts."""
    deleted = job_store.delete_job(str(video_id))
    if not deleted:
        raise HTTPException(status_code=404, detail="Video not found.")
    return {"status": "deleted", "video_id": str(video_id)}


@router.get("/jobs")
async def list_jobs() -> list[dict]:
    """List all assistance preparation jobs (newest first). Used by the dashboard."""
    jobs = job_store.list_jobs()
    return [j.to_dict() for j in jobs]
