import { Session } from "../../types";
import { API_BASE_URL, checkResponse } from "./client";
import { PROTOTYPE_USER_ID } from "../prototypeUser";

// ============================================================================
// Wired API Surface - Session Lifecycle
// ============================================================================

/** Start a new assisted playback session. */
export async function startSession(videoId: string, userId?: string): Promise<Session> {
  const res = await fetch(`${API_BASE_URL}/api/session/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      video_id: videoId,
      user_id: userId || PROTOTYPE_USER_ID,
    }),
  });
  return checkResponse(res, "Start session failed");
}

/** Finalize the session, saving all buffered events in batch and ending the session. */
export async function finalizeSession(
  sessionId: string,
  playbackEvents: Array<{ event_type: string; timestamp_ms: number | null; metadata?: object }>,
  reps: Array<{ exercise_id: string; rep_count: number; timestamp: string; metadata?: object }>,
  formErrors: Array<{
    exercise_id: string;
    form_error: {
      joint: string;
      observed_angle: number;
      expected_range: [number, number];
      severity: string;
      message?: string | null;
    };
    timestamp: string;
  }>,
  endedAt?: string
): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE_URL}/api/session/${sessionId}/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      playback_events: playbackEvents,
      reps,
      form_errors: formErrors,
      ended_at: endedAt || new Date().toISOString(),
    }),
  });
  return checkResponse(res, "Finalize session failed");
}

/** Get a list of past sessions for a user. */
export async function getSessionHistory(userId: string): Promise<Session[]> {
  const res = await fetch(`${API_BASE_URL}/api/session?user_id=${userId}`);
  return checkResponse(res, "Fetch session history failed");
}

/** Fetch details of a past session. */
export async function getSession(sessionId: string): Promise<Session> {
  const res = await fetch(`${API_BASE_URL}/api/session/${sessionId}`);
  return checkResponse(res, "Fetch session failed");
}
