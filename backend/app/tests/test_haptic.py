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
from app.services.haptics.utils import sanitize_target_limbs
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
        self.assertNotIn("left_leg", devices)
        self.assertNotIn("right_leg", devices)
        
        left = devices["left_arm"]
        self.assertEqual(left["key"], "left_arm")
        self.assertEqual(left["position"], 1)
        self.assertIn("connected", left)
        self.assertIn("paired", left)
        self.assertIn("battery", left)
        self.assertIn("status_text", left)
        self.assertIn("source", left)

    def test_legacy_leg_targets_are_dropped(self):
        targets = sanitize_target_limbs(["left_arm", "left_leg", "right_leg", "right_arm"])
        self.assertEqual(targets, [HapticLimb.LEFT_ARM, HapticLimb.RIGHT_ARM])

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
            "cue_type": "reps"
        }
        response = self.client.post("/api/haptic/trigger", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "would_trigger")
        self.assertEqual(data["delivery_mode"], "dry_run")
        self.assertEqual(data["bhaptics_event_name"], "assist_reps")

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
                "metadata": {"bhaptics_event_name": "assist_finish"}
            },
            {
                "event_type": SessionEventNames.HAPTIC_CUE_FAILED,
                "timestamp_ms": 5100,
                "metadata": {"bhaptics_event_name": "assist_finish", "delivery_mode": "failed"}
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

if __name__ == "__main__":
    unittest.main()
