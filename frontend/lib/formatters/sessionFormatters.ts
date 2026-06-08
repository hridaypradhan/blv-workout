import { Session } from "../../types";
import { SESSION_EVENTS } from "../sessionEvents";

/**
 * Formats a session's started_at or ended_at date string into a human-readable date.
 * If verbose is true, returns a full date representation including weekday.
 */
export function formatSessionDate(dateStr: string | null | undefined, verbose = false): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (verbose) {
      return d.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Calculates and formats the duration between two dates (started_at and ended_at).
 */
export function formatSessionDuration(startStr: string | null | undefined, endStr: string | null | undefined): string {
  if (!startStr || !endStr) return "-";
  try {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return "-";
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.round((diffMs % 60000) / 1000);
    if (diffMins === 0) return `${diffSecs}s`;
    return `${diffMins}m ${diffSecs}s`;
  } catch {
    return "-";
  }
}

/**
 * Formats seconds into a M:SS play time readout.
 */
export function formatPlaybackTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

/**
 * Returns a shortened string of a video's ID.
 */
export function shortVideoId(videoId: string | null | undefined): string {
  return videoId ? videoId.substring(0, 8) : "Unknown";
}

/**
 * Calculates high-level metrics for a session.
 */
/**
 * Calculates high-level metrics for a session.
 */
export function getSessionMetrics(session: Session) {
  const reps = session.reps?.length || 0;
  const formErrors = session.form_errors?.length || 0;
  
  let assistantInteractions = 0;
  let hapticCues = 0;
  let playbackInteractions = 0;
  
  if (session.playback_events) {
    for (const evt of session.playback_events) {
      const type = evt.event_type;
      if (
        type === SESSION_EVENTS.ASSISTANT_CUE_DELIVERED ||
        type === SESSION_EVENTS.ASSISTANT_CORRECTION_DELIVERED ||
        type === SESSION_EVENTS.ASSISTANT_ANSWER_DELIVERED ||
        type === SESSION_EVENTS.USER_QUESTION_SUBMITTED
      ) {
        assistantInteractions++;
      } else if (
        type === SESSION_EVENTS.HAPTIC_CUE_TRIGGERED ||
        type === SESSION_EVENTS.HAPTIC_CUE_REQUESTED
      ) {
        hapticCues++;
      } else if (
        type === SESSION_EVENTS.PLAY ||
        type === SESSION_EVENTS.PAUSE ||
        type === SESSION_EVENTS.SEEK ||
        type === SESSION_EVENTS.SPEED_CHANGE ||
        type === SESSION_EVENTS.ENDED
      ) {
        playbackInteractions++;
      }
    }
  }
  
  return {
    reps,
    formErrors,
    assistantInteractions,
    hapticCues,
    playbackInteractions,
  };
}

/** Get a reader-friendly display label for a session event type. */
export function getSessionEventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    [SESSION_EVENTS.PLAY]: "Started Playback",
    [SESSION_EVENTS.PAUSE]: "Paused Playback",
    [SESSION_EVENTS.ENDED]: "Playback Completed",
    [SESSION_EVENTS.SEEK]: "Seeked Video",
    [SESSION_EVENTS.SPEED_CHANGE]: "Speed Changed",
    [SESSION_EVENTS.USER_QUESTION_SUBMITTED]: "Question Submitted",
    [SESSION_EVENTS.ASSISTANT_ANSWER_DELIVERED]: "Answer Delivered",
    [SESSION_EVENTS.ASSISTANT_ANSWER_FAILED]: "Q&A Failed",
    [SESSION_EVENTS.ASSISTANT_CUE_DELIVERED]: "Voice Cue Delivered",
    [SESSION_EVENTS.ASSISTANT_CORRECTION_REQUESTED]: "Correction Requested",
    [SESSION_EVENTS.ASSISTANT_CORRECTION_DELIVERED]: "Correction Delivered",
    [SESSION_EVENTS.HAPTIC_CUE_REQUESTED]: "Haptic Cue Requested",
    [SESSION_EVENTS.HAPTIC_CUE_TRIGGERED]: "Haptic Cue Triggered",
    [SESSION_EVENTS.HAPTIC_CUE_FAILED]: "Haptic Cue Failed",
    [SESSION_EVENTS.HAPTIC_TEST_REQUESTED]: "Haptic Test Requested",
    [SESSION_EVENTS.TRAINER_INSTRUCTION_REPEATED]: "Instruction Repeated",
    [SESSION_EVENTS.SECTION_SKIPPED]: "Section Skipped",
    [SESSION_EVENTS.PROTOTYPE_REP_DETECTED]: "Repetition Detected",
    [SESSION_EVENTS.PROTOTYPE_FORM_ERROR_DETECTED]: "Form Warning",
  };
  return labels[eventType] || eventType.replace(/_/g, " ");
}

