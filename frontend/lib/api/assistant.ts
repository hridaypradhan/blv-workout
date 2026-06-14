import { API_BASE_URL, checkResponse } from "./client";
import {
  AssistantCue,
  QARequest,
  CorrectionRequest,
  RuntimeCueSelectionRequest,
  RuntimeCueSelectionResponse,
} from "../../types";

// ============================================================================
// Wired API Surface - Assistant Telemetry and Q&A
// ============================================================================

/** Ask the assistant a verbal Q&A question in the context of the workout. */
export async function askAssistant(payload: QARequest): Promise<AssistantCue> {
  console.log("Asking assistant question:", payload.question);
  const res = await fetch(`${API_BASE_URL}/api/assistant/qa`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return checkResponse<AssistantCue>(res, "Failed to ask assistant");
}



/** Fetch a form correction cue from the assistant based on observed joint angles. */
export async function generateCorrection(payload: CorrectionRequest): Promise<AssistantCue> {
  console.log("Generating correction cue for joint:", payload.joint, "angle:", payload.angle);
  const res = await fetch(`${API_BASE_URL}/api/assistant/correction`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return checkResponse<AssistantCue>(res, "Failed to generate correction cue");
}



/** Selects the next eligible cue plan candidate deterministically based on playback state and settings. */
export async function selectCueCandidate(payload: RuntimeCueSelectionRequest): Promise<RuntimeCueSelectionResponse> {
  const res = await fetch(`${API_BASE_URL}/api/assistant/cue-plan/select`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return checkResponse<RuntimeCueSelectionResponse>(res, "Failed to select cue candidate");
}



