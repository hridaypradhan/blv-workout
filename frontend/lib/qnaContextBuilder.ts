import { SidecarManifest, CuePlan, TranscriptArtifact, AudioCoexistenceSettings } from "@/types";

interface QnAContextBuilderParams {
  videoTitle?: string | null;
  currentTimeMs: number;
  manifest: SidecarManifest;
  cuePlan: CuePlan;
  transcript: TranscriptArtifact;
  audioCoexistence?: AudioCoexistenceSettings | null;
  assistantVoiceMuted?: boolean;
}

export function buildFrontendQnAContext({
  videoTitle,
  currentTimeMs,
  manifest,
  cuePlan,
  transcript,
  audioCoexistence,
  assistantVoiceMuted,
}: QnAContextBuilderParams): Record<string, unknown> {
  const currentSeconds = currentTimeMs / 1000.0;
  const windowMs = 60000.0; // ±60s

  const context = {
    is_grounded: true,
    video_title: videoTitle || null,
    current_exercise: null as Record<string, unknown> | null,
    nearby_exercises: [] as Array<Record<string, unknown>>,
    nearby_trainer_instructions: [] as string[],
    cue_plan_exercise_description: null as string | null,
    recent_trainer_instruction_summaries: [] as string[],
    nearby_transcript: null as string | null,
    audio_coexistence: audioCoexistence || null,
    assistant_voice_muted: assistantVoiceMuted ?? false,
    active_exercise: null as string | null,
    latest_trainer_instruction: null as string | null,
  };

  // 1. Current exercise & nearby exercises from manifest
  const anchors = [...(manifest.exercise_timeline_anchors || [])].sort(
    (a, b) => a.start_time_seconds - b.start_time_seconds
  );

  let currAnchorIndex = -1;
  for (let i = 0; i < anchors.length; i++) {
    const anchor = anchors[i];
    if (anchor.start_time_seconds <= currentSeconds && currentSeconds <= anchor.end_time_seconds) {
      currAnchorIndex = i;
      break;
    }
  }

  if (currAnchorIndex !== -1) {
    const curr = anchors[currAnchorIndex];
    context.current_exercise = {
      name: curr.name,
      start_time_seconds: curr.start_time_seconds,
      end_time_seconds: curr.end_time_seconds,
      primary_body_part: curr.primary_body_part,
      description_accessible: curr.description_accessible,
    };
    context.active_exercise = curr.name;

    // Prev/next anchors
    if (currAnchorIndex > 0) {
      const prev = anchors[currAnchorIndex - 1];
      context.nearby_exercises.push({
        relation: "previous",
        name: prev.name,
        start_time_seconds: prev.start_time_seconds,
        end_time_seconds: prev.end_time_seconds,
      });
    }
    if (currAnchorIndex + 1 < anchors.length) {
      const next = anchors[currAnchorIndex + 1];
      context.nearby_exercises.push({
        relation: "next",
        name: next.name,
        start_time_seconds: next.start_time_seconds,
        end_time_seconds: next.end_time_seconds,
      });
    }
  } else {
    // If no exercise is active, find closest past/upcoming
    let prev = null;
    let next = null;
    for (const anchor of anchors) {
      if (anchor.end_time_seconds < currentSeconds) {
        prev = anchor;
      } else if (anchor.start_time_seconds > currentSeconds) {
        if (!next) next = anchor;
      }
    }
    if (prev) {
      context.nearby_exercises.push({
        relation: "previous",
        name: prev.name,
        start_time_seconds: prev.start_time_seconds,
        end_time_seconds: prev.end_time_seconds,
      });
    }
    if (next) {
      context.nearby_exercises.push({
        relation: "next",
        name: next.name,
        start_time_seconds: next.start_time_seconds,
        end_time_seconds: next.end_time_seconds,
      });
    }
  }

  // 2. Nearby trainer instructions from manifest
  const nearbyInstructions = (manifest.trainer_instruction_events || [])
    .filter((event) => {
      const start = event.start_ms ?? event.timestamp_ms;
      const end = event.end_ms ?? start;
      if (start !== undefined && end !== undefined) {
        return start <= currentTimeMs + windowMs && end >= currentTimeMs - windowMs;
      }
      return false;
    })
    .map((e) => {
      const start = e.start_ms ?? e.timestamp_ms ?? 0;
      const dist = Math.abs(start - currentTimeMs);
      return { dist, start, text: `[${(start / 1000).toFixed(0)}s] ${e.text}` };
    })
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 5)
    .sort((a, b) => a.start - b.start)
    .map((e) => e.text);

  context.nearby_trainer_instructions = nearbyInstructions;

  // Set latest_trainer_instruction if available
  if (manifest.trainer_instruction_events && manifest.trainer_instruction_events.length > 0) {
    let latest = null;
    for (const e of manifest.trainer_instruction_events) {
      const t = e.start_ms ?? e.timestamp_ms ?? 0;
      if (t <= currentTimeMs) {
        if (!latest || (latest.start_ms ?? latest.timestamp_ms ?? 0) < t) {
          latest = e;
        }
      }
    }
    if (latest) {
      context.latest_trainer_instruction = latest.text;
    }
  }

  // 3. Current cue plan exercise description
  if (currAnchorIndex !== -1 && cuePlan && cuePlan.exercise_descriptions) {
    const curr = anchors[currAnchorIndex];
    const desc = cuePlan.exercise_descriptions.find((d) => d.exercise_anchor_id === curr.id);
    if (desc) {
      context.cue_plan_exercise_description = desc.accessible_description;
    }
  }

  // 4. Recent trainer instruction summaries from cue plan
  if (cuePlan && cuePlan.trainer_instruction_summaries) {
    const nearbySummaries = cuePlan.trainer_instruction_summaries
      .filter((s) => s.start_ms <= currentTimeMs + windowMs && s.end_ms >= currentTimeMs - windowMs)
      .map((s) => {
        const dist = Math.abs((s.start_ms + s.end_ms) / 2.0 - currentTimeMs);
        return { dist, start: s.start_ms, text: `[${(s.start_ms / 1000).toFixed(0)}s - ${(s.end_ms / 1000).toFixed(0)}s] ${s.summary}` };
      })
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 5)
      .sort((a, b) => a.start - b.start)
      .map((s) => s.text);

    context.recent_trainer_instruction_summaries = nearbySummaries;
  }

  // 5. Nearby transcript segments (3000 chars limit)
  if (transcript && transcript.transcript_segments) {
    const segs = transcript.transcript_segments
      .filter((seg) => {
        const start = seg.start_ms;
        const end = seg.end_ms;
        if (start !== undefined && start !== null) {
          if (end !== undefined && end !== null) {
            return start <= currentTimeMs + windowMs && end >= currentTimeMs - windowMs;
          }
          return Math.abs(start - currentTimeMs) <= windowMs;
        }
        return false;
      })
      .map((seg) => {
        const start = seg.start_ms ?? 0;
        const end = seg.end_ms ?? start;
        const mid = (start + end) / 2;
        return {
          text: seg.text || "",
          start_ms: start,
          distance: Math.abs(mid - currentTimeMs),
        };
      })
      .sort((a, b) => a.distance - b.distance);

    const selected: typeof segs = [];
    let chars = 0;
    for (const seg of segs) {
      if (chars + seg.text.length + 1 <= 3000) {
        selected.push(seg);
        chars += seg.text.length + 1;
      } else {
        break;
      }
    }

    selected.sort((a, b) => a.start_ms - b.start_ms);
    context.nearby_transcript = selected.map((s) => s.text).join(" ") || null;
  }

  return context;
}
