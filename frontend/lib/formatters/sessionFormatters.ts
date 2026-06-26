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
  const reps = typeof session.reps_count === "number" ? session.reps_count : (session.reps?.length || 0);
  const formErrors = typeof session.form_errors_count === "number" ? session.form_errors_count : (session.form_errors?.length || 0);
  
  let assistantInteractions = typeof session.assistant_interactions_count === "number" ? session.assistant_interactions_count : 0;
  let hapticCues = typeof session.haptic_cues_count === "number" ? session.haptic_cues_count : 0;
  let playbackInteractions = typeof session.playback_interactions_count === "number" ? session.playback_interactions_count : 0;

  const hasPrecomputed =
    typeof session.reps_count === "number" &&
    typeof session.form_errors_count === "number" &&
    typeof session.assistant_interactions_count === "number" &&
    typeof session.haptic_cues_count === "number" &&
    typeof session.playback_interactions_count === "number";

  if (!hasPrecomputed && session.playback_events) {
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSessionEventLabel(eventType: string, metadata?: any): string {
  if (eventType === SESSION_EVENTS.HAPTIC_CUE_TRIGGERED) {
    const mode = metadata?.delivery_mode;
    if (mode === "hardware") return "Haptic Fired";
    if (mode === "indicator" || mode === "dry_run") return "Haptic Indicator";
    return "Haptic Triggered";
  }
  if (eventType === SESSION_EVENTS.HAPTIC_CUE_FAILED) {
    return "Haptic Failed";
  }
  if (eventType === SESSION_EVENTS.HAPTIC_CUE_REQUESTED) {
    return "Haptic Requested";
  }

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
    return `Requested correction check for ${jointLabel} (observed: ${observed}\u00b0)`;
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
    const eventName = metadata.bhaptics_event_name || "unknown";
    const cueType = metadata.cue_type || "unknown";
    const limbs = (metadata.target_positions || metadata.target_limbs || []).join(", ") || "none";
    const vibId = metadata.selected_vibration_id || "none";
    return `Haptic request: Event ${eventName} (Type: ${cueType}, ID: ${vibId}) on [${limbs}]`;
  }
  if (type === SESSION_EVENTS.HAPTIC_CUE_TRIGGERED) {
    const eventName = metadata.bhaptics_event_name || "unknown";
    const mode = metadata.delivery_mode || "unknown";
    const provider = metadata.provider || "none";
    const limbs = (metadata.target_positions || metadata.target_limbs || []).join(", ") || "none";
    const reqId = metadata.request_id || "none";
    const statusMsg = metadata.status_message || metadata.status || "Triggered successfully";
    return `Haptic delivered (${mode}): Event ${eventName} via ${provider} on [${limbs}]. Req ID: ${reqId}. Status: ${statusMsg}`;
  }
  if (type === SESSION_EVENTS.HAPTIC_CUE_FAILED) {
    const eventName = metadata.bhaptics_event_name || "unknown";
    const errorMsg = metadata.error || metadata.status_message || "Unknown error";
    const provider = metadata.provider || "none";
    const reqId = metadata.request_id || "none";
    return `Haptic delivery failed: Event ${eventName} via ${provider}. Req ID: ${reqId}. Error: ${errorMsg}`;
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
    return `Warning on ${jointLabel} (${observed}\u00b0): "${metadata.message || ""}"`;
  }
  
  return typeof metadata === "object" ? JSON.stringify(metadata) : type;
}

/** Get Tailwind CSS style category classes based on event type. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSessionEventStyle(eventType: string, metadata?: any): string {
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
    const mode = metadata?.delivery_mode;
    if (mode === "hardware") {
      return "text-sky-400 font-extrabold";
    } else if (mode === "indicator" || mode === "dry_run") {
      return "text-yellow-500/90 font-medium";
    }
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
