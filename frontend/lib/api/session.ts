import { Session } from "../../types";
import { plannedApiStub } from "./client";

// ============================================================================
// Planned API Surface - Session Lifecycle (Not wired to backend yet)
// ============================================================================

/** Start a new assisted playback session. */
export async function startSession(videoId: string): Promise<Session> {
  console.log("Starting assisted playback session for video:", videoId);
  return plannedApiStub("startSession");
}

/** Record a user interaction or assistant event in a session. */
export async function recordPlaybackEvent(
  sessionId: string,
  eventType: string,
  timestampMs: number,
  metadata?: object
): Promise<void> {
  console.log("Recording playback event:", { sessionId, eventType, timestampMs, metadata });
  // Stub for future telemetry logging.
}

/** End the current session and get a final report. */
export async function endSession(sessionId: string): Promise<Session> {
  console.log("Ending assisted playback session:", sessionId);
  return plannedApiStub("endSession");
}

/** Get a list of past sessions for a user. */
export async function getSessionHistory(userId: string): Promise<Session[]> {
  console.log("Fetching session history for user:", userId);
  return plannedApiStub("getSessionHistory");
}

/** Fetch details of a past session. */
export async function getSession(sessionId: string): Promise<Session> {
  console.log("Fetching details for session:", sessionId);
  return plannedApiStub("getSession");
}
