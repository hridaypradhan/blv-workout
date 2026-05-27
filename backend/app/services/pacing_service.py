"""Pacing service for FitA11y containing deterministic pacing algorithms."""

from typing import Optional, Any
from app.models.schemas import (
    CoachPersona,
    SleeveSide,
    PlaybackInstruction,
    HapticInstruction,
    RepAdjustment,
    PacingMetrics,
    AdaptivePacingResponse,
    RhythmMetrics,
    RhythmPacingResponse
)

# Deterministic Coach Messages for Adaptive Pacing Decisions
ADAPTIVE_PACING_MESSAGES = {
    "none": {
        CoachPersona.SUPPORTIVE: "Great pace! Keep it up.",
        CoachPersona.DIRECT: "Good pace. Continue.",
        CoachPersona.ENERGETIC: "Awesome speed! Keep crushing it!",
        CoachPersona.CALM: "Nice and steady. Keep moving."
    },
    "slow_prompt": {
        CoachPersona.SUPPORTIVE: "Take your time, slow it down.",
        CoachPersona.DIRECT: "Slow down your reps.",
        CoachPersona.ENERGETIC: "Woah there, let's control the pace a bit!",
        CoachPersona.CALM: "Breathe and ease into a slower tempo."
    },
    "hold_cue": {
        CoachPersona.SUPPORTIVE: "Let's pause here. Take a brief hold to catch up with the video.",
        CoachPersona.DIRECT: "Hold pose. Wait for video.",
        CoachPersona.ENERGETIC: "Hold it right there! Catch your breath!",
        CoachPersona.CALM: "Find stillness for a moment. Let the video catch up."
    },
    "rep_reduction": {
        CoachPersona.SUPPORTIVE: "Let's reduce the target reps slightly so you can focus on quality over speed.",
        CoachPersona.DIRECT: "Target reps reduced.",
        CoachPersona.ENERGETIC: "Let's adjust the target and make every single rep count!",
        CoachPersona.CALM: "Reducing the rep count to maintain a peaceful, steady flow."
    },
    "modification_offer": {
        CoachPersona.SUPPORTIVE: "If this is feeling tough, we can try a modified version to keep you safe.",
        CoachPersona.DIRECT: "Form is slipping. Modify exercise.",
        CoachPersona.ENERGETIC: "Let's switch it up to a modified move and keep the energy high!",
        CoachPersona.CALM: "Let's transition to a gentler modification to protect your alignment."
    },
    "recovery": {
        CoachPersona.SUPPORTIVE: "Excellent job catching up. Resuming normal speed.",
        CoachPersona.DIRECT: "Resuming normal speed.",
        CoachPersona.ENERGETIC: "You're back on track! Let's pick up the speed!",
        CoachPersona.CALM: "Well recovered. Gently returning to standard tempo."
    },
    "override_acknowledged": {
        CoachPersona.SUPPORTIVE: "Alright, keep going! I'll stay on your pace.",
        CoachPersona.DIRECT: "Command received. Continuing.",
        CoachPersona.ENERGETIC: "Got it! Keep pushing, let's go!",
        CoachPersona.CALM: "Acknowledged. Continue at your own comfort."
    }
}

# Deterministic Coach Messages for Rhythm Pacing Decisions
RHYTHM_PACING_MESSAGES = {
    "on_rhythm": {
        CoachPersona.SUPPORTIVE: "Perfect rhythm! You're matching the beat beautifully.",
        CoachPersona.DIRECT: "On rhythm.",
        CoachPersona.ENERGETIC: "Boom! Locked in on the beat! Let's go!",
        CoachPersona.CALM: "Harmonious rhythm. Keep flowing with the tempo."
    },
    "too_slow": {
        CoachPersona.SUPPORTIVE: "You're falling slightly behind the beat. Let's speed up just a bit.",
        CoachPersona.DIRECT: "Too slow. Match the beat.",
        CoachPersona.ENERGETIC: "Pick it up! Let's match that tempo!",
        CoachPersona.CALM: "Gently increase your pace to realign with the rhythm."
    },
    "too_fast": {
        CoachPersona.SUPPORTIVE: "You're ahead of the beat. Let's slow down and feel the rhythm.",
        CoachPersona.DIRECT: "Too fast. Slow down.",
        CoachPersona.ENERGETIC: "Hold on, you're rushing! Feel the beat!",
        CoachPersona.CALM: "Slow down. Align your movements with the gentle cadence."
    },
    "irregular": {
        CoachPersona.SUPPORTIVE: "Your rhythm is a bit uneven. Try to find a steady, consistent bounce.",
        CoachPersona.DIRECT: "Rhythm is irregular. Stabilize pace.",
        CoachPersona.ENERGETIC: "Let's find the groove again! Focus on a steady bounce!",
        CoachPersona.CALM: "Try to smooth out your pacing for a more consistent flow."
    },
    "insufficient_data": {
        CoachPersona.SUPPORTIVE: "Keep moving! I'll analyze your rhythm after a few more reps.",
        CoachPersona.DIRECT: "Insufficient data for rhythm analysis.",
        CoachPersona.ENERGETIC: "Get a few more reps in so we can find your groove!",
        CoachPersona.CALM: "A few more repetitions will help me understand your tempo."
    }
}


