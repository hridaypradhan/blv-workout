from abc import ABC, abstractmethod
from typing import Optional, List, Any
from uuid import UUID
from datetime import datetime

from app.models.schemas import (
    User,
    UserSettingsUpdate,
    Session,
    FormError,
    ProcessingStage,
    AssistanceSidecarManifest,
    TranscriptArtifact,
)
from app.models.cue_plan_schemas import CuePlan


class UserStorage(ABC):
    """Interface for user profile and accessibility settings storage."""

    @abstractmethod
    def register_user(self, user: User) -> User:
        """Register a new user profile."""
        pass

    @abstractmethod
    def get_user(self, user_id: UUID) -> Optional[User]:
        """Retrieve a user profile by ID."""
        pass

    @abstractmethod
    def update_user_settings(self, user_id: UUID, settings: UserSettingsUpdate) -> Optional[User]:
        """Update a user's settings."""
        pass


class JobStorage(ABC):
    """Interface for preprocessing job metadata storage."""

    @abstractmethod
    def create_job(self, youtube_url: str) -> Any:
        """Create a new preprocessing job."""
        pass

    @abstractmethod
    def get_job(self, video_id: str) -> Optional[Any]:
        """Retrieve a preprocessing job by video_id."""
        pass

    @abstractmethod
    def update_stage(self, video_id: str, stage: ProcessingStage, **kwargs) -> None:
        """Update a job's stage and metadata fields."""
        pass

    @abstractmethod
    def delete_job(self, video_id: str) -> bool:
        """Remove a preprocessing job by video_id."""
        pass

    @abstractmethod
    def list_jobs(self) -> List[Any]:
        """List all preprocessing jobs."""
        pass

    @abstractmethod
    def deduplicate_jobs(self) -> None:
        """Deduplicate jobs by youtube_id/normalized URL."""
        pass


class SessionStorage(ABC):
    """Interface for assisted playback session tracking."""

    @abstractmethod
    def create_session(
        self,
        user_id: UUID,
        video_id: UUID,
        video_title: Optional[str] = None
    ) -> Session:
        """Create a new assisted playback session."""
        pass

    @abstractmethod
    def get_session(self, session_id: UUID) -> Optional[Session]:
        """Retrieve an active or ended session by ID."""
        pass

    @abstractmethod
    def finalize_session(
        self,
        session_id: UUID,
        playback_events: List[Any],
        reps: List[Any],
        form_errors: List[Any],
        ended_at: Optional[datetime] = None
    ) -> bool:
        """Finalize the session, saving all event lists in batch and updating status & summary."""
        pass

    @abstractmethod
    def session_exists_and_active(self, session_id: UUID) -> bool:
        """Lightweight check to see if session exists and is not ended."""
        pass

    @abstractmethod
    def list_sessions(self, user_id: UUID, include_active: bool = False) -> List[Session]:
        """List all sessions for a user, sorted newest first."""
        pass


class GeneratedArtifactStorage(ABC):
    """Interface for storing and loading generated AI workout assets (manifests, cue plans)."""

    @abstractmethod
    def load_manifest(self, video_id: str) -> Optional[AssistanceSidecarManifest]:
        """Load sidecar manifest from persistence."""
        pass

    @abstractmethod
    def save_manifest(self, video_id: str, manifest: AssistanceSidecarManifest) -> None:
        """Save sidecar manifest to persistence."""
        pass

    @abstractmethod
    def delete_manifest(self, video_id: str) -> bool:
        """Delete sidecar manifest from persistence."""
        pass

    @abstractmethod
    def load_cue_plan(self, video_id: str) -> Optional[CuePlan]:
        """Load cue plan from persistence."""
        pass

    @abstractmethod
    def save_cue_plan(self, video_id: str, cue_plan: CuePlan) -> None:
        """Save cue plan to persistence."""
        pass

    @abstractmethod
    def delete_cue_plan(self, video_id: str) -> bool:
        """Delete cue plan from persistence."""
        pass

    @abstractmethod
    def load_sidecar_diagnostics(self, video_id: str) -> Optional[dict]:
        """Load sidecar diagnostics from persistence."""
        pass

    @abstractmethod
    def save_sidecar_diagnostics(self, video_id: str, diagnostics: dict) -> None:
        """Save sidecar diagnostics to persistence."""
        pass

    @abstractmethod
    def delete_sidecar_diagnostics(self, video_id: str) -> bool:
        """Delete sidecar diagnostics from persistence."""
        pass

    @abstractmethod
    def load_cue_plan_diagnostics(self, video_id: str) -> Optional[dict]:
        """Load cue plan diagnostics from persistence."""
        pass

    @abstractmethod
    def save_cue_plan_diagnostics(self, video_id: str, diagnostics: dict) -> None:
        """Save cue plan diagnostics to persistence."""
        pass

    @abstractmethod
    def delete_cue_plan_diagnostics(self, video_id: str) -> bool:
        """Delete cue plan diagnostics from persistence."""
        pass

    @abstractmethod
    def save_qna_diagnostics(self, session_or_video_id: str, key_suffix: str, diagnostics: dict) -> None:
        """Save QnA diagnostics report to persistence."""
        pass

    @abstractmethod
    def load_transcript(self, video_id: str) -> Optional[TranscriptArtifact]:
        """Load transcript artifact from persistence."""
        pass

    @abstractmethod
    def save_transcript(self, video_id: str, transcript_data: TranscriptArtifact) -> None:
        """Save transcript artifact to persistence."""
        pass

    @abstractmethod
    def delete_transcript(self, video_id: str) -> bool:
        """Delete transcript artifact from persistence."""
        pass

