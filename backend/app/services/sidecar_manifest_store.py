"""Sidecar manifest persistence store for saving and loading JSON sidecars on disk."""

from __future__ import annotations

import os
import logging
from typing import Optional

from app.core.prototype_persistence import load_json_store, save_json_store, delete_json_store
from app.models.schemas import AssistanceSidecarManifest

logger = logging.getLogger(__name__)


def load_manifest_from_disk(video_id: str) -> Optional[AssistanceSidecarManifest]:
    """Loads a prepared sidecar manifest from the disk JSON store."""
    try:
        data = load_json_store(f"manifest_{video_id}.json")
        if data:
            return AssistanceSidecarManifest.model_validate(data)
        return None
    except Exception as e:
        logger.warning('Failed to load sidecar manifest %s from disk: %s', video_id, e)
        return None


def save_manifest_to_disk(video_id: str, manifest: AssistanceSidecarManifest) -> None:
    """Saves a prepared sidecar manifest to the disk JSON store."""
    try:
        save_json_store(f"manifest_{video_id}.json", manifest.model_dump(mode='json'))
        logger.info('Saved sidecar manifest %s to disk persistence.', video_id)
    except Exception as e:
        logger.error('Failed to save sidecar manifest %s to disk: %s', video_id, e)


def delete_manifest_from_disk(video_id: str) -> bool:
    """Removes a prepared sidecar manifest JSON file from disk if it exists."""
    try:
        return delete_json_store(f"manifest_{video_id}.json")
    except Exception as e:
        logger.error("Failed to delete sidecar manifest %s from disk: %s", video_id, e)
        return False
