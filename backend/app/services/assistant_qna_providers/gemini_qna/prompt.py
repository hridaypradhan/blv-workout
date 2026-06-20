"""Gemini prompt templates and instructions for Assistant QnA."""

PROMPT_VERSION = "gemini_qna_v1"
SCHEMA_VERSION = "assistant_qna_schema_v1"

SYSTEM_INSTRUCTION = """You are the FitA11y workout assistant layer, an assistive playback companion for Blind and Low Vision (BLV) users watching YouTube exercise videos.
The original YouTube video creator is the trainer of record. Your role is to provide brief, helpful, Q&A assistance alongside the video.

You have access to:
- Grounded video contexts (timeline anchors, trainer instructions, transcript segments).
- A runtime observation context, if real reliable pose/form observation is available.

CRITICAL GROUNDING AND CAPABILITY BOUNDARY RULES:
1. CAPABILITY BOUNDARY (VISION/POSE):
   - You CANNOT see or check the user's form/posture UNLESS `runtime_observation_context.pose_available` is explicitly set to `true`.
   - Note that the current frontend may send `pose_available=false`, and in that case you have no visual access to the user and must not claim to see them or their form under any circumstances.
   - If the user asks a self-observation or form-checking question (e.g., "Am I doing this right?", "Can you check my knees?", "Is my back straight?") AND `pose_available` is `false` (or missing):
     - You MUST honestly state in the `answer_text` that you cannot see or check their form right now.
     - You MUST offer a useful alternative, such as:
       - Inviting them to describe their position or how their muscles feel.
       - Restating the relevant trainer/video guidance or general non-observational form cues for the current exercise.
     - NEVER say "I can see you", "Your back looks...", "Your knee is..." if `pose_available` is `false`.
2. VIDEO-GROUNDED QUESTIONS:
   - Use the provided context to answer questions about the video content (e.g. "What did the trainer just say?", "What's next?", "What exercise are we doing?", "Explain this move").
3. MEDICAL & SAFETY BOUNDARY:
   - Do NOT diagnose injuries or provide medical advice.
   - If the user asks about pain, dizziness, or chest tightness, encourage them to stop the exercise immediately, rest, and consult a professional medical practitioner. Set `answer_kind` to "safety_boundary".
4. GENERAL WORKOUT CONTEXT:
   - Keep answers short and direct (1 to 3 concise sentences). The user is active in a workout; do not provide long essays or generic summaries.
   - Match the requested assistant persona tone (supportive, direct, energetic, calm) if specified.
"""


def build_qna_prompt(question: str, grounded_context: dict, runtime_observation: dict | None, persona: str) -> str:
    # Grounded context formatting
    context_str = f"Video Title: {grounded_context.get('video_title') or 'Unknown'}\n"
    
    current_ex = grounded_context.get("current_exercise")
    if current_ex:
        context_str += (
            f"Current Exercise Name: {current_ex.get('name')}\n"
            f"Current Exercise Accessible Description: {current_ex.get('description_accessible')}\n"
        )
    else:
        context_str += "Current Exercise: Transition / Rest / None active\n"

    cue_plan_desc = grounded_context.get("cue_plan_exercise_description")
    if cue_plan_desc:
        context_str += f"Cue Plan Exercise Guidance: {cue_plan_desc}\n"

    nearby_exercises = grounded_context.get("nearby_exercises") or []
    if nearby_exercises:
        context_str += "Nearby Exercises in Timeline:\n"
        for ex in nearby_exercises:
            context_str += f"- {ex.get('relation')} exercise: {ex.get('name')} ({ex.get('start_time_seconds')}s - {ex.get('end_time_seconds')}s)\n"

    trainer_insts = grounded_context.get("nearby_trainer_instructions") or []
    if trainer_insts:
        context_str += "Nearby Trainer Instructions (from video audio):\n"
        for inst in trainer_insts:
            context_str += f"- {inst}\n"

    recent_summaries = grounded_context.get("recent_trainer_instruction_summaries") or []
    if recent_summaries:
        context_str += "Recent Cue Plan Trainer Instruction Summaries:\n"
        for s in recent_summaries:
            context_str += f"- {s}\n"

    nearby_transcript = grounded_context.get("nearby_transcript")
    if nearby_transcript:
        context_str += f"Nearby Video Subtitles/Transcript Text: {nearby_transcript}\n"

    # Runtime observation context formatting
    obs_available = False
    obs_capability = "not_available"
    obs_confidence = None
    latest_err = None
    latest_rep = None
    obs_notes = None
    
    if runtime_observation:
        obs_available = runtime_observation.get("pose_available", False)
        obs_capability = runtime_observation.get("observation_capability", "not_available")
        obs_confidence = runtime_observation.get("pose_confidence")
        latest_err = runtime_observation.get("latest_form_error")
        latest_rep = runtime_observation.get("latest_rep_event")
        obs_notes = runtime_observation.get("notes")

    obs_str = (
        f"Reliable runtime pose observation available: {obs_available}\n"
        f"Observation Capability: {obs_capability}\n"
        f"Pose Confidence Score: {obs_confidence}\n"
        f"Latest Form Error Detected: {latest_err}\n"
        f"Latest Repetition Event: {latest_rep}\n"
        f"Notes/Observations: {obs_notes}\n"
    )

    prompt = f"""[GROUNDED VIDEO CONTEXT]
{context_str}

[RUNTIME OBSERVATION CONTEXT]
{obs_str}

[USER QUESTION]
Question: {question}
Requested Tone Persona: {persona}

Generate the structured JSON response according to the requested schemas.
"""
    return prompt
