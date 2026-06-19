"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  AudioCoexistenceSettings,
  InterruptionLevel,
  FeedbackModality,
} from "../../types";

export interface UseSpokenCuePlaybackProps {
  cueId: string | null | undefined;
  shouldDeliver: boolean | null | undefined;
  modality: string | null | undefined;
  text: string | null | undefined;
  recommendedPlaybackAction: "none" | "pause_before_speaking" | "duck_audio" | null | undefined;
  assistantMuted: boolean;
  audioCoexistenceSettings: AudioCoexistenceSettings | null | undefined;
  voiceSettings: Record<string, unknown> | null | undefined;
  feedbackModalities: FeedbackModality[] | null | undefined;
  videoId: string | null | undefined;
  sessionId: string | null | undefined;
  currentTime: number; // in seconds
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  getVolume?: () => number | null;
  setVolume?: (vol: number) => void;
  isPlayerMuted?: () => boolean | null;
  timestampMs?: number | null;
  seekEpoch: number;
}

function findBestVoice(voices: SpeechSynthesisVoice[], voiceId?: string): SpeechSynthesisVoice | null {
  if (!voiceId || voiceId === "system") {
    return null;
  }

  const search = voiceId.toLowerCase();

  // Try exact match first
  let match = voices.find((v) => v.name.toLowerCase() === search);
  if (match) return match;

  // Try name containing search string
  match = voices.find((v) => v.name.toLowerCase().includes(search));
  if (match) return match;

  // Try language match
  match = voices.find((v) => v.lang.toLowerCase() === search);
  if (match) return match;

  // Special match for google-us / google-uk
  if (search.includes("google-us") || search.includes("us")) {
    match =
      voices.find((v) => v.lang.toLowerCase() === "en-us" && v.name.toLowerCase().includes("google")) ||
      voices.find((v) => v.lang.toLowerCase() === "en-us") ||
      voices.find((v) => v.lang.toLowerCase().startsWith("en"));
    if (match) return match;
  }

  if (search.includes("google-uk") || search.includes("uk") || search.includes("gb")) {
    match =
      voices.find((v) => v.lang.toLowerCase() === "en-gb" && v.name.toLowerCase().includes("google")) ||
      voices.find((v) => v.lang.toLowerCase() === "en-gb") ||
      voices.find((v) => v.lang.toLowerCase().startsWith("en"));
    if (match) return match;
  }

  // Fallback to any English voice
  const englishVoice = voices.find((v) => v.lang.toLowerCase().startsWith("en"));
  if (englishVoice) return englishVoice;

  return null;
}

