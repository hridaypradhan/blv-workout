"""Prompt builder for Gemini sidecar manifest generation."""

from __future__ import annotations

from typing import TYPE_CHECKING

PROMPT_VERSION = "gemini_sidecar_v1"

if TYPE_CHECKING:
    from app.services.sidecar_providers.base import SidecarGenerationInput


def build_gemini_prompt(input_data: SidecarGenerationInput) -> tuple[str, str]:
    """Builds the system instruction and user prompt for sidecar generation using SidecarGenerationInput."""
    duration = input_data.duration_seconds
    
    # Format the timestamped segments internally
    formatted_segments = []
    if input_data.transcript_segments:
        for s in input_data.transcript_segments:
            start = int(s.get('start_ms', 0))
            end = int(s.get('end_ms', 0))
            text = s.get('text', '')
            formatted_segments.append(f"[{start}-{end} ms] {text}")
    timestamped_transcript = '\n'.join(formatted_segments)
    
    system_instruction = (
        "You are an expert physical therapist and accessibility designer specializing in blind and low vision (BLV) workout experiences.\n"
        "Your task is to analyze the metadata and transcript captions of a YouTube workout video, and generate a structured AssistanceSidecarManifest. "
        "This manifest maps exercises, trainer speech events, and speaking opportunities to guide a BLV user with audio and haptic feedback.\n"
        "Constraints:\n"
        "1. The original YouTube video is the source of truth; do NOT try to replace the trainer.\n"
        "2. Identify 'exercise_timeline_anchors' corresponding to exercise segments in the timeline. The total duration is "
        f"{duration} seconds. Ensure all anchors fit within [0, {duration}] in seconds.\n"
        "3. Identify 'trainer_instruction_events' where the trainer is speaking key instructions (like form cues, rep counts). Keep the original spoken text. Timestamps must be in milliseconds within [0, "
        f"{duration * 1000}].\n"
        "4. Identify 'speaking_opportunity_map' representing windows of silence/relative pause suitable for the assistant to deliver audio tips.\n"
        "5. Create 'form_risk_templates' for each exercise identifying joints (e.g. hip, knee, ankle, shoulder), risk descriptions, and short corrective cues.\n"
        "6. Populate 'haptic_spatial_cue_profiles' specifying body parts (left, right) and mapping cues to vibration patterns (e.g. double_pulse, continuous_vibe).\n"
        "7. Populate 'expected_movement_windows' as a list of ExpectedMovementWindowGemini defining start and end seconds for each exercise name.\n"
        "8. Keep beat_timestamps aligned to pacing structure if detectable (or every 4 seconds during active exercise anchors).\n"
        "Use strict schema output matching the structure of AssistanceSidecarManifestGemini."
    )
    
    prompt = (
        f"Video Title: {input_data.title}\n"
        f"Creator/Channel: {input_data.channel_name}\n"
        f"Duration: {duration} seconds\n"
        f"YouTube URL: {input_data.youtube_url}\n\n"
        f"Timestamped Transcript:\n{timestamped_transcript}\n\n"
        f"Flat Transcript (for reference):\n{input_data.transcript_text}\n"
    )
    
    return system_instruction, prompt
