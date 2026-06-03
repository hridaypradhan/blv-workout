"""Deterministic mock sidecar manifest generator service for FitA11y."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING
import uuid

from app.models.schemas import (
    AssistanceSidecarManifest,
    ExerciseTimelineAnchor,
    TrainerInstructionEvent,
    SpeakingOpportunityWindow,
    FormRiskTemplate,
    HapticSpatialCueProfile,
    TrainerInstructionEventType,
    SpeakingOpportunityMode,
)

if TYPE_CHECKING:
    from app.core.job_store import JobRecord

# Default fallback video duration in seconds (10 minutes)
DEFAULT_FALLBACK_DURATION = 600.0


def build_deterministic_sidecar_manifest(job: JobRecord) -> AssistanceSidecarManifest:
    """Generate a deterministic AssistanceSidecarManifest based on JobRecord metadata.

    Ensures timestamps and ranges do not exceed the video's actual or fallback duration.
    Uses UUID namespace mappings to ensure generated UUIDs are completely deterministic.
    """
    video_id_str = job.video_id
    video_uuid = uuid.UUID(video_id_str)

    # Determine duration
    duration = job.duration if (job.duration and job.duration > 0) else DEFAULT_FALLBACK_DURATION

    # Exercise timeline anchors and expected movement windows
    exercise_timeline_anchors = []
    expected_movement_windows = {}

    # Helper to generate deterministic UUIDs
    ex1_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, f"fita11y:{video_id_str}:ex1")
    ex2_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, f"fita11y:{video_id_str}:ex2")

    # If the video is very short (less than 25 seconds), emit only one anchor (Squats)
    if duration < 25.0:
        ex1_start = 0.0
        ex1_end = duration
        ex2_start = None

        exercise_timeline_anchors.append(
            ExerciseTimelineAnchor(
                id=ex1_uuid,
                video_id=video_uuid,
                name="Bodyweight Squats",
                start_time_seconds=ex1_start,
                end_time_seconds=ex1_end,
                primary_body_part="Quadriceps",
                secondary_body_parts=["Glutes", "Hamstrings"],
                description_internal="Squats movement with alignment checking.",
                description_accessible="Stand with feet shoulder-width apart. We will track your squats and the haptic sleeve will guide your depth.",
                counting_joint="hip",
                angle_range=(75.0, 105.0),
                acceptable_ranges={"hip": (80.0, 100.0)},
            )
        )
        expected_movement_windows["squats"] = (ex1_start, ex1_end)
    else:
        # Normal duration: emit both Squats and Reverse Lunges
        ex1_start = 0.0
        ex1_end = min(duration / 2.0, 180.0)

        ex2_start = min(ex1_end + 10.0, duration - 5.0)
        ex2_end = min(ex2_start + 240.0, duration)

        exercise_timeline_anchors.append(
            ExerciseTimelineAnchor(
                id=ex1_uuid,
                video_id=video_uuid,
                name="Bodyweight Squats",
                start_time_seconds=ex1_start,
                end_time_seconds=ex1_end,
                primary_body_part="Quadriceps",
                secondary_body_parts=["Glutes", "Hamstrings"],
                description_internal="Squats movement with alignment checking.",
                description_accessible="Stand with feet shoulder-width apart. We will track your squats and the haptic sleeve will guide your depth.",
                counting_joint="hip",
                angle_range=(75.0, 105.0),
                acceptable_ranges={"hip": (80.0, 100.0)},
            )
        )
        exercise_timeline_anchors.append(
            ExerciseTimelineAnchor(
                id=ex2_uuid,
                video_id=video_uuid,
                name="Reverse Lunges",
                start_time_seconds=ex2_start,
                end_time_seconds=ex2_end,
                primary_body_part="Hamstrings",
                secondary_body_parts=["Glutes", "Quadriceps"],
                description_internal="Reverse lunges movement.",
                description_accessible="Step back with one leg, keeping your front knee aligned. Haptics will monitor knee drift.",
                counting_joint="knee",
                angle_range=(85.0, 95.0),
                acceptable_ranges={"knee": (80.0, 100.0)},
            )
        )
        expected_movement_windows["squats"] = (ex1_start, ex1_end)
        expected_movement_windows["lunges"] = (ex2_start, ex2_end)

    max_ms = duration * 1000.0

    # 2. Trainer Instruction Events
    raw_trainer_events = [
        (10000.0, 15000.0, "Keep your chest up and push your knees out.", TrainerInstructionEventType.FORM_CUE, True),
        (45000.0, 50000.0, "Excellent squats, let's go for three more reps.", TrainerInstructionEventType.REP_COUNT, True),
    ]

    if ex2_start is not None:
        raw_trainer_events.extend([
            (ex2_start * 1000.0 + 5000.0, ex2_start * 1000.0 + 10000.0, "Step back, lower your hips, and return to center.", TrainerInstructionEventType.FORM_CUE, True),
            (ex2_start * 1000.0 + 50000.0, ex2_start * 1000.0 + 55000.0, "Final repetitions, stay strong.", TrainerInstructionEventType.ENCOURAGEMENT, True),
        ])

    trainer_instruction_events = []
    for start_ms, end_ms, text, evt_type, may_speak in raw_trainer_events:
        if start_ms < max_ms:
            clamped_start = max(0.0, start_ms)
            clamped_end = max(clamped_start, min(end_ms, max_ms))
            clamped_timestamp = max(clamped_start, min(start_ms, clamped_end))
            trainer_instruction_events.append(
                TrainerInstructionEvent(
                    timestamp_ms=clamped_timestamp,
                    start_ms=clamped_start,
                    end_ms=clamped_end,
                    text=text,
                    event_type=evt_type,
                    assistant_may_speak=may_speak,
                )
            )

    # 3. Speaking Opportunity Map
    raw_speaking_windows = [
        (15000.0, 25000.0, 10000.0, SpeakingOpportunityMode.DUCK_SPEAK, "Deliver supplementary posture tips"),
        (55000.0, 65000.0, 10000.0, SpeakingOpportunityMode.HAPTIC_ONLY, "Haptic depth reinforcement"),
    ]

    if ex2_start is not None:
        raw_speaking_windows.extend([
            (ex2_start * 1000.0 + 12000.0, ex2_start * 1000.0 + 22000.0, 10000.0, SpeakingOpportunityMode.DUCK_SPEAK, "Lunges alignment reminder"),
            (ex2_start * 1000.0 + 60000.0, ex2_start * 1000.0 + 70000.0, 10000.0, SpeakingOpportunityMode.PAUSE_SPEAK, "Break reminder and target summary"),
        ])

    speaking_opportunity_map = []
    for start_ms, end_ms, dur_ms, mode, context in raw_speaking_windows:
        if start_ms < max_ms:
            clamped_start = max(0.0, start_ms)
            clamped_end = max(clamped_start, min(end_ms, max_ms))
            actual_dur = clamped_end - clamped_start
            speaking_opportunity_map.append(
                SpeakingOpportunityWindow(
                    start_ms=clamped_start,
                    end_ms=clamped_end,
                    duration_ms=actual_dur,
                    mode=mode,
                    context=context,
                )
            )

    # 4. Haptic Spatial Cue Profiles
    haptic_spatial_cue_profiles = [
        HapticSpatialCueProfile(
            exercise_name="Bodyweight Squats",
            body_parts=["left", "right"],
            patterns={"depth_reached": "double_pulse", "alignment_drift": "continuous_vibe"},
            default_intensity=0.8,
        ),
        HapticSpatialCueProfile(
            exercise_name="Reverse Lunges",
            body_parts=["left", "right"],
            patterns={"knee_drift": "single_long_pulse", "reps_completed": "short_success_pulse"},
            default_intensity=0.7,
        ),
    ]

    # 5. Form Risk Templates
    form_risk_templates = [
        FormRiskTemplate(
            exercise_name="Bodyweight Squats",
            joint="hip",
            risk_description="Hip alignment drifting or inadequate squat depth",
            correction_cue="Sink your hips back and keep your knees behind your toes",
        ),
        FormRiskTemplate(
            exercise_name="Reverse Lunges",
            joint="knee",
            risk_description="Front knee drifting inward or forward beyond the toes",
            correction_cue="Keep your front knee aligned over your ankle and push back from the heel",
        ),
    ]

    # 7. Beat Timestamps (every 4 seconds for the first 100 seconds, if duration allows)
    beat_timestamps = [
        float(i) for i in range(4, min(100, int(duration)), 4)
    ]

    return AssistanceSidecarManifest(
        video_id=video_uuid,
        youtube_id=job.youtube_id,
        exercise_timeline_anchors=exercise_timeline_anchors,
        trainer_instruction_events=trainer_instruction_events,
        expected_movement_windows=expected_movement_windows,
        form_risk_templates=form_risk_templates,
        haptic_spatial_cue_profiles=haptic_spatial_cue_profiles,
        beat_timestamps=beat_timestamps,
        speaking_opportunity_map=speaking_opportunity_map,
    )
