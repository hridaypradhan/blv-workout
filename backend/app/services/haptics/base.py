from abc import ABC, abstractmethod
from typing import Any
from app.models.schemas import HapticTriggerResponse, HapticTestResponse, SleeveSide, HapticLimb

class BaseHapticsProvider(ABC):
    """Abstract base class for all haptic feedback providers."""

    @abstractmethod
    async def get_status(self) -> dict[str, Any]:
        """Return status information for the provider and devices."""
        pass

    @abstractmethod
    async def trigger_event(
        self,
        event_name: str,
        intensity: float = 0.5,
        sleeve_sides: list[SleeveSide] | None = None,
        cue_type: str | None = None,
        vibration_id: str | None = None,
        limbs: list[HapticLimb] | None = None,
    ) -> HapticTriggerResponse:
        """Trigger a haptic vibration event."""
        pass

    @abstractmethod
    async def test_device(self, sleeve_side: SleeveSide) -> HapticTestResponse:
        """Fire a calibration test pulse on the given side."""
        pass