/** Format specific telemetry properties into a readable details string. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatSessionEventDetails(evt: { event_type: string; metadata?: any }): string {
  const type = evt.event_type;
  const metadata = evt.metadata || {};
  
  if (type === SESSION_EVENTS.SEEK) {
    const from = metadata.from_seconds ? formatPlaybackTime(metadata.from_seconds) : "0:00";
    const to = metadata.to_seconds ? formatPlaybackTime(metadata.to_seconds) : "0:00";
    return `Seeked from ${from} to ${to}`;
  }
  if (type === SESSION_EVENTS.SPEED_CHANGE) {
    return `Playback speed changed from ${metadata.from_rate || "1.0"}x to ${metadata.to_rate || "1.0"}x`;
  }
  if (type === SESSION_EVENTS.PLAY) {
    return "Started video playback";
  }
  if (type === SESSION_EVENTS.PAUSE) {
    return "Paused video playback";
  }
  if (type === SESSION_EVENTS.ENDED) {
    return "Video playback completed";
  }
  if (type === SESSION_EVENTS.ASSISTANT_CUE_DELIVERED) {
    return `Delivered voice cue: "${metadata.text || ""}"`;
  }
  if (type === SESSION_EVENTS.ASSISTANT_CORRECTION_DELIVERED) {
    const jointLabel = metadata.joint ? metadata.joint.replace(/_/g, " ") : "form";
    return `Correction delivered for ${jointLabel}: "${metadata.text || ""}"`;
  }
  if (type === SESSION_EVENTS.ASSISTANT_CORRECTION_REQUESTED) {
    const jointLabel = metadata.joint ? metadata.joint.replace(/_/g, " ") : "joint";
    const observed = typeof metadata.observed_angle === "number" ? metadata.observed_angle.toFixed(0) : "0";
    return `Requested correction check for ${jointLabel} (observed: ${observed}°)`;
  }
  if (type === SESSION_EVENTS.ASSISTANT_ANSWER_DELIVERED) {
    return `Answered: "${metadata.answer || ""}"`;
  }
  if (type === SESSION_EVENTS.ASSISTANT_ANSWER_FAILED) {
    return `Q&A failed: "${metadata.error || ""}"`;
  }
  if (type === SESSION_EVENTS.TRAINER_INSTRUCTION_REPEATED) {
    return `Repeated trainer instruction: "${metadata.text || ""}"`;
  }
  if (type === SESSION_EVENTS.SECTION_SKIPPED) {
    return `Skipped directly to workout section: "${metadata.section_name || ""}"`;
  }
  if (type === SESSION_EVENTS.HAPTIC_CUE_REQUESTED) {
    const sides = metadata.sleeve_sides?.join(", ") || "sleeves";
    return `Requested pattern "${metadata.pattern_name || ""}" on ${sides} (${metadata.purpose || "cues"})`;
  }
  if (type === SESSION_EVENTS.HAPTIC_CUE_TRIGGERED) {
    const sides = metadata.sleeve_sides?.join(", ") || "sleeves";
    const intensity = typeof metadata.intensity === "number" ? metadata.intensity : 0.7;
    return `Triggered haptic pattern "${metadata.pattern_name || ""}" on ${sides} at ${intensity} intensity`;
  }
  if (type === SESSION_EVENTS.HAPTIC_CUE_FAILED) {
    return `Haptic trigger failed: "${metadata.error || ""}"`;
  }
  if (type === SESSION_EVENTS.HAPTIC_TEST_REQUESTED) {
    return `Fired haptic test pulse on sleeve side: "${metadata.sleeve_side || ""}"`;
  }
  if (type === SESSION_EVENTS.USER_QUESTION_SUBMITTED) {
    const exerciseLabel = metadata.active_exercise ? ` during ${metadata.active_exercise}` : "";
    return `Asked: "${metadata.question || ""}"${exerciseLabel}`;
  }
  if (type === SESSION_EVENTS.PROTOTYPE_REP_DETECTED) {
    return `Tracked repetition #${metadata.rep_count || 1} completed (${metadata.exercise_name || "exercise"})`;
  }
  if (type === SESSION_EVENTS.PROTOTYPE_FORM_ERROR_DETECTED) {
    const jointLabel = metadata.joint ? metadata.joint.replace(/_/g, " ") : "joint";
    const observed = typeof metadata.observed_angle === "number" ? metadata.observed_angle.toFixed(0) : "0";
    return `Warning on ${jointLabel} (${observed}°): "${metadata.message || ""}"`;
  }
  
  return typeof metadata === "object" ? JSON.stringify(metadata) : type;
}

/** Get Tailwind CSS style category classes based on event type. */
export function getSessionEventStyle(eventType: string): string {
  if (
    eventType === SESSION_EVENTS.SEEK ||
    eventType === SESSION_EVENTS.SPEED_CHANGE ||
    eventType === SESSION_EVENTS.PLAY ||
    eventType === SESSION_EVENTS.PAUSE ||
    eventType === SESSION_EVENTS.ENDED
  ) {
    return "text-slate-400";
  }
  if (
    eventType === SESSION_EVENTS.ASSISTANT_CUE_DELIVERED ||
    eventType === SESSION_EVENTS.ASSISTANT_ANSWER_DELIVERED
  ) {
    return "text-emerald-400";
  }
  if (
    eventType === SESSION_EVENTS.ASSISTANT_CORRECTION_DELIVERED ||
    eventType === SESSION_EVENTS.USER_QUESTION_SUBMITTED
  ) {
    return "text-emerald-400 font-semibold";
  }
  if (eventType === SESSION_EVENTS.ASSISTANT_CORRECTION_REQUESTED) {
    return "text-emerald-500/80";
  }
  if (eventType === SESSION_EVENTS.HAPTIC_CUE_REQUESTED) {
    return "text-sky-500/80";
  }
  if (eventType === SESSION_EVENTS.HAPTIC_CUE_TRIGGERED) {
    return "text-sky-400 font-semibold";
  }
  if (eventType === SESSION_EVENTS.HAPTIC_TEST_REQUESTED) {
    return "text-sky-400";
  }
  if (
    eventType === SESSION_EVENTS.TRAINER_INSTRUCTION_REPEATED ||
    eventType === SESSION_EVENTS.SECTION_SKIPPED
  ) {
    return "text-purple-400";
  }
  if (eventType === SESSION_EVENTS.PROTOTYPE_REP_DETECTED) {
    return "text-yellow-400 font-bold";
  }
  if (eventType === SESSION_EVENTS.PROTOTYPE_FORM_ERROR_DETECTED) {
    return "text-amber-400 font-bold";
  }
  if (
    eventType === SESSION_EVENTS.ASSISTANT_ANSWER_FAILED ||
    eventType === SESSION_EVENTS.HAPTIC_CUE_FAILED
  ) {
    return "text-red-400 font-bold";
  }
  return "text-slate-400";
}
