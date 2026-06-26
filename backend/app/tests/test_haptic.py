import unittest
import uuid
import sys
import asyncio
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.services.haptics import event_contract, provider_factory
from app.services.haptics.dry_run_provider import DryRunHapticsProvider
from app.services.haptics.bhaptics_provider import BHapticsProvider
from app.models.schemas import SleeveSide, HapticLimb
from app.core.config import settings

class TestHapticServicesAndRouter(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        # Reset factory singleton before each test
        provider_factory.reset_haptics_provider()
        self.original_enabled = settings.BHAPTICS_ENABLED
        self.original_app_id = settings.BHAPTICS_APP_ID
        self.original_api_key = settings.BHAPTICS_API_KEY
        self.original_provider = settings.BHAPTICS_PROVIDER

    def tearDown(self):
        # Restore configuration
        settings.BHAPTICS_ENABLED = self.original_enabled
        settings.BHAPTICS_APP_ID = self.original_app_id
        settings.BHAPTICS_API_KEY = self.original_api_key
        settings.BHAPTICS_PROVIDER = self.original_provider
        provider_factory.reset_haptics_provider()

    def test_canonical_mapping_resolution(self):
        # start -> assist_start
        self.assertEqual(event_contract.resolve_bhaptics_event(cue_type="start"), "assist_start")
        # countdown -> assist_countdown
        self.assertEqual(event_contract.resolve_bhaptics_event(cue_type="countdown"), "assist_countdown")
        # per_rep_tick -> assist_rep_tick
        self.assertEqual(event_contract.resolve_bhaptics_event(cue_type="per_rep_tick"), "assist_rep_tick")
        # speed_up -> assist_speed_up
        self.assertEqual(event_contract.resolve_bhaptics_event(cue_type="speed_up"), "assist_speed_up")
        # slow_down -> assist_slow_down
        self.assertEqual(event_contract.resolve_bhaptics_event(cue_type="slow_down"), "assist_slow_down")
        # form_warning_above -> assist_form_warning_high
        self.assertEqual(event_contract.resolve_bhaptics_event(cue_type="form_warning_above"), "assist_form_warning_high")
        # cooldown -> assist_cooldown
        self.assertEqual(event_contract.resolve_bhaptics_event(cue_type="cooldown"), "assist_cooldown")

    def test_explicit_event_name_preserved(self):
        self.assertEqual(
            event_contract.resolve_bhaptics_event(cue_type="start", explicit_bhaptics_event_name="my_explicit_event"),
            "my_explicit_event"
        )
        self.assertEqual(
            event_contract.resolve_bhaptics_event(explicit_bhaptics_event_name="my_explicit_event"),
            "my_explicit_event"
        )

    def test_unknown_cue_type_fallback(self):
        # Unknown cue type falls back to assist_attention_double
        self.assertEqual(event_contract.resolve_bhaptics_event(cue_type="nonexistent_cue"), "assist_attention_double")
        self.assertEqual(event_contract.resolve_bhaptics_event(), "assist_attention_double")

    def test_vibration_id_mapping(self):
        # Should parse start from vibration_id and resolve to assist_start
        self.assertEqual(event_contract.resolve_bhaptics_event(vibration_id="start_001"), "assist_start")
        self.assertEqual(event_contract.resolve_bhaptics_event(vibration_id="form_warning_above_005"), "assist_form_warning_high")
        # Unknown prefix in vibration_id should fallback to assist_attention_double
        self.assertEqual(event_contract.resolve_bhaptics_event(vibration_id="nonexistent_999"), "assist_attention_double")

    def test_event_contract_no_prototype_imports(self):
        # Pop from sys.modules if present to verify it is not loaded on resolution
        sys.modules.pop("app.prototype.haptic_provider", None)
        event_contract.resolve_bhaptics_event(vibration_id="start_001")
        self.assertNotIn("app.prototype.haptic_provider", sys.modules)

    def test_dry_run_provider_fallback_reasons(self):
        p1 = DryRunHapticsProvider(status="disabled")
        p2 = DryRunHapticsProvider(status="not_configured")
        p3 = DryRunHapticsProvider(status="sdk_unavailable")
        
        status1 = asyncio.run(p1.get_status())
        status2 = asyncio.run(p2.get_status())
        status3 = asyncio.run(p3.get_status())
        
        self.assertEqual(status1["status"], "disabled")
        self.assertEqual(status2["status"], "not_configured")
        self.assertEqual(status3["status"], "sdk_unavailable")

    def test_provider_factory_disabled(self):
        settings.BHAPTICS_ENABLED = False
        settings.BHAPTICS_PROVIDER = "auto"
        provider = provider_factory.get_haptics_provider()
        self.assertIsInstance(provider, DryRunHapticsProvider)
        status = asyncio.run(provider.get_status())
        self.assertEqual(status["status"], "disabled")

    def test_provider_factory_missing_config(self):
        settings.BHAPTICS_ENABLED = True
        settings.BHAPTICS_APP_ID = ""
        settings.BHAPTICS_API_KEY = "key"
        settings.BHAPTICS_PROVIDER = "auto"
        provider = provider_factory.get_haptics_provider()
        self.assertIsInstance(provider, DryRunHapticsProvider)
        status = asyncio.run(provider.get_status())
        self.assertEqual(status["status"], "not_configured")

    def test_provider_factory_sdk_import_failure(self):
        settings.BHAPTICS_ENABLED = True
        settings.BHAPTICS_APP_ID = "app"
        settings.BHAPTICS_API_KEY = "key"
        settings.BHAPTICS_PROVIDER = "bhaptics"

        # Force import failure of bhaptics_python using patch
        with patch.dict(sys.modules, {'bhaptics_python': None}):
            with patch.object(BHapticsProvider, '_check_python_supported', return_value=True):
                # Clear cache and fetch provider
                provider_factory.reset_haptics_provider()
                provider = provider_factory.get_haptics_provider()
                self.assertIsInstance(provider, BHapticsProvider)
                
                # Check that get_status reports sdk_unavailable gracefully
                status = asyncio.run(provider.get_status())
                self.assertEqual(status["status"], "sdk_unavailable")

    def test_registry_and_initialize_false_returns_failure(self):
        provider = BHapticsProvider("app", "key")
        mock_sdk = MagicMock()
        
        async def mock_reg(*args, **kwargs):
            return False
            
        mock_sdk.registry_and_initialize = mock_reg
        provider._sdk = mock_sdk
        
        init_ok = asyncio.run(provider._ensure_initialized())
        self.assertFalse(init_ok)
        self.assertFalse(provider._initialized)
        self.assertEqual(provider._init_error, "bHaptics Player is not running or connection failed.")

    def test_bhaptics_provider_no_devices_indicator_fallback(self):
        with patch.object(BHapticsProvider, '_check_python_supported', return_value=True):
            provider = BHapticsProvider("app", "key")
            mock_sdk = MagicMock()
            
            async def mock_reg(*args, **kwargs):
                return True
            
            async def mock_is_connected(pos):
                return False  # No devices connected
                
            async def mock_get_device_info():
                return {"devices": []}
                
            mock_sdk.registry_and_initialize = mock_reg
            mock_sdk.is_bhaptics_device_connected = mock_is_connected
            mock_sdk.get_device_info_json = mock_get_device_info
            mock_sdk.play_event = MagicMock()
            
            provider._sdk = mock_sdk
            
            # Trigger
            response = asyncio.run(provider.trigger_event(
                event_name="assist_start",
                intensity=0.5,
                sleeve_sides=[SleeveSide.LEFT]
            ))
            
            self.assertEqual(response.status, "would_trigger")
            self.assertEqual(response.delivery_mode, "indicator")
            self.assertEqual(response.provider, "bhaptics")
            self.assertFalse(response.hardware_available)
            self.assertTrue(response.player_available)
            self.assertEqual(response.bhaptics_event_name, "assist_start")
            self.assertIn("no connected sleeve is available", response.status_message)
            
            # Verify play_event was never called
            mock_sdk.play_event.assert_not_called()

    def test_api_status_endpoint(self):
        response = self.client.get("/api/haptic/status")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("status", data)
        self.assertIn("provider", data)
        self.assertIn("hardware_available", data)

    def test_api_status_normalized_slots(self):
        response = self.client.get("/api/haptic/status")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("devices", data)
        devices = data["devices"]
        self.assertIn("left_arm", devices)
        self.assertIn("right_arm", devices)
        self.assertIn("left_leg", devices)
        self.assertIn("right_leg", devices)
        
        left = devices["left_arm"]
        self.assertEqual(left["key"], "left_arm")
        self.assertEqual(left["position"], 1)
        self.assertIn("connected", left)
        self.assertIn("paired", left)
        self.assertIn("battery", left)
        self.assertIn("status_text", left)
        self.assertIn("source", left)

    def test_api_vibrations_endpoint(self):
        response = self.client.get("/api/haptic/vibrations")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, list)
        if len(data) > 0:
            for item in data:
                self.assertIsNotNone(item.get("bhaptics_event_name"))
                self.assertTrue(item.get("bhaptics_event_name").startswith("assist_"))

    def test_api_event_map_endpoint(self):
        response = self.client.get("/api/haptic/event-map")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, list)
        self.assertTrue(len(data) > 0)
        for item in data:
            self.assertIn("cue_type", item)
            self.assertIn("bhaptics_event_name", item)
            self.assertIn("label", item)
            self.assertIn("description", item)
            self.assertTrue(item["bhaptics_event_name"].startswith("assist_"))

    def test_api_ping_endpoint(self):
        response = self.client.post("/api/haptic/ping")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data.get("pong"))
        self.assertIn("provider", data)
        self.assertIn("status", data)

    def test_api_refresh_endpoint(self):
        response = self.client.post("/api/haptic/refresh")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("status"), "refreshed")
        self.assertIn("provider_status", data)

    def test_api_trigger_no_limbs_success(self):
        # Relaxed validation: check that a request with only cue_type succeeds without limbs/sleeves
        payload = {
            "intensity": 0.6,
            "cue_type": "per_rep_tick"
        }
        response = self.client.post("/api/haptic/trigger", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "would_trigger")
        self.assertEqual(data["delivery_mode"], "dry_run")
        self.assertEqual(data["bhaptics_event_name"], "assist_rep_tick")

    def test_api_trigger_explicit_event_name(self):
        payload = {
            "intensity": 0.8,
            "bhaptics_event_name": "assist_attention_long"
        }
        response = self.client.post("/api/haptic/trigger", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["bhaptics_event_name"], "assist_attention_long")

    def test_api_test_compatibility(self):
        payload = {
            "sleeve_side": "left"
        }
        response = self.client.post("/api/haptic/test", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["sleeve_side"], "left")
        self.assertIn("No physical sleeve fired", data["message"])

    def test_bhaptics_provider_python_unsupported_trigger(self):
        with patch.object(BHapticsProvider, '_check_python_supported', return_value=False):
            provider = BHapticsProvider("app", "key")
            response = asyncio.run(provider.trigger_event(
                event_name="assist_start",
                intensity=0.5
            ))
            self.assertEqual(response.status, "would_trigger")
            self.assertEqual(response.delivery_mode, "indicator")
            self.assertFalse(response.hardware_available)
            self.assertFalse(response.player_available)
            self.assertIn("Python version not supported", response.status_message)

    def test_bhaptics_provider_sdk_unavailable_trigger(self):
        with patch.object(BHapticsProvider, '_check_python_supported', return_value=True):
            with patch.object(BHapticsProvider, '_lazy_import', side_effect=ImportError("mock sdk missing")):
                provider = BHapticsProvider("app", "key")
                response = asyncio.run(provider.trigger_event(
                    event_name="assist_start",
                    intensity=0.5
                ))
                self.assertEqual(response.status, "would_trigger")
                self.assertEqual(response.delivery_mode, "indicator")
                self.assertFalse(response.hardware_available)
                self.assertFalse(response.player_available)
                self.assertIn("SDK is not installed or unavailable", response.status_message)

    def test_bhaptics_provider_player_unavailable_trigger(self):
        with patch.object(BHapticsProvider, '_check_python_supported', return_value=True):
            provider = BHapticsProvider("app", "key")
            mock_sdk = MagicMock()
            async def mock_reg(*args, **kwargs):
                return False
            mock_sdk.registry_and_initialize = mock_reg
            provider._sdk = mock_sdk
            
            response = asyncio.run(provider.trigger_event(
                event_name="assist_start",
                intensity=0.5
            ))
            self.assertEqual(response.status, "would_trigger")
            self.assertEqual(response.delivery_mode, "indicator")
            self.assertFalse(response.hardware_available)
            self.assertFalse(response.player_available)
            self.assertIn("Player is offline", response.status_message)

    def test_bhaptics_provider_play_event_no_index(self):
        with patch.object(BHapticsProvider, '_check_python_supported', return_value=True):
            provider = BHapticsProvider("app", "key")
            mock_sdk = MagicMock()
            async def mock_reg(*args, **kwargs):
                return True
            async def mock_is_connected(pos):
                return True
            async def mock_get_device_info():
                return {"devices": [{"position": 1, "connected": True, "name": "Left Sleeve"}]}
            
            # play_event mock
            async def mock_play(event, *args, **kwargs):
                # Ensure no index args are passed
                if len(args) > 0 or len(kwargs) > 0:
                    raise ValueError("play_event was called with extra arguments! Positional index assumptions violated.")
                return "12345"
            
            mock_sdk.registry_and_initialize = mock_reg
            mock_sdk.is_bhaptics_device_connected = mock_is_connected
            mock_sdk.get_device_info_json = mock_get_device_info
            mock_sdk.play_event = mock_play
            
            provider._sdk = mock_sdk
            
            # Even if we pass sleeve side RIGHT or LEFT, play_event should NOT be called with device index
            response = asyncio.run(provider.trigger_event(
                event_name="assist_start",
                intensity=0.5,
                sleeve_sides=[SleeveSide.LEFT]
            ))
            
            self.assertEqual(response.status, "triggered")
            self.assertEqual(response.delivery_mode, "hardware")
            self.assertEqual(response.request_id, "12345")

    def test_bhaptics_provider_test_unavailable_hardware(self):
        with patch.object(BHapticsProvider, '_check_python_supported', return_value=True):
            provider = BHapticsProvider("app", "key")
            mock_sdk = MagicMock()
            async def mock_reg(*args, **kwargs):
                return True
            async def mock_is_connected(pos):
                return False  # no hardware
            async def mock_get_device_info():
                return {"devices": []}
            
            mock_sdk.registry_and_initialize = mock_reg
            mock_sdk.is_bhaptics_device_connected = mock_is_connected
            mock_sdk.get_device_info_json = mock_get_device_info
            
            provider._sdk = mock_sdk
            
            response = asyncio.run(provider.test_device(sleeve_side=SleeveSide.LEFT))
            self.assertTrue(response.success)
            self.assertIn("No physical sleeve fired (hardware unavailable)", response.message)
            self.assertEqual(response.source, "prototype")

    def test_haptic_event_deduplication_and_summary_counts(self):
        from app.core.session_store import SessionStore, SessionEventNames
        
        store = SessionStore()
        user_id = uuid.uuid4()
        video_id = uuid.uuid4()
        session = store.create_session(user_id, video_id, "Test Deduplication Video")
        
        events = [
            {
                "event_type": SessionEventNames.HAPTIC_CUE_REQUESTED,
                "timestamp_ms": 1000,
                "metadata": {"cue_id": "cue_1", "bhaptics_event_name": "assist_start"}
            },
            {
                "event_type": SessionEventNames.HAPTIC_CUE_TRIGGERED,
                "timestamp_ms": 1100,
                "metadata": {"cue_id": "cue_1", "bhaptics_event_name": "assist_start", "delivery_mode": "hardware"}
            },
            {
                "event_type": SessionEventNames.HAPTIC_CUE_REQUESTED,
                "timestamp_ms": 5000,
                "metadata": {"bhaptics_event_name": "assist_countdown"}
            },
            {
                "event_type": SessionEventNames.HAPTIC_CUE_FAILED,
                "timestamp_ms": 5100,
                "metadata": {"bhaptics_event_name": "assist_countdown", "delivery_mode": "failed"}
            },
            {
                "event_type": SessionEventNames.HAPTIC_CUE_REQUESTED,
                "timestamp_ms": 10000,
                "metadata": {"bhaptics_event_name": "assist_speed_up"}
            },
            {
                "event_type": SessionEventNames.HAPTIC_CUE_TRIGGERED,
                "timestamp_ms": 15000,
                "metadata": {"bhaptics_event_name": "assist_slow_down", "delivery_mode": "indicator"}
            }
        ]
        
        success = store.finalize_session(
            session_id=session.id,
            playback_events=events,
            reps=[],
            form_errors=[]
        )
        
        self.assertTrue(success)
        finalized_session = store.get_session(session.id)
        self.assertIsNotNone(finalized_session)
        
        self.assertEqual(finalized_session.haptic_cues_count, 4)
        
        summary = finalized_session.summary
        self.assertIn("1 physical hardware cue", summary)
        self.assertIn("1 indicator cue", summary)
        self.assertIn("1 haptic cue failure", summary)
        
        with store._lock:
            store._sessions.pop(session.id, None)

    def _make_bhaptics_mock_provider(self, left_connected: bool, right_connected: bool) -> BHapticsProvider:
        """Helper: build an initialized BHapticsProvider with controlled device state."""
        provider = BHapticsProvider("app", "key")
        # Patch instance method directly so it stays active throughout the test
        provider._check_python_supported = MagicMock(return_value=True)
        mock_sdk = MagicMock()

        async def mock_reg(*args, **kwargs):
            return True

        async def mock_is_connected(pos):
            if pos == 1:
                return left_connected
            if pos == 2:
                return right_connected
            return False

        async def mock_get_device_info():
            devices = []
            if left_connected:
                devices.append({"position": 1, "connected": True, "name": "Left Arm"})
            if right_connected:
                devices.append({"position": 2, "connected": True, "name": "Right Arm"})
            return {"devices": devices}

        async def mock_play(event, *args, **kwargs):
            return "req-ok"

        mock_sdk.registry_and_initialize = mock_reg
        mock_sdk.is_bhaptics_device_connected = mock_is_connected
        mock_sdk.get_device_info_json = mock_get_device_info
        mock_sdk.play_event = mock_play
        provider._sdk = mock_sdk
        return provider


    def test_target_left_only_no_left_connected_gives_indicator(self):
        """Targeting left sleeve but only right is connected → indicator mode."""
        provider = self._make_bhaptics_mock_provider(left_connected=False, right_connected=True)
        response = asyncio.run(provider.trigger_event(
            event_name="assist_start",
            intensity=0.5,
            sleeve_sides=[SleeveSide.LEFT],
        ))
        self.assertEqual(response.delivery_mode, "indicator")
        self.assertEqual(response.status, "would_trigger")
        self.assertFalse(response.hardware_available)
        self.assertTrue(response.player_available)
        self.assertIn("no connected sleeve is available", response.status_message)

    def test_target_right_only_no_right_connected_gives_indicator(self):
        """Targeting right sleeve but only left is connected → indicator mode."""
        provider = self._make_bhaptics_mock_provider(left_connected=True, right_connected=False)
        response = asyncio.run(provider.trigger_event(
            event_name="assist_rep_tick",
            intensity=0.5,
            sleeve_sides=[SleeveSide.RIGHT],
        ))
        self.assertEqual(response.delivery_mode, "indicator")
        self.assertFalse(response.hardware_available)

    def test_target_left_both_connected_fires_hardware(self):
        """Targeting left sleeve and both are connected → hardware fires."""
        provider = self._make_bhaptics_mock_provider(left_connected=True, right_connected=True)
        response = asyncio.run(provider.trigger_event(
            event_name="assist_countdown",
            intensity=0.7,
            sleeve_sides=[SleeveSide.LEFT],
        ))
        self.assertEqual(response.delivery_mode, "hardware")
        self.assertEqual(response.status, "triggered")
        self.assertEqual(response.request_id, "req-ok")

    def test_target_right_only_connected_fires_hardware(self):
        """Targeting right sleeve and only right is connected → hardware fires."""
        provider = self._make_bhaptics_mock_provider(left_connected=False, right_connected=True)
        response = asyncio.run(provider.trigger_event(
            event_name="assist_speed_up",
            intensity=0.6,
            sleeve_sides=[SleeveSide.RIGHT],
        ))
        self.assertEqual(response.delivery_mode, "hardware")
        self.assertEqual(response.status, "triggered")
        self.assertTrue(response.hardware_available)

    def test_target_both_one_connected_fires_hardware(self):
        """Targeting both sleeves when only one is connected → hardware fires on available side."""
        provider = self._make_bhaptics_mock_provider(left_connected=True, right_connected=False)
        response = asyncio.run(provider.trigger_event(
            event_name="assist_slow_down",
            intensity=0.5,
            sleeve_sides=[SleeveSide.BOTH],
        ))
        # At least one target is connected, so hardware should fire
        self.assertEqual(response.delivery_mode, "hardware")
        self.assertEqual(response.status, "triggered")

    def test_target_default_no_devices_gives_indicator(self):
        """No sleeve_sides specified and no devices connected → indicator mode."""
        provider = self._make_bhaptics_mock_provider(left_connected=False, right_connected=False)
        response = asyncio.run(provider.trigger_event(
            event_name="assist_cooldown",
            intensity=0.5,
        ))
        # Default targets both; no connected devices → indicator
        self.assertEqual(response.delivery_mode, "indicator")
        self.assertFalse(response.hardware_available)


if __name__ == "__main__":
    unittest.main()
