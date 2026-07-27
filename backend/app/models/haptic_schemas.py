"""Canonical haptic schemas for the FitA11y backend.

This module is the sole source of truth for all haptic-related Pydantic models,
enums, and defaults. Other modules import from here or via the re-exports
in app.models.schemas.
"""

from typing import Any, Literal
from pydantic import BaseModel, Field, model_validator
from enum import Enum


CANONICAL_HAPTIC_CATEGORIES = frozenset(["start", "finish", "reps", "speed_up", "slow_down"])


class SleeveSide(str, Enum):
    """Sleeve body side identification."""

    LEFT = "left"
    RIGHT = "right"
    BOTH = "both"


class HapticLimb(str, Enum):
    """Body position targets for haptic vibration cues."""

    LEFT_ARM = "left_arm"
    RIGHT_ARM = "right_arm"
    LEFT_LEG = "left_leg"
    RIGHT_LEG = "right_leg"
    CHEST = "chest"
    BACK = "back"


DEFAULT_HAPTIC_CATEGORY_IDS = {
    "start": "start_high_01_v-09-11-4-3",
    "finish": "finish_high_01_v-09-10-12-2",
    "reps": "reps_high_01_v-09-16-1-43",
    "speed_up": "speed_up_high_01_v-09-10-3-52",
    "slow_down": "slow_down_high_01_v-09-11-3-54",
}


class HapticPreferences(BaseModel):
    """User preferences for preferred vibration pattern candidate per canonical category.

    Handles:
    - Legacy migration: per_rep_tick -> reps, cooldown -> finish
    - Removal of deprecated keys: countdown, form_warning_above, per_rep_tick, cooldown
    - Category-prefix validation
    - Manifest membership validation when available
    - Fallback to canonical defaults for invalid/missing/cross-category IDs
    """

    start: str = DEFAULT_HAPTIC_CATEGORY_IDS["start"]
    finish: str = DEFAULT_HAPTIC_CATEGORY_IDS["finish"]
    reps: str = DEFAULT_HAPTIC_CATEGORY_IDS["reps"]
    speed_up: str = DEFAULT_HAPTIC_CATEGORY_IDS["speed_up"]
    slow_down: str = DEFAULT_HAPTIC_CATEGORY_IDS["slow_down"]

    @model_validator(mode="before")
    @classmethod
    def _normalize_and_migrate(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        raw = dict(data)

        # Legacy key migration
        if "reps" not in raw and ("per_rep_tick" in raw or "per_rep" in raw):
            raw["reps"] = raw.get("per_rep_tick") or raw.get("per_rep")
        if "finish" not in raw and "cooldown" in raw:
            raw["finish"] = raw["cooldown"]

        # Remove deprecated keys
        for key in ("countdown", "form_warning_above", "per_rep_tick", "per_rep", "cooldown"):
            raw.pop(key, None)

        # Load manifest candidate IDs if available
        manifest_ids: set[str] | None = None
        try:
            from app.services.haptics.manifest import get_manifest
            candidates = get_manifest()
            if candidates:
                manifest_ids = {c.id for c in candidates}
        except Exception:
            pass

        defaults = DEFAULT_HAPTIC_CATEGORY_IDS
        normalized = {}
        for cat, default_id in defaults.items():
            val = raw.get(cat)
            # Must be a non-empty string
            if not val or not isinstance(val, str) or not val.strip():
                normalized[cat] = default_id
                continue
            # Must match category prefix
            if not val.startswith(f"{cat}_"):
                normalized[cat] = default_id
                continue
            # Must be in manifest if manifest is available
            if manifest_ids and val not in manifest_ids:
                normalized[cat] = default_id
                continue
            normalized[cat] = val

        return normalized


class HapticVibrationCandidate(BaseModel):
    """Individual haptic vibration configuration entry from the manifest."""

    id: str
    cue_type: str
    label: str
    source_wav: str
    filename: str
    duration_ms: float
    original_vibviz_id: str | None = None
    pleasantness_score: float | None = None
    pleasantness_band: str | None = None
    conversion_status: str = "raw_wav"
    bhaptics_event_name: str | None = None
    provider_notes: str | None = None


class HapticTestRequest(BaseModel):
    """Request body for firing a haptic sleeve test pulse."""

    sleeve_side: SleeveSide


class HapticTriggerRequest(BaseModel):
    """Request body for triggering a named haptic/spatial assistance cue pattern."""

    sleeve_sides: list[SleeveSide] | None = None
    pattern_name: str | None = None
    intensity: float
    cue_type: str | None = None
    vibration_id: str | None = None
    limbs: list[HapticLimb] | None = None
    bhaptics_event_name: str | None = None


class HapticPattern(BaseModel):
    """Available haptic pattern description with metadata."""

    name: str
    label: str
    purpose: str
    duration_ms: int
    pulse_count: int
    default_intensity: float
    replace_with: str = "haptic_hardware_provider"
    metadata: dict[str, Any] = Field(default_factory=dict)


class HapticTestResponse(BaseModel):
    """Response returned from a successful calibration/test pulse."""

    success: bool
    sleeve_side: SleeveSide
    message: str
    source: str = "prototype"
    provider: str = "bhaptics_dry_run"
    replace_with: str = "haptic_hardware_provider"


class HapticTriggerResponse(BaseModel):
    """Response returned from triggering a haptic pattern."""

    status: str
    pattern_name: str | None = None
    sleeve_sides: list[SleeveSide] | None = None
    intensity: float
    source: str = "prototype"
    provider: str = "bhaptics_dry_run"
    replace_with: str = "haptic_hardware_provider"
    cue_type: str | None = None
    selected_vibration_id: str | None = None
    selected_wav: str | None = None
    target_limbs: list[HapticLimb] | None = None
    bhaptics_event_name: str | None = None
    delivery_mode: (
        Literal["hardware", "indicator", "dry_run", "failed"] | None
    ) = None
    hardware_available: bool = False
    player_available: bool | None = None
    request_id: str | None = None
    status_message: str | None = None
    resolved_cue_type: str | None = None
    target_positions: list[str] | None = None


class HapticStatusResponse(BaseModel):
    """Response returned from checking haptic device connection status."""

    status: str
    provider: str
    hardware_available: bool
    player_available: bool | None = None
    devices: dict[str, Any] = Field(default_factory=dict)
    details: dict[str, Any] = Field(default_factory=dict)


class HapticEventMappingItem(BaseModel):
    """Canonical mapping item of cue category to neutral bHaptics event name."""

    cue_type: str
    bhaptics_event_name: str
    label: str
    description: str
