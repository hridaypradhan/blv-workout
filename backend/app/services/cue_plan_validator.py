"""Validation and safety clamping service for FitA11y cue plans."""

from __future__ import annotations

import logging
import math
import re
import uuid
from dataclasses import dataclass
from typing import Any, Optional

from app.models.cue_plan_schemas import (
    CuePlan,
    CueCandidate,
    CuePlanValidationWarning,
    ExerciseCueDescription,
    TrainerInstructionSummary,
    CueTextVariants,
    CueModality,
    CueSourceType,
    CuePriority,
    CueIntent,
    InterruptionPolicyHint,
)

@dataclass
class CuePlanValidationResult:
    """Result of cue plan validation and safety clamping."""

    cue_plan: Optional[CuePlan]
    warnings: list[CuePlanValidationWarning]


logger = logging.getLogger(__name__)


def is_finite_number(val: Any) -> bool:
    if isinstance(val, (int, float)):
        return not (math.isnan(val) or math.isinf(val))
    return False


def clamp_val(val: float, min_val: float, max_val: float) -> float:
    return max(min_val, min(val, max_val))


def strip_transcript_artifacts(text: str) -> str:
    """Strips common transcript captions artifacts, annotations, and timestamps."""
    if not text:
        return ""
    # Remove bracketed/parenthesized annotations, e.g. [Music], (Laughter)
    text = re.sub(r"\[[^\]]+\]", "", text)
    text = re.sub(r"\([^)]+\)", "", text)
    # Remove timestamps like 12:34 or 1:23:45
    text = re.sub(r"\b\d{1,2}:\d{2}(:\d{2})?\b", "", text)
    # Remove excessive whitespace
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def check_forbidden_phrases(text: str) -> Optional[str]:
    """Checks for phrases suggesting live camera body observation or medical/injury diagnosis."""
    text_lower = text.lower()
    
    # Medical diagnosis patterns
    medical_patterns = [
        "diagnos",
        "muscle strain",
        "ligament",
        "tendonitis",
        "sprain",
        "injury",
        "medical advice",
        "clinical",
    ]
    # Live body observation patterns
    observation_patterns = [
        "i can see you",
        "i see your",
        "camera detects",
        "camera shows",
        "looking at your",
        "looking at you",
        "i am watching you",
        "my screen shows",
    ]
    
    for p in medical_patterns:
        if p in text_lower:
            return f"forbidden_medical_phrase: contains '{p}'"
    for p in observation_patterns:
        if p in text_lower:
            return f"forbidden_observation_phrase: contains '{p}'"
            
    return None