def durations_from_timestamps(timestamps: list[float]) -> list[float]:
    """Calculate rep durations as the difference between consecutive timestamps."""
    if not timestamps or len(timestamps) < 2:
        return []
    return [timestamps[i] - timestamps[i - 1] for i in range(1, len(timestamps))]


def calculate_lag_ratios(rep_durations: list[float], expected_duration: float) -> list[float]:
    """Calculate lag ratios for all completed reps."""
    if not expected_duration or expected_duration <= 0:
        return [1.0] * len(rep_durations)
    return [dur / expected_duration for dur in rep_durations]


def calculate_rolling_average(ratios: list[float], window: int = 3) -> float:
    """Calculate rolling average of ratios over a window of recent reps."""
    if not ratios:
        return 1.0
    recent = ratios[-window:]
    return sum(recent) / len(recent)


def detect_sustained_lag(ratios: list[float], threshold: float = 1.2, min_count: int = 2) -> bool:
    """Detect sustained lag when recent reps exceed the threshold."""
    if len(ratios) < min_count:
        return False
    recent = ratios[-min_count:]
    return all(ratio > threshold for ratio in recent)


def detect_recovery(ratios: list[float], threshold: float = 1.1, min_count: int = 2) -> bool:
    """Detect recovery when recent reps return below the recovery threshold."""
    if len(ratios) < min_count:
        return False
    recent = ratios[-min_count:]
    return all(ratio < threshold for ratio in recent)


def detect_form_errors_increasing(error_counts: list[int]) -> bool:
    """Detect if the form error count is increasing over recent intervals."""
    if not error_counts or len(error_counts) < 2:
        return False
    # If the latest error count is greater than the previous one, it's increasing.
    return error_counts[-1] > error_counts[-2]


def get_deterministic_coach_message(decision: str, persona: CoachPersona) -> str:
    """Return a persona-aligned coach feedback message for a given pacing decision."""
    # Handle Adaptive Pacing
    if decision in ADAPTIVE_PACING_MESSAGES:
        return ADAPTIVE_PACING_MESSAGES[decision].get(persona, ADAPTIVE_PACING_MESSAGES[decision][CoachPersona.SUPPORTIVE])
    # Handle Rhythm Pacing
    if decision in RHYTHM_PACING_MESSAGES:
        return RHYTHM_PACING_MESSAGES[decision].get(persona, RHYTHM_PACING_MESSAGES[decision][CoachPersona.SUPPORTIVE])
    return "Keep up the good work!"


def choose_adaptive_intervention(
    latest_lag_ratio: float,
    rolling_avg_lag: float,
    sustained_lag: bool,
    recovery_detected: bool,
    form_errors_increasing: bool,
    completed_reps: int,
    target_reps: int,
    user_command: Optional[str]
) -> tuple[str, str]:
    """
    Decide the appropriate pacing intervention.
    Returns: (decision_string, reason_string)
    """
    if user_command == "keep_going":
        return "override_acknowledged", "User explicitly requested to continue without modifications."

    if recovery_detected:
        return "recovery", "User has successfully matched the expected pace over recent repetitions."

    if sustained_lag:
        if form_errors_increasing:
            return "modification_offer", "Sustained pacing lag coupled with increasing form errors suggests exercise modification is needed."
        
        # High lag: > 40% behind
        if latest_lag_ratio > 1.4 or rolling_avg_lag > 1.4:
            # If target reps is set, check if we can reduce reps
            if target_reps and completed_reps < target_reps:
                return "rep_reduction", "Severe sustained lag detected. Reducing target reps to focus on form quality."
            else:
                return "hold_cue", "Severe sustained lag detected. Instructing user to hold until caught up."

        # Medium lag: 21-40% behind
        return "hold_cue", "Sustained pacing lag between 21% and 40% behind the expected duration."

    # Slight lag: up to 20% behind
    if latest_lag_ratio > 1.0:
        return "slow_prompt", "User is slightly behind the expected repetition pace."

    return "none", "User is maintaining pace with the video guide."


