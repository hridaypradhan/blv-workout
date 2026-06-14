"""Adapter to convert Gemini-specific DTO response to canonical CuePlan schemas."""

from __future__ import annotations

from typing import Any
from datetime import datetime, timezone

from app.services.cue_plan_providers.gemini_cue_plan.schema import CuePlanGemini


SOURCE_TYPE_MAPPING = {
    "speaking_opportunity": "speaking_window",
    "speaking_opportunity_map": "speaking_window",
    "speech_window": "speaking_window",
    "form_correction": "form_risk",
}

INTENT_MAPPING = {
    "form_correction": "form_reminder",
    "correction": "form_reminder",
    "setup": "setup_orientation",
    "transition": "transition_notice",
    "repeat_instruction": "trainer_instruction_repeat",
}

INTERRUPTION_POLICY_MAPPING = {
    "allow": "safe_gap_only",
    "allowed": "safe_gap_only",
    "speak": "safe_gap_only",
    "duck": "duck_speak",
    "pause": "pause_then_speak",
    "haptic": "haptic_only",
}

MODALITY_MAPPING = {
    "voice": "audio",
    "speech": "audio",
    "vibration": "haptic",
    "tactile": "haptic",
}


def convert_gemini_to_canonical(gemini_plan: CuePlanGemini, youtube_id: str) -> dict[str, Any]:
    """Converts a Gemini-structured DTO object into a canonical CuePlan dictionary format, normalizing common aliases."""
    
    # 1. exercise_descriptions
    exercise_descriptions = []
    for d in gemini_plan.exercise_descriptions:
        exercise_descriptions.append({
            "exercise_anchor_id": d.exercise_anchor_id,
            "name": d.name,
            "accessible_description": d.accessible_description,
        })
        
    # 2. cue_candidates
    cue_candidates = []
    for c in gemini_plan.cue_candidates:
        # Normalize source_type
        src_type = c.source_type
        norm_src = src_type.strip().lower() if src_type else ""
        if norm_src in SOURCE_TYPE_MAPPING:
            src_type = SOURCE_TYPE_MAPPING[norm_src]

        # Normalize intent
        intent = c.intent
        norm_intent = intent.strip().lower() if intent else ""
        if norm_intent in INTENT_MAPPING:
            intent = INTENT_MAPPING[norm_intent]

        # Normalize interruption_policy_hint
        policy = c.interruption_policy_hint
        norm_policy = policy.strip().lower() if policy else ""
        if norm_policy in INTERRUPTION_POLICY_MAPPING:
            policy = INTERRUPTION_POLICY_MAPPING[norm_policy]

        # Normalize allowed_modalities
        modalities = []
        for m in c.allowed_modalities:
            norm_m = m.strip().lower() if m else ""
            if norm_m in MODALITY_MAPPING:
                modalities.append(MODALITY_MAPPING[norm_m])
            else:
                modalities.append(m)

        text_variants = None
        if c.text_variants:
            text_variants = {
                "brief": c.text_variants.brief,
                "moderate": c.text_variants.moderate,
                "detailed": c.text_variants.detailed,
            }
            
        cue_candidates.append({
            "id": c.id,
            "exercise_anchor_id": c.exercise_anchor_id,
            "source_type": src_type,
            "source_ref": c.source_ref,
            "start_ms": c.start_ms,
            "end_ms": c.end_ms,
            "priority": c.priority,
            "intent": intent,
            "allowed_modalities": modalities,
            "text_variants": text_variants,
            "haptic_cue_ref": c.haptic_cue_ref,
            "interruption_policy_hint": policy,
        })
        
    # 3. trainer_instruction_summaries
    trainer_instruction_summaries = []
    for s in gemini_plan.trainer_instruction_summaries:
        trainer_instruction_summaries.append({
            "source_event_id": s.source_event_id,
            "start_ms": s.start_ms,
            "end_ms": s.end_ms,
            "summary": s.summary,
        })
        
    return {
        "youtube_id": youtube_id,
        "pre_session_overview": gemini_plan.pre_session_overview,
        "exercise_descriptions": exercise_descriptions,
        "cue_candidates": cue_candidates,
        "trainer_instruction_summaries": trainer_instruction_summaries,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
