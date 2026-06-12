"""Validation and timestamp clamping service for FitA11y sidecar manifests."""

from __future__ import annotations

import logging
import math
import re
import uuid
from typing import Any, Optional

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

logger = logging.getLogger(__name__)


def is_finite_number(val: Any) -> bool:
    if isinstance(val, (int, float)):
        return not (math.isnan(val) or math.isinf(val))
    return False


def clamp_val(val: float, min_val: float, max_val: float) -> float:
    return max(min_val, min(val, max_val))


def clean_supplementary_text(text: str) -> str:
    if not text:
        return ''
    
    replacements = [
        ('I am your trainer today', 'I will guide you alongside your trainer'),
        ('Instead of the video trainer', 'As supplementary guidance'),
        ("Ignore the trainer's instructions", "Alongside the trainer's instructions"),
    ]
    for orig, rep in replacements:
        text = re.sub(re.escape(orig), rep, text, flags=re.IGNORECASE)
    return text.strip()


def validate_and_clamp_sidecar_manifest(
    manifest_dict: dict[str, Any],
    video_duration: float,
    youtube_id: str,
    video_uuid: uuid.UUID,
) -> Optional[AssistanceSidecarManifest]:
    """Validates, normalizes, and clamps raw manifest dictionary inputs to construct a canonical AssistanceSidecarManifest.

    Performs normalization and safety checks, logging detailed warning events for dropped or repaired values.
    """
    try:
        max_seconds = max(0.0, video_duration)
        max_ms = max_seconds * 1000.0
        
        # 1. exercise_timeline_anchors
        exercise_timeline_anchors = []
        raw_anchors = manifest_dict.get('exercise_timeline_anchors', [])
        for anchor_idx, a in enumerate(raw_anchors):
            try:
                name = a.get('name')
                if not name or not isinstance(name, str) or not name.strip():
                    logger.warning("Exercise anchor at index %d has invalid name, defaulted.", anchor_idx)
                    name = f"Exercise Anchor {anchor_idx + 1}"
                
                raw_start_sec = a.get('start_time_seconds')
                raw_end_sec = a.get('end_time_seconds')
                
                if not is_finite_number(raw_start_sec):
                    logger.warning("Timeline anchor '%s' has non-finite start_time_seconds (%s), defaulted to 0.0", name, raw_start_sec)
                    start_sec = 0.0
                else:
                    start_sec = float(raw_start_sec)
                    
                if not is_finite_number(raw_end_sec):
                    logger.warning("Timeline anchor '%s' has non-finite end_time_seconds (%s), defaulted to max duration %s", name, raw_end_sec, max_seconds)
                    end_sec = max_seconds
                else:
                    end_sec = float(raw_end_sec)
                    
                clamped_start = clamp_val(start_sec, 0.0, max_seconds)
                clamped_end = clamp_val(end_sec, 0.0, max_seconds)
                
                if clamped_start != start_sec or clamped_end != end_sec:
                    logger.warning(
                        "Clamped timeline anchor '%s' seconds from (%s, %s) to (%s, %s)",
                        name, start_sec, end_sec, clamped_start, clamped_end
                    )
                
                start_sec, end_sec = clamped_start, clamped_end
                
                if start_sec > end_sec:
                    logger.warning("Swapped start > end seconds for timeline anchor '%s'", name)
                    start_sec, end_sec = end_sec, start_sec
                    
                angle_range = a.get('angle_range')
                valid_angle_range = None
                if isinstance(angle_range, (list, tuple)) and len(angle_range) == 2:
                    try:
                        val0 = float(angle_range[0])
                        val1 = float(angle_range[1])
                        if is_finite_number(val0) and is_finite_number(val1):
                            valid_angle_range = (val0, val1)
                    except (ValueError, TypeError) as exc:
                        logger.warning("Dropped invalid angle_range for anchor '%s': %s", name, exc)
                        
                acceptable_ranges = {}
                raw_ranges = a.get('acceptable_ranges')
                if isinstance(raw_ranges, dict):
                    for k, r in raw_ranges.items():
                        if isinstance(r, (list, tuple)) and len(r) == 2:
                            try:
                                r0 = float(r[0])
                                r1 = float(r[1])
                                if is_finite_number(r0) and is_finite_number(r1):
                                    acceptable_ranges[str(k)] = (r0, r1)
                            except (ValueError, TypeError) as exc:
                                logger.warning("Dropped invalid acceptable range entry for joint '%s': %s", k, exc)
                                
                anchor_id = a.get('id')
                if not anchor_id:
                    anchor_id = uuid.uuid5(uuid.NAMESPACE_DNS, f"fita11y:{str(video_uuid)}:anchor:{anchor_idx}")
                else:
                    try:
                        anchor_id = uuid.UUID(str(anchor_id))
                    except ValueError:
                        anchor_id = uuid.uuid5(uuid.NAMESPACE_DNS, f"fita11y:{str(video_uuid)}:anchor:{anchor_idx}")
                        
                exercise_timeline_anchors.append(
                    ExerciseTimelineAnchor(
                        id=anchor_id,
                        video_id=video_uuid,
                        name=name.strip(),
                        start_time_seconds=start_sec,
                        end_time_seconds=end_sec,
                        primary_body_part=a.get('primary_body_part'),
                        secondary_body_parts=list(a.get('secondary_body_parts')) if a.get('secondary_body_parts') else [],
                        description_internal=a.get('description_internal'),
                        description_accessible=a.get('description_accessible'),
                        counting_joint=a.get('counting_joint'),
                        angle_range=valid_angle_range,
                        acceptable_ranges=acceptable_ranges,
                    )
                )
            except (ValueError, TypeError) as exc:
                logger.warning("Dropped invalid exercise timeline anchor index %d: %s", anchor_idx, exc)
                continue
                
        # 2. trainer_instruction_events
        trainer_instruction_events = []
        raw_events = manifest_dict.get('trainer_instruction_events', [])
        for event_idx, e in enumerate(raw_events):
            text = e.get('text')
            if not text or not isinstance(text, str) or not text.strip():
                logger.warning("Dropped empty or non-string trainer instruction event at index %d", event_idx)
                continue
            text = clean_supplementary_text(text)
            
            raw_start_ms = e.get('start_ms')
            raw_end_ms = e.get('end_ms')
            
            if not is_finite_number(raw_start_ms):
                logger.warning("Trainer instruction event at index %d has non-finite start_ms (%s), defaulted to 0.0", event_idx, raw_start_ms)
                start_ms = 0.0
            else:
                start_ms = float(raw_start_ms)
                
            if not is_finite_number(raw_end_ms):
                logger.warning("Trainer instruction event at index %d has non-finite end_ms (%s), defaulted to max duration ms %s", event_idx, raw_end_ms, max_ms)
                end_ms = max_ms
            else:
                end_ms = float(raw_end_ms)
                
            clamped_start = clamp_val(start_ms, 0.0, max_ms)
            clamped_end = clamp_val(end_ms, 0.0, max_ms)
            
            if clamped_start != start_ms or clamped_end != end_ms:
                logger.warning(
                    "Clamped event ms for '%s...' from (%s, %s) to (%s, %s)",
                    text[:20], start_ms, end_ms, clamped_start, clamped_end
                )
                
            start_ms, end_ms = clamped_start, clamped_end
            
            if start_ms > end_ms:
                logger.warning("Swapped start > end ms for event '%s...'", text[:20])
                start_ms, end_ms = end_ms, start_ms
                
            timestamp_ms = e.get('timestamp_ms')
            if not is_finite_number(timestamp_ms):
                timestamp_ms = start_ms
            else:
                timestamp_ms = float(timestamp_ms)
                if timestamp_ms < start_ms or timestamp_ms > end_ms:
                    logger.warning("Reset out-of-bounds timestamp_ms %s to start_ms %s for event '%s...'", timestamp_ms, start_ms, text[:20])
                    timestamp_ms = start_ms
            timestamp_ms = clamp_val(timestamp_ms, start_ms, end_ms)
            
            event_type_str = e.get('event_type')
            try:
                event_type = TrainerInstructionEventType(event_type_str)
            except ValueError:
                logger.warning("Defaulted invalid event_type '%s' to FORM_CUE for event '%s...'", event_type_str, text[:20])
                event_type = TrainerInstructionEventType.FORM_CUE
                
            trainer_instruction_events.append(
                TrainerInstructionEvent(
                    timestamp_ms=timestamp_ms,
                    start_ms=start_ms,
                    end_ms=end_ms,
                    text=text,
                    event_type=event_type,
                    assistant_may_speak=bool(e.get('assistant_may_speak', False)),
                )
            )
            
        # 3. speaking_opportunity_map
        speaking_opportunity_map = []
        raw_windows = manifest_dict.get('speaking_opportunity_map', [])
        for win_idx, w in enumerate(raw_windows):
            raw_start_ms = w.get('start_ms')
            raw_end_ms = w.get('end_ms')
            if not is_finite_number(raw_start_ms) or not is_finite_number(raw_end_ms):
                logger.warning("Dropped speaking opportunity window at index %d due to non-finite bounds", win_idx)
                continue
                
            start_ms = float(raw_start_ms)
            end_ms = float(raw_end_ms)
            
            clamped_start = clamp_val(start_ms, 0.0, max_ms)
            clamped_end = clamp_val(end_ms, 0.0, max_ms)
            
            if clamped_start != start_ms or clamped_end != end_ms:
                logger.warning(
                    "Clamped speaking window from (%s, %s) to (%s, %s)",
                    start_ms, end_ms, clamped_start, clamped_end
                )
                
            start_ms, end_ms = clamped_start, clamped_end
            
            if start_ms > end_ms:
                logger.warning("Swapped start > end ms for speaking opportunity window")
                start_ms, end_ms = end_ms, start_ms
                
            mode_str = w.get('mode')
            try:
                mode = SpeakingOpportunityMode(mode_str)
            except ValueError:
                logger.warning("Defaulted invalid speaking opportunity mode '%s' to HAPTIC_ONLY", mode_str)
                mode = SpeakingOpportunityMode.HAPTIC_ONLY
                
            speaking_opportunity_map.append(
                SpeakingOpportunityWindow(
                    start_ms=start_ms,
                    end_ms=end_ms,
                    duration_ms=end_ms - start_ms,
                    mode=mode,
                    context=w.get('context'),
                )
            )
            
        # 4. form_risk_templates
        form_risk_templates = []
        raw_risks = manifest_dict.get('form_risk_templates', [])
        for risk_idx, r in enumerate(raw_risks):
            ex_name = r.get('exercise_name')
            joint = r.get('joint')
            if not ex_name or not joint or not isinstance(ex_name, str) or not isinstance(joint, str):
                logger.warning("Dropped invalid form risk template at index %d", risk_idx)
                continue
                
            form_risk_templates.append(
                FormRiskTemplate(
                    exercise_name=ex_name.strip(),
                    joint=joint.strip(),
                    risk_description=r.get('risk_description'),
                    correction_cue=r.get('correction_cue'),
                )
            )
            
        # 5. haptic_spatial_cue_profiles
        haptic_spatial_cue_profiles = []
        raw_profiles = manifest_dict.get('haptic_spatial_cue_profiles', [])
        for prof_idx, p in enumerate(raw_profiles):
            ex_name = p.get('exercise_name')
            if not ex_name or not isinstance(ex_name, str):
                logger.warning("Dropped invalid haptic cue profile at index %d", prof_idx)
                continue
                
            haptic_spatial_cue_profiles.append(
                HapticSpatialCueProfile(
                    exercise_name=ex_name.strip(),
                    body_parts=list(p.get('body_parts')) if p.get('body_parts') else [],
                    patterns=dict(p.get('patterns')) if p.get('patterns') else {},
                    default_intensity=p.get('default_intensity'),
                )
            )
            
        # 6. beat_timestamps
        beat_timestamps = []
        raw_beats = manifest_dict.get('beat_timestamps', [])
        if isinstance(raw_beats, list):
            for b in raw_beats:
                if not is_finite_number(b):
                    logger.warning("Filtered non-finite beat timestamp: %s", b)
                    continue
                beat_timestamps.append(clamp_val(float(b), 0.0, max_seconds))
        beat_timestamps = sorted(list(set(beat_timestamps)))
        
        # 7. expected_movement_windows
        expected_movement_windows = {}
        raw_windows_dict = manifest_dict.get('expected_movement_windows', {})
        if isinstance(raw_windows_dict, dict):
            for key, val in raw_windows_dict.items():
                if isinstance(val, (list, tuple)) and len(val) == 2:
                    try:
                        v0 = float(val[0])
                        v1 = float(val[1])
                        if is_finite_number(v0) and is_finite_number(v1):
                            v0 = clamp_val(v0, 0.0, max_seconds)
                            v1 = clamp_val(v1, 0.0, max_seconds)
                            if v0 > v1:
                                v0, v1 = v1, v0
                            expected_movement_windows[str(key)] = [v0, v1]
                    except (ValueError, TypeError) as exc:
                        logger.warning("Dropped invalid expected movement window for exercise '%s': %s", key, exc)
                        
        return AssistanceSidecarManifest(
            video_id=video_uuid,
            youtube_id=youtube_id,
            exercise_timeline_anchors=exercise_timeline_anchors,
            trainer_instruction_events=trainer_instruction_events,
            expected_movement_windows=expected_movement_windows,
            form_risk_templates=form_risk_templates,
            haptic_spatial_cue_profiles=haptic_spatial_cue_profiles,
            beat_timestamps=beat_timestamps,
            speaking_opportunity_map=speaking_opportunity_map,
        )
    except Exception as e:
        logger.error('Failed to perform semantic clamping and schema validation on sidecar dictionary: %s', e)
        return None
