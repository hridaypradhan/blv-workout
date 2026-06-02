import { useEffect, useRef } from "react";
import { recordPlaybackEvent } from "@/lib/api";

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
 * Avoids duplicate noisy events and ensures telemetry failures do not block or crash playback.
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

  // Track state transitions (play, pause, ended)
  useEffect(() => {
    if (!sessionId || !isReady) return;

    if (prevIsPlaying.current !== isPlaying) {
      if (prevIsPlaying.current !== null) {
        if (!isPlaying && hasEnded) {
          recordPlaybackEvent(sessionId, "ended", currentTime * 1000, { source: "youtube_player" })
            .catch((err) => console.warn("Failed to log playback ended event:", err));
        } else {
          const eventType = isPlaying ? "play" : "pause";
          recordPlaybackEvent(sessionId, eventType, currentTime * 1000, { source: "youtube_player" })
            .catch((err) => console.warn("Failed to log playback state event:", err));
        }
      }
      prevIsPlaying.current = isPlaying;
    }
  }, [isPlaying, hasEnded, isReady, sessionId, currentTime]);

  // Track playback rate changes
  useEffect(() => {
    if (!sessionId || !isReady) return;

    if (prevPlaybackRate.current !== null && prevPlaybackRate.current !== playbackRate) {
      recordPlaybackEvent(sessionId, "speed_change", currentTime * 1000, {
        from_rate: prevPlaybackRate.current,
        to_rate: playbackRate,
      }).catch((err) => console.warn("Failed to log playback rate event:", err));
    }
    prevPlaybackRate.current = playbackRate;
  }, [playbackRate, isReady, sessionId, currentTime]);

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
      recordPlaybackEvent(sessionId, "seek", currentTime * 1000, {
        from_seconds: prevTime.current,
        to_seconds: currentTime,
      }).catch((err) => console.warn("Failed to log playback seek event:", err));
    }

    prevTime.current = currentTime;
  }, [currentTime, isReady, sessionId]);
}
