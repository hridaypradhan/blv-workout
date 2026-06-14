import { AssistanceJob, SidecarManifest, CuePlan } from "../../types";
import { API_BASE_URL, checkResponse } from "./client";

/** Submit a YouTube URL for assistance preparation. Returns the new video_id. */
export async function submitVideo(youtubeUrl: string): Promise<{ video_id: string }> {
  const res = await fetch(`${API_BASE_URL}/api/preprocessing/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: youtubeUrl }),
  });
  return checkResponse(res, "Submit failed");
}

/** Fetch the current assistance preparation status for a video. */
export async function getProcessingStatus(videoId: string): Promise<AssistanceJob> {
  const res = await fetch(`${API_BASE_URL}/api/preprocessing/status/${videoId}`);
  return checkResponse(res, "Status fetch failed");
}

/** Build the full SSE endpoint URL for EventSource updates. */
export function getSSEUrl(videoId: string): string {
  return `${API_BASE_URL}/api/preprocessing/events/${videoId}`;
}

/** Delete an assistance preparation job record. */
export async function deleteVideo(videoId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/preprocessing/${videoId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Delete failed (${res.status})`);
  }
}

/** List all assistance preparation jobs (newest first). */
export async function getJobs(): Promise<AssistanceJob[]> {
  const res = await fetch(`${API_BASE_URL}/api/preprocessing/jobs`);
  return checkResponse(res, "Jobs fetch failed");
}

/** Fetch the prepared assistance sidecar manifest for a video. */
export async function getSidecarManifest(videoId: string): Promise<SidecarManifest> {
  const res = await fetch(`${API_BASE_URL}/api/preprocessing/manifest/${videoId}`);
  return checkResponse(res, "Manifest fetch failed");
}

/** Fetch the prepared assistance cue plan for a video. */
export async function getCuePlan(videoId: string): Promise<CuePlan> {
  const res = await fetch(`${API_BASE_URL}/api/preprocessing/cue-plan/${videoId}`);
  return checkResponse<CuePlan>(res, "Cue plan fetch failed");
}

