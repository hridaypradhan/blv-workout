import { User, Video, Session, AssistanceJob } from "../types";

/** Base URL for the FastAPI backend. */
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ---------------------------------------------------------------------------
// Assistance Preparation Pipeline
// ---------------------------------------------------------------------------

/** Submit a YouTube URL for assistance preparation. Returns the new video_id. */
export async function submitVideo(
  youtubeUrl: string
): Promise<{ video_id: string }> {
  const res = await fetch(`${API_BASE_URL}/api/preprocessing/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: youtubeUrl }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Submit failed (${res.status})`);
  }
  return res.json();
}

/** Fetch the current assistance preparation status for a video. */
export async function getProcessingStatus(
  videoId: string
): Promise<AssistanceJob> {
  const res = await fetch(
    `${API_BASE_URL}/api/preprocessing/status/${videoId}`
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Status fetch failed (${res.status})`);
  }
  return res.json();
}

/** Build the full SSE endpoint URL for EventSource updates. */
export function getSSEUrl(videoId: string): string {
  return `${API_BASE_URL}/api/preprocessing/events/${videoId}`;
}

/** Delete an assistance preparation job record. */
export async function deleteVideo(videoId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/api/preprocessing/${videoId}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Delete failed (${res.status})`);
  }
}

/** List all assistance preparation jobs (newest first). */
export async function getJobs(): Promise<AssistanceJob[]> {
  const res = await fetch(`${API_BASE_URL}/api/preprocessing/jobs`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Jobs fetch failed (${res.status})`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Existing stubs for future features (v2 updated)
// ---------------------------------------------------------------------------

export async function prepareAssistance(youtubeUrl: string): Promise<Video> {
  console.log("Preparing assistance for YouTube URL:", youtubeUrl);
  throw new Error("Not implemented");
}

export async function getVideos(): Promise<Video[]> {
  throw new Error("Not implemented");
}

export async function getVideo(videoId: string): Promise<Video> {
  console.log("Fetching video info for ID:", videoId);
  throw new Error("Not implemented");
}

export async function startSession(videoId: string): Promise<Session> {
  console.log("Starting assisted playback session for video:", videoId);
  throw new Error("Not implemented");
}

export async function sendCorrection(sessionId: string, jointData: object): Promise<void> {
  console.log("Sending joint pose data for session correction:", sessionId, jointData);
  throw new Error("Not implemented");
}

export async function askAssistant(sessionId: string, question: string): Promise<string> {
  console.log("Asking assistant question in session:", sessionId, question);
  throw new Error("Not implemented");
}

export async function recordPlaybackEvent(
  sessionId: string,
  eventType: string,
  timestampMs: number,
  metadata?: object
): Promise<void> {
  console.log("Recording playback event:", { sessionId, eventType, timestampMs, metadata });
  // In the future this makes a POST /api/session/{sessionId}/playback-event request
}

export async function endSession(sessionId: string): Promise<Session> {
  console.log("Ending assisted playback session:", sessionId);
  throw new Error("Not implemented");
}

export async function getSessionHistory(userId: string): Promise<Session[]> {
  console.log("Fetching session history for user:", userId);
  throw new Error("Not implemented");
}

export async function getSession(sessionId: string): Promise<Session> {
  console.log("Fetching details for session:", sessionId);
  throw new Error("Not implemented");
}

export async function updateUserSettings(settings: Partial<User>): Promise<User> {
  console.log("Updating user settings:", settings);
  throw new Error("Not implemented");
}
