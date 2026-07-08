import { useState, useCallback, useRef } from "react";

/**
 * Identifies which feature currently owns a playback pause.
 *
 * - `positioning_gate`  – Active while a per-exercise camera alignment gate is open.
 * - `assistant_speech`  – Active while the assistant is speaking a "pause before speaking" cue.
 * - `voice_listening`   – Reserved for future audio ducking during voice capture. Not currently wired.
 * - `user_manual`       – Active when the user pauses manually (button, IFrame click, or voice command).
 */
export type PauseOwner = "positioning_gate" | "assistant_speech" | "voice_listening" | "user_manual";

export function usePlaybackPauseCoordinator(
  playVideo: () => void,
  pauseVideo: () => void,
  logSessionEvent: (eventType: string, timestampMs: number, metadata?: Record<string, unknown>) => void,
  currentTimeMs: number,
  isEnding: () => boolean
) {
  const [activeOwners, setActiveOwners] = useState<Set<PauseOwner>>(new Set());
  const activeOwnersRef = useRef<Set<PauseOwner>>(new Set());

  const requestPause = useCallback((owner: PauseOwner, reason?: string) => {
    const current = new Set(activeOwnersRef.current);
    if (!current.has(owner)) {
      current.add(owner);
      activeOwnersRef.current = current;
      setActiveOwners(current);

      logSessionEvent("pause_coordinator_request", currentTimeMs, {
        owner,
        reason,
        activeOwners: Array.from(current),
      });

      pauseVideo();
    }
  }, [pauseVideo, logSessionEvent, currentTimeMs]);

  const releasePause = useCallback((owner: PauseOwner, reason?: string, skipResume = false) => {
    const current = new Set(activeOwnersRef.current);
    if (current.has(owner)) {
      current.delete(owner);
      activeOwnersRef.current = current;
      setActiveOwners(current);

      const ending = isEnding();

      logSessionEvent("pause_coordinator_release", currentTimeMs, {
        owner,
        reason,
        activeOwners: Array.from(current),
        willResume: current.size === 0 && !skipResume && !ending,
      });

      if (current.size === 0 && !skipResume && !ending) {
        playVideo();
      }
    }
  }, [playVideo, logSessionEvent, currentTimeMs, isEnding]);

  const clearAll = useCallback(() => {
    activeOwnersRef.current = new Set();
    setActiveOwners(new Set());
    logSessionEvent("pause_coordinator_clear", currentTimeMs);
  }, [logSessionEvent, currentTimeMs]);

  return {
    activeOwners,
    requestPause,
    releasePause,
    clearAll,
  };
}
