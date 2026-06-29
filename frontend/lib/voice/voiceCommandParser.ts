import { VoiceCommand } from "./voiceCommandTypes";

/**
 * Pure, deterministic voice command parser.
 * Accepts a recognized transcript string and returns a typed command object.
 * No React state, no browser APIs, no side effects.
 */
export function parseVoiceCommand(transcript: string): VoiceCommand {
  const raw = transcript.trim();

  // Reject empty transcripts
  if (!raw) {
    return { type: "rejected", reason: "empty", transcript: raw };
  }

  const normalized = raw.toLowerCase().replace(/\s+/g, " ").trim();

  // Reject very short / noise transcripts
  if (normalized.length < 2) {
    return { type: "rejected", reason: "too_short", transcript: raw };
  }

  // --- Pause ---
  if (
    normalized === "pause" ||
    normalized === "pause video" ||
    normalized === "stop playback" ||
    normalized === "pause playback"
  ) {
    return { type: "pause" };
  }

  // --- Resume ---
  if (
    normalized === "resume" ||
    normalized === "play" ||
    normalized === "start video" ||
    normalized === "continue" ||
    normalized === "unpause" ||
    normalized === "resume playback" ||
    normalized === "resume video"
  ) {
    return { type: "resume" };
  }

  // --- Rewind (with optional explicit seconds) ---
  const rewindExplicit = normalized.match(
    /^(?:rewind|go back|back)\s+(\d+)\s*(?:seconds?)?$/
  );
  if (rewindExplicit) {
    const seconds = parseInt(rewindExplicit[1], 10);
    return { type: "rewind", seconds: seconds > 0 ? seconds : 10 };
  }
  if (
    normalized === "rewind" ||
    normalized === "go back" ||
    normalized === "back"
  ) {
    return { type: "rewind", seconds: 10 };
  }

  // --- Forward (with optional explicit seconds) ---
  const forwardExplicit = normalized.match(
    /^(?:forward|skip ahead|fast forward)\s+(\d+)\s*(?:seconds?)?$/
  );
  if (forwardExplicit) {
    const seconds = parseInt(forwardExplicit[1], 10);
    return { type: "forward", seconds: seconds > 0 ? seconds : 10 };
  }
  if (
    normalized === "fast forward" ||
    normalized === "skip ahead" ||
    normalized === "forward"
  ) {
    return { type: "forward", seconds: 10 };
  }

  // --- Slow down ---
  if (
    normalized === "slow down" ||
    normalized === "slower" ||
    normalized === "reduce speed"
  ) {
    return { type: "slow_down" };
  }

  // --- Normal speed ---
  if (
    normalized === "normal speed" ||
    normalized === "regular speed" ||
    normalized === "reset speed"
  ) {
    return { type: "normal_speed" };
  }

  // --- Speed up ---
  if (
    normalized === "speed up" ||
    normalized === "faster" ||
    normalized === "increase speed"
  ) {
    return { type: "speed_up" };
  }

  // --- Next section ---
  if (
    normalized === "next section" ||
    normalized === "skip section" ||
    normalized === "skip to next exercise" ||
    normalized === "next exercise" ||
    normalized === "skip to next section"
  ) {
    return { type: "next_section" };
  }

  // --- Repeat instruction ---
  if (
    normalized === "repeat instruction" ||
    normalized === "repeat trainer" ||
    normalized === "what did the trainer say" ||
    normalized === "say that again" ||
    normalized === "repeat last instruction" ||
    normalized === "repeat"
  ) {
    return { type: "repeat_instruction" };
  }

  // --- Mute assistant ---
  if (
    normalized === "mute assistant" ||
    normalized === "mute" ||
    normalized === "silence assistant"
  ) {
    return { type: "mute_assistant" };
  }

  // --- Unmute assistant ---
  if (
    normalized === "unmute assistant" ||
    normalized === "unmute"
  ) {
    return { type: "unmute_assistant" };
  }

  // --- End session (confirmation needed) ---
  if (
    normalized === "end session" ||
    normalized === "stop workout" ||
    normalized === "finish workout" ||
    normalized === "end workout"
  ) {
    return { type: "end_session", confirmationNeeded: true };
  }

  // --- Ask question (Q&A prefix detection) ---
  const qaMatch = normalized.match(
    /^(?:ask|question|fita11y|fit a 11 y|fit ally)\s+(.+)$/
  );
  if (qaMatch) {
    const question = qaMatch[1].trim();
    if (question.length > 0) {
      return { type: "ask_question", question };
    }
  }

  // --- Unrecognized ---
  return { type: "rejected", reason: "unrecognized", transcript: raw };
}
