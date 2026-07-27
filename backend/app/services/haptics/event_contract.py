# Canonical mapping of internal FitA11y cue types to neutral bHaptics event names.
# Does not use 'fita11y' in bHaptics event names.
CANONICAL_MAPPING = {
    "start": "assist_start",
    "finish": "assist_finish",
    "reps": "assist_reps",
    "speed_up": "assist_speed_up",
    "slow_down": "assist_slow_down",
}


DEPRECATED_TO_CANONICAL = {
    "per_rep_tick": "reps",
    "per_rep": "reps",
    "cooldown": "finish",
}

SUPPRESSED_CATEGORIES = {"countdown", "form_warning_above"}


def get_canonical_haptic_categories() -> set[str]:
    return set(CANONICAL_MAPPING.keys())


def normalize_haptic_category(cue_type: str | None) -> str | None:
    if not cue_type:
        return None
    if cue_type in SUPPRESSED_CATEGORIES:
        return None
    if cue_type in DEPRECATED_TO_CANONICAL:
        return DEPRECATED_TO_CANONICAL[cue_type]
    if cue_type in CANONICAL_MAPPING:
        return cue_type
    return None


def resolve_bhaptics_event(
    cue_type: str | None = None,
    vibration_id: str | None = None,
    explicit_bhaptics_event_name: str | None = None,
) -> str | None:
    """Resolve a neutral bHaptics event name using candidate ID, explicit event, or category fallback."""
    # 1. Manifest candidate lookup via vibration_id takes top priority if candidate exists
    if vibration_id:
        try:
            from app.services.haptics.manifest import get_manifest
            manifest = get_manifest()
            candidate = next((c for c in manifest if c.id == vibration_id), None)
            if candidate and candidate.bhaptics_event_name:
                return candidate.bhaptics_event_name
            if candidate and candidate.cue_type:
                mapped = CANONICAL_MAPPING.get(candidate.cue_type)
                if mapped:
                    return mapped
        except Exception:
            pass

    # 2. Explicit event name if supplied
    if explicit_bhaptics_event_name:
        return explicit_bhaptics_event_name

    # 3. Vibration ID prefix fallback if candidate wasn't found in manifest
    if vibration_id:
        for key in CANONICAL_MAPPING.keys():
            if vibration_id.startswith(f"{key}_"):
                return CANONICAL_MAPPING[key]

    # 4. Cue type category fallback
    if cue_type:
        if cue_type in SUPPRESSED_CATEGORIES:
            return None
        norm = normalize_haptic_category(cue_type)
        if norm:
            mapped = CANONICAL_MAPPING.get(norm)
            if mapped:
                return mapped

    # 5. Unknown cue type / neutral fallback
    return "assist_attention_double"


EVENT_MAP_DATA = [
    {
        "cue_type": "start",
        "bhaptics_event_name": "assist_start",
        "label": "Workout Start",
        "description": "Tactile vibration signifying the start of the workout or active phase."
    },
    {
        "cue_type": "finish",
        "bhaptics_event_name": "assist_finish",
        "label": "Workout Finish / Cooldown",
        "description": "Gentle pattern signifying workout completion."
    },
    {
        "cue_type": "reps",
        "bhaptics_event_name": "assist_reps",
        "label": "Repetition Guidance",
        "description": "Tactile pulse delivered on each completed repetition."
    },
    {
        "cue_type": "speed_up",
        "bhaptics_event_name": "assist_speed_up",
        "label": "Speed Up Guidance",
        "description": "Ascending tactile sweep indicating you should increase your movement speed."
    },
    {
        "cue_type": "slow_down",
        "bhaptics_event_name": "assist_slow_down",
        "label": "Slow Down Guidance",
        "description": "Descending tactile sweep indicating you should decrease your movement speed."
    }
]
