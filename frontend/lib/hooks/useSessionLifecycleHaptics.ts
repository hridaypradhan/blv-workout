import { useState, useEffect, useRef, useCallback } from "react";
import { User } from "@/types";
import { HAPTIC_CATEGORY_DEFAULT_IDS } from "@/lib/userPreferences";

export interface UseSessionLifecycleHapticsProps {
  sessionId: string | null;
  isReady: boolean;
  isPlaying: boolean;
  hasEnded: boolean;
  isLiveGateOpen: boolean;
  currentTime: number;
  userProfile: User | null | undefined;
  triggerHapticEvent: (payload: {
    cueType: string;
    vibrationId: string;
    intensity: number;
    limbs?: string[];
    text?: string;
    cueId?: string | null;
    currentTimeMs: number;
  }) => Promise<unknown>;
}

export interface UseSessionLifecycleHapticsReturn {
  triggerStartHaptic: () => Promise<void>;
  triggerFinishHaptic: () => Promise<void>;
  hasDeliveredStart: boolean;
  hasDeliveredFinish: boolean;
  isStartPending: boolean;
  isFinishPending: boolean;
}

/**
 * Concurrency-safe and cross-session-safe hook for workout Start/Finish haptic triggers.
 *
 * Uses a session generation counter to ensure that a pending request from session A
 * cannot resolve and mutate session B's delivered/pending state.
 */
export function useSessionLifecycleHaptics({
  sessionId,
  isReady,
  isPlaying,
  hasEnded,
  isLiveGateOpen,
  currentTime,
  userProfile,
  triggerHapticEvent,
}: UseSessionLifecycleHapticsProps): UseSessionLifecycleHapticsReturn {
  const [hasDeliveredStart, setHasDeliveredStart] = useState(false);
  const [hasDeliveredFinish, setHasDeliveredFinish] = useState(false);
  const [isStartPending, setIsStartPending] = useState(false);
  const [isFinishPending, setIsFinishPending] = useState(false);

  const hasDeliveredStartRef = useRef(false);
  const hasDeliveredFinishRef = useRef(false);
  const isStartPendingRef = useRef(false);
  const isFinishPendingRef = useRef(false);

  // Session generation counter — incremented on every sessionId change
  const sessionGenerationRef = useRef(0);
  const mountedRef = useRef(true);

  // Keep latest mutable props in ref to preserve callback identity
  const propsRef = useRef({
    sessionId,
    isReady,
    isPlaying,
    isLiveGateOpen,
    currentTime,
    userProfile,
    triggerHapticEvent,
  });

  useEffect(() => {
    propsRef.current = {
      sessionId,
      isReady,
      isPlaying,
      isLiveGateOpen,
      currentTime,
      userProfile,
      triggerHapticEvent,
    };
  }, [sessionId, isReady, isPlaying, isLiveGateOpen, currentTime, userProfile, triggerHapticEvent]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Reset delivered and pending states when sessionId changes
  useEffect(() => {
    sessionGenerationRef.current += 1;
    hasDeliveredStartRef.current = false;
    hasDeliveredFinishRef.current = false;
    isStartPendingRef.current = false;
    isFinishPendingRef.current = false;
    if (mountedRef.current) {
      setHasDeliveredStart(false);
      setHasDeliveredFinish(false);
      setIsStartPending(false);
      setIsFinishPending(false);
    }
  }, [sessionId]);

  const triggerStartHaptic = useCallback(async () => {
    const { sessionId, userProfile, triggerHapticEvent, currentTime } = propsRef.current;
    if (!sessionId) return;
    if (hasDeliveredStartRef.current || isStartPendingRef.current) return;

    // Capture current generation before the async operation
    const capturedGeneration = sessionGenerationRef.current;

    // Synchronously set pending guard before awaiting trigger request
    isStartPendingRef.current = true;
    if (mountedRef.current) setIsStartPending(true);

    const vibrationId = userProfile?.haptic_preferences?.start || HAPTIC_CATEGORY_DEFAULT_IDS.start;
    try {
      await triggerHapticEvent({
        cueType: "start",
        vibrationId,
        intensity: 0.8,
        limbs: ["left_arm", "right_arm"],
        text: "Workout session started.",
        cueId: `session-start-${sessionId}`,
        currentTimeMs: currentTime * 1000,
      });
      // Only apply result if we're still in the same session generation
      if (capturedGeneration === sessionGenerationRef.current) {
        hasDeliveredStartRef.current = true;
        if (mountedRef.current) setHasDeliveredStart(true);
      }
    } catch (err) {
      console.error("Failed to trigger start haptic cue:", err);
    } finally {
      // Only clear pending if still the same generation
      if (capturedGeneration === sessionGenerationRef.current) {
        isStartPendingRef.current = false;
        if (mountedRef.current) setIsStartPending(false);
      }
    }
  }, []);

  const triggerFinishHaptic = useCallback(async () => {
    const { sessionId, userProfile, triggerHapticEvent, currentTime } = propsRef.current;
    if (!sessionId) return;
    if (hasDeliveredFinishRef.current || isFinishPendingRef.current) return;

    // Capture current generation before the async operation
    const capturedGeneration = sessionGenerationRef.current;

    // Synchronously set pending guard before awaiting trigger request
    isFinishPendingRef.current = true;
    if (mountedRef.current) setIsFinishPending(true);

    const vibrationId = userProfile?.haptic_preferences?.finish || HAPTIC_CATEGORY_DEFAULT_IDS.finish;
    try {
      await triggerHapticEvent({
        cueType: "finish",
        vibrationId,
        intensity: 0.8,
        limbs: ["left_arm", "right_arm"],
        text: "Workout session finished.",
        cueId: `session-finish-${sessionId}`,
        currentTimeMs: currentTime * 1000,
      });
      // Only apply result if we're still in the same session generation
      if (capturedGeneration === sessionGenerationRef.current) {
        hasDeliveredFinishRef.current = true;
        if (mountedRef.current) setHasDeliveredFinish(true);
      }
    } catch (err) {
      console.error("Failed to trigger finish haptic cue:", err);
    } finally {
      // Only clear pending if still the same generation
      if (capturedGeneration === sessionGenerationRef.current) {
        isFinishPendingRef.current = false;
        if (mountedRef.current) setIsFinishPending(false);
      }
    }
  }, []);

  // Automatic Start delivery when eligible
  useEffect(() => {
    if (isPlaying && isReady && !isLiveGateOpen && !hasDeliveredStartRef.current && !isStartPendingRef.current && sessionId) {
      triggerStartHaptic();
    }
  }, [isPlaying, isReady, isLiveGateOpen, sessionId, triggerStartHaptic]);

  // Automatic Finish delivery on natural video completion
  useEffect(() => {
    if (hasEnded && !hasDeliveredFinishRef.current && !isFinishPendingRef.current && sessionId) {
      triggerFinishHaptic();
    }
  }, [hasEnded, sessionId, triggerFinishHaptic]);

  return {
    triggerStartHaptic,
    triggerFinishHaptic,
    hasDeliveredStart,
    hasDeliveredFinish,
    isStartPending,
    isFinishPending,
  };
}
