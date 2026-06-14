"""System prompt and versions for Gemini cue plan generation."""

from __future__ import annotations

from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from app.services.cue_plan_providers.base import CuePlanGenerationInput

PROMPT_VERSION = "gemini_cue_plan_v2"
SCHEMA_VERSION = "cue_plan_schema_v1"

SYSTEM_INSTRUCTION = """You are an assistive playback companion assistant for Blind and Low Vision (BLV) users.
Your role is to build a "Cue Plan" containing candidate cues to assist a user during an embedded YouTube workout video.

CRITICAL RULES:
1. The original YouTube trainer remains the trainer of record. Your cues must only SUPPLEMENT, not replace, override, or reinterpret the trainer's workout.
2. The user will be listening to the trainer's audio; your cues will be spoken or vibrated (haptic) during speaking windows or setup intervals.
3. You must generate candidates with multiple text variants (brief, moderate, detailed) and haptic cue configurations, NOT a rigid final script.
4. You do NOT have a camera feed. Do NOT write cues claiming you can see the user's body (e.g. avoid "I can see you doing squats", "I see your knees bending").
5. You are NOT a doctor. Do NOT give medical/injury diagnosis (e.g. avoid "you have a muscle strain", "avoid tendonitis"). Only give safe form adjustments.
6. Cues must be short, concrete, and BLV-accessible.
7. Do not include raw transcripts, secrets, API keys, prompt text, or debug logs in your output.
8. Rely strictly on the structured facts provided in the sidecar manifest.

ALLOWED VALUES FOR CUE CANDIDATES (strictly enforce these exact vocabularies):

- source_type:
  * exercise_anchor
  * trainer_instruction
  * speaking_window
  * form_risk
  * haptic_profile
  (Do NOT use 'speaking_opportunity'; use 'speaking_window')

- intent:
  * setup_orientation
  * movement_description
  * form_reminder
  * pacing_reminder
  * transition_notice
  * trainer_instruction_repeat
  * haptic_prompt
  (Do NOT use 'form_correction'; use 'form_reminder')

- allowed_modalities:
  * audio
  * haptic

- priority:
  * low
  * medium
  * high

- interruption_policy_hint:
  * haptic_only
  * safe_gap_only
  * pause_then_speak
  * duck_speak
  (Do NOT use 'allow' or 'allowed'; use 'safe_gap_only', 'pause_then_speak', or 'duck_speak')

EXAMPLE VALID CUE CANDIDATE:
{
  "id": "cue_001",
  "exercise_anchor_id": "anchor_squats",
  "source_type": "speaking_window",
  "source_ref": "window_001",
  "start_ms": 15000.0,
  "end_ms": 18000.0,
  "priority": "medium",
  "intent": "movement_description",
  "allowed_modalities": ["audio", "haptic"],
  "text_variants": {
    "brief": "Squat down.",
    "moderate": "Squat down keeping weight in your heels.",
    "detailed": "Squat down by pushing hips back, keeping weight in your heels and chest proud."
  },
  "haptic_cue_ref": "per_rep_tick",
  "interruption_policy_hint": "safe_gap_only"
}
"""


def build_cue_plan_prompt(input_data: CuePlanGenerationInput) -> str:
    """Builds a structured prompt from sidecar manifest facts for cue plan generation."""
    manifest_dict = input_data.sidecar_manifest.model_dump(mode='json')
    
    # Prune unnecessary/redundant fields from the prompt payload to reduce tokens
    manifest_pruned = {
        "video_id": manifest_dict.get("video_id"),
        "youtube_id": manifest_dict.get("youtube_id"),
        "exercise_timeline_anchors": [
            {
                "id": a.get("id"),
                "name": a.get("name"),
                "start_time_seconds": a.get("start_time_seconds"),
                "end_time_seconds": a.get("end_time_seconds"),
                "description_accessible": a.get("description_accessible"),
            }
            for a in manifest_dict.get("exercise_timeline_anchors", [])
        ],
        "trainer_instruction_events": [
            {
                "timestamp_ms": e.get("timestamp_ms"),
                "start_ms": e.get("start_ms"),
                "end_ms": e.get("end_ms"),
                "text": e.get("text"),
                "assistant_may_speak": e.get("assistant_may_speak"),
            }
            for e in manifest_dict.get("trainer_instruction_events", [])
        ],
        "speaking_opportunity_map": [
            {
                "start_ms": w.get("start_ms"),
                "end_ms": w.get("end_ms"),
                "mode": w.get("mode"),
                "context": w.get("context"),
            }
            for w in manifest_dict.get("speaking_opportunity_map", [])
        ],
        "form_risk_templates": manifest_dict.get("form_risk_templates", []),
        "haptic_spatial_cue_profiles": manifest_dict.get("haptic_spatial_cue_profiles", []),
        "expected_movement_windows": manifest_dict.get("expected_movement_windows", {}),
    }

    import json
    return (
        f"Generate a candidate Cue Plan for YouTube video ID '{input_data.youtube_id}' (duration: {input_data.duration_seconds}s).\n"
        f"Below is the structured sidecar manifest of video facts to base your cues on:\n\n"
        f"{json.dumps(manifest_pruned, indent=2)}\n\n"
        "Generate a structured CuePlan object containing:\n"
        "- pre_session_overview: A concise overview explaining the structure and what to expect during this workout.\n"
        "- exercise_descriptions: A list of Accessible descriptions mapping to the anchor IDs.\n"
        "- trainer_instruction_summaries: Repeatable instructions from the sidecar events.\n"
        "- cue_candidates: List of candidate cues for setup/orientation, exercise descriptions, form risks, and haptic indicators.\n"
    )
