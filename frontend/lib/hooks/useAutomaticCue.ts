import { useState, useRef, useCallback } from "react";

/**
 * Hook to manage the active automatic assistant cue state and its 25-second deduplication map.
 */
export function useAutomaticCue(currentTimeRef: React.MutableRefObject<number>) {
  const [latestAutomaticCue, setLatestAutomaticCue] = useState<{
    text: string;
    type: string;
    timestamp: Date;
    videoTime: number;
  } | null>(null);

  const recentCuesRef = useRef<Map<string, number>>(new Map());

  const updateLatestAutomaticCue = useCallback((text: string, type: string) => {
    const now = Date.now();
    const lastShown = recentCuesRef.current.get(text);
    if (!lastShown || now - lastShown >= 25000) {
      recentCuesRef.current.set(text, now);
      setLatestAutomaticCue({
        text,
        type,
        timestamp: new Date(now),
        videoTime: currentTimeRef.current,
      });
    }
  }, [currentTimeRef]);

  return {
    latestAutomaticCue,
    updateLatestAutomaticCue,
    recentCuesRef,
  };
}
