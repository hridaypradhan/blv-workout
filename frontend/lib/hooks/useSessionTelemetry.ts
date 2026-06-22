import { useEffect, useRef, useCallback } from "react";
interface UseSessionTelemetryProps {
  sessionId: string | null;
  isReady: boolean;
  isPlaying: boolean;
  hasEnded: boolean;
  currentTime: number;
  playbackRate: number;
}

/**
 * React hook to observe and record video player interactions (play, pause, seek, speed change).
 * Buffers all events in client-side memory to minimize AWS transactions.
 */
export function useSessionTelemetry({
  sessionId,
  isReady,
  isPlaying,
  hasEnded,
  currentTime,
  playbackRate,
}: UseSessionTelemetryProps) {
  const prevIsPlaying = useRef<boolean | null>(null);
  const prevPlaybackRate = useRef<number | null>(null);
  const prevTime = useRef<number>(0);
  const isInitialTime = useRef<boolean>(true);
  const lastStateLogged = useRef<string | null>(null);
  const lastStateLoggedTime = useRef<number>(0);

  // Stable dedupe cache
  const lastLoggedEvents = useRef<Map<string, number>>(new Map());

  // Local telemetry buffer
  const bufferRef = useRef<Array<{ event_type: string; timestamp_ms: number | null; metadata?: object }>>([]);

  const getBufferedEvents = useCallback(() => {
    return bufferRef.current;
  }, []);

  const logSessionEvent = useCallback(
    async (eventType: string, timestampMs: number, metadata?: Record<string, unknown>) => {
      if (!sessionId) return;

      const now = Date.now();

      // Determine dedupe bucket size
      let bucketSize = 2000;
      if (
        eventType === "haptic_cue_triggered" ||
        eventType === "haptic_cue_requested" ||
        eventType === "haptic_cue_failed"
      ) {
        bucketSize = 5000;
      } else if (
        eventType === "assistant_correction_delivered" ||
        eventType === "prototype_form_error_detected"
      ) {
        bucketSize = 10000;
      }

      // Stable dedupe key components
      const cueId = (metadata?.cue_id || metadata?.cue_type || "") as string;
      const joint = (metadata?.joint || "") as string;
      const section = (metadata?.section || "") as string;
      const timestampBucket = Math.floor(timestampMs / bucketSize);
      const dedupeKey = `${eventType}-${cueId}-${joint}-${section}-${timestampBucket}`;

      if (lastLoggedEvents.current.has(dedupeKey)) {
        return;
      }
      lastLoggedEvents.current.set(dedupeKey, now);

      // Add to buffer
      bufferRef.current.push({
        event_type: eventType,
        timestamp_ms: timestampMs,
        metadata: metadata || {},
      });
    },
    [sessionId]
  );

  // Track state transitions (play, pause, ended)
  useEffect(() => {
    if (!sessionId || !isReady) return;

    if (prevIsPlaying.current !== isPlaying) {
      if (prevIsPlaying.current !== null) {
        if (!isPlaying && hasEnded) {
          logSessionEvent("ended", currentTime * 1000, { source: "youtube_player" });
        } else {
          const eventType = isPlaying ? "play" : "pause";
          const now = Date.now();
          if (lastStateLogged.current !== eventType || now - lastStateLoggedTime.current > 1000) {
            lastStateLogged.current = eventType;
            lastStateLoggedTime.current = now;
            logSessionEvent(eventType, currentTime * 1000, { source: "youtube_player" });
          }
        }
      }
      prevIsPlaying.current = isPlaying;
    }
  }, [isPlaying, hasEnded, isReady, sessionId, currentTime, logSessionEvent]);

  // Track playback rate changes
  useEffect(() => {
    if (!sessionId || !isReady) return;

    if (prevPlaybackRate.current !== null && prevPlaybackRate.current !== playbackRate) {
      logSessionEvent("speed_change", currentTime * 1000, {
        from_rate: prevPlaybackRate.current,
        to_rate: playbackRate,
      });
    }
    prevPlaybackRate.current = playbackRate;
  }, [playbackRate, isReady, sessionId, currentTime, logSessionEvent]);

  // Track seek events
  useEffect(() => {
    if (!sessionId || !isReady) return;

    if (isInitialTime.current) {
      if (currentTime > 0) {
        isInitialTime.current = false;
        prevTime.current = currentTime;
      }
      return;
    }

    const timeDiff = Math.abs(currentTime - prevTime.current);
    if (timeDiff > 1.5) {
      logSessionEvent("seek", currentTime * 1000, {
        from_seconds: prevTime.current,
        to_seconds: currentTime,
      });
    }

    prevTime.current = currentTime;
  }, [currentTime, isReady, sessionId, logSessionEvent]);

  return { logSessionEvent, getBufferedEvents };
}