export function useSpokenCuePlayback({
  cueId,
  shouldDeliver,
  modality,
  text,
  recommendedPlaybackAction,
  assistantMuted,
  audioCoexistenceSettings,
  voiceSettings,
  feedbackModalities,
  videoId,
  sessionId,
  currentTime,
  isPlaying,
  play,
  pause,
  getVolume,
  setVolume,
  isPlayerMuted,
  timestampMs,
  seekEpoch,
}: UseSpokenCuePlaybackProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Keep tracks of delivered cue IDs
  const spokenCueIdsRef = useRef<Set<string>>(new Set());

  // Track playback state and functions using refs to avoid re-triggering speech on state updates
  const isPlayingRef = useRef(isPlaying);
  const playRef = useRef(play);
  const pauseRef = useRef(pause);

  // Track volume methods using refs
  const getVolumeRef = useRef(getVolume);
  const setVolumeRef = useRef(setVolume);
  const isPlayerMutedRef = useRef(isPlayerMuted);

  // Reference to cancel state flag to prevent async event handler race conditions
  const isCancelledRef = useRef(false);

  // Keep refs updated
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    playRef.current = play;
    pauseRef.current = pause;
    getVolumeRef.current = getVolume;
    setVolumeRef.current = setVolume;
    isPlayerMutedRef.current = isPlayerMuted;
  }, [isPlaying, play, pause, getVolume, setVolume, isPlayerMuted]);

  // Track whether we paused the player specifically for the active spoken cue
  const wasPlayingRef = useRef(false);

  // Track whether we ducked the player and the original volume
  const isDuckedRef = useRef(false);
  const originalVolumeRef = useRef<number | null>(null);

  // Track time & wall clock for fallback seek detection
  const prevTimeRef = useRef<number>(currentTime);
  const prevWallClockRef = useRef<number>(Date.now());

  // Track seekEpoch to detect explicit seeks
  const prevSeekEpochRef = useRef(seekEpoch);

  const restoreVolume = useCallback(() => {
    if (isDuckedRef.current && originalVolumeRef.current !== null && setVolumeRef.current) {
      setVolumeRef.current(originalVolumeRef.current);
      originalVolumeRef.current = null;
      isDuckedRef.current = false;
    }
  }, []);

  const restorePlayback = useCallback(() => {
    if (wasPlayingRef.current && playRef.current) {
      playRef.current();
      wasPlayingRef.current = false;
    }
  }, []);

  const cancelSpeech = useCallback((shouldResumePlayback = false) => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      isCancelledRef.current = true;
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    // Restore volume if ducked
    restoreVolume();

    // Conditionally restore playback
    if (shouldResumePlayback) {
      restorePlayback();
    } else {
      wasPlayingRef.current = false; // Discard resume flag
    }
  }, [restoreVolume, restorePlayback]);

  // 1. Cancel speech on video change, session change, or unmount, and clear cue cache
  useEffect(() => {
    cancelSpeech(false);
    spokenCueIdsRef.current.clear();
    return () => {
      cancelSpeech(false);
    };
  }, [videoId, sessionId, cancelSpeech]);

  // 2. Cancel speech on mute or if interruption level changes to silent/haptic-only
  useEffect(() => {
    const isSilentOrHapticOnly =
      audioCoexistenceSettings?.interruption_level === InterruptionLevel.SILENT ||
      audioCoexistenceSettings?.interruption_level === InterruptionLevel.HAPTIC_ONLY;

    if (assistantMuted || isSilentOrHapticOnly) {
      cancelSpeech(true); // Allow resuming playback since this is a configuration change, not a seek
    }
  }, [assistantMuted, audioCoexistenceSettings?.interruption_level, cancelSpeech]);

  // 3. Cancel speech on explicit seekEpoch signal changes
  useEffect(() => {
    if (seekEpoch !== prevSeekEpochRef.current) {
      cancelSpeech(false); // Do NOT resume playback after user-initiated seeks
    }
    prevSeekEpochRef.current = seekEpoch;
  }, [seekEpoch, cancelSpeech]);

  // 4. Fallback seek detection for direct YouTube player iframe seeks (ignores normal playback drift and timer throttling)
  useEffect(() => {
    const now = Date.now();
    const deltaWallClock = (now - prevWallClockRef.current) / 1000;
    const deltaVideo = currentTime - prevTimeRef.current;

    // Detect seek: if the change in video time differs significantly from the elapsed wall clock time.
    // If deltaVideo is negative, it is always a backward seek.
    const isSeek = deltaVideo < -1.5 || (deltaVideo > 1.5 && Math.abs(deltaVideo - deltaWallClock) > 2.0);

    if (isSeek) {
      cancelSpeech(false); // Do NOT resume playback after user-initiated seeks

      // Clear spoken cache if seeking backward significantly
      if (deltaVideo < -1.5) {
        spokenCueIdsRef.current.clear();
      }
    }

    prevTimeRef.current = currentTime;
    prevWallClockRef.current = now;
  }, [currentTime, cancelSpeech]);

  // 5. Trigger speech when a new cue is received
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    // Speak conditions
    if (!cueId || !shouldDeliver || modality !== "audio" || !text) {
      return;
    }

    if (assistantMuted) {
      return;
    }

    const isSilentOrHapticOnly =
      audioCoexistenceSettings?.interruption_level === InterruptionLevel.SILENT ||
      audioCoexistenceSettings?.interruption_level === InterruptionLevel.HAPTIC_ONLY;

    if (isSilentOrHapticOnly) {
      return;
    }

    if (feedbackModalities && !feedbackModalities.includes(FeedbackModality.AUDIO)) {
      return;
    }

    if (spokenCueIdsRef.current.has(cueId)) {
      return;
    }

    // Invalidate stale cues (more than 2 seconds off from current video time)
    if (timestampMs !== undefined && timestampMs !== null) {
      const timeDiff = Math.abs(currentTime * 1000 - timestampMs);
      if (timeDiff > 2000) {
        return;
      }
    }

    // Mark as delivered
    spokenCueIdsRef.current.add(cueId);

    // Cancel any active speech (do NOT resume playback in between cues)
    cancelSpeech(false);

    // Setup the speech utterance
    const utterance = new SpeechSynthesisUtterance(text);

    // Determine voice speed/rate preference
    const ttsRate =
      typeof voiceSettings?.tts_rate === "number"
        ? voiceSettings.tts_rate
        : typeof voiceSettings?.speed === "number"
        ? voiceSettings.speed
        : 1.0;
    utterance.rate = ttsRate;

    // Pick matching browser voice if available
    const voices = window.speechSynthesis.getVoices();
    const voiceId = typeof voiceSettings?.voice_id === "string" ? voiceSettings.voice_id : undefined;
    const bestVoice = findBestVoice(voices, voiceId);
    if (bestVoice) {
      utterance.voice = bestVoice;
    }

    // Reset cancel flag before speaking
    isCancelledRef.current = false;

    // A. Handle pause_before_speaking playback action
    if (recommendedPlaybackAction === "pause_before_speaking") {
      const wasPlayingBefore = isPlayingRef.current;
      wasPlayingRef.current = wasPlayingBefore;
      if (wasPlayingBefore && pauseRef.current) {
        pauseRef.current();
      }
    }

    // B. Handle duck_audio playback action
    if (recommendedPlaybackAction === "duck_audio") {
      const currentVol = getVolumeRef.current ? getVolumeRef.current() : null;
      const isMuted = isPlayerMutedRef.current ? isPlayerMutedRef.current() : null;

      if (currentVol !== null && isMuted !== null) {
        originalVolumeRef.current = currentVol;
        isDuckedRef.current = true;

        // If the player is NOT muted, and current volume is above target, duck it to 25
        if (!isMuted && currentVol > 25 && setVolumeRef.current) {
          setVolumeRef.current(25);
        }
      }
    }

    utterance.onend = () => {
      setIsSpeaking(false);
      if (isCancelledRef.current) return;

      restoreVolume();
      if (recommendedPlaybackAction === "pause_before_speaking") {
        restorePlayback();
      }
    };

    utterance.onerror = (event) => {
      setIsSpeaking(false);
      if (isCancelledRef.current) return;

      restoreVolume();
      // Resume playback only if speech was not explicitly interrupted/cancelled
      if (event.error !== "interrupted" && event.error !== "canceled") {
        if (recommendedPlaybackAction === "pause_before_speaking") {
          restorePlayback();
        }
      }
    };

    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  }, [
    cueId,
    shouldDeliver,
    modality,
    text,
    recommendedPlaybackAction,
    assistantMuted,
    audioCoexistenceSettings?.interruption_level,
    feedbackModalities,
    voiceSettings,
    timestampMs,
    cancelSpeech,
    currentTime,
    restorePlayback,
    restoreVolume,
  ]);

  return {
    isSpeaking,
  };
}
