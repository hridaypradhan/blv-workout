"""Assistant QnA context builder service for FitA11y."""

import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

from app.core.storage import get_job_storage, get_artifact_storage
from app.models.schemas import AssistanceSidecarManifest, TranscriptArtifact
from app.models.cue_plan_schemas import CuePlan

logger = logging.getLogger(__name__)


def build_qna_context(
    video_id: str,
    current_timestamp_ms: float | None,
    session_context: dict[str, Any] | None = None
) -> dict[str, Any]:
    """Builds a compact grounded context window from job metadata, sidecar, cue plan, and transcript."""
    if session_context and session_context.get("is_grounded"):
        logger.info("S3/DynamoDB reads skipped for QnA context due to is_grounded: true")
        context = {
            "video_title": session_context.get("video_title"),
            "current_exercise": session_context.get("current_exercise"),
            "nearby_exercises": session_context.get("nearby_exercises") or [],
            "nearby_transcript": session_context.get("nearby_transcript"),
            "nearby_trainer_instructions": session_context.get("nearby_trainer_instructions") or [],
            "cue_plan_exercise_description": session_context.get("cue_plan_exercise_description"),
            "recent_trainer_instruction_summaries": session_context.get("recent_trainer_instruction_summaries") or [],
        }

        session_ctx_compact = {}
        if session_context.get("active_exercise"):
            session_ctx_compact["active_exercise"] = session_context.get("active_exercise")
        if session_context.get("latest_trainer_instruction"):
            session_ctx_compact["latest_trainer_instruction"] = session_context.get("latest_trainer_instruction")
        if session_context.get("audio_coexistence"):
            session_ctx_compact["audio_coexistence_settings"] = session_context.get("audio_coexistence")
        if "assistant_voice_muted" in session_context:
            session_ctx_compact["assistant_muted_state"] = session_context.get("assistant_voice_muted")

        context["session_context"] = session_ctx_compact
        return context

    context = {
        "video_title": None,
        "current_exercise": None,
        "nearby_exercises": [],
        "nearby_transcript": None,
        "nearby_trainer_instructions": [],
        "cue_plan_exercise_description": None,
        "recent_trainer_instruction_summaries": [],
    }
    
    if not video_id:
        pass
    else:
        # 1. Load video title from JobRecord
        try:
            job = get_job_storage().get_job(video_id)
            if job and hasattr(job, "title"):
                context["video_title"] = job.title
        except Exception as exc:
            logger.warning("Failed to load job for QnA context builder (video_id=%s): %s", video_id, exc)

        # 2. Load sidecar manifest
        sidecar_manifest = None
        try:
            sidecar_manifest = get_artifact_storage().load_manifest(video_id)
        except Exception as exc:
            logger.warning("Failed to load manifest for QnA context builder (video_id=%s): %s", video_id, exc)

        curr_anchor = None
        if sidecar_manifest:
            anchors = sorted(sidecar_manifest.exercise_timeline_anchors, key=lambda a: a.start_time_seconds)
            
            if current_timestamp_ms is not None:
                current_seconds = current_timestamp_ms / 1000.0
                
                # Find current exercise
                for anchor in anchors:
                    if anchor.start_time_seconds <= current_seconds <= anchor.end_time_seconds:
                        curr_anchor = anchor
                        break
                
                if curr_anchor:
                    context["current_exercise"] = {
                        "name": curr_anchor.name,
                        "start_time_seconds": curr_anchor.start_time_seconds,
                        "end_time_seconds": curr_anchor.end_time_seconds,
                        "primary_body_part": curr_anchor.primary_body_part,
                        "description_accessible": curr_anchor.description_accessible,
                    }
                    
                    # Find immediately before and after
                    idx = anchors.index(curr_anchor)
                    if idx > 0:
                        prev_a = anchors[idx - 1]
                        context["nearby_exercises"].append({
                            "relation": "previous",
                            "name": prev_a.name,
                            "start_time_seconds": prev_a.start_time_seconds,
                            "end_time_seconds": prev_a.end_time_seconds,
                        })
                    if idx + 1 < len(anchors):
                        next_a = anchors[idx + 1]
                        context["nearby_exercises"].append({
                            "relation": "next",
                            "name": next_a.name,
                            "start_time_seconds": next_a.start_time_seconds,
                            "end_time_seconds": next_a.end_time_seconds,
                        })
                else:
                    # No current exercise active, find upcoming and past based on time
                    prev_a = None
                    next_a = None
                    for anchor in anchors:
                        if anchor.end_time_seconds < current_seconds:
                            prev_a = anchor
                        elif anchor.start_time_seconds > current_seconds:
                            if not next_a:
                                next_a = anchor
                    if prev_a:
                        context["nearby_exercises"].append({
                            "relation": "previous",
                            "name": prev_a.name,
                            "start_time_seconds": prev_a.start_time_seconds,
                            "end_time_seconds": prev_a.end_time_seconds,
                        })
                    if next_a:
                        context["nearby_exercises"].append({
                            "relation": "next",
                            "name": next_a.name,
                            "start_time_seconds": next_a.start_time_seconds,
                            "end_time_seconds": next_a.end_time_seconds,
                        })

            # 3. Find nearby trainer instructions (within ±60s window, or 60000ms)
            # Clamp to max 5 closest, sorted chronologically
            if current_timestamp_ms is not None:
                window_ms = 60000.0
                nearby_events_with_dist = []
                for event in sidecar_manifest.trainer_instruction_events:
                    evt_start = event.start_ms if event.start_ms is not None else event.timestamp_ms
                    evt_end = event.end_ms if event.end_ms is not None else evt_start
                    if evt_start is not None and evt_end is not None:
                        if evt_start <= current_timestamp_ms + window_ms and evt_end >= current_timestamp_ms - window_ms:
                            mid = (evt_start + evt_end) / 2.0
                            dist = abs(mid - current_timestamp_ms)
                            nearby_events_with_dist.append((dist, evt_start, f"[{evt_start/1000:.0f}s - {evt_end/1000:.0f}s] {event.text}"))
                nearby_events_with_dist.sort(key=lambda x: x[0])
                nearby_events_with_dist = nearby_events_with_dist[:5]
                nearby_events_with_dist.sort(key=lambda x: x[1])
                context["nearby_trainer_instructions"] = [x[2] for x in nearby_events_with_dist]

        # 4. Load cue plan
        cue_plan = None
        try:
            cue_plan = get_artifact_storage().load_cue_plan(video_id)
        except Exception as exc:
            logger.warning("Failed to load cue plan for QnA context builder (video_id=%s): %s", video_id, exc)

        if cue_plan:
            # Accessible exercise description for the current anchor
            if curr_anchor:
                anchor_id_str = str(curr_anchor.id)
                for desc in cue_plan.exercise_descriptions:
                    if desc.exercise_anchor_id == anchor_id_str:
                        context["cue_plan_exercise_description"] = desc.accessible_description
                        break
            
            # Recent trainer instruction summaries (within ±60s window)
            # Clamp to max 5 closest, sorted chronologically
            if current_timestamp_ms is not None:
                window_ms = 60000.0
                recent_summaries_with_dist = []
                for summary in cue_plan.trainer_instruction_summaries:
                    if (summary.start_ms <= current_timestamp_ms + window_ms and
                            summary.end_ms >= current_timestamp_ms - window_ms):
                        mid = (summary.start_ms + summary.end_ms) / 2.0
                        dist = abs(mid - current_timestamp_ms)
                        recent_summaries_with_dist.append((dist, summary.start_ms, f"[{summary.start_ms/1000:.0f}s - {summary.end_ms/1000:.0f}s] {summary.summary}"))
                recent_summaries_with_dist.sort(key=lambda x: x[0])
                recent_summaries_with_dist = recent_summaries_with_dist[:5]
                recent_summaries_with_dist.sort(key=lambda x: x[1])
                context["recent_trainer_instruction_summaries"] = [x[2] for x in recent_summaries_with_dist]

        # 5. Load transcript segments (within ±60s window)
        # Prioritize by closest proximity up to a max character budget of 3000, then sorted chronologically.
        try:
            transcript = get_artifact_storage().load_transcript(video_id)
            if transcript and current_timestamp_ms is not None:
                window_ms = 60000.0
                segments_with_dist = []
                for seg in transcript.transcript_segments:
                    start = seg.get("start_ms")
                    end = seg.get("end_ms")
                    in_window = False
                    if start is not None and end is not None:
                        in_window = (start <= current_timestamp_ms + window_ms and end >= current_timestamp_ms - window_ms)
                        mid = (start + end) / 2.0
                    elif start is not None:
                        in_window = (abs(start - current_timestamp_ms) <= window_ms)
                        mid = start
                    else:
                        mid = current_timestamp_ms
                        
                    if in_window:
                        segments_with_dist.append({
                            "text": seg.get("text", ""),
                            "start_ms": start,
                            "distance": abs(mid - current_timestamp_ms)
                        })
                
                # Sort by distance (closest first)
                segments_with_dist.sort(key=lambda s: s["distance"])
                
                # Accumulate within 3000 character limit
                selected_segs = []
                current_chars = 0
                for seg in segments_with_dist:
                    text = seg["text"]
                    if current_chars + len(text) + 1 <= 3000:
                        selected_segs.append(seg)
                        current_chars += len(text) + 1
                    else:
                        break
                
                # Sort selected chronologically
                selected_segs.sort(key=lambda s: s["start_ms"] if s["start_ms"] is not None else 0)
                nearby_segs_text = [s["text"] for s in selected_segs]
                if nearby_segs_text:
                    context["nearby_transcript"] = " ".join(nearby_segs_text)
        except Exception as exc:
            logger.warning("Failed to load transcript for QnA context builder (video_id=%s): %s", video_id, exc)

    # 6. Apply session_context fallbacks and add session_context metadata
    session_ctx_compact = {}
    if session_context:
        # Extract fields safely
        if session_context.get("active_exercise"):
            session_ctx_compact["active_exercise"] = session_context.get("active_exercise")
        if session_context.get("latest_trainer_instruction"):
            session_ctx_compact["latest_trainer_instruction"] = session_context.get("latest_trainer_instruction")
        if session_context.get("audio_coexistence"):
            session_ctx_compact["audio_coexistence_settings"] = session_context.get("audio_coexistence")
        if "assistant_voice_muted" in session_context:
            session_ctx_compact["assistant_muted_state"] = session_context.get("assistant_voice_muted")
        
        # Fallback for video title if backend title is not available
        if not context["video_title"] and session_context.get("youtube_metadata"):
            yt_meta = session_context.get("youtube_metadata")
            if isinstance(yt_meta, dict) and yt_meta.get("title"):
                context["video_title"] = yt_meta.get("title")
                
        # Fallback for active exercise if backend current_exercise is not available
        if not context["current_exercise"] and session_context.get("active_exercise"):
            context["current_exercise"] = {"name": session_context.get("active_exercise")}
            
        # Fallback for latest trainer instruction if nearby_trainer_instructions is empty
        if not context["nearby_trainer_instructions"] and session_context.get("latest_trainer_instruction"):
            context["nearby_trainer_instructions"] = [session_context.get("latest_trainer_instruction")]

    context["session_context"] = session_ctx_compact

    return context
