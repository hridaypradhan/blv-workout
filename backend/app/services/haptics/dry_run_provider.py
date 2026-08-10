import uuid
from typing import Any
from app.models.schemas import HapticTriggerResponse, HapticTestResponse, SleeveSide, HapticLimb
from app.services.haptics.base import BaseHapticsProvider
from app.services.haptics.utils import sanitize_target_limbs

class DryRunHapticsProvider(BaseHapticsProvider):
    """Dry-run simulation haptic provider."""

    def __init__(self, status: str = "disabled"):
        self.status = status

    async def get_status(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "provider": "bhaptics_dry_run",
            "hardware_available": False,
            "player_available": None,
            "devices": {
                "left_arm": {
                    "key": "left_arm",
                    "name": "Left Arm",
                    "position": 1,
                    "connected": False,
                    "paired": False,
                    "battery": None,
                    "status_text": "Disconnected",
                    "source": "bhaptics"
                },
                "right_arm": {
                    "key": "right_arm",
                    "name": "Right Arm",
                    "position": 2,
                    "connected": False,
                    "paired": False,
                    "battery": None,
                    "status_text": "Disconnected",
                    "source": "bhaptics"
                }
            }
        }

    async def trigger_event(
        self,
        event_name: str,
        intensity: float = 0.5,
        sleeve_sides: list[SleeveSide] | None = None,
        cue_type: str | None = None,
        vibration_id: str | None = None,
        limbs: list[HapticLimb] | None = None,
    ) -> HapticTriggerResponse:
        sanitized_limbs = sanitize_target_limbs(limbs)
        target_limbs = sanitized_limbs if len(sanitized_limbs) > 0 else None

        if not target_limbs:
            target_limbs = []
            if sleeve_sides:
                for side in sleeve_sides:
                    if side == SleeveSide.LEFT:
                        target_limbs.append(HapticLimb.LEFT_ARM)
                    elif side == SleeveSide.RIGHT:
                        target_limbs.append(HapticLimb.RIGHT_ARM)
                    elif side == SleeveSide.BOTH:
                        target_limbs.extend([HapticLimb.LEFT_ARM, HapticLimb.RIGHT_ARM])

        resolved_sleeve_sides = sleeve_sides
        if not resolved_sleeve_sides:
            if target_limbs:
                sides = set()
                for limb in target_limbs:
                    if limb == HapticLimb.LEFT_ARM:
                        sides.add(SleeveSide.LEFT)
                    elif limb == HapticLimb.RIGHT_ARM:
                        sides.add(SleeveSide.RIGHT)
                resolved_sleeve_sides = list(sides)
                if len(resolved_sleeve_sides) == 2:
                    resolved_sleeve_sides = [SleeveSide.BOTH]
            if not resolved_sleeve_sides:
                resolved_sleeve_sides = [SleeveSide.BOTH]

        return HapticTriggerResponse(
            status="would_trigger",
            pattern_name="dry_run_pattern",
            sleeve_sides=resolved_sleeve_sides,
            intensity=intensity,
            source="prototype",
            provider="bhaptics_dry_run",
            replace_with="haptic_hardware_provider",
            cue_type=cue_type,
            selected_vibration_id=vibration_id,
            selected_wav=None,
            target_limbs=target_limbs,
            bhaptics_event_name=event_name,
            delivery_mode="dry_run",
            hardware_available=False,
            player_available=None,
            request_id=str(uuid.uuid4()),
            status_message=f"Haptic event {event_name} would fire in dry-run mode.",
            resolved_cue_type=cue_type,
            target_positions=[limb.value for limb in target_limbs] if target_limbs else None
        )

    async def test_device(self, sleeve_side: SleeveSide) -> HapticTestResponse:
        return HapticTestResponse(
            success=True,
            sleeve_side=sleeve_side,
            message=f"Dry-run calibration test pulse simulated on the {sleeve_side.value} sleeve. No physical sleeve fired.",
            source="prototype",
            provider="bhaptics_dry_run",
            replace_with="haptic_hardware_provider",
        )
