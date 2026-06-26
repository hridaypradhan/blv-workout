"""Haptic and spatial assistance cue routes for FitA11y.

These routes control haptic sleeve hardware for delivering tactile
assistance cues (form correction vibrations, pacing pulses, spatial
guidance) alongside the embedded YouTube video playback.
"""

from typing import Any
from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    HapticTestRequest,
    HapticTestResponse,
    HapticTriggerRequest,
    HapticTriggerResponse,
    HapticVibrationCandidate,
    HapticStatusResponse,
    HapticEventMappingItem,
)
from app.services.haptics.manifest import get_pattern, get_manifest
from app.services.haptics.provider_factory import get_haptics_provider, reset_haptics_provider
from app.services.haptics.event_contract import resolve_bhaptics_event, EVENT_MAP_DATA

router = APIRouter()


@router.get("/event-map", response_model=list[HapticEventMappingItem])
async def get_haptic_event_map() -> list[HapticEventMappingItem]:
    """Return the canonical mapping of cue categories to neutral bHaptics event names."""
    return [HapticEventMappingItem(**item) for item in EVENT_MAP_DATA]


@router.post("/test", response_model=HapticTestResponse)
async def run_haptic_test(payload: HapticTestRequest) -> HapticTestResponse:
    """Fire a test pulse on a specified haptic sleeve for calibration."""
    provider = get_haptics_provider()
    return await provider.test_device(payload.sleeve_side)


@router.post("/trigger", response_model=HapticTriggerResponse)
async def trigger_haptic_pattern(payload: HapticTriggerRequest) -> HapticTriggerResponse:
    """Trigger a specific haptic/spatial assistance cue pattern on one or more sleeves/limbs."""
    # Validate pattern name exists in the library if provided
    if payload.pattern_name and not get_pattern(payload.pattern_name):
        raise HTTPException(
            status_code=400,
            detail=f"Pattern '{payload.pattern_name}' is not defined in the haptic library.",
        )
    # Validate that the trigger request is not completely empty
    if not (payload.sleeve_sides or payload.limbs or payload.cue_type or payload.vibration_id or payload.pattern_name or payload.bhaptics_event_name):
        raise HTTPException(
            status_code=400,
            detail="Trigger request must specify sleeve_sides, limbs, cue_type, vibration_id, pattern_name, or bhaptics_event_name.",
        )
    # Validate intensity is in [0.0, 1.0] range
    if not (0.0 <= payload.intensity <= 1.0):
        raise HTTPException(
            status_code=400,
            detail="Intensity must be a float value between 0.0 and 1.0 inclusive.",
        )

    # Resolve the neutral bHaptics event name
    event_name = resolve_bhaptics_event(
        cue_type=payload.cue_type,
        vibration_id=payload.vibration_id,
        explicit_bhaptics_event_name=payload.bhaptics_event_name,
    )

    provider = get_haptics_provider()
    return await provider.trigger_event(
        event_name=event_name,
        intensity=payload.intensity,
        sleeve_sides=payload.sleeve_sides,
        cue_type=payload.cue_type,
        vibration_id=payload.vibration_id,
        limbs=payload.limbs,
    )


@router.get("/vibrations", response_model=list[HapticVibrationCandidate])
async def get_haptic_vibrations() -> list[HapticVibrationCandidate]:
    """Return the list of all WAV vibration candidates in the manifest, enriched with resolved event names."""
    candidates = get_manifest()
    enriched = []
    for c in candidates:
        c_copy = c.model_copy()
        if not c_copy.bhaptics_event_name:
            c_copy.bhaptics_event_name = resolve_bhaptics_event(
                cue_type=c_copy.cue_type,
                vibration_id=c_copy.id
            )
        enriched.append(c_copy)
    return enriched


@router.get("/status", response_model=HapticStatusResponse)
async def get_haptic_status() -> HapticStatusResponse:
    """Return the runtime status of the haptic provider and connected devices."""
    provider = get_haptics_provider()
    status_data = await provider.get_status()
    return HapticStatusResponse(
        status=status_data.get("status", "error"),
        provider=status_data.get("provider", "unknown"),
        hardware_available=status_data.get("hardware_available", False),
        player_available=status_data.get("player_available", None),
        devices=status_data.get("devices") if isinstance(status_data.get("devices"), dict) else {},
        details=status_data
    )


@router.post("/refresh")
async def refresh_haptic_status() -> dict[str, Any]:
    """Force re-initialize/refresh the haptic provider connection."""
    reset_haptics_provider()
    provider = get_haptics_provider()
    status_data = await provider.get_status()
    return {
        "status": "refreshed",
        "provider_status": status_data
    }


@router.post("/ping")
async def ping_haptic() -> dict[str, Any]:
    """Simple ping-check to verify provider responsiveness."""
    provider = get_haptics_provider()
    status_data = await provider.get_status()
    return {
        "pong": True,
        "provider": status_data.get("provider", "unknown"),
        "status": status_data.get("status", "error")
    }
