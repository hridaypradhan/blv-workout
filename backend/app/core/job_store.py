"""In-memory job store for the assistance preparation pipeline prototype."""

from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from app.models.schemas import ProcessingStage


@dataclass
class JobRecord:
    """Represents a single assistance preparation job.

    Each job tracks the preparation of a sidecar manifest for a YouTube
    video. No local video files are stored — the user watches the
    original embedded YouTube video directly.
    """

    video_id: str
    youtube_url: str
    stage: ProcessingStage = ProcessingStage.SUBMITTED
    error: Optional[str] = None
    youtube_id: Optional[str] = None
    title: Optional[str] = None
    channel_name: Optional[str] = None
    thumbnail_url: Optional[str] = None
    duration: Optional[float] = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        """Serialize the job record to a JSON-friendly dict."""
        return {
            "video_id": self.video_id,
            "youtube_url": self.youtube_url,
            "stage": self.stage.value,
            "error": self.error,
            "youtube_id": self.youtube_id,
            "title": self.title,
            "channel_name": self.channel_name,
            "thumbnail_url": self.thumbnail_url,
            "duration": self.duration,
            "created_at": self.created_at,
        }


class JobStore:
    """Thread-safe in-memory store for assistance preparation job records."""

    def __init__(self) -> None:
        self._jobs: dict[str, JobRecord] = {}
        self._lock = threading.Lock()

    def create_job(self, youtube_url: str) -> JobRecord:
        """Create a new job with a fresh UUID and SUBMITTED stage."""
        video_id = str(uuid.uuid4())
        job = JobRecord(video_id=video_id, youtube_url=youtube_url)
        with self._lock:
            self._jobs[video_id] = job
        return job

    def get_job(self, video_id: str) -> Optional[JobRecord]:
        """Look up a job by video_id. Returns None if not found."""
        with self._lock:
            return self._jobs.get(video_id)

    def update_stage(
        self,
        video_id: str,
        stage: ProcessingStage,
        *,
        error: Optional[str] = None,
        youtube_id: Optional[str] = None,
        title: Optional[str] = None,
        channel_name: Optional[str] = None,
        thumbnail_url: Optional[str] = None,
        duration: Optional[float] = None,
    ) -> None:
        """Update a job's stage and optional metadata fields."""
        with self._lock:
            job = self._jobs.get(video_id)
            if job is None:
                return
            job.stage = stage
            if error is not None:
                job.error = error
            if youtube_id is not None:
                job.youtube_id = youtube_id
            if title is not None:
                job.title = title
            if channel_name is not None:
                job.channel_name = channel_name
            if thumbnail_url is not None:
                job.thumbnail_url = thumbnail_url
            if duration is not None:
                job.duration = duration

    def delete_job(self, video_id: str) -> bool:
        """Remove a job record. Returns True if found and deleted."""
        with self._lock:
            job = self._jobs.pop(video_id, None)
        return job is not None

    def list_jobs(self) -> list[JobRecord]:
        """Return all jobs, newest first."""
        with self._lock:
            jobs = list(self._jobs.values())
        return sorted(jobs, key=lambda j: j.created_at, reverse=True)


# Module-level singleton
job_store = JobStore()
