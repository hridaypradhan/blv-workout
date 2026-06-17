from typing import Optional
from app.core.config import settings
from app.core.storage.interfaces import (
    UserStorage,
    JobStorage,
    SessionStorage,
    SessionEventStorage,
    GeneratedArtifactStorage,
)

_user_storage: Optional[UserStorage] = None
_job_storage: Optional[JobStorage] = None
_session_storage: Optional[SessionStorage] = None
_session_event_storage: Optional[SessionEventStorage] = None
_artifact_storage: Optional[GeneratedArtifactStorage] = None


def get_user_storage() -> UserStorage:
    """Get the active UserStorage implementation."""
    global _user_storage
    if _user_storage is not None:
        return _user_storage

    provider = settings.STORAGE_PROVIDER.lower()
    if provider == "local_json":
        from app.core.user_store import user_store
        _user_storage = user_store
    elif provider == "dynamodb":
        from app.core.storage.dynamodb import DynamoDBUserStorage
        _user_storage = DynamoDBUserStorage()
    else:
        raise ValueError(f"Unknown storage provider: {settings.STORAGE_PROVIDER}")
    return _user_storage


def get_job_storage() -> JobStorage:
    """Get the active JobStorage implementation."""
    global _job_storage
    if _job_storage is not None:
        return _job_storage

    provider = settings.STORAGE_PROVIDER.lower()
    if provider == "local_json":
        from app.core.job_store import job_store
        _job_storage = job_store
    elif provider == "dynamodb":
        from app.core.storage.dynamodb import DynamoDBJobStorage
        _job_storage = DynamoDBJobStorage()
    else:
        raise ValueError(f"Unknown storage provider: {settings.STORAGE_PROVIDER}")
    return _job_storage


def get_session_storage() -> SessionStorage:
    """Get the active SessionStorage implementation."""
    global _session_storage
    if _session_storage is not None:
        return _session_storage

    provider = settings.STORAGE_PROVIDER.lower()
    if provider == "local_json":
        from app.core.session_store import session_store
        _session_storage = session_store
    elif provider == "dynamodb":
        from app.core.storage.dynamodb import DynamoDBSessionStorage
        _session_storage = DynamoDBSessionStorage()
    else:
        raise ValueError(f"Unknown storage provider: {settings.STORAGE_PROVIDER}")
    return _session_storage


def get_session_event_storage() -> SessionEventStorage:
    """Get the active SessionEventStorage implementation."""
    global _session_event_storage
    if _session_event_storage is not None:
        return _session_event_storage

    provider = settings.STORAGE_PROVIDER.lower()
    if provider == "local_json":
        from app.core.session_store import session_store
        _session_event_storage = session_store
    elif provider == "dynamodb":
        from app.core.storage.dynamodb import DynamoDBSessionEventStorage
        _session_event_storage = DynamoDBSessionEventStorage()
    else:
        raise ValueError(f"Unknown storage provider: {settings.STORAGE_PROVIDER}")
    return _session_event_storage


def get_artifact_storage() -> GeneratedArtifactStorage:
    """Get the active GeneratedArtifactStorage implementation."""
    global _artifact_storage
    if _artifact_storage is not None:
        return _artifact_storage

    provider = settings.STORAGE_PROVIDER.lower()
    if provider == "local_json":
        from app.core.storage.local_json import LocalJsonGeneratedArtifactStorage
        _artifact_storage = LocalJsonGeneratedArtifactStorage()
    elif provider in ("dynamodb", "s3"):
        from app.core.storage.s3_artifacts import S3GeneratedArtifactStorage
        _artifact_storage = S3GeneratedArtifactStorage()
    else:
        raise ValueError(f"Unknown storage provider: {settings.STORAGE_PROVIDER}")
    return _artifact_storage
