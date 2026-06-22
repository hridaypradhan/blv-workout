import { API_BASE_URL, checkResponse } from "./client";
import {
  AssistantCue,
  QARequest,
  QAResponse,
  CorrectionRequest,
} from "../../types";
import { devLogger } from "../logger";

// ============================================================================
// Wired API Surface - Assistant Telemetry and Q&A
// ============================================================================

/** Ask the assistant a verbal Q&A question in the context of the workout. */
export async function askAssistant(payload: QARequest): Promise<QAResponse> {
  devLogger.log("Asking assistant question:", payload.question);
  const res = await fetch(`${API_BASE_URL}/api/assistant/qa`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return checkResponse<QAResponse>(res, "Failed to ask assistant");
}



/** Fetch a form correction cue from the assistant based on observed joint angles. */
export async function generateCorrection(payload: CorrectionRequest): Promise<AssistantCue> {
  devLogger.log("Generating correction cue for joint:", payload.joint, "angle:", payload.angle);
  const res = await fetch(`${API_BASE_URL}/api/assistant/correction`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return checkResponse<AssistantCue>(res, "Failed to generate correction cue");
}



