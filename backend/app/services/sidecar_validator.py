"""Validation and timestamp clamping service for FitA11y sidecar manifests."""

from __future__ import annotations

import logging
import math
import re
import uuid
from dataclasses import dataclass
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
    SidecarValidationWarning,
)

@dataclass
class SidecarValidationResult:
    """Result of sidecar manifest validation and safety clamping."""

    manifest: Optional[AssistanceSidecarManifest]
    warnings: list[SidecarValidationWarning]

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


def validate_and_clamp_sidecar_manifest_with_warnings(
    manifest_dict: dict[str, Any],
    video_duration: float,
    youtube_id: str,
    video_uuid: uuid.UUID,
) -> SidecarValidationResult:
    """Validates, normalizes, and clamps raw manifest dictionary inputs.
    
    Returns a SidecarValidationResult containing both the built AssistanceSidecarManifest
    and a structured list of validation/clamping warnings.
    """
    warnings = []
    
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
                    msg = f"Exercise anchor at index {anchor_idx} has invalid name, defaulted."
                    logger.warning(msg)
                    warnings.append(SidecarValidationWarning(
                        code="anchor_name_defaulted",
                        message=msg,
                        path=f"exercise_timeline_anchors[{anchor_idx}].name"
                    ))
                    name = f"Exercise Anchor {anchor_idx + 1}"
                
                raw_start_sec = a.get('start_time_seconds')
                raw_end_sec = a.get('end_time_seconds')
                
                start_defaulted = False
                end_defaulted = False
                
                if not is_finite_number(raw_start_sec):
                    msg = f"Timeline anchor '{name}' has non-finite start_time_seconds ({raw_start_sec}), defaulted to 0.0"
                    logger.warning(msg)
                    warnings.append(SidecarValidationWarning(
                        code="anchor_timestamp_defaulted",
                        message=msg,
                        path=f"exercise_timeline_anchors[{anchor_idx}].start_time_seconds"
                    ))
                    start_sec = 0.0
                    start_defaulted = True
                else:
                    start_sec = float(raw_start_sec)
                    
                if not is_finite_number(raw_end_sec):
                    msg = f"Timeline anchor '{name}' has non-finite end_time_seconds ({raw_end_sec}), defaulted to max duration {max_seconds}"
                    logger.warning(msg)
                    warnings.append(SidecarValidationWarning(
                        code="anchor_timestamp_defaulted",
                        message=msg,
                        path=f"exercise_timeline_anchors[{anchor_idx}].end_time_seconds"
                    ))
                    end_sec = max_seconds
                    end_defaulted = True
                else:
                    end_sec = float(raw_end_sec)
                    
                clamped_start = clamp_val(start_sec, 0.0, max_seconds)
                clamped_end = clamp_val(end_sec, 0.0, max_seconds)
                
                if (clamped_start != start_sec or clamped_end != end_sec) and not (start_defaulted and end_defaulted):
                    msg = f"Clamped timeline anchor '{name}' seconds from ({start_sec}, {end_sec}) to ({clamped_start}, {clamped_end})"
                    logger.warning(msg)
                    warnings.append(SidecarValidationWarning(
                        code="anchor_timestamp_clamped",
                        message=msg,
                        path=f"exercise_timeline_anchors[{anchor_idx}]"
                    ))
                
                start_sec, end_sec = clamped_start, clamped_end
                
                if start_sec > end_sec:
                    msg = f"Swapped start > end seconds for timeline anchor '{name}'"
                    logger.warning(msg)
                    warnings.append(SidecarValidationWarning(
                        code="anchor_start_end_swapped",
                        message=msg,
                        path=f"exercise_timeline_anchors[{anchor_idx}]"
                    ))
                    start_sec, end_sec = end_sec, start_sec
                    
                angle_range = a.get('angle_range')
                valid_angle_range = None
                if angle_range is not None:
                    if isinstance(angle_range, (list, tuple)) and len(angle_range) == 2:
                        try:
                            val0 = float(angle_range[0])
                            val1 = float(angle_range[1])
                            if is_finite_number(val0) and is_finite_number(val1):
                                valid_angle_range = (val0, val1)
                        except (ValueError, TypeError) as exc:
                            msg = f"Dropped invalid angle_range for anchor '{name}': {exc}"
                            logger.warning(msg)
                            warnings.append(SidecarValidationWarning(
                                code="invalid_angle_range_dropped",
                                message=msg,
                                path=f"exercise_timeline_anchors[{anchor_idx}].angle_range"
                            ))
                    else:
                        msg = f"Dropped invalid angle_range format for anchor '{name}'"
                        logger.warning(msg)
                        warnings.append(SidecarValidationWarning(
                            code="invalid_angle_range_dropped",
                            message=msg,
                            path=f"exercise_timeline_anchors[{anchor_idx}].angle_range"
                        ))
                        
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
                                msg = f"Dropped invalid acceptable range entry for joint '{k}': {exc}"
                                logger.warning(msg)
                                warnings.append(SidecarValidationWarning(
                                    code="invalid_acceptable_range_dropped",
                                    message=msg,
                                    path=f"exercise_timeline_anchors[{anchor_idx}].acceptable_ranges.{k}"
                                ))
                        else:
                            msg = f"Dropped invalid acceptable range format for joint '{k}'"
                            logger.warning(msg)
                            warnings.append(SidecarValidationWarning(
                                code="invalid_acceptable_range_dropped",
                                message=msg,
                                path=f"exercise_timeline_anchors[{anchor_idx}].acceptable_ranges.{k}"
                            ))
                                
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
                msg = f"Dropped invalid exercise timeline anchor index {anchor_idx}: {exc}"
                logger.warning(msg)
                warnings.append(SidecarValidationWarning(
                    code="anchor_timestamp_defaulted",
                    message=msg,
                    path=f"exercise_timeline_anchors[{anchor_idx}]"
                ))
                continue
                
        # 2. trainer_instruction_events
        trainer_instruction_events = []
        raw_events = manifest_dict.get('trainer_instruction_events', [])
        for event_idx, e in enumerate(raw_events):
            try:
                text = e.get('text')
                if not text or not isinstance(text, str) or not text.strip():
                    msg = f"Dropped empty or non-string trainer instruction event at index {event_idx}"
                    logger.warning(msg)
                    warnings.append(SidecarValidationWarning(
                        code="instruction_event_dropped",
                        message=msg,
                        path=f"trainer_instruction_events[{event_idx}]"
                    ))
                    continue
                text = clean_supplementary_text(text)
                
                raw_start_ms = e.get('start_ms')
                raw_end_ms = e.get('end_ms')
                
                start_defaulted = False
                end_defaulted = False
                
                if not is_finite_number(raw_start_ms):
                    msg = f"Trainer instruction event at index {event_idx} has non-finite start_ms ({raw_start_ms}), defaulted to 0.0"
                    logger.warning(msg)
                    warnings.append(SidecarValidationWarning(
                        code="instruction_timestamp_defaulted",
                        message=msg,
                        path=f"trainer_instruction_events[{event_idx}].start_ms"
                    ))
                    start_ms = 0.0
                    start_defaulted = True
                else:
                    start_ms = float(raw_start_ms)
                    
                if not is_finite_number(raw_end_ms):
                    msg = f"Trainer instruction event at index {event_idx} has non-finite end_ms ({raw_end_ms}), defaulted to max duration ms {max_ms}"
                    logger.warning(msg)
                    warnings.append(SidecarValidationWarning(
                        code="instruction_timestamp_defaulted",
                        message=msg,
                        path=f"trainer_instruction_events[{event_idx}].end_ms"
                    ))
                    end_ms = max_ms
                    end_defaulted = True
                else:
                    end_ms = float(raw_end_ms)
                    
                clamped_start = clamp_val(start_ms, 0.0, max_ms)
                clamped_end = clamp_val(end_ms, 0.0, max_ms)
                
                if (clamped_start != start_ms or clamped_end != end_ms) and not (start_defaulted and end_defaulted):
                    msg = f"Clamped event ms from ({start_ms}, {end_ms}) to ({clamped_start}, {clamped_end})"
                    logger.warning(msg)
                    warnings.append(SidecarValidationWarning(
                        code="instruction_timestamp_clamped",
                        message=msg,
                        path=f"trainer_instruction_events[{event_idx}]"
                    ))
                    
                start_ms, end_ms = clamped_start, clamped_end
                
                if start_ms > end_ms:
                    msg = f"Swapped start > end ms for event at index {event_idx}"
                    logger.warning(msg)
                    warnings.append(SidecarValidationWarning(
                        code="instruction_start_end_swapped",
                        message=msg,
                        path=f"trainer_instruction_events[{event_idx}]"
                    ))
                    start_ms, end_ms = end_ms, start_ms
                    
                timestamp_ms = e.get('timestamp_ms')
                if not is_finite_number(timestamp_ms):
                    msg = f"Trainer instruction event at index {event_idx} has non-finite timestamp_ms, defaulting to start_ms {start_ms}"
                    logger.warning(msg)
                    warnings.append(SidecarValidationWarning(
                        code="instruction_timestamp_defaulted",
                        message=msg,
                        path=f"trainer_instruction_events[{event_idx}].timestamp_ms"
                    ))
                    timestamp_ms = start_ms
                else:
                    timestamp_ms = float(timestamp_ms)
                    if timestamp_ms < start_ms or timestamp_ms > end_ms:
                        msg = f"Reset out-of-bounds timestamp_ms {timestamp_ms} to start_ms {start_ms}"
                        logger.warning(msg)
                        warnings.append(SidecarValidationWarning(
                            code="instruction_timestamp_clamped",
                            message=msg,
                            path=f"trainer_instruction_events[{event_idx}].timestamp_ms"
                        ))
                        timestamp_ms = start_ms
                timestamp_ms = clamp_val(timestamp_ms, start_ms, end_ms)
                
                event_type_str = e.get('event_type')
                try:
                    event_type = TrainerInstructionEventType(event_type_str)
                except ValueError:
                    msg = f"Defaulted invalid event_type '{event_type_str}' to FORM_CUE for event at index {event_idx}"
                    logger.warning(msg)
                    warnings.append(SidecarValidationWarning(
                        code="invalid_event_type_defaulted",
                        message=msg,
                        path=f"trainer_instruction_events[{event_idx}].event_type"
                    ))
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
            except Exception as exc:
                msg = f"Dropped invalid trainer instruction event index {event_idx}: {exc}"
                logger.warning(msg)
                warnings.append(SidecarValidationWarning(
                    code="instruction_event_dropped",
                    message=msg,
                    path=f"trainer_instruction_events[{event_idx}]"
                ))
                continue
                
        # 3. speaking_opportunity_map
        speaking_opportunity_map = []
        raw_windows = manifest_dict.get('speaking_opportunity_map', [])
        for win_idx, w in enumerate(raw_windows):
            try:
                raw_start_ms = w.get('start_ms')
                raw_end_ms = w.get('end_ms')
                if not is_finite_number(raw_start_ms) or not is_finite_number(raw_end_ms):
                    msg = f"Dropped speaking opportunity window at index {win_idx} due to non-finite bounds"
                    logger.warning(msg)
                    warnings.append(SidecarValidationWarning(
                        code="speaking_window_dropped",
                        message=msg,
                        path=f"speaking_opportunity_map[{win_idx}]"
                    ))
                    continue
                    
                start_ms = float(raw_start_ms)
                end_ms = float(raw_end_ms)
                
                clamped_start = clamp_val(start_ms, 0.0, max_ms)
                clamped_end = clamp_val(end_ms, 0.0, max_ms)
                
                if clamped_start != start_ms or clamped_end != end_ms:
                    msg = f"Clamped speaking window from ({start_ms}, {end_ms}) to ({clamped_start}, {clamped_end})"
                    logger.warning(msg)
                    warnings.append(SidecarValidationWarning(
                        code="speaking_window_clamped",
                        message=msg,
                        path=f"speaking_opportunity_map[{win_idx}]"
                    ))
                    
                start_ms, end_ms = clamped_start, clamped_end
                
                if start_ms > end_ms:
                    msg = f"Swapped start > end ms for speaking opportunity window"
                    logger.warning(msg)
                    warnings.append(SidecarValidationWarning(
                        code="speaking_window_start_end_swapped",
                        message=msg,
                        path=f"speaking_opportunity_map[{win_idx}]"
                    ))
                    start_ms, end_ms = end_ms, start_ms
                    
                mode_str = w.get('mode')
                try:
                    mode = SpeakingOpportunityMode(mode_str)
                except ValueError:
                    msg = f"Defaulted invalid speaking opportunity mode '{mode_str}' to HAPTIC_ONLY"
                    logger.warning(msg)
                    warnings.append(SidecarValidationWarning(
                        code="invalid_speaking_mode_defaulted",
                        message=msg,
                        path=f"speaking_opportunity_map[{win_idx}].mode"
                    ))
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
            except Exception as exc:
                msg = f"Dropped invalid speaking window index {win_idx}: {exc}"
                logger.warning(msg)
                warnings.append(SidecarValidationWarning(
                    code="speaking_window_dropped",
                    message=msg,
                    path=f"speaking_opportunity_map[{win_idx}]"
                ))
                continue
                
        # 4. form_risk_templates
        form_risk_templates = []
        raw_risks = manifest_dict.get('form_risk_templates', [])
        for risk_idx, r in enumerate(raw_risks):
            try:
                ex_name = r.get('exercise_name')
                joint = r.get('joint')
                if not ex_name or not joint or not isinstance(ex_name, str) or not isinstance(joint, str):
                    msg = f"Dropped invalid form risk template at index {risk_idx}"
                    logger.warning(msg)
                    warnings.append(SidecarValidationWarning(
                        code="form_risk_template_dropped",
                        message=msg,
                        path=f"form_risk_templates[{risk_idx}]"
                    ))
                    continue
                    
                form_risk_templates.append(
                    FormRiskTemplate(
                        exercise_name=ex_name.strip(),
                        joint=joint.strip(),
                        risk_description=r.get('risk_description'),
                        correction_cue=r.get('correction_cue'),
                    )
                )
            except Exception as exc:
                msg = f"Dropped invalid form risk template index {risk_idx}: {exc}"
                logger.warning(msg)
                warnings.append(SidecarValidationWarning(
                    code="form_risk_template_dropped",
                    message=msg,
                    path=f"form_risk_templates[{risk_idx}]"
                ))
                
        # 5. haptic_spatial_cue_profiles
        haptic_spatial_cue_profiles = []
        raw_profiles = manifest_dict.get('haptic_spatial_cue_profiles', [])
        for prof_idx, p in enumerate(raw_profiles):
            try:
                ex_name = p.get('exercise_name')
                if not ex_name or not isinstance(ex_name, str):
                    msg = f"Dropped invalid haptic cue profile at index {prof_idx}"
                    logger.warning(msg)
                    warnings.append(SidecarValidationWarning(
                        code="haptic_profile_dropped",
                        message=msg,
                        path=f"haptic_spatial_cue_profiles[{prof_idx}]"
                    ))
                    continue
                    
                haptic_spatial_cue_profiles.append(
                    HapticSpatialCueProfile(
                        exercise_name=ex_name.strip(),
                        body_parts=list(p.get('body_parts')) if p.get('body_parts') else [],
                        patterns=dict(p.get('patterns')) if p.get('patterns') else {},
                        default_intensity=p.get('default_intensity'),
                    )
                )
            except Exception as exc:
                msg = f"Dropped invalid haptic profile index {prof_idx}: {exc}"
                logger.warning(msg)
                warnings.append(SidecarValidationWarning(
                    code="haptic_profile_dropped",
                    message=msg,
                    path=f"haptic_spatial_cue_profiles[{prof_idx}]"
                ))
                
        # 6. beat_timestamps
        beat_timestamps = []
        raw_beats = manifest_dict.get('beat_timestamps', [])
        if isinstance(raw_beats, list):
            for beat_idx, b in enumerate(raw_beats):
                if not is_finite_number(b):
                    msg = f"Filtered non-finite beat timestamp: {b}"
                    logger.warning(msg)
                    warnings.append(SidecarValidationWarning(
                        code="beat_timestamp_dropped",
                        message=msg,
                        path=f"beat_timestamps[{beat_idx}]"
                    ))
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
                        else:
                            msg = f"Dropped invalid non-finite expected movement window values for exercise '{key}'"
                            logger.warning(msg)
                            warnings.append(SidecarValidationWarning(
                                code="expected_movement_window_dropped",
                                message=msg,
                                path=f"expected_movement_windows.{key}"
                            ))
                    except (ValueError, TypeError) as exc:
                        msg = f"Dropped invalid expected movement window for exercise '{key}': {exc}"
                        logger.warning(msg)
                        warnings.append(SidecarValidationWarning(
                            code="expected_movement_window_dropped",
                            message=msg,
                            path=f"expected_movement_windows.{key}"
                        ))
                else:
                    msg = f"Dropped invalid format expected movement window for exercise '{key}'"
                    logger.warning(msg)
                    warnings.append(SidecarValidationWarning(
                        code="expected_movement_window_dropped",
                        message=msg,
                        path=f"expected_movement_windows.{key}"
                    ))
                        
        manifest = AssistanceSidecarManifest(
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
        return SidecarValidationResult(manifest=manifest, warnings=warnings)
    except Exception as e:
        logger.error('Failed to perform semantic clamping and schema validation on sidecar dictionary: %s', e)
        return SidecarValidationResult(manifest=None, warnings=warnings)


def validate_and_clamp_sidecar_manifest(
    manifest_dict: dict[str, Any],
    video_duration: float,
    youtube_id: str,
    video_uuid: uuid.UUID,
) -> Optional[AssistanceSidecarManifest]:
    """Backward-compatible validation wrapper returning manifest only."""
    res = validate_and_clamp_sidecar_manifest_with_warnings(
        manifest_dict=manifest_dict,
        video_duration=video_duration,
        youtube_id=youtube_id,
        video_uuid=video_uuid
    )
    return res.manifest
