from typing import Optional
from app.core.config import settings
from app.core.storage.interfaces import (
    UserStorage,
    JobStorage,
    SessionStorage,
    GeneratedArtifactStorage,
)

_current_provider: Optional[str] = None
_user_storage: Optional[UserStorage] = None
_job_storage: Optional[JobStorage] = None
_session_storage: Optional[SessionStorage] = None
_artifact_storage: Optional[GeneratedArtifactStorage] = None


def _check_and_reset_cache() -> None:
    global _current_provider, _user_storage, _job_storage, _session_storage, _artifact_storage
    prov = settings.STORAGE_PROVIDER.lower()
    if _current_provider != prov:
        _current_provider = prov
        _user_storage = None
        _job_storage = None
        _session_storage = None
        _artifact_storage = None


def reset_storage_cache() -> None:
    """Clear all cached storage instances."""
    global _current_provider, _user_storage, _job_storage, _session_storage, _artifact_storage
    _current_provider = None
    _user_storage = None
    _job_storage = None
    _session_storage = None
    _artifact_storage = None


def get_user_storage() -> UserStorage:
    """Get the active UserStorage implementation."""
    _check_and_reset_cache()
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
    _check_and_reset_cache()
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
    _check_and_reset_cache()
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



def get_artifact_storage() -> GeneratedArtifactStorage:
    """Get the active GeneratedArtifactStorage implementation."""
    _check_and_reset_cache()
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
