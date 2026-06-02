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

/** Record a user interaction or assistant event in a session. */
export async function recordPlaybackEvent(
  sessionId: string,
  eventType: string,
  timestampMs: number | null,
  metadata?: object
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/session/${sessionId}/playback-event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event_type: eventType,
      timestamp_ms: timestampMs,
      metadata: metadata || {},
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const detail = typeof body.detail === "string" ? body.detail : undefined;
    throw new Error(detail || `Failed to record playback event (${res.status})`);
  }
}

/** End the current session and get a final report status. */
export async function endSession(sessionId: string): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE_URL}/api/session/${sessionId}/end`, {
    method: "POST",
  });
  return checkResponse(res, "End session failed");
}

/** Get a list of past sessions for a user.
 * 
 * TODO: Implement backend history list endpoint when real History UI is added.
 * For now, this is a placeholder stub.
 */
export async function getSessionHistory(userId: string): Promise<Session[]> {
  console.log("Fetching session history for user (stub):", userId);
  return [];
}

/** Fetch details of a past session. */
export async function getSession(sessionId: string): Promise<Session> {
  const res = await fetch(`${API_BASE_URL}/api/session/${sessionId}`);
  return checkResponse(res, "Fetch session failed");
}
