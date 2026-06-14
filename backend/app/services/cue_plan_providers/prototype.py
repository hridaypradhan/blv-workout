"""Deterministic prototype cue plan provider for FitA11y."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.services.cue_plan_providers.base import CuePlanProvider, CuePlanGenerationInput
from app.models.cue_plan_schemas import (
    CuePlan,
    CueCandidate,
    CueTextVariants,
    ExerciseCueDescription,
    TrainerInstructionSummary,
    CueModality,
)

PROMPT_VERSION = "prototype_deterministic_v1"
SCHEMA_VERSION = "cue_plan_schema_v1"


class PrototypeCuePlanProvider(CuePlanProvider):
    """Generates deterministic, safe cue plans offline from sidecar manifest details."""

    def generate_cue_plan(self, input_data: CuePlanGenerationInput) -> dict[str, Any]:
        manifest = input_data.sidecar_manifest
        youtube_id = input_data.youtube_id
        video_uuid = manifest.video_id
        
        # 1. Pre-session overview
        exercise_names = [a.name for a in manifest.exercise_timeline_anchors]
        if exercise_names:
            names_str = ", ".join(exercise_names)
            pre_session_overview = (
                f"Welcome to your assistive playback session. This workout contains {len(exercise_names)} "
                f"exercises: {names_str}. We will provide supplementary timing and form cues alongside the original trainer's audio."
            )
        else:
            pre_session_overview = (
                "Welcome to your assistive playback session. We will provide supplementary timing and form cues "
                "alongside the original trainer's audio."
            )
            
        # 2. Exercise descriptions
        exercise_descriptions = []
        for anchor in manifest.exercise_timeline_anchors:
            desc = anchor.description_accessible or f"Perform the exercise {anchor.name}."
            exercise_descriptions.append({
                "exercise_anchor_id": str(anchor.id),
                "name": anchor.name,
                "accessible_description": desc,
            })
            
        # 3. Cue candidates list
        cue_candidates = []
        
        # Generate setup and description candidates for each exercise
        for anchor in manifest.exercise_timeline_anchors:
            anchor_start_ms = anchor.start_time_seconds * 1000.0
            anchor_end_ms = anchor.end_time_seconds * 1000.0
            anchor_id_str = str(anchor.id)
            
            # Setup/Orientation (5s before anchor starts, clamped to >= 0)
            setup_start = max(0.0, anchor_start_ms - 5000.0)
            setup_end = anchor_start_ms
            
            cue_candidates.append({
                "id": f"setup_{anchor_id_str[:8]}",
                "exercise_anchor_id": anchor_id_str,
                "source_type": "exercise_anchor",
                "source_ref": "timeline_anchor",
                "start_ms": setup_start,
                "end_ms": setup_end,
                "priority": "medium",
                "intent": "setup_orientation",
                "allowed_modalities": [CueModality.AUDIO],
                "text_variants": {
                    "brief": f"Prepare for {anchor.name}.",
                    "moderate": f"Get ready to perform {anchor.name}.",
                    "detailed": f"Prepare to perform {anchor.name}. Find a comfortable starting position and clear your active space."
                },
                "haptic_cue_ref": None,
                "interruption_policy_hint": "safe_gap_only"
            })
            
            # Movement description (starts at anchor start, ends 8s later or at anchor end)
            desc_end = min(anchor_end_ms, anchor_start_ms + 8000.0)
            desc_text = anchor.description_accessible or f"Perform the movement for {anchor.name}."
            
            cue_candidates.append({
                "id": f"desc_{anchor_id_str[:8]}",
                "exercise_anchor_id": anchor_id_str,
                "source_type": "exercise_anchor",
                "source_ref": "timeline_anchor",
                "start_ms": anchor_start_ms,
                "end_ms": desc_end,
                "priority": "low",
                "intent": "movement_description",
                "allowed_modalities": [CueModality.AUDIO],
                "text_variants": {
                    "brief": f"Starting {anchor.name}.",
                    "moderate": f"Beginning {anchor.name}. {desc_text}",
                    "detailed": f"Now starting {anchor.name}. Pacing details: {desc_text}"
                },
                "haptic_cue_ref": None,
                "interruption_policy_hint": "duck_speak"
            })
            
            # Map Form risks associated with this exercise name
            for risk in manifest.form_risk_templates:
                if risk.exercise_name.lower() in anchor.name.lower():
                    # Generate form correction reminder cue (middle of exercise, 10s-15s in)
                    risk_start = min(anchor_end_ms, anchor_start_ms + 10000.0)
                    risk_end = min(anchor_end_ms, risk_start + 5000.0)
                    
                    cue_candidates.append({
                        "id": f"risk_{anchor_id_str[:8]}_{risk.joint}",
                        "exercise_anchor_id": anchor_id_str,
                        "source_type": "form_risk",
                        "source_ref": f"risk_template:{risk.joint}",
                        "start_ms": risk_start,
                        "end_ms": risk_end,
                        "priority": "high",
                        "intent": "form_reminder",
                        "allowed_modalities": [CueModality.AUDIO, CueModality.HAPTIC],
                        "text_variants": {
                            "brief": f"Keep {risk.joint} stable.",
                            "moderate": f"Form reminder: {risk.correction_cue or 'Maintain proper alignment.'}",
                            "detailed": f"Form alert for {anchor.name}: {risk.risk_description or 'Watch your joint extension.'}. {risk.correction_cue or 'Adjust your form.'}"
                        },
                        "haptic_cue_ref": "form_warning_above",
                        "interruption_policy_hint": "duck_speak"
                    })
                    
        # Generate haptic candidates from speaking opportunity map or haptic profiles
        for win_idx, w in enumerate(manifest.speaking_opportunity_map):
            cue_candidates.append({
                "id": f"haptic_win_{win_idx}",
                "exercise_anchor_id": None,
                "source_type": "speaking_window",
                "source_ref": f"speaking_map:{win_idx}",
                "start_ms": w.start_ms,
                "end_ms": w.end_ms,
                "priority": "medium",
                "intent": "haptic_prompt",
                "allowed_modalities": [CueModality.HAPTIC],
                "text_variants": None,
                "haptic_cue_ref": "countdown" if "countdown" in (w.context or "").lower() else "per_rep_tick",
                "interruption_policy_hint": "haptic_only"
            })
            
        # 4. Trainer instruction repeat summaries
        trainer_instruction_summaries = []
        for idx, event in enumerate(manifest.trainer_instruction_events):
            trainer_instruction_summaries.append({
                "source_event_id": f"event_{idx}",
                "start_ms": event.start_ms,
                "end_ms": event.end_ms,
                "summary": event.text,
            })
            
            # Add cue candidate to repeat trainer instruction if marked important
            if event.assistant_may_speak:
                cue_candidates.append({
                    "id": f"repeat_event_{idx}",
                    "exercise_anchor_id": None,
                    "source_type": "trainer_instruction",
                    "source_ref": f"instruction_event:{idx}",
                    "start_ms": event.timestamp_ms or event.start_ms,
                    "end_ms": min(input_data.duration_seconds * 1000.0, (event.timestamp_ms or event.start_ms) + 4000.0),
                    "priority": "medium",
                    "intent": "trainer_instruction_repeat",
                    "allowed_modalities": [CueModality.AUDIO],
                    "text_variants": {
                        "brief": f"Trainer: {event.text}",
                        "moderate": f"Trainer says: {event.text}",
                        "detailed": f"Trainer instructed: {event.text}"
                    },
                    "haptic_cue_ref": None,
                    "interruption_policy_hint": "duck_speak"
                })
                
        return {
            "youtube_id": youtube_id,
            "pre_session_overview": pre_session_overview,
            "exercise_descriptions": exercise_descriptions,
            "cue_candidates": cue_candidates,
            "trainer_instruction_summaries": trainer_instruction_summaries,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