def build_adaptive_response(
    session_id: str,
    exercise_id: str,
    exercise_name: str,
    expected_duration: float,
    rep_durations: list[float],
    recent_lag_ratios: Optional[list[float]],
    completed_reps: int,
    target_reps: int,
    recent_form_error_counts: list[int],
    primary_sleeves: list[SleeveSide],
    current_playback_speed: float,
    user_command: Optional[str],
    persona: CoachPersona
) -> dict:
    """Build the final AdaptivePacingResponse dictionary."""
    
    # Resolve ratios
    if recent_lag_ratios:
        ratios = recent_lag_ratios
    else:
        ratios = calculate_lag_ratios(rep_durations, expected_duration)

    latest_lag_ratio = ratios[-1] if ratios else 1.0
    rolling_avg_lag = calculate_rolling_average(ratios)

    sustained_lag = detect_sustained_lag(ratios)
    # Only detect recovery if we had some lag history or are at an active recovery stage
    recovery_detected = detect_recovery(ratios)
    form_errors_increasing = detect_form_errors_increasing(recent_form_error_counts)

    decision, reason = choose_adaptive_intervention(
        latest_lag_ratio=latest_lag_ratio,
        rolling_avg_lag=rolling_avg_lag,
        sustained_lag=sustained_lag,
        recovery_detected=recovery_detected,
        form_errors_increasing=form_errors_increasing,
        completed_reps=completed_reps,
        target_reps=target_reps,
        user_command=user_command
    )

    coach_message = get_deterministic_coach_message(decision, persona)

    # Calculate PlaybackInstruction
    playback_action = "none"
    suggested_speed = current_playback_speed

    if decision == "slow_prompt":
        playback_action = "slow"
        suggested_speed = 0.75
    elif decision == "hold_cue":
        playback_action = "pause"
        suggested_speed = 0.0
    elif decision == "rep_reduction":
        playback_action = "slow"
        suggested_speed = 0.75
    elif decision == "modification_offer":
        playback_action = "slow"
        suggested_speed = 0.75
    elif decision == "recovery":
        playback_action = "resume"
        suggested_speed = 1.0
    elif decision == "override_acknowledged":
        playback_action = "resume"
        suggested_speed = 1.0

    # Calculate HapticInstruction
    haptic_enabled = False
    haptic_pattern = None
    haptic_intensity = 0.0

    if decision in ["slow_prompt", "hold_cue", "rep_reduction", "modification_offer"]:
        haptic_enabled = True
        haptic_intensity = 0.8
        if decision == "slow_prompt":
            haptic_pattern = "double-pulse"
        elif decision == "hold_cue":
            haptic_pattern = "sustained-vibe"
        elif decision == "rep_reduction":
            haptic_pattern = "triple-pulse"
        elif decision == "modification_offer":
            haptic_pattern = "long-pulse"
    elif decision == "recovery":
        haptic_enabled = True
        haptic_intensity = 0.5
        haptic_pattern = "success-spark"

    # Calculate RepAdjustment
    rep_adjustment = None
    if decision == "rep_reduction" and target_reps:
        # Reduce target reps by 2, but not below completed_reps
        adjusted_target = max(completed_reps, target_reps - 2)
        rep_adjustment = {
            "original_target": target_reps,
            "adjusted_target": adjusted_target,
            "reason": "Target reduced to keep user from over-exerting during sustained lag."
        }

    return {
        "feature": "adaptive_pacing",
        "decision": decision,
        "coach_message": coach_message,
        "playback": {
            "action": playback_action,
            "suggested_speed": suggested_speed
        },
        "haptic": {
            "enabled": haptic_enabled,
            "pattern": haptic_pattern,
            "sleeves": [s.value for s in primary_sleeves],
            "intensity": haptic_intensity
        },
        "rep_adjustment": rep_adjustment,
        "metrics": {
            "latest_lag_ratio": latest_lag_ratio,
            "rolling_average_lag_ratio": rolling_avg_lag,
            "sustained_lag": sustained_lag,
            "recovery_detected": recovery_detected,
            "form_errors_increasing": form_errors_increasing
        },
        "reason": reason
    }


# F3.6 — Beat & Rhythm Pacing Coach Logic

def calculate_expected_rep_duration(
    beat_timestamps: Optional[list[float]],
    bpm: Optional[float],
    beats_per_rep: Optional[int]
) -> Optional[float]:
    """Calculate the expected rep duration based on beats, BPM, and beats_per_rep."""
    bpr = beats_per_rep if beats_per_rep and beats_per_rep > 0 else 4

    if bpm and bpm > 0:
        return (60.0 / bpm) * bpr
    
    if beat_timestamps and len(beat_timestamps) > 1:
        # Infer BPM from beat timestamps
        intervals = [beat_timestamps[i] - beat_timestamps[i-1] for i in range(1, len(beat_timestamps))]
        avg_interval = sum(intervals) / len(intervals)
        return avg_interval * bpr

    return None


