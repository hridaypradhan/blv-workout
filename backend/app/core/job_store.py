"""In-memory job store for the assistance preparation pipeline prototype."""

from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, Any

UNSET: Any = object()

from app.models.schemas import ProcessingStage
from app.core.prototype_persistence import load_json_store, save_json_store
from app.core.storage.interfaces import JobStorage


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
    transcript: Optional[str] = None
    sidecar_provider: Optional[str] = None
    sidecar_fallback_reason: Optional[str] = None
    cue_plan_provider: Optional[str] = None
    cue_plan_fallback_reason: Optional[str] = None
    caption_status: Optional[str] = None
    transcript_segments: Optional[list[dict]] = None
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
            "transcript": self.transcript,
            "sidecar_provider": self.sidecar_provider,
            "sidecar_fallback_reason": self.sidecar_fallback_reason,
            "cue_plan_provider": self.cue_plan_provider,
            "cue_plan_fallback_reason": self.cue_plan_fallback_reason,
            "caption_status": self.caption_status,
            "transcript_segments": self.transcript_segments,
            "created_at": self.created_at,
        }


def normalize_youtube_url(url: str) -> str:
    """Normalize YouTube URL to a standard format for comparison."""
    if not url:
        return ""
    url = url.strip()
    if "://" in url:
        url = url.split("://", 1)[1]
    if url.startswith("www."):
        url = url[4:]
    return url.lower()


def is_legitimate_job(job: JobRecord) -> bool:
    """Filter out jobs that are clearly not legitimate user-prepared videos."""
    # Always reject malformed records with invalid created_at.
    try:
        created_dt = datetime.fromisoformat(job.created_at)
        if created_dt.tzinfo is None:
            created_dt = created_dt.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        age_seconds = (now - created_dt).total_seconds()
    except Exception:
        # If timestamp parsing fails, filter out
        return False

    # Check for recent user-facing failures (e.g. invalid URL errors)
    if job.stage == ProcessingStage.FAILED:
        if not job.error:
            return False
        err_msg = job.error.lower()
        # Reject internal/code-error failed jobs immediately
        if (
            "unexpected keyword argument" in err_msg
            or "typeerror" in err_msg
            or "attributeerror" in err_msg
            or "syntaxerror" in err_msg
        ):
            return False
        # Keep recent user-facing failed jobs for about 30 minutes if they have an actionable error.
        return age_seconds <= 30 * 60

    # Otherwise, apply strict validation for normal/in-progress/completed jobs:
    # Reject missing/blank youtube_id for normal non-failed jobs.
    if not job.youtube_id or not job.youtube_id.strip():
        return False

    # Reject non-11-character youtube_id for normal non-failed jobs.
    if len(job.youtube_id.strip()) != 11:
        return False

    # Reject missing/blank title for normal completed jobs.
    if job.stage == ProcessingStage.COMPLETED:
        if not job.title or not job.title.strip():
            return False

    # Reject known test/placeholder titles
    if job.title:
        title_clean = job.title.strip()
        if title_clean in ("Test Workout", "Untitled Video"):
            return False

    # Invalid YouTube URLs
    if "youtube.com" not in job.youtube_url and "youtu.be" not in job.youtube_url:
        return False

    # Filter stale submitted jobs older than 10 minutes.
    if job.stage == ProcessingStage.SUBMITTED:
        if age_seconds > 10 * 60:
            return False

    # Filter stale in-progress jobs older than 30 minutes.
    elif job.stage not in (ProcessingStage.COMPLETED, ProcessingStage.FAILED):
        if age_seconds > 30 * 60:
            return False

    # Do NOT expire valid completed jobs just because they are older than 30 minutes.
    return True


