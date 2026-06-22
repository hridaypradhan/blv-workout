import { useState } from "react";
import { useRouter } from "next/navigation";
import { finalizeSession } from "@/lib/api";

interface UseSessionEndProps {
  sessionId: string | null;
  videoId: string;
  playbackEventsBuffer: Array<{ event_type: string; timestamp_ms: number | null; metadata?: object }>;
  repsBuffer: Array<{ exercise_id: string; rep_count: number; timestamp: string; metadata?: object }>;
  formErrorsBuffer: Array<{
    exercise_id: string;
    form_error: {
      joint: string;
      observed_angle: number;
      expected_range: [number, number];
      severity: string;
      message?: string | null;
    };
    timestamp: string;
  }>;
  announce: (msg: string) => void;
}

export function useSessionEnd({
  sessionId,
  videoId,
  playbackEventsBuffer,
  repsBuffer,
  formErrorsBuffer,
  announce,
}: UseSessionEndProps) {
  const [isEnding, setIsEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const router = useRouter();

  const handleEndSession = async () => {
    if (!sessionId) {
      window.dispatchEvent(new Event("navigation-start"));
      router.push(`/session/${videoId}/setup`);
      return;
    }

    setIsEnding(true);
    setEndError(null);

    try {
      announce("Finalizing workout data and saving report...");

      // Call single finalize endpoint with all buffered data
      await finalizeSession(sessionId, playbackEventsBuffer, repsBuffer, formErrorsBuffer);

      window.dispatchEvent(new Event("navigation-start"));
      router.push("/history");
    } catch (err) {
      console.error("Failed to end session:", err);
      const message = err instanceof Error ? err.message : "Failed to end session. Please try again.";
      setEndError(message);
      setIsEnding(false);
      announce(`Failed to end session: ${message}`);
    }
  };

  return {
    isEnding,
    endError,
    handleEndSession,
  };
}
