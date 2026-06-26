import uuid
import asyncio
import json
import sys
from typing import Any
from app.models.schemas import HapticTriggerResponse, HapticTestResponse, SleeveSide, HapticLimb
from app.services.haptics.base import BaseHapticsProvider
from app.services.haptics.utils import (
    check_python_supported,
    get_normalized_devices,
    is_any_target_connected,
    make_trigger_response,
)

class BHapticsProvider(BaseHapticsProvider):
    """bHaptics SDK-backed haptic feedback provider."""

    def __init__(self, app_id: str, api_key: str):
        self.app_id = app_id
        self.api_key = api_key
        self._sdk = None
        self._initialized = False
        self._init_lock = asyncio.Lock()
        self._init_error = None

    def _check_python_supported(self) -> bool:
        """Check if Python version is between 3.8 and 3.12 inclusive."""
        return check_python_supported()

    def _lazy_import(self):
        """Lazily imports the official SDK to prevent runtime crashes when unavailable."""
        if self._sdk is not None:
            return self._sdk
        import bhaptics_python
        self._sdk = bhaptics_python
        return self._sdk

    async def _ensure_initialized(self) -> bool:
        """Ensures registry_and_initialize has been called asynchronously."""
        if self._initialized:
            return True
        async with self._init_lock:
            if self._initialized:
                return True
            try:
                sdk = self._lazy_import()
                res = await sdk.registry_and_initialize(self.app_id, self.api_key, "")
                if not res:
                    self._init_error = "bHaptics Player is not running or connection failed."
                    return False
                self._initialized = True
                self._init_error = None
                return True
            except Exception as e:
                self._init_error = str(e)
                return False

    async def get_status(self) -> dict[str, Any]:
        if not self._check_python_supported():
            return {
                "status": "python_unsupported",
                "provider": "bhaptics",
                "hardware_available": False,
                "player_available": False,
                "devices": get_normalized_devices(False, False, {}),
            }

        sdk_available = True
        try:
            self._lazy_import()
        except (ImportError, ModuleNotFoundError):
            sdk_available = False

        if not sdk_available:
            return {
                "status": "sdk_unavailable",
                "provider": "bhaptics",
                "hardware_available": False,
                "player_available": False,
                "devices": get_normalized_devices(False, False, {}),
            }

        init_ok = await self._ensure_initialized()
        if not init_ok:
            return {
                "status": "player_unavailable",
                "provider": "bhaptics",
                "hardware_available": False,
                "player_available": False,
                "devices": get_normalized_devices(False, False, {}),
                "error_message": self._init_error
            }

        # SDK is initialized, get device info using get_device_info_json()
        try:
            device_info_json = await self._sdk.get_device_info_json()
            if isinstance(device_info_json, str):
                devices_data = json.loads(device_info_json)
            else:
                devices_data = device_info_json
        except Exception:
            devices_data = {}

        # Check connection status for Left (1) and Right (2) sleeves
        left_connected = False
        right_connected = False
        try:
            left_connected = await self._sdk.is_bhaptics_device_connected(1)
            right_connected = await self._sdk.is_bhaptics_device_connected(2)
        except Exception:
            if devices_data and "devices" in devices_data:
                for d in devices_data["devices"]:
                    pos = d.get("position")
                    conn = d.get("connected", False)
                    if pos == 1 and conn:
                        left_connected = True
                    elif pos == 2 and conn:
                        right_connected = True

        if left_connected and right_connected:
            status = "connected"
        elif left_connected or right_connected:
            status = "partially_connected"
        else:
            status = "initialized_no_devices"

        return {
            "status": status,
            "provider": "bhaptics",
            "hardware_available": left_connected or right_connected,
            "player_available": True,
            "devices": get_normalized_devices(left_connected, right_connected, devices_data),
            "left_sleeve_connected": left_connected,
            "right_sleeve_connected": right_connected
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
        if not self._check_python_supported():
            return make_trigger_response(
                status="would_trigger",
                intensity=intensity,
                cue_type=cue_type,
                vibration_id=vibration_id,
                event_name=event_name,
                delivery_mode="indicator",
                hardware_available=False,
                player_available=False,
                status_message="Python version not supported for bHaptics SDK. Haptic event mapped but not fired physically.",
            )

        try:
            self._lazy_import()
        except (ImportError, ModuleNotFoundError):
            return make_trigger_response(
                status="would_trigger",
                intensity=intensity,
                cue_type=cue_type,
                vibration_id=vibration_id,
                event_name=event_name,
                delivery_mode="indicator",
                hardware_available=False,
                player_available=False,
                status_message="bHaptics SDK is not installed or unavailable. Haptic event mapped but not fired physically.",
            )

        init_ok = await self._ensure_initialized()
        if not init_ok:
            return make_trigger_response(
                status="would_trigger",
                intensity=intensity,
                cue_type=cue_type,
                vibration_id=vibration_id,
                event_name=event_name,
                delivery_mode="indicator",
                hardware_available=False,
                player_available=False,
                status_message=f"bHaptics Player is offline or initialization failed: {self._init_error}. Haptic event mapped but not fired physically.",
            )

        status_info = await self.get_status()
        left_connected = status_info.get("left_sleeve_connected", False)
        right_connected = status_info.get("right_sleeve_connected", False)
        hardware_available = status_info.get("hardware_available", False)

        # Determine which sleeve sides are targeted
        targeted_left = False
        targeted_right = False

        if sleeve_sides:
            for side in sleeve_sides:
                if side in (SleeveSide.LEFT, SleeveSide.BOTH):
                    targeted_left = True
                if side in (SleeveSide.RIGHT, SleeveSide.BOTH):
                    targeted_right = True
        elif limbs and len(limbs) > 0:
            for limb in limbs:
                if limb.value.startswith("left"):
                    targeted_left = True
                elif limb.value.startswith("right"):
                    targeted_right = True
        else:
            # Default to both targeted if neither is specified
            targeted_left = True
            targeted_right = True

        target_limbs = limbs
        if not target_limbs:
            target_limbs = []
            if sleeve_sides:
                for side in sleeve_sides:
                    if side == SleeveSide.LEFT:
                        target_limbs.extend([HapticLimb.LEFT_ARM, HapticLimb.LEFT_LEG])
                    elif side == SleeveSide.RIGHT:
                        target_limbs.extend([HapticLimb.RIGHT_ARM, HapticLimb.RIGHT_LEG])
                    elif side == SleeveSide.BOTH:
                        target_limbs.extend([
                            HapticLimb.LEFT_ARM, HapticLimb.RIGHT_ARM,
                            HapticLimb.LEFT_LEG, HapticLimb.RIGHT_LEG
                        ])
        resolved_sleeve_sides = sleeve_sides or []

        # Hardware fires when at least one requested target is connected
        target_connected = (targeted_left and left_connected) or (targeted_right and right_connected)
        if not target_connected:
            return make_trigger_response(
                status="would_trigger",
                intensity=intensity,
                cue_type=cue_type,
                vibration_id=vibration_id,
                target_limbs=target_limbs,
                event_name=event_name,
                delivery_mode="indicator",
                hardware_available=False,
                player_available=True,
                status_message="bHaptics Player is available, but no connected sleeve is available to play this cue.",
            )

        request_id = "-1"
        try:
            request_id = await self._sdk.play_event(event_name)
            request_id_str = str(request_id)
        except Exception as e:
            return make_trigger_response(
                status="failed",
                intensity=intensity,
                cue_type=cue_type,
                vibration_id=vibration_id,
                event_name=event_name,
                delivery_mode="failed",
                hardware_available=hardware_available,
                player_available=True,
                status_message=f"bHaptics SDK play_event failed: {e}",
            )

        if request_id_str == "-1":
            return make_trigger_response(
                status="failed",
                intensity=intensity,
                cue_type=cue_type,
                vibration_id=vibration_id,
                event_name=event_name,
                delivery_mode="failed",
                hardware_available=hardware_available,
                player_available=True,
                status_message="bHaptics SDK play_event returned request ID -1 (failed).",
            )

        return make_trigger_response(
            status="triggered",
            intensity=intensity,
            cue_type=cue_type,
            vibration_id=vibration_id,
            target_limbs=target_limbs,
            event_name=event_name,
            delivery_mode="hardware",
            hardware_available=hardware_available,
            player_available=True,
            request_id=request_id_str,
            status_message=f"Haptic event {event_name} played on bHaptics hardware.",
        )

    async def test_device(self, sleeve_side: SleeveSide) -> HapticTestResponse:
        if not self._check_python_supported():
            return HapticTestResponse(
                success=True,
                sleeve_side=sleeve_side,
                message="Python version not supported for bHaptics SDK. Calibration test pulse simulated. No physical sleeve fired.",
                source="prototype",
                provider="bhaptics_dry_run",
                replace_with="haptic_hardware_provider",
            )
        try:
            self._lazy_import()
        except (ImportError, ModuleNotFoundError):
            return HapticTestResponse(
                success=True,
                sleeve_side=sleeve_side,
                message="bHaptics SDK is not installed or unavailable. Calibration test pulse simulated. No physical sleeve fired.",
                source="prototype",
                provider="bhaptics_dry_run",
                replace_with="haptic_hardware_provider",
            )

        status_info = await self.get_status()
        hardware_available = status_info.get("hardware_available", False)

        if not hardware_available:
            return HapticTestResponse(
                success=True,
                sleeve_side=sleeve_side,
                message=f"Calibration test pulse simulated on the {sleeve_side.value} sleeve. No physical sleeve fired (hardware unavailable).",
                source="prototype",
                provider="bhaptics_dry_run",
                replace_with="haptic_hardware_provider",
            )

        try:
            event_name = "assist_attention_double"
            await self._sdk.play_event(event_name)

            return HapticTestResponse(
                success=True,
                sleeve_side=sleeve_side,
                message=f"Calibration test pulse event {event_name} fired on the {sleeve_side.value} sleeve.",
                source="hardware",
                provider="bhaptics",
                replace_with="haptic_hardware_provider",
            )
        except Exception as e:
            return HapticTestResponse(
                success=False,
                sleeve_side=sleeve_side,
                message=f"bHaptics calibration test pulse failed to play: {e}. No physical sleeve fired.",
                source="hardware",
                provider="bhaptics",
                replace_with="haptic_hardware_provider",
            )