class JobStore(JobStorage):
    """Thread-safe in-memory store for assistance preparation job records."""

    def __init__(self) -> None:
        self._jobs: dict[str, JobRecord] = {}
        self._lock = threading.Lock()
        self._load_from_disk()

    def _load_from_disk(self) -> None:
        """Load job records from local JSON store if enabled."""
        data = load_json_store("jobs.json")
        if data and isinstance(data, dict):
            with self._lock:
                changed = False
                for k, v in data.items():
                    try:
                        job = JobRecord(
                            video_id=v["video_id"],
                            youtube_url=v["youtube_url"],
                            stage=ProcessingStage(v["stage"]),
                            error=v.get("error"),
                            youtube_id=v.get("youtube_id"),
                            title=v.get("title"),
                            channel_name=v.get("channel_name"),
                            thumbnail_url=v.get("thumbnail_url"),
                            duration=v.get("duration"),
                            transcript=v.get("transcript"),
                            sidecar_provider=v.get("sidecar_provider"),
                            sidecar_fallback_reason=v.get("sidecar_fallback_reason"),
                            cue_plan_provider=v.get("cue_plan_provider"),
                            cue_plan_fallback_reason=v.get("cue_plan_fallback_reason"),
                            caption_status=v.get("caption_status"),
                            transcript_segments=v.get("transcript_segments"),
                            created_at=v.get("created_at"),
                        )
                        if is_legitimate_job(job):
                            self._jobs[k] = job
                        else:
                            changed = True
                    except Exception:
                        changed = True
                
                deduped = self._deduplicate_jobs_nolock()
                if changed or deduped:
                    self._save_to_disk()

    def _deduplicate_jobs_nolock(self) -> bool:
        """Groups jobs by youtube_id (or normalized URL) and keeps the best one. Assumes lock is held."""
        groups: dict[str, list[JobRecord]] = {}
        for job in self._jobs.values():
            key = job.youtube_id.strip() if (job.youtube_id and job.youtube_id.strip()) else normalize_youtube_url(job.youtube_url)
            groups.setdefault(key, []).append(job)
        
        new_jobs: dict[str, JobRecord] = {}
        changed = False
        
        for key, group in groups.items():
            if len(group) == 1:
                new_jobs[group[0].video_id] = group[0]
                continue
            
            # Deduplicate: find the best one
            # Priority: completed > recent in-progress > recent failed
            def get_priority(j: JobRecord) -> int:
                if j.stage == ProcessingStage.COMPLETED:
                    return 3
                elif j.stage != ProcessingStage.FAILED:
                    return 2
                else:
                    return 1
            
            # Sort group by priority descending, then created_at descending
            group.sort(key=lambda j: (get_priority(j), j.created_at), reverse=True)
            best_job = group[0]
            new_jobs[best_job.video_id] = best_job
            changed = True
            
        if changed:
            self._jobs = new_jobs
        return changed

    def deduplicate_jobs(self) -> None:
        """Deduplicate jobs by youtube_id (or normalized URL) and persist the cleaned store."""
        with self._lock:
            if self._deduplicate_jobs_nolock():
                self._save_to_disk()

    def _save_to_disk(self) -> None:
        """Save job records to local JSON store if enabled. Assumes lock is held."""
        data = {k: v.to_dict() for k, v in self._jobs.items()}
        save_json_store("jobs.json", data)

    def create_job(self, youtube_url: str) -> JobRecord:
        """Create a new job with a fresh UUID and SUBMITTED stage."""
        video_id = str(uuid.uuid4())
        job = JobRecord(video_id=video_id, youtube_url=youtube_url)
        with self._lock:
            self._jobs[video_id] = job
            self._save_to_disk()
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
        transcript: Optional[str] = UNSET,
        sidecar_provider: Optional[str] = UNSET,
        sidecar_fallback_reason: Optional[str] = UNSET,
        cue_plan_provider: Optional[str] = UNSET,
        cue_plan_fallback_reason: Optional[str] = UNSET,
        caption_status: Optional[str] = UNSET,
        transcript_segments: Optional[list[dict]] = UNSET,
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
            if transcript is not UNSET:
                job.transcript = transcript
            if sidecar_provider is not UNSET:
                job.sidecar_provider = sidecar_provider
            if sidecar_fallback_reason is not UNSET:
                job.sidecar_fallback_reason = sidecar_fallback_reason
            if cue_plan_provider is not UNSET:
                job.cue_plan_provider = cue_plan_provider
            if cue_plan_fallback_reason is not UNSET:
                job.cue_plan_fallback_reason = cue_plan_fallback_reason
            if caption_status is not UNSET:
                job.caption_status = caption_status
            if transcript_segments is not UNSET:
                job.transcript_segments = transcript_segments
            self._save_to_disk()

    def delete_job(self, video_id: str) -> bool:
        """Remove a job record. Returns True if found and deleted."""
        with self._lock:
            job = self._jobs.pop(video_id, None)
            if job is not None:
                self._save_to_disk()
        return job is not None

    def list_jobs(self) -> list[JobRecord]:
        """Return all legitimate, non-stale, deduped jobs, newest first."""
        with self._lock:
            original_len = len(self._jobs)
            self._jobs = {k: j for k, j in self._jobs.items() if is_legitimate_job(j)}
            filtered_len = len(self._jobs)
            
            deduped = self._deduplicate_jobs_nolock()
            if filtered_len != original_len or deduped:
                self._save_to_disk()
                
            jobs = list(self._jobs.values())
        return sorted(jobs, key=lambda j: j.created_at, reverse=True)


# Module-level singleton
job_store = JobStore()
