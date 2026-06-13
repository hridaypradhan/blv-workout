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
from app.services.preprocessing_service import run_assistance_preparation
from app.services.sidecar_service import sidecar_service
from app.services.sidecar_manifest_store import load_manifest_from_disk, delete_manifest_from_disk
from app.core.prototype_persistence import delete_json_store

logger = logging.getLogger(__name__)
router = APIRouter()



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
        "sidecar_provider": job.sidecar_provider,
        "sidecar_fallback_reason": job.sidecar_fallback_reason,
        "caption_status": job.caption_status,
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
    background_tasks.add_task(run_assistance_preparation, job.video_id, url_str)

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
    """Return the assistance sidecar manifest for a prepared YouTube video."""
    job = job_store.get_job(str(video_id))
    if job is None:
        raise HTTPException(status_code=404, detail="Video not found.")

    # Try loading from disk persistence
    manifest = load_manifest_from_disk(str(video_id))
    if manifest:
        return manifest

    # Graceful fallback on-the-fly generation if not pre-persisted
    return sidecar_service.generate_sidecar(
        job,
        job.transcript or "",
        job.transcript_segments or []
    )


@router.get("/manifest/{video_id}/inspection", response_model=dict)
async def inspect_sidecar_manifest(video_id: UUID) -> dict:
    """Return a developer-mode quality inspection summary of the sidecar manifest.
    
    Excludes transcripts, prompts, and secrets/API keys to maintain security.
    """
    # Try loading from disk persistence
    manifest = load_manifest_from_disk(str(video_id))
    if manifest is None:
        raise HTTPException(status_code=404, detail="Sidecar manifest not found on disk.")

    job = job_store.get_job(str(video_id))

    # Calculate anchors timeline ordering sanity
    anchors_out_of_order_count = 0
    anchors_with_zero_duration_count = 0
    prev_start = -1.0
    for anchor in manifest.exercise_timeline_anchors:
        if anchor.start_time_seconds < prev_start:
            anchors_out_of_order_count += 1
        prev_start = anchor.start_time_seconds
        
        if anchor.end_time_seconds <= anchor.start_time_seconds:
            anchors_with_zero_duration_count += 1

    instruction_events_without_timestamps_count = sum(
        1 for e in manifest.trainer_instruction_events if e.timestamp_ms is None
    )
    
    speaking_windows_with_zero_duration_count = sum(
        1 for w in manifest.speaking_opportunity_map if w.end_ms <= w.start_ms
    )

    metadata = manifest.generation_metadata
    
    # Safely unpack metadata for inspection, filling defaults for old/unversioned manifests
    provider = metadata.provider if metadata else None
    model = metadata.model if metadata else None
    prompt_version = metadata.prompt_version if metadata else None
    schema_version = metadata.schema_version if metadata else None
    generated_at = metadata.generated_at if metadata else None
    caption_status = metadata.caption_status if metadata else ((job.caption_status or "unknown") if job else "unknown")
    fallback_reason = metadata.fallback_reason if metadata else (job.sidecar_fallback_reason if job else None)
    validation_warning_count = metadata.validation_warning_count if metadata else len(manifest.validation_warnings)

    warnings_preview = []
    for warning in manifest.validation_warnings[:10]:
        warnings_preview.append({
            "code": warning.code,
            "message": warning.message,
            "path": warning.path
        })

    duration_seconds = (job.duration if job else None) or (manifest.exercise_timeline_anchors[-1].end_time_seconds if manifest.exercise_timeline_anchors else None)

    return {
        "video_id": str(video_id),
        "youtube_id": manifest.youtube_id or (job.youtube_id if job else None),
        "provider": provider,
        "model": model,
        "prompt_version": prompt_version,
        "schema_version": schema_version,
        "caption_status": caption_status,
        "fallback_reason": fallback_reason,
        "generated_at": generated_at,
        "validation_warning_count": validation_warning_count,
        "counts": {
            "exercise_timeline_anchors": len(manifest.exercise_timeline_anchors),
            "trainer_instruction_events": len(manifest.trainer_instruction_events),
            "speaking_opportunity_windows": len(manifest.speaking_opportunity_map),
            "form_risk_templates": len(manifest.form_risk_templates),
            "haptic_spatial_cue_profiles": len(manifest.haptic_spatial_cue_profiles),
            "beat_timestamps": len(manifest.beat_timestamps),
            "expected_movement_windows": len(manifest.expected_movement_windows),
        },
        "basic_timeline_sanity": {
            "duration_seconds": duration_seconds,
            "anchors_out_of_order_count": anchors_out_of_order_count,
            "anchors_with_zero_duration_count": anchors_with_zero_duration_count,
            "instruction_events_without_timestamps_count": instruction_events_without_timestamps_count,
            "speaking_windows_with_zero_duration_count": speaking_windows_with_zero_duration_count,
        },
        "warnings_preview": warnings_preview
    }


@router.delete("/{video_id}")
async def delete_prepared_video(video_id: UUID) -> dict:
    """Remove a prepared video and its assistance artifacts."""
    deleted = job_store.delete_job(str(video_id))
    if not deleted:
        raise HTTPException(status_code=404, detail="Video not found.")
    
    # Attempt to delete the corresponding sidecar manifest file and diagnostics
    delete_manifest_from_disk(str(video_id))
    delete_json_store(f"ai_diagnostics/{video_id}.json")
    
    return {"status": "deleted", "video_id": str(video_id)}


@router.get("/jobs")
async def list_jobs() -> list[dict]:
    """List all assistance preparation jobs (newest first)."""
    jobs = job_store.list_jobs()
    return [j.to_dict() for j in jobs]
