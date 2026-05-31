import { plannedApiStub } from "./client";

// ============================================================================
// Planned API Surface - Assistant Telemetry and Q&A (Not wired to backend yet)
// ============================================================================

/** Ask the assistant a verbal Q&A question in the context of the workout. */
export async function askAssistant(sessionId: string, question: string): Promise<string> {
  console.log("Asking assistant question in session:", sessionId, question);
  return plannedApiStub("askAssistant");
}

/** Send active joint sensor telemetry to the assistant for real-time form checks. */
export async function sendCorrection(sessionId: string, jointData: object): Promise<void> {
  console.log("Sending joint pose data for session correction:", sessionId, jointData);
  return plannedApiStub("sendCorrection");
}