def calculate_rhythm_drift(
    user_durations: list[float],
    expected_duration: float
) -> dict:
    """
    Calculate rhythm drift metrics.
    Returns: dict with (drift_ratio, drift_percent, irregularity_score)
    """
    if not user_durations or not expected_duration or expected_duration <= 0:
        return {
            "drift_ratio": 1.0,
            "drift_percent": 0.0,
            "irregularity_score": 0.0
        }

    user_avg = sum(user_durations) / len(user_durations)
    drift_ratio = user_avg / expected_duration
    drift_percent = (drift_ratio - 1.0) * 100.0

    # Calculate coefficient of variation as irregularity score
    if len(user_durations) > 1:
        mean = user_avg
        variance = sum((x - mean) ** 2 for x in user_durations) / len(user_durations)
        std_dev = variance ** 0.5
        irregularity_score = std_dev / mean if mean > 0 else 0.0
    else:
        irregularity_score = 0.0

    return {
        "drift_ratio": drift_ratio,
        "drift_percent": drift_percent,
        "irregularity_score": irregularity_score
    }


def choose_rhythm_nudge(drift_ratio: float, irregularity: float) -> str:
    """Decide on a rhythm nudge based on drift and irregularity."""
    if irregularity >= 0.15:
        return "irregular"
    if drift_ratio > 1.10:
        return "too_slow"
    if drift_ratio < 0.90:
        return "too_fast"
    return "on_rhythm"


def build_rhythm_response(
    session_id: str,
    exercise_id: str,
    exercise_name: str,
    beat_timestamps: Optional[list[float]],
    bpm: Optional[float],
    expected_beats_per_rep: Optional[int],
    expected_rep_duration: Optional[float],
    rep_timestamps: Optional[list[float]],
    rep_durations: Optional[list[float]],
    persona: CoachPersona
) -> dict:
    """Build the final RhythmPacingResponse dictionary."""
    
    # Calculate user durations
    user_durs = []
    if rep_durations:
        user_durs = rep_durations
    elif rep_timestamps:
        user_durs = durations_from_timestamps(rep_timestamps)

    # Calculate expected duration
    exp_duration = expected_rep_duration
    if not exp_duration:
        exp_duration = calculate_expected_rep_duration(beat_timestamps, bpm, expected_beats_per_rep)

    if not exp_duration or exp_duration <= 0:
        # Insufficient expected data
        decision = "insufficient_data"
        reason = "Could not determine the target rep duration from beat or exercise configuration."
        coach_message = get_deterministic_coach_message(decision, persona)
        return {
            "feature": "rhythm_pacing",
            "decision": decision,
            "coach_message": coach_message,
            "rhythm": {
                "expected_rep_duration_seconds": 0.0,
                "user_average_rep_duration_seconds": sum(user_durs)/len(user_durs) if user_durs else 0.0,
                "drift_ratio": 1.0,
                "drift_percent": 0.0,
                "irregularity_score": 0.0
            },
            "reason": reason
        }

    # Analyze rhythm
    if len(user_durs) < 2:
        decision = "insufficient_data"
        reason = "At least 2 user repetitions are required to establish a rhythm pattern."
        coach_message = get_deterministic_coach_message(decision, persona)
        return {
            "feature": "rhythm_pacing",
            "decision": decision,
            "coach_message": coach_message,
            "rhythm": {
                "expected_rep_duration_seconds": exp_duration,
                "user_average_rep_duration_seconds": user_durs[0] if user_durs else 0.0,
                "drift_ratio": 1.0,
                "drift_percent": 0.0,
                "irregularity_score": 0.0
            },
            "reason": reason
        }

    drift_metrics = calculate_rhythm_drift(user_durs, exp_duration)
    drift_ratio = drift_metrics["drift_ratio"]
    irregularity = drift_metrics["irregularity_score"]

    decision = choose_rhythm_nudge(drift_ratio, irregularity)
    coach_message = get_deterministic_coach_message(decision, persona)

    reason_map = {
        "on_rhythm": "User pacing is well aligned with the video tempo.",
        "too_slow": "User average repetition speed is slower than the video's rhythmic beat.",
        "too_fast": "User average repetition speed is faster than the video's rhythmic beat.",
        "irregular": "User movement speed varies too much from rep to rep to establish a steady cadence."
    }
    reason = reason_map.get(decision, "Rhythm pacing evaluated successfully.")

    return {
        "feature": "rhythm_pacing",
        "decision": decision,
        "coach_message": coach_message,
        "rhythm": {
            "expected_rep_duration_seconds": exp_duration,
            "user_average_rep_duration_seconds": sum(user_durs) / len(user_durs),
            "drift_ratio": drift_ratio,
            "drift_percent": drift_metrics["drift_percent"],
            "irregularity_score": irregularity
        },
        "reason": reason
    }
