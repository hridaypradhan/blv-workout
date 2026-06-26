# Canonical mapping of internal FitA11y cue types to neutral bHaptics event names.
# Does not use 'fita11y' in bHaptics event names.
CANONICAL_MAPPING = {
    "start": "assist_start",
    "countdown": "assist_countdown",
    "per_rep_tick": "assist_rep_tick",
    "rep_tick": "assist_rep_tick",
    "speed_up": "assist_speed_up",
    "slow_down": "assist_slow_down",
    "form_warning_above": "assist_form_warning_high",
    "form_warning_high": "assist_form_warning_high",
    "form_warning_left": "assist_form_warning_left",
    "form_warning_right": "assist_form_warning_right",
    "cooldown": "assist_cooldown",
    "success_tick": "assist_success_tick",
    "attention_double": "assist_attention_double",
    "attention_long": "assist_attention_long",
}


def resolve_bhaptics_event(
    cue_type: str | None = None,
    vibration_id: str | None = None,
    explicit_bhaptics_event_name: str | None = None,
) -> str:
    """Resolve a neutral bHaptics event name from cue type, vibration ID, or explicit name."""
    # 1. Explicit event name is preserved if provided
    if explicit_bhaptics_event_name:
        return explicit_bhaptics_event_name

    # 2. Try resolving via vibration_id
    if vibration_id:
        from app.services.haptics.manifest import get_manifest
        manifest = get_manifest()
        candidate = next((c for c in manifest if c.id == vibration_id), None)
        if candidate:
            if candidate.bhaptics_event_name:
                return candidate.bhaptics_event_name
            if candidate.cue_type:
                mapped = CANONICAL_MAPPING.get(candidate.cue_type)
                if mapped:
                    return mapped
        # Fallback if candidate not found in manifest or has no cue_type, e.g. parse key from prefix
        for key in CANONICAL_MAPPING.keys():
            if vibration_id.startswith(f"{key}_"):
                return CANONICAL_MAPPING[key]

    # 3. Try resolving via cue_type
    if cue_type:
        mapped = CANONICAL_MAPPING.get(cue_type)
        if mapped:
            return mapped

    # 4. Unknown cue type / fallback
    return "assist_attention_double"


EVENT_MAP_DATA = [
    {
        "cue_type": "start",
        "bhaptics_event_name": "assist_start",
        "label": "Workout Start",
        "description": "Tactile vibration signifying the start of the workout or active phase."
    },
    {
        "cue_type": "countdown",
        "bhaptics_event_name": "assist_countdown",
        "label": "Countdown Tick",
        "description": "Pulsing ticks counting down to the next movement or transition."
    },
    {
        "cue_type": "per_rep_tick",
        "bhaptics_event_name": "assist_rep_tick",
        "label": "Repetition Tick",
        "description": "Short pulse delivered on each completed repetition."
    },
    {
        "cue_type": "speed_up",
        "bhaptics_event_name": "assist_speed_up",
        "label": "Speed Up",
        "description": "Ascending tactile sweep indicating you should increase your movement speed."
    },
    {
        "cue_type": "slow_down",
        "bhaptics_event_name": "assist_slow_down",
        "label": "Slow Down",
        "description": "Descending tactile sweep indicating you should decrease your movement speed."
    },
    {
        "cue_type": "form_warning_above",
        "bhaptics_event_name": "assist_form_warning_high",
        "label": "Form Warning (High)",
        "description": "Sharp warning buzz indicating joint/posture angle is too high."
    },
    {
        "cue_type": "cooldown",
        "bhaptics_event_name": "assist_cooldown",
        "label": "Cooldown / End",
        "description": "Gentle, dissipating pattern signifying workout completion."
    }
]
