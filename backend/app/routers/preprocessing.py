"""Preprocessing routes for FitA11y workout videos — F1.1 implementation."""

from __future__ import annotations

import asyncio
import json
import logging
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.core.job_store import job_store, JobRecord
from app.models.schemas import Exercise, ProcessingStage, YouTubeURL
from app.services.youtube_service import (
    AudioExtractionError,
    YouTubeDownloadError,
    download_video,
    extract_audio,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _run_import_pipeline(video_id: str, youtube_url: str) -> None:
    """Background task: download video, extract audio, update job state."""
    import_dir = settings.IMPORT_DIR

    try:
        # Stage: downloading
        job_store.update_stage(video_id, ProcessingStage.DOWNLOADING)

        result = download_video(youtube_url, video_id, import_dir)
        video_path = result["video_path"]
        title = result.get("title")
        duration = result.get("duration")

        job_store.update_stage(
            video_id,
            ProcessingStage.DOWNLOADING,
            video_path=video_path,
            title=title,
            duration=duration,
        )

        # Stage: transcribing (audio extraction in F1.1)
        job_store.update_stage(video_id, ProcessingStage.TRANSCRIBING)

        audio_path = extract_audio(video_path, import_dir, video_id)
        job_store.update_stage(
            video_id,
            ProcessingStage.TRANSCRIBING,
            audio_path=audio_path,
        )

        # Stage: completed
        job_store.update_stage(video_id, ProcessingStage.COMPLETED)
        logger.info("Import pipeline completed for video %s", video_id)

    except (YouTubeDownloadError, AudioExtractionError) as exc:
        logger.error("Import pipeline failed for video %s: %s", video_id, exc)
        job_store.update_stage(
            video_id, ProcessingStage.FAILED, error=str(exc)
        )
    except Exception as exc:
        logger.exception("Unexpected error in import pipeline for video %s", video_id)
        job_store.update_stage(
            video_id, ProcessingStage.FAILED, error=f"Unexpected error: {exc}"
        )


def _job_to_status_dict(job: JobRecord) -> dict:
    """Convert a JobRecord to the status response payload."""
    return {
        "video_id": job.video_id,
        "stage": job.stage.value,
        "error": job.error,
        "title": job.title,
        "duration": job.duration,
        "video_path": job.video_path,
        "audio_path": job.audio_path,
        "created_at": job.created_at,
    }


@router.post("/submit", response_model=dict)
async def submit_video(
    payload: YouTubeURL, background_tasks: BackgroundTasks
) -> dict:
    """Accept a YouTube URL and start the video import pipeline."""
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
    background_tasks.add_task(_run_import_pipeline, job.video_id, url_str)

    return {"video_id": job.video_id}


@router.get("/status/{video_id}")
async def get_processing_status(video_id: UUID) -> dict:
    """Return the current processing status for a submitted video."""
    job = job_store.get_job(str(video_id))
    if job is None:
        raise HTTPException(status_code=404, detail="Video not found.")
    return _job_to_status_dict(job)


@router.get("/events/{video_id}")
async def stream_events(video_id: UUID) -> StreamingResponse:
    """Server-Sent Events endpoint for real-time import status updates."""
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


@router.get("/manifest/{video_id}", response_model=list[Exercise])
async def get_exercise_manifest(video_id: UUID) -> list[Exercise]:
    """Return the full exercise manifest for a processed workout video.

    For F1.1, returns an empty list — exercise segmentation is not yet implemented.
    """
    job = job_store.get_job(str(video_id))
    if job is None:
        raise HTTPException(status_code=404, detail="Video not found.")
    return []


@router.delete("/{video_id}")
async def delete_processed_video(video_id: UUID) -> dict:
    """Remove a processed video and its generated preprocessing artifacts."""
    deleted = job_store.delete_job(str(video_id))
    if not deleted:
        raise HTTPException(status_code=404, detail="Video not found.")
    return {"status": "deleted", "video_id": str(video_id)}


@router.get("/jobs")
async def list_jobs() -> list[dict]:
    """List all import jobs (newest first). Used by the dashboard."""
    jobs = job_store.list_jobs()
    return [j.to_dict() for j in jobs]
