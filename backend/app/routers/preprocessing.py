"""Preprocessing routes for FitA11y workout videos."""

from uuid import UUID

from fastapi import APIRouter

from app.models.schemas import Exercise, ProcessingStage, YouTubeURL

router = APIRouter()


@router.post("/submit", response_model=dict[str, UUID])
async def submit_video(payload: YouTubeURL) -> dict[str, UUID]:
    """Accept a YouTube URL and start the workout video processing pipeline."""
    raise NotImplementedError("TODO: implement")


@router.get("/status/{video_id}", response_model=ProcessingStage)
async def get_processing_status(video_id: UUID) -> ProcessingStage:
    """Return the current preprocessing stage for a submitted video."""
    raise NotImplementedError("TODO: implement")


@router.get("/manifest/{video_id}", response_model=list[Exercise])
async def get_exercise_manifest(video_id: UUID) -> list[Exercise]:
    """Return the full exercise manifest for a processed workout video."""
    raise NotImplementedError("TODO: implement")


@router.delete("/{video_id}", response_model=dict[str, str])
async def delete_processed_video(video_id: UUID) -> dict[str, str]:
    """Remove a processed video and its generated preprocessing artifacts."""
    raise NotImplementedError("TODO: implement")
