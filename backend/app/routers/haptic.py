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
)
from app.prototype import haptic_provider

router = APIRouter()


@router.post("/test", response_model=HapticTestResponse)
async def run_haptic_test(payload: HapticTestRequest) -> HapticTestResponse:
    """Fire a test pulse on a specified haptic sleeve for calibration."""
    return haptic_provider.test_sleeve(payload.sleeve_side)


@router.post("/trigger", response_model=HapticTriggerResponse)
async def trigger_haptic_pattern(payload: HapticTriggerRequest) -> HapticTriggerResponse:
    """Trigger a specific haptic/spatial assistance cue pattern on one or more sleeves/limbs."""
    # Validate pattern name exists in the library if provided
    if payload.pattern_name and not haptic_provider.get_pattern(payload.pattern_name):
        raise HTTPException(
            status_code=400,
            detail=f"Pattern '{payload.pattern_name}' is not defined in the haptic library.",
        )
    # Validate sleeve sides or limbs are not empty
    if not payload.sleeve_sides and not payload.limbs:
        raise HTTPException(
            status_code=400,
            detail="At least one sleeve side or target limb must be specified.",
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
        cue_type=payload.cue_type,
        vibration_id=payload.vibration_id,
        limbs=payload.limbs,
    )



@router.get("/vibrations", response_model=list[HapticVibrationCandidate])
async def get_haptic_vibrations() -> list[HapticVibrationCandidate]:
    """Return the list of all WAV vibration candidates in the manifest."""
    return haptic_provider.get_manifest()


