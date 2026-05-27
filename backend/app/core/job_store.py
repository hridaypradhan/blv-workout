"""In-memory job store for the F1.1 import pipeline prototype."""

from __future__ import annotations

import os
import shutil
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from app.models.schemas import ProcessingStage


@dataclass
class JobRecord:
    """Represents a single video import job."""

    video_id: str
    youtube_url: str
    stage: ProcessingStage = ProcessingStage.SUBMITTED
    error: Optional[str] = None
    video_path: Optional[str] = None
    audio_path: Optional[str] = None
    title: Optional[str] = None
    duration: Optional[float] = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        """Serialize the job record to a JSON-friendly dict."""
        return {
            "video_id": self.video_id,
            "youtube_url": self.youtube_url,
            "stage": self.stage.value,
            "error": self.error,
            "video_path": self.video_path,
            "audio_path": self.audio_path,
            "title": self.title,
            "duration": self.duration,
            "created_at": self.created_at,
        }


class JobStore:
    """Thread-safe in-memory store for import job records."""

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
        video_path: Optional[str] = None,
        audio_path: Optional[str] = None,
        title: Optional[str] = None,
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
            if video_path is not None:
                job.video_path = video_path
            if audio_path is not None:
                job.audio_path = audio_path
            if title is not None:
                job.title = title
            if duration is not None:
                job.duration = duration

    def delete_job(self, video_id: str) -> bool:
        """Remove a job and delete its associated files. Returns True if found."""
        with self._lock:
            job = self._jobs.pop(video_id, None)
        if job is None:
            return False
        # Clean up files
        for path in (job.video_path, job.audio_path):
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass
        return True

    def list_jobs(self) -> list[JobRecord]:
        """Return all jobs, newest first."""
        with self._lock:
            jobs = list(self._jobs.values())
        return sorted(jobs, key=lambda j: j.created_at, reverse=True)


# Module-level singleton
job_store = JobStore()
