"""JSON-backed local persistence store for FitA11y cue plans."""

from __future__ import annotations

import logging
from typing import Optional

from app.core.prototype_persistence import load_json_store, save_json_store, delete_json_store
from app.models.cue_plan_schemas import CuePlan

logger = logging.getLogger(__name__)


def load_cue_plan_from_disk(video_id: str) -> Optional[CuePlan]:
    """Loads a prepared cue plan from the local disk JSON store."""
    try:
        data = load_json_store(f"cue_plans/{video_id}.json")
        if data:
            return CuePlan.model_validate(data)
        return None
    except Exception as e:
        logger.warning("Failed to load cue plan %s from disk: %s", video_id, e)
        return None


def save_cue_plan_to_disk(video_id: str, cue_plan: CuePlan) -> None:
    """Saves a prepared cue plan to the local disk JSON store."""
    try:
        save_json_store(f"cue_plans/{video_id}.json", cue_plan.model_dump(mode="json"))
        logger.info("Saved cue plan %s to disk persistence.", video_id)
    except Exception as e:
        logger.error("Failed to save cue plan %s to disk: %s", video_id, e)


def delete_cue_plan_from_disk(video_id: str) -> bool:
    """Removes a prepared cue plan JSON file from disk if it exists."""
    try:
        return delete_json_store(f"cue_plans/{video_id}.json")
    except Exception as e:
        logger.error("Failed to delete cue plan %s from disk: %s", video_id, e)
        return False
