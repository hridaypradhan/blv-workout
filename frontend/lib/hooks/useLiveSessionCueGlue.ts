"use client";
/**
 * useLiveSessionCueGlue.ts
 *
 * Wires the legacy `activeCue` (from useAssistantCueQueue) to the
 * spoken-cue, haptic, and telemetry systems.
 *
 * This is the non-plan-backed fallback path — only active when there is no
 * cuePlan from the sidecar. When a positioning gate is open, cues are
 * suppressed (not deferred) and logged with SUPPRESSED_BY_GATE.
 */

import { useEffect, useRef } from "react";
import { SESSION_EVENTS } from "@/lib/sessionEvents";
import { AudioCoexistenceSettings, RuntimeCueSelectionResponse, User } from "@/types";
import { inferHapticCategoryFromCue, HAPTIC_CATEGORY_DEFAULT_IDS } from "@/lib/userPreferences";

// A minimal shape of an activeCue from useAssistantCueQueue
interface ActiveCueItem {
  timestamp_ms?: number | null;
  text: string;
  modality: "audio" | "haptic" | string;
  priority?: string;
  persona?: string;
  metadata?: Record<string, unknown> | null;
}

interface UseLiveSessionCueGlueProps {
  activeCue: ActiveCueItem | null;
  currentTime: number;
  currentTimeMs: number;
  isLiveGateOpen: boolean;
  coexistenceSettings: AudioCoexistenceSettings;
  userProfile: User | null | undefined;
  announce: (msg: string) => void;
  handleAudioCueAnnouncement: (text: string) => void;
  updateLatestAutomaticCue: (text: string, source: string) => void;
  logSessionEvent: (eventType: string, timestampMs: number, payload?: Record<string, unknown>) => void;
  triggerHapticEvent: (payload: {
    cueType: string;
    vibrationId: string;
    intensity: number;
    limbs?: string[];
    text?: string;
    cueId?: string | null;
    currentTimeMs: number;
  }) => Promise<unknown>;
  setCurrentSpokenCue: (cue: (RuntimeCueSelectionResponse & { timestampMs?: number }) | null) => void;
}

export function useLiveSessionCueGlue({
  activeCue,
  currentTime,
  currentTimeMs,
  isLiveGateOpen,
  coexistenceSettings,
  userProfile,
  announce,
  handleAudioCueAnnouncement,
  updateLatestAutomaticCue,
  logSessionEvent,
  triggerHapticEvent,
  setCurrentSpokenCue,
}: UseLiveSessionCueGlueProps) {
  const lastRecordedCueKey = useRef<string | null>(null);

  useEffect(() => {
    if (!activeCue) return;

    const cueKey = `${activeCue.timestamp_ms}-${activeCue.text}`;
    if (lastRecordedCueKey.current === cueKey) return;

    // Gate-active suppression: do not deliver audio/haptic, do not record
    // as delivered so the cue can re-trigger after gate completion + seek-back.
    if (isLiveGateOpen) {
      logSessionEvent(
        SESSION_EVENTS.CUE_SUPPRESSED_BY_GATE,
        activeCue.timestamp_ms || currentTime * 1000,
        {
          text: activeCue.text,
          modality: activeCue.modality,
          reason: "positioning_gate_active",
          source: "legacy_fallback",
        }
      );
      return;
    }

    lastRecordedCueKey.current = cueKey;
    updateLatestAutomaticCue(activeCue.text, "legacy");

    if (activeCue.modality === "audio") {
      handleAudioCueAnnouncement(activeCue.text);
      setCurrentSpokenCue({
        cue_id: `legacy-${activeCue.timestamp_ms}-${activeCue.text}`,
        should_deliver: true,
        modality: "audio",
        text: activeCue.text,
        haptic_cue_ref: null,
        interruption_policy_hint: null,
        recommended_playback_action: coexistenceSettings.pause_before_speaking
          ? "pause_before_speaking"
          : "none",
        reason: "Legacy fallback cue",
        timestampMs: activeCue.timestamp_ms || currentTime * 1000,
      });
    } else if (activeCue.modality === "haptic") {
      announce(`Haptic cue requested: ${activeCue.text}`);
    }

    if (activeCue.modality !== "haptic") {
      logSessionEvent(
        SESSION_EVENTS.ASSISTANT_CUE_DELIVERED,
        activeCue.timestamp_ms || currentTime * 1000,
        {
          text: activeCue.text,
          modality: activeCue.modality,
          priority: activeCue.priority,
          persona: activeCue.persona,
        }
      );
    }

    if (activeCue.modality === "haptic") {
      const category = inferHapticCategoryFromCue(activeCue.text, activeCue.metadata);
      if (!category) {
        // Countdown, Form Warning, or unclassifiable cue -> suppress haptics
        return;
      }
      const vibrationId =
        (userProfile?.haptic_preferences as Record<string, string | null | undefined> | null | undefined)?.[category] ||
        HAPTIC_CATEGORY_DEFAULT_IDS[category];
      const intensity =
        typeof activeCue.metadata?.intensity === "number" ? activeCue.metadata.intensity : 0.7;

      const limbs: string[] = [];
      const requestSleeves = (activeCue.metadata?.sleeve_sides ||
        activeCue.metadata?.sleeves || ["both"]) as string[];
      requestSleeves.forEach((s) => {
        if (s === "left") limbs.push("left_arm");
        else if (s === "right") limbs.push("right_arm");
        else if (s === "both") limbs.push("left_arm", "right_arm");
      });
      if (limbs.length === 0) limbs.push("left_arm", "right_arm");

      triggerHapticEvent({
        cueType: category,
        vibrationId,
        intensity,
        limbs,
        text: activeCue.text,
        cueId: `legacy-${activeCue.timestamp_ms}-${activeCue.text}`,
        currentTimeMs: activeCue.timestamp_ms || currentTime * 1000,
      }).catch((err) => {
        console.error("Failed to trigger haptic event:", err);
      });
    }
  }, [
    activeCue,
    currentTime,
    currentTimeMs,
    isLiveGateOpen,
    coexistenceSettings,
    userProfile,
    announce,
    handleAudioCueAnnouncement,
    updateLatestAutomaticCue,
    logSessionEvent,
    triggerHapticEvent,
    setCurrentSpokenCue,
  ]);
}
