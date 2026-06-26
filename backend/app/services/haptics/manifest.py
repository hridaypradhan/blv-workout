import os
import json
from app.models.schemas import HapticVibrationCandidate, HapticPattern

HAPTIC_PATTERNS = {
    "double_pulse": HapticPattern(
        name="double_pulse",
        label="Double Pulse Nudge",
        purpose="General alert or minor form correction nudge",
        duration_ms=600,
        pulse_count=2,
        default_intensity=0.7,
        replace_with="haptic_hardware_provider",
    ),
    "single_long_pulse": HapticPattern(
        name="single_long_pulse",
        label="Single Long Pulse Alert",
        purpose="Warning or correction for sustained form deviation",
        duration_ms=1000,
        pulse_count=1,
        default_intensity=0.8,
        replace_with="haptic_hardware_provider",
    ),
    "continuous_vibe": HapticPattern(
        name="continuous_vibe",
        label="Continuous Vibration Feedback",
        purpose="Active pacing guidance matching the rep duration",
        duration_ms=2000,
        pulse_count=1,
        default_intensity=0.5,
        replace_with="haptic_hardware_provider",
    ),
    "short_success_pulse": HapticPattern(
        name="short_success_pulse",
        label="Short Success Pulse",
        purpose="Confirmation of a successfully completed rep",
        duration_ms=250,
        pulse_count=1,
        default_intensity=0.6,
        replace_with="haptic_hardware_provider",
    ),
    "left_spatial_hint": HapticPattern(
        name="left_spatial_hint",
        label="Left Spatial Hint",
        purpose="Directional nudge to adjust posture toward the left side",
        duration_ms=400,
        pulse_count=1,
        default_intensity=0.7,
        replace_with="haptic_hardware_provider",
    ),
    "right_spatial_hint": HapticPattern(
        name="right_spatial_hint",
        label="Right Spatial Hint",
        purpose="Directional nudge to adjust posture toward the right side",
        duration_ms=400,
        pulse_count=1,
        default_intensity=0.7,
        replace_with="haptic_hardware_provider",
    ),
}

def load_manifest() -> list[HapticVibrationCandidate]:
    """Locate and load the generated vibration manifest JSON file."""
    possible_paths = [
        # Relative to backend/
        "../frontend/public/haptics/manifest.json",
        # Relative to this file
        os.path.join(os.path.dirname(__file__), "../../../../frontend/public/haptics/manifest.json"),
    ]
    for path in possible_paths:
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    data = json.load(f)
                    return [HapticVibrationCandidate.model_validate(x) for x in data]
            except Exception as e:
                print(f"Error parsing haptic manifest at {path}: {e}")
    return []

_manifest_cache: list[HapticVibrationCandidate] = load_manifest()

def get_manifest() -> list[HapticVibrationCandidate]:
    """Return the list of all WAV vibration candidates in the manifest."""
    global _manifest_cache
    if not _manifest_cache:
        _manifest_cache = load_manifest()
    return _manifest_cache

def get_patterns() -> dict[str, HapticPattern]:
    """Return the complete library of available haptic patterns."""
    return HAPTIC_PATTERNS

def get_pattern(pattern_name: str) -> HapticPattern | None:
    """Look up a haptic pattern by name."""
    return HAPTIC_PATTERNS.get(pattern_name)