def validate_and_clamp_cue_plan(
    cue_plan_dict: dict[str, Any],
    video_duration_seconds: float,
    video_uuid: Optional[uuid.UUID] = None,
) -> CuePlanValidationResult:
    """Validates, clamps timestamps, and filters raw cue plan dictionaries to ensure safety."""
    warnings = []
    
    try:
        max_seconds = max(0.0, video_duration_seconds)
        max_ms = max_seconds * 1000.0
        
        pre_session_overview = cue_plan_dict.get("pre_session_overview", "")
        pre_session_overview = strip_transcript_artifacts(pre_session_overview)
        if pre_session_overview and len(pre_session_overview) > 800:
            pre_session_overview = pre_session_overview[:797] + "..."
            warnings.append(CuePlanValidationWarning(
                code="text_too_long",
                message="Pre-session overview exceeded 800 chars, truncated.",
                path="pre_session_overview"
            ))
        
        # 1. exercise_descriptions
        exercise_descriptions = []
        raw_descriptions = cue_plan_dict.get("exercise_descriptions", [])
        for desc_idx, d in enumerate(raw_descriptions):
            anchor_id = d.get("exercise_anchor_id")
            name = d.get("name", "")
            accessible_description = d.get("accessible_description", "")
            
            if not anchor_id or not isinstance(anchor_id, str) or not anchor_id.strip():
                msg = f"Dropped exercise description at index {desc_idx} due to empty anchor_id."
                logger.warning(msg)
                warnings.append(CuePlanValidationWarning(
                    code="missing_anchor_id",
                    message=msg,
                    path=f"exercise_descriptions[{desc_idx}]"
                ))
                continue
                
            accessible_description = strip_transcript_artifacts(accessible_description)
            if accessible_description and len(accessible_description) > 500:
                accessible_description = accessible_description[:497] + "..."
                warnings.append(CuePlanValidationWarning(
                    code="text_too_long",
                    message=f"Exercise description for '{name}' exceeded 500 chars, truncated.",
                    path=f"exercise_descriptions[{desc_idx}].accessible_description"
                ))
            
            # Check forbidden phrases in descriptions
            forbidden_err = check_forbidden_phrases(accessible_description)
            if forbidden_err:
                msg = f"Sanitized exercise description for '{name}': {forbidden_err}"
                logger.warning(msg)
                warnings.append(CuePlanValidationWarning(
                    code="forbidden_phrase_sanitized",
                    message=msg,
                    path=f"exercise_descriptions[{desc_idx}].accessible_description"
                ))
                # Replace with safe generic placeholder
                accessible_description = "Perform the exercise maintaining steady posture."
                
            exercise_descriptions.append(
                ExerciseCueDescription(
                    exercise_anchor_id=anchor_id.strip(),
                    name=name.strip(),
                    accessible_description=accessible_description,
                )
            )
            
        # 2. cue_candidates
        cue_candidates = []
        raw_candidates = cue_plan_dict.get("cue_candidates", [])
        for cand_idx, c in enumerate(raw_candidates):
            candidate_id = c.get("id")
            if not candidate_id or not isinstance(candidate_id, str) or not candidate_id.strip():
                msg = f"Dropped cue candidate at index {cand_idx} due to empty candidate ID."
                logger.warning(msg)
                warnings.append(CuePlanValidationWarning(
                    code="invalid_candidate_id",
                    message=msg,
                    path=f"cue_candidates[{cand_idx}]"
                ))
                continue
                
            allowed_modalities_raw = c.get("allowed_modalities", [])
            if not isinstance(allowed_modalities_raw, list):
                allowed_modalities_raw = []
            
            valid_modalities = []
            for m in allowed_modalities_raw:
                if isinstance(m, CueModality):
                    valid_modalities.append(m)
                    continue
                m_str = str(m).strip().lower()
                try:
                    valid_modalities.append(CueModality(m_str))
                except ValueError:
                    warnings.append(CuePlanValidationWarning(
                        code="invalid_modality",
                        message=f"Candidate '{candidate_id}' has invalid modality '{m}', ignoring it.",
                        path=f"cue_candidates[{cand_idx}].allowed_modalities"
                    ))
            
            if not valid_modalities:
                msg = f"Dropped candidate '{candidate_id}' because it has no valid modalities."
                logger.warning(msg)
                warnings.append(CuePlanValidationWarning(
                    code="empty_modalities",
                    message=msg,
                    path=f"cue_candidates[{cand_idx}]"
                ))
                continue
                
            allowed_modalities = valid_modalities
            
            # Validate Source Type
            source_type_val = c.get("source_type")
            try:
                source_type = CueSourceType(source_type_val)
            except (ValueError, TypeError):
                msg = f"Dropped candidate '{candidate_id}' due to invalid source_type '{source_type_val}'."
                logger.warning(msg)
                warnings.append(CuePlanValidationWarning(
                    code="invalid_source_type",
                    message=msg,
                    path=f"cue_candidates[{cand_idx}].source_type"
                ))
                continue
                
            # Validate Priority
            priority_val = c.get("priority", "medium")
            try:
                priority = CuePriority(priority_val)
            except ValueError:
                priority = CuePriority.MEDIUM
                warnings.append(CuePlanValidationWarning(
                    code="invalid_priority_sanitized",
                    message=f"Candidate '{candidate_id}' has invalid priority '{priority_val}', defaulted to medium.",
                    path=f"cue_candidates[{cand_idx}].priority"
                ))
                
            # Validate Intent
            intent_val = c.get("intent", "movement_description")
            try:
                intent = CueIntent(intent_val)
            except ValueError:
                intent = CueIntent.MOVEMENT_DESCRIPTION
                warnings.append(CuePlanValidationWarning(
                    code="invalid_intent_sanitized",
                    message=f"Candidate '{candidate_id}' has invalid intent '{intent_val}', defaulted to movement_description.",
                    path=f"cue_candidates[{cand_idx}].intent"
                ))
                
            # Validate Interruption Policy Hint
            policy_val = c.get("interruption_policy_hint", "safe_gap_only")
            try:
                policy = InterruptionPolicyHint(policy_val)
            except ValueError:
                policy = InterruptionPolicyHint.SAFE_GAP_ONLY
                warnings.append(CuePlanValidationWarning(
                    code="invalid_policy_sanitized",
                    message=f"Candidate '{candidate_id}' has invalid interruption_policy_hint '{policy_val}', defaulted to safe_gap_only.",
                    path=f"cue_candidates[{cand_idx}].interruption_policy_hint"
                ))
            
            # Drop audio cues without text variants
            text_variants_dict = c.get("text_variants")
            has_audio = CueModality.AUDIO in allowed_modalities
            
            if has_audio and not text_variants_dict:
                msg = f"Dropped candidate '{candidate_id}' because it allows audio but has no text variants."
                logger.warning(msg)
                warnings.append(CuePlanValidationWarning(
                    code="missing_text_variants",
                    message=msg,
                    path=f"cue_candidates[{cand_idx}]"
                ))
                continue
                
            # Drop haptic cues without haptic_cue_ref if modality is ONLY haptic
            haptic_cue_ref = c.get("haptic_cue_ref")
            has_haptic = CueModality.HAPTIC in allowed_modalities
            
            if has_haptic and not has_audio and not haptic_cue_ref:
                msg = f"Dropped candidate '{candidate_id}' because it is haptic-only but lacks haptic_cue_ref."
                logger.warning(msg)
                warnings.append(CuePlanValidationWarning(
                    code="missing_haptic_ref",
                    message=msg,
                    path=f"cue_candidates[{cand_idx}]"
                ))
                continue
                
            # Timestamps clamping
            raw_start_ms = c.get("start_ms")
            raw_end_ms = c.get("end_ms")
            
            start_defaulted = False
            end_defaulted = False
            
            if not is_finite_number(raw_start_ms):
                start_ms = 0.0
                start_defaulted = True
                warnings.append(CuePlanValidationWarning(
                    code="timestamp_defaulted",
                    message=f"Candidate '{candidate_id}' start_ms is non-finite, defaulted to 0.0",
                    path=f"cue_candidates[{cand_idx}].start_ms"
                ))
            else:
                start_ms = float(raw_start_ms)
                
            if not is_finite_number(raw_end_ms):
                end_ms = max_ms
                end_defaulted = True
                warnings.append(CuePlanValidationWarning(
                    code="timestamp_defaulted",
                    message=f"Candidate '{candidate_id}' end_ms is non-finite, defaulted to max ms",
                    path=f"cue_candidates[{cand_idx}].end_ms"
                ))
            else:
                end_ms = float(raw_end_ms)
                
            clamped_start = clamp_val(start_ms, 0.0, max_ms)
            clamped_end = clamp_val(end_ms, 0.0, max_ms)
            
            if (clamped_start != start_ms or clamped_end != end_ms) and not (start_defaulted and end_defaulted):
                warnings.append(CuePlanValidationWarning(
                    code="timestamp_clamped",
                    message=f"Clamped candidate '{candidate_id}' ms from ({start_ms}, {end_ms}) to ({clamped_start}, {clamped_end})",
                    path=f"cue_candidates[{cand_idx}]"
                ))
            
            start_ms, end_ms = clamped_start, clamped_end
            
            if start_ms > end_ms:
                warnings.append(CuePlanValidationWarning(
                    code="timestamp_swapped",
                    message=f"Swapped start > end ms for candidate '{candidate_id}'",
                    path=f"cue_candidates[{cand_idx}]"
                ))
                start_ms, end_ms = end_ms, start_ms
                
            # Parse text variants
            parsed_text_variants = None
            if text_variants_dict:
                brief = text_variants_dict.get("brief")
                moderate = text_variants_dict.get("moderate", "")
                detailed = text_variants_dict.get("detailed")
                
                # Moderate must be provided
                if not moderate:
                    moderate = "Please perform the movement steady."
                    warnings.append(CuePlanValidationWarning(
                        code="missing_moderate_text",
                        message=f"Candidate '{candidate_id}' has empty moderate text, defaulted.",
                        path=f"cue_candidates[{cand_idx}].text_variants.moderate"
                    ))
                
                # Truncate and warn on length limits
                if brief and len(brief) > 80:
                    brief = brief[:77] + "..."
                    warnings.append(CuePlanValidationWarning(
                        code="text_too_long",
                        message=f"Candidate '{candidate_id}' brief text exceeded 80 chars, truncated.",
                        path=f"cue_candidates[{cand_idx}].text_variants.brief"
                    ))
                if len(moderate) > 180:
                    moderate = moderate[:177] + "..."
                    warnings.append(CuePlanValidationWarning(
                        code="text_too_long",
                        message=f"Candidate '{candidate_id}' moderate text exceeded 180 chars, truncated.",
                        path=f"cue_candidates[{cand_idx}].text_variants.moderate"
                    ))
                if detailed and len(detailed) > 320:
                    detailed = detailed[:317] + "..."
                    warnings.append(CuePlanValidationWarning(
                        code="text_too_long",
                        message=f"Candidate '{candidate_id}' detailed text exceeded 320 chars, truncated.",
                        path=f"cue_candidates[{cand_idx}].text_variants.detailed"
                    ))
                
                # Strip artifacts
                if brief:
                    brief = strip_transcript_artifacts(brief)
                moderate = strip_transcript_artifacts(moderate)
                if detailed:
                    detailed = strip_transcript_artifacts(detailed)
                    
                # Check forbidden medical/observation phrases
                forbidden_err = (
                    check_forbidden_phrases(brief or "") or
                    check_forbidden_phrases(moderate) or
                    check_forbidden_phrases(detailed or "")
                )
                if forbidden_err:
                    msg = f"Dropped candidate '{candidate_id}' due to {forbidden_err}"
                    logger.warning(msg)
                    warnings.append(CuePlanValidationWarning(
                        code="forbidden_phrase_dropped",
                        message=msg,
                        path=f"cue_candidates[{cand_idx}]"
                    ))
                    continue
                    
                parsed_text_variants = CueTextVariants(
                    brief=brief,
                    moderate=moderate,
                    detailed=detailed,
                )
                
            cue_candidates.append(
                CueCandidate(
                    id=candidate_id.strip(),
                    exercise_anchor_id=c.get("exercise_anchor_id"),
                    source_type=source_type,
                    source_ref=c.get("source_ref"),
                    start_ms=start_ms,
                    end_ms=end_ms,
                    priority=priority,
                    intent=intent,
                    allowed_modalities=allowed_modalities,
                    text_variants=parsed_text_variants,
                    haptic_cue_ref=haptic_cue_ref,
                    interruption_policy_hint=policy,
                )
            )
            
        # 3. trainer_instruction_summaries
        trainer_instruction_summaries = []
        raw_summaries = cue_plan_dict.get("trainer_instruction_summaries", [])
        for sum_idx, s in enumerate(raw_summaries):
            summary_text = s.get("summary", "")
            if not summary_text or not isinstance(summary_text, str) or not summary_text.strip():
                continue
            
            summary_text = strip_transcript_artifacts(summary_text)
            if len(summary_text) > 220:
                summary_text = summary_text[:217] + "..."
                warnings.append(CuePlanValidationWarning(
                    code="text_too_long",
                    message=f"Trainer instruction summary at index {sum_idx} exceeded 220 chars, truncated.",
                    path=f"trainer_instruction_summaries[{sum_idx}].summary"
                ))
            
            raw_start_ms = s.get("start_ms", 0.0)
            raw_end_ms = s.get("end_ms", max_ms)
            
            start_ms = clamp_val(float(raw_start_ms) if is_finite_number(raw_start_ms) else 0.0, 0.0, max_ms)
            end_ms = clamp_val(float(raw_end_ms) if is_finite_number(raw_end_ms) else max_ms, 0.0, max_ms)
            
            if start_ms > end_ms:
                start_ms, end_ms = end_ms, start_ms
                
            trainer_instruction_summaries.append(
                TrainerInstructionSummary(
                    source_event_id=s.get("source_event_id"),
                    start_ms=start_ms,
                    end_ms=end_ms,
                    summary=summary_text,
                )
            )
            
        cue_plan = CuePlan(
            video_id=video_uuid,
            youtube_id=cue_plan_dict.get("youtube_id"),
            pre_session_overview=pre_session_overview,
            exercise_descriptions=exercise_descriptions,
            cue_candidates=cue_candidates,
            trainer_instruction_summaries=trainer_instruction_summaries,
            validation_warnings=warnings,
            created_at=cue_plan_dict.get("created_at"),
        )
        return CuePlanValidationResult(cue_plan=cue_plan, warnings=warnings)
        
    except Exception as e:
        logger.error("Failed to perform clamping and validation on cue plan dict: %s", e)
        return CuePlanValidationResult(cue_plan=None, warnings=warnings)
