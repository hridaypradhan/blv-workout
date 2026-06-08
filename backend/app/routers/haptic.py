"""Haptic and spatial assistance cue routes for FitA11y.

These routes control haptic sleeve hardware for delivering tactile
assistance cues (form correction vibrations, pacing pulses, spatial
guidance) alongside the embedded YouTube video playback.
"""

from typing import Any

from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    HapticPattern,
    HapticTestRequest,
    HapticTestResponse,
    HapticTriggerRequest,
    HapticTriggerResponse,
)
from app.prototype import haptic_provider

router = APIRouter()


@router.post("/test", response_model=HapticTestResponse)
async def run_haptic_test(payload: HapticTestRequest) -> HapticTestResponse:
    """Fire a test pulse on a specified haptic sleeve for calibration."""
    return haptic_provider.test_sleeve(payload.sleeve_side)


@router.post("/trigger", response_model=HapticTriggerResponse)
async def trigger_haptic_pattern(payload: HapticTriggerRequest) -> HapticTriggerResponse:
    """Trigger a specific haptic/spatial assistance cue pattern on one or more sleeves."""
    # Validate pattern name exists in the library
    if not haptic_provider.get_pattern(payload.pattern_name):
        raise HTTPException(
            status_code=400,
            detail=f"Pattern '{payload.pattern_name}' is not defined in the haptic library.",
        )
    # Validate sleeve sides list is not empty
    if not payload.sleeve_sides:
        raise HTTPException(
            status_code=400,
            detail="At least one sleeve side must be specified.",
        )
    # Validate intensity is in [0.0, 1.0] range
    if not (0.0 <= payload.intensity <= 1.0):
        raise HTTPException(
            status_code=400,
            detail="Intensity must be a float value between 0.0 and 1.0 inclusive.",
        )

    return haptic_provider.trigger_pattern(
        sleeve_sides=payload.sleeve_sides,
        pattern_name=payload.pattern_name,
        intensity=payload.intensity,
    )


@router.get("/patterns", response_model=dict[str, HapticPattern])
async def get_haptic_patterns() -> dict[str, HapticPattern]:
    """Return the available haptic/spatial assistance cue pattern library."""
    return haptic_provider.get_patterns()


