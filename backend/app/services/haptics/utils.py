import sys
from typing import Any
from app.models.schemas import HapticTriggerResponse, SleeveSide, HapticLimb

def check_python_supported() -> bool:
    """Check if Python version is between 3.8 and 3.12 inclusive."""
    py_version = sys.version_info
    return (3, 8) <= (py_version.major, py_version.minor) <= (3, 12)

def get_normalized_devices(left_connected: bool, right_connected: bool, devices_data: dict[str, Any]) -> dict[str, Any]:
    # Exact real hardware mapping is uncertain until limbs are available.
    # We document mapping uncertainties briefly here:
    # Under standard bHaptics configurations, positions 1 & 2 correspond to left/right arms (sleeves),
    # while positions 3 & 4 correspond to left/right legs.
    left_arm_info = {}
    right_arm_info = {}
    left_leg_info = {}
    right_leg_info = {}

    if isinstance(devices_data, dict):
        for d in devices_data.get("devices", []):
            pos = d.get("position")
            if pos == 1:
                left_arm_info = d
            elif pos == 2:
                right_arm_info = d
            elif pos == 3:
                left_leg_info = d
            elif pos == 4:
                right_leg_info = d

    left_arm_connected = left_connected
    right_arm_connected = right_connected
    left_leg_connected = left_leg_info.get("connected", False)
    right_leg_connected = right_leg_info.get("connected", False)

    left_arm_battery = left_arm_info.get("battery") if left_arm_connected else None
    right_arm_battery = right_arm_info.get("battery") if right_arm_connected else None
    left_leg_battery = left_leg_info.get("battery") if left_leg_connected else None
    right_leg_battery = right_leg_info.get("battery") if right_leg_connected else None

    return {
        "left_arm": {
            "key": "left_arm",
            "name": left_arm_info.get("name", "Left Arm"),
            "position": 1,
            "connected": left_arm_connected,
            "paired": left_arm_connected,
            "battery": left_arm_battery,
            "status_text": "Connected" if left_arm_connected else "Disconnected",
            "source": "bhaptics"
        },
        "right_arm": {
            "key": "right_arm",
            "name": right_arm_info.get("name", "Right Arm"),
            "position": 2,
            "connected": right_arm_connected,
            "paired": right_arm_connected,
            "battery": right_arm_battery,
            "status_text": "Connected" if right_arm_connected else "Disconnected",
            "source": "bhaptics"
        },
        "left_leg": {
            "key": "left_leg",
            "name": left_leg_info.get("name", "Left Leg"),
            "position": 3,
            "connected": left_leg_connected,
            "paired": left_leg_connected,
            "battery": left_leg_battery,
            "status_text": "Connected" if left_leg_connected else "Disconnected",
            "source": "bhaptics"
        },
        "right_leg": {
            "key": "right_leg",
            "name": right_leg_info.get("name", "Right Leg"),
            "position": 4,
            "connected": right_leg_connected,
            "paired": right_leg_connected,
            "battery": right_leg_battery,
            "status_text": "Connected" if right_leg_connected else "Disconnected",
            "source": "bhaptics"
        }
    }

def is_any_target_connected(device_index: int, left_connected: bool, right_connected: bool) -> bool:
    if device_index == 1:
        return left_connected
    elif device_index == 2:
        return right_connected
    else:
        return left_connected or right_connected

def make_trigger_response(
    status: str,
    intensity: float,
    cue_type: str | None = None,
    vibration_id: str | None = None,
    target_limbs: list[HapticLimb] | None = None,
    event_name: str | None = None,
    delivery_mode: str | None = None,
    hardware_available: bool = False,
    player_available: bool | None = None,
    request_id: str | None = None,
    status_message: str | None = None,
) -> HapticTriggerResponse:
    return HapticTriggerResponse(
        status=status,
        intensity=intensity,
        source="hardware",
        provider="bhaptics",
        replace_with="haptic_hardware_provider",
        cue_type=cue_type,
        selected_vibration_id=vibration_id,
        target_limbs=target_limbs,
        bhaptics_event_name=event_name,
        delivery_mode=delivery_mode,
        hardware_available=hardware_available,
        player_available=player_available,
        request_id=request_id,
        status_message=status_message,
        resolved_cue_type=cue_type,
        target_positions=[limb.value for limb in target_limbs] if target_limbs else None
    )
