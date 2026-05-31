"""Haptic and spatial assistance cue routes for FitA11y.

These routes control haptic sleeve hardware for delivering tactile
assistance cues (form correction vibrations, pacing pulses, spatial
guidance) alongside the embedded YouTube video playback.
"""

from typing import Any

from fastapi import APIRouter, HTTPException

from app.models.schemas import HapticTestRequest, HapticTriggerRequest

router = APIRouter()


@router.post("/test", response_model=dict[str, bool])
async def run_haptic_test(payload: HapticTestRequest) -> dict[str, bool]:
    """Fire a test pulse on a specified haptic sleeve for calibration."""
    raise HTTPException(status_code=501, detail="Haptic sleeve test pulse triggering is not implemented yet.")


@router.post("/trigger", response_model=dict[str, str])
async def trigger_haptic_pattern(payload: HapticTriggerRequest) -> dict[str, str]:
    """Trigger a specific haptic/spatial assistance cue pattern on one or more sleeves."""
    raise HTTPException(status_code=501, detail="Haptic sleeve pattern triggering is not implemented yet.")


@router.get("/patterns", response_model=dict[str, dict[str, Any]])
async def get_haptic_patterns() -> dict[str, dict[str, Any]]:
    """Return the available haptic/spatial assistance cue pattern library."""
    raise HTTPException(status_code=501, detail="Retrieving haptic pattern library is not implemented yet.")

