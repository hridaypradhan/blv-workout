from __future__ import annotations
import logging
from typing import Optional, List, Literal
from pydantic import BaseModel
from uuid import UUID

from app.models.cue_plan_schemas import CuePlan, CueCandidate, CueModality, CuePriority, InterruptionPolicyHint
from app.models.schemas import AudioCoexistenceSettings, InterruptionLevel, AssistantVerbosity
from app.core.storage import get_artifact_storage

# Wrapper to preserve compatibility with test patching
def load_cue_plan_from_disk(video_id: str) -> Optional[CuePlan]:
    return get_artifact_storage().load_cue_plan(video_id)

logger = logging.getLogger(__name__)


class RuntimeCueSelectionResponse(BaseModel):
    cue_id: Optional[str] = None
    should_deliver: bool = False
    modality: Optional[CueModality] = None
    text: Optional[str] = None
    haptic_cue_ref: Optional[str] = None
    interruption_policy_hint: Optional[InterruptionPolicyHint] = None
    recommended_playback_action: Optional[Literal["none", "pause_before_speaking", "duck_audio"]] = None
    reason: str


class CuePlanRuntimeService:
    """Service for deterministic runtime selection of cue plan candidates."""

    def select_cue(
        self,
        video_id: str,
        current_time_ms: float,
        settings: AudioCoexistenceSettings,
        assistant_muted: bool,
        recently_delivered_cue_ids: Optional[List[str]] = None,
    ) -> RuntimeCueSelectionResponse:
        # Load the cue plan
        cue_plan = load_cue_plan_from_disk(video_id)
        if not cue_plan:
            return RuntimeCueSelectionResponse(
                should_deliver=False,
                reason="cue_plan_not_found"
            )

        if not recently_delivered_cue_ids:
            recently_delivered_cue_ids = []

        # 1. Filter candidates by current time window: start_ms <= current_time_ms <= end_ms
        active_candidates = []
        for c in cue_plan.cue_candidates:
            if c.start_ms <= current_time_ms <= c.end_ms:
                active_candidates.append(c)

        if not active_candidates:
            return RuntimeCueSelectionResponse(
                should_deliver=False,
                reason="no_active_candidates_in_window"
            )

        # 2. Skip recently delivered candidates
        eligible_candidates = [
            c for c in active_candidates if c.id not in recently_delivered_cue_ids
        ]

        if not eligible_candidates:
            return RuntimeCueSelectionResponse(
                should_deliver=False,
                reason="all_active_candidates_recently_delivered"
            )

        # 3. Check modality and policy compatibility for each candidate
        # If settings require silent, nothing can be delivered
        if settings.interruption_level == InterruptionLevel.SILENT:
            return RuntimeCueSelectionResponse(
                should_deliver=False,
                reason="silent_mode_suppresses_all_cues"
            )

        # Helper to check if audio is allowed by user settings & mute status
        audio_allowed_by_settings = (
            not assistant_muted
            and settings.interruption_level in (InterruptionLevel.BRIEF_SPEECH, InterruptionLevel.FULL_SPEECH)
        )

        final_candidates = []
        # We'll store a tuple of (candidate, delivery_modality, text_to_deliver)
        for c in eligible_candidates:
            chosen_modality = None
            text_to_deliver = None

            # Try to deliver as audio first
            can_deliver_audio = False
            if audio_allowed_by_settings and CueModality.AUDIO in c.allowed_modalities:
                # Check policy hint compatibility
                if settings.interruption_level == InterruptionLevel.BRIEF_SPEECH:
                    # brief_speech allows only safe_gap_only or pause_then_speak
                    if c.interruption_policy_hint in (InterruptionPolicyHint.SAFE_GAP_ONLY, InterruptionPolicyHint.PAUSE_THEN_SPEAK):
                        can_deliver_audio = True
                elif settings.interruption_level == InterruptionLevel.FULL_SPEECH:
                    # full_speech allows duck_speak, safe_gap_only, pause_then_speak
                    if c.interruption_policy_hint in (
                        InterruptionPolicyHint.SAFE_GAP_ONLY,
                        InterruptionPolicyHint.PAUSE_THEN_SPEAK,
                        InterruptionPolicyHint.DUCKSPEAK
                    ):
                        can_deliver_audio = True

            if can_deliver_audio:
                chosen_modality = CueModality.AUDIO
                # Select text variant based on verbosity/settings
                variants = c.text_variants
                if variants:
                    if settings.interruption_level == InterruptionLevel.BRIEF_SPEECH or settings.assistant_verbosity == AssistantVerbosity.MINIMAL:
                        text_to_deliver = variants.brief or variants.moderate
                    elif settings.assistant_verbosity == AssistantVerbosity.DETAILED:
                        text_to_deliver = variants.detailed or variants.moderate
                    else:
                        text_to_deliver = variants.moderate
                else:
                    text_to_deliver = "Please perform the movement."
            # Fallback to haptic if audio is not allowed/possible, and haptic is allowed by candidate & settings
            elif CueModality.HAPTIC in c.allowed_modalities:
                # Haptic is allowed as long as interruption level is not SILENT
                chosen_modality = CueModality.HAPTIC
                # Keep haptic-only cues textless unless audio modality is allowed
                if audio_allowed_by_settings:
                    variants = c.text_variants
                    if variants:
                        if settings.assistant_verbosity == AssistantVerbosity.MINIMAL:
                            text_to_deliver = variants.brief or variants.moderate
                        elif settings.assistant_verbosity == AssistantVerbosity.DETAILED:
                            text_to_deliver = variants.detailed or variants.moderate
                        else:
                            text_to_deliver = variants.moderate

            if chosen_modality:
                final_candidates.append((c, chosen_modality, text_to_deliver))

        if not final_candidates:
            return RuntimeCueSelectionResponse(
                should_deliver=False,
                reason="no_candidates_compatible_with_settings"
            )

        # 4. Sort candidates:
        # Priority mapping: high = 3, medium = 2, low = 1
        priority_map = {
            CuePriority.HIGH: 3,
            CuePriority.MEDIUM: 2,
            CuePriority.LOW: 1
        }

        # pause_before_speaking preference: if settings.pause_before_speaking is True,
        # prefer candidates with interruption_policy_hint == pause_then_speak
        def sort_key(item):
            cand, delivery_mod, _ = item
            priority_val = priority_map.get(cand.priority, 2)
            
            prefer_pause = 0
            if settings.pause_before_speaking and cand.interruption_policy_hint == InterruptionPolicyHint.PAUSE_THEN_SPEAK:
                prefer_pause = 1
                
            # Sort descending by priority, then descending by pause preference, then ascending by start_ms
            # In Python, we can return a tuple: (-priority_val, -prefer_pause, cand.start_ms)
            return (-priority_val, -prefer_pause, cand.start_ms)

        final_candidates.sort(key=sort_key)

        selected_cand, selected_modality, selected_text = final_candidates[0]

        # 5. Determine recommended playback action
        recommended_action: Literal["none", "pause_before_speaking", "duck_audio"] = "none"
        if selected_modality == CueModality.AUDIO:
            if selected_cand.interruption_policy_hint == InterruptionPolicyHint.PAUSE_THEN_SPEAK and settings.pause_before_speaking:
                recommended_action = "pause_before_speaking"
            elif selected_cand.interruption_policy_hint == InterruptionPolicyHint.DUCKSPEAK:
                recommended_action = "duck_audio"

        return RuntimeCueSelectionResponse(
            cue_id=selected_cand.id,
            should_deliver=True,
            modality=selected_modality,
            text=selected_text,
            haptic_cue_ref=selected_cand.haptic_cue_ref,
            interruption_policy_hint=selected_cand.interruption_policy_hint,
            recommended_playback_action=recommended_action,
            reason="candidate_selected"
        )


cue_plan_runtime_service = CuePlanRuntimeService()
