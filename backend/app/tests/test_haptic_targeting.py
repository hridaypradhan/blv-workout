"""Focused bHaptics sleeve-targeting tests."""

import asyncio
import unittest
from unittest.mock import MagicMock

from app.models.schemas import SleeveSide
from app.services.haptics.bhaptics_provider import BHapticsProvider


class TestBHapticsTargeting(unittest.TestCase):
    def _make_provider(
        self, left_connected: bool, right_connected: bool
    ) -> BHapticsProvider:
        provider = BHapticsProvider("app", "key")
        provider._check_python_supported = MagicMock(return_value=True)
        mock_sdk = MagicMock()

        async def mock_reg(*args, **kwargs):
            return True

        async def mock_is_connected(position):
            if position == 1:
                return left_connected
            if position == 2:
                return right_connected
            return False

        async def mock_get_device_info():
            devices = []
            if left_connected:
                devices.append(
                    {"position": 1, "connected": True, "name": "Left Arm"}
                )
            if right_connected:
                devices.append(
                    {"position": 2, "connected": True, "name": "Right Arm"}
                )
            return {"devices": devices}

        async def mock_play(event, *args, **kwargs):
            return "req-ok"

        mock_sdk.registry_and_initialize = mock_reg
        mock_sdk.is_bhaptics_device_connected = mock_is_connected
        mock_sdk.get_device_info_json = mock_get_device_info
        mock_sdk.play_event = mock_play
        provider._sdk = mock_sdk
        return provider

    def test_left_target_without_left_device_uses_indicator(self):
        provider = self._make_provider(left_connected=False, right_connected=True)
        response = asyncio.run(
            provider.trigger_event(
                event_name="assist_start",
                intensity=0.5,
                sleeve_sides=[SleeveSide.LEFT],
            )
        )
        self.assertEqual(response.delivery_mode, "indicator")
        self.assertEqual(response.status, "would_trigger")
        self.assertFalse(response.hardware_available)
        self.assertTrue(response.player_available)
        self.assertIn("no connected sleeve is available", response.status_message)

    def test_right_target_without_right_device_uses_indicator(self):
        provider = self._make_provider(left_connected=True, right_connected=False)
        response = asyncio.run(
            provider.trigger_event(
                event_name="assist_reps",
                intensity=0.5,
                sleeve_sides=[SleeveSide.RIGHT],
            )
        )
        self.assertEqual(response.delivery_mode, "indicator")
        self.assertFalse(response.hardware_available)

    def test_left_target_with_both_devices_uses_hardware(self):
        provider = self._make_provider(left_connected=True, right_connected=True)
        response = asyncio.run(
            provider.trigger_event(
                event_name="assist_reps",
                intensity=0.7,
                sleeve_sides=[SleeveSide.LEFT],
            )
        )
        self.assertEqual(response.delivery_mode, "hardware")
        self.assertEqual(response.status, "triggered")
        self.assertEqual(response.request_id, "req-ok")

    def test_right_target_with_right_device_uses_hardware(self):
        provider = self._make_provider(left_connected=False, right_connected=True)
        response = asyncio.run(
            provider.trigger_event(
                event_name="assist_speed_up",
                intensity=0.6,
                sleeve_sides=[SleeveSide.RIGHT],
            )
        )
        self.assertEqual(response.delivery_mode, "hardware")
        self.assertEqual(response.status, "triggered")
        self.assertTrue(response.hardware_available)

    def test_both_target_with_one_device_uses_hardware(self):
        provider = self._make_provider(left_connected=True, right_connected=False)
        response = asyncio.run(
            provider.trigger_event(
                event_name="assist_slow_down",
                intensity=0.5,
                sleeve_sides=[SleeveSide.BOTH],
            )
        )
        self.assertEqual(response.delivery_mode, "hardware")
        self.assertEqual(response.status, "triggered")

    def test_default_target_without_devices_uses_indicator(self):
        provider = self._make_provider(left_connected=False, right_connected=False)
        response = asyncio.run(
            provider.trigger_event(
                event_name="assist_finish",
                intensity=0.5,
            )
        )
        self.assertEqual(response.delivery_mode, "indicator")
        self.assertFalse(response.hardware_available)


if __name__ == "__main__":
    unittest.main()
