"""Local JSON-backed prototype/demo persistence helper.

This module is designed for local prototype/demo persistence only and does NOT
represent a production database layer.
"""

import json
import logging
import os
from typing import Any, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


def _get_storage_path(filename: str) -> Optional[str]:
    """Get the path to the local storage file, if persistence is enabled."""
    if not settings.PROTOTYPE_PERSISTENCE_ENABLED:
        return None

    # Resolve relative to the backend directory
    # base_dir is the 'backend' folder
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    data_dir = os.path.join(base_dir, settings.PROTOTYPE_DATA_DIR)
    return os.path.join(data_dir, filename)


def load_json_store(filename: str) -> Optional[Any]:
    """Load JSON data from a file in the prototype data directory.

    This is for prototype/demo persistence only.
    If the file does not exist, is empty, or is corrupted, it logs a warning
    and returns None.
    """
    path = _get_storage_path(filename)
    if not path:
        return None

    if not os.path.exists(path):
        return None

    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read().strip()
            if not content:
                logger.warning(f"Prototype persistence file {filename} is empty.")
                return None
            return json.loads(content)
    except Exception as e:
        logger.warning(
            f"Failed to load prototype persistence file {filename} (corrupted or unreadable): {e}"
        )
        return None


def save_json_store(filename: str, data: Any) -> None:
    """Save data to a JSON file in the prototype data directory.

    This is for prototype/demo persistence only.
    """
    path = _get_storage_path(filename)
    if not path:
        return

    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        # Write to temporary file first and then rename to ensure atomic write
        temp_path = f"{path}.tmp"
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        # On Windows, os.replace replaces the file if it exists, unlike os.rename
        os.replace(temp_path, path)
    except Exception as e:
        logger.warning(f"Failed to save prototype persistence file {filename}: {e}")
