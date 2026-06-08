import { API_BASE_URL, checkResponse, plannedApiStub } from "./client";
import { AssistantCue, QARequest } from "../../types";

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

/** Send active joint sensor telemetry to the assistant for real-time form checks. */
export async function sendCorrection(sessionId: string, jointData: object): Promise<void> {
  console.log("Sending joint pose data for session correction:", sessionId, jointData);
  return plannedApiStub("sendCorrection");
}

