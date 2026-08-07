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
export type PlaybackIntent = "playing" | "paused" | null;

export function usePlaybackPauseCoordinator(
  playVideo: () => void,
  pauseVideo: () => void,
  logSessionEvent: (eventType: string, timestampMs: number, metadata?: Record<string, unknown>) => void,
  currentTimeMs: number,
  isEnding: () => boolean
) {
  const [activeOwners, setActiveOwners] = useState<Set<PauseOwner>>(new Set());
  const activeOwnersRef = useRef<Set<PauseOwner>>(new Set());

  const [playbackIntent, setPlaybackIntentState] = useState<PlaybackIntent>(null);
  const playbackIntentRef = useRef<PlaybackIntent>(null);

  const setPlaybackIntent = useCallback((intent: PlaybackIntent) => {
    playbackIntentRef.current = intent;
    setPlaybackIntentState(intent);
  }, []);

  const clearPlaybackIntent = useCallback(() => {
    playbackIntentRef.current = null;
    setPlaybackIntentState(null);
  }, []);

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

      setPlaybackIntent("paused");
      pauseVideo();
    }
  }, [pauseVideo, logSessionEvent, currentTimeMs, setPlaybackIntent]);

  const releasePause = useCallback((owner: PauseOwner, reason?: string, skipResume = false) => {
    const current = new Set(activeOwnersRef.current);
    if (current.has(owner)) {
      current.delete(owner);
      activeOwnersRef.current = current;
      setActiveOwners(current);

      const ending = isEnding();
      const willResume = current.size === 0 && !skipResume && !ending;

      logSessionEvent("pause_coordinator_release", currentTimeMs, {
        owner,
        reason,
        activeOwners: Array.from(current),
        willResume,
      });

      if (willResume) {
        setPlaybackIntent("playing");
        playVideo();
      }
    }
  }, [playVideo, logSessionEvent, currentTimeMs, isEnding, setPlaybackIntent]);

  const resume = useCallback((reason?: string) => {
    const current = new Set(activeOwnersRef.current);
    if (current.has("user_manual")) {
      current.delete("user_manual");
      activeOwnersRef.current = current;
      setActiveOwners(current);
    }

    const ending = isEnding();
    const canResume = current.size === 0 && !ending;

    logSessionEvent("pause_coordinator_release", currentTimeMs, {
      owner: "user_manual",
      reason: reason || "Manual user play trigger",
      activeOwners: Array.from(current),
      willResume: canResume,
    });

    if (canResume) {
      setPlaybackIntent("playing");
      playVideo();
    }
  }, [playVideo, logSessionEvent, currentTimeMs, isEnding, setPlaybackIntent]);

  const clearAll = useCallback(() => {
    activeOwnersRef.current = new Set();
    setActiveOwners(new Set());
    setPlaybackIntent(null);
    logSessionEvent("pause_coordinator_clear", currentTimeMs);
  }, [logSessionEvent, currentTimeMs, setPlaybackIntent]);

  return {
    activeOwners,
    playbackIntent,
    setPlaybackIntent,
    clearPlaybackIntent,
    requestPause,
    releasePause,
    resume,
    clearAll,
  };
}
