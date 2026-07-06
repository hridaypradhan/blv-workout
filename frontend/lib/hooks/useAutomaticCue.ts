import { useState, useRef, useCallback, useMemo } from "react";

/** Default half-window (ms) for cues that don't carry an explicit time range. */
const DEFAULT_WINDOW_HALF_MS = 3000;

export interface AutomaticCueState {
  text: string;
  type: string;
  timestamp: Date;
  videoTime: number;
  /** Start of the cue's valid playback window (ms). */
  startMs: number;
  /** End of the cue's valid playback window (ms). */
  endMs: number;
}

/**
 * Hook to manage the active automatic assistant cue state and its 25-second deduplication map.
 *
 * Tracks the cue's validity window so consumers can derive whether the cue
 * is active at the current playback position.
 *
 * @param currentTimeRef  Mutable ref kept in sync with the player's currentTime (seconds).
 *                        Used inside the update callback so it captures the delivery-time value.
 * @param currentTime     The current playback time in seconds (reactive, drives re-renders).
 *                        Used in the derived `isAutomaticCueActive` so it re-evaluates on every tick.
 */
export function useAutomaticCue(
  currentTimeRef: React.MutableRefObject<number>,
  currentTime: number
) {
  const [latestAutomaticCue, setLatestAutomaticCue] = useState<AutomaticCueState | null>(null);

  const recentCuesRef = useRef<Map<string, number>>(new Map());

  /**
   * Record a new automatic cue.
   *
   * @param text      The cue text to display.
   * @param type      The cue source type (e.g. "cue_plan", "correction", "legacy").
   * @param startMs   Optional explicit window start (ms). Defaults to videoTime - 3s.
   * @param endMs     Optional explicit window end (ms). Defaults to videoTime + 3 s.
   */
  const updateLatestAutomaticCue = useCallback(
    (text: string, type: string, startMs?: number, endMs?: number) => {
      const now = Date.now();
      const lastShown = recentCuesRef.current.get(text);
      if (!lastShown || now - lastShown >= 25000) {
        recentCuesRef.current.set(text, now);
        const videoTimeMs = currentTimeRef.current * 1000;
        setLatestAutomaticCue({
          text,
          type,
          timestamp: new Date(now),
          videoTime: currentTimeRef.current,
          startMs: startMs ?? videoTimeMs - DEFAULT_WINDOW_HALF_MS,
          endMs: endMs ?? videoTimeMs + DEFAULT_WINDOW_HALF_MS,
        });
      }
    },
    [currentTimeRef]
  );

  /**
   * Clear the displayed cue (e.g. on video change).
   */
  const clearAutomaticCue = useCallback(() => {
    setLatestAutomaticCue(null);
  }, []);

  /**
   * Derived: is the latest cue valid at the current playback position?
   *
   * Re-evaluated every time `currentTime` changes because it is a reactive
   * dependency (not a ref).
   */
  const isAutomaticCueActive = useMemo(() => {
    if (!latestAutomaticCue) return false;
    const currentMs = currentTime * 1000;
    return currentMs >= latestAutomaticCue.startMs && currentMs <= latestAutomaticCue.endMs;
  }, [latestAutomaticCue, currentTime]);

  return {
    latestAutomaticCue,
    isAutomaticCueActive,
    updateLatestAutomaticCue,
    clearAutomaticCue,
    recentCuesRef,
  };
}
