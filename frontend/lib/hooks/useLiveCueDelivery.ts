import { useEffect, useRef } from "react";
import { selectCuePlanCandidateLocal } from "@/lib/cueSelection";
import { AudioCoexistenceSettings, CuePlan, RuntimeCueSelectionResponse } from "@/types";
import { SESSION_EVENTS } from "@/lib/sessionEvents";

interface UseLiveCueDeliveryProps {
  cuePlan: CuePlan | null;
  currentTime: number;
  isPlaying: boolean;
  coexistenceSettings: AudioCoexistenceSettings;
  assistantMuted: boolean;
  recentlyDeliveredCueIds: string[];
  setRecentlyDeliveredCueIds: React.Dispatch<React.SetStateAction<string[]>>;
  updateLatestAutomaticCue: (text: string, source: string) => void;
  handleAudioCueAnnouncement: (text: string) => void;
  handleHapticCueTrigger: (text: string, hapticCueRef: string | null, cueId: string | null) => void;
  logSessionEvent: (eventType: string, timestampMs: number, metadata?: Record<string, unknown>) => void;
  announce: (msg: string) => void;
  setCurrentSpokenCue: React.Dispatch<React.SetStateAction<(RuntimeCueSelectionResponse & { timestampMs?: number }) | null>>;
}

export function useLiveCueDelivery({
  cuePlan,
  currentTime,
  isPlaying,
  coexistenceSettings,
  assistantMuted,
  recentlyDeliveredCueIds,
  setRecentlyDeliveredCueIds,
  updateLatestAutomaticCue,
  handleAudioCueAnnouncement,
  handleHapticCueTrigger,
  logSessionEvent,
  announce,
  setCurrentSpokenCue,
}: UseLiveCueDeliveryProps) {
  const lastCheckedSecond = useRef<number>(-1);

  useEffect(() => {
    if (!cuePlan || !isPlaying) return;

    const currentSecond = Math.floor(currentTime);
    if (currentSecond === lastCheckedSecond.current) return;
    lastCheckedSecond.current = currentSecond;

    try {
      const res = selectCuePlanCandidateLocal(
        cuePlan,
        currentTime * 1000,
        coexistenceSettings,
        assistantMuted,
        recentlyDeliveredCueIds
      );

      if (res.should_deliver && res.cue_id) {
        setRecentlyDeliveredCueIds((prev) => [...prev, res.cue_id!]);

        const text = res.text || "";

        if (text) {
          updateLatestAutomaticCue(text, "cue_plan");
        }

        if (res.modality === "audio" && text) {
          handleAudioCueAnnouncement(text);
          setCurrentSpokenCue({
            ...res,
            timestampMs: currentTime * 1000
          });

          logSessionEvent(
            SESSION_EVENTS.ASSISTANT_CUE_DELIVERED,
            currentTime * 1000,
            {
              text: text,
              modality: res.modality,
              priority: "normal",
              cue_id: res.cue_id,
              reason: res.reason,
            }
          );
        } else if (res.modality === "haptic") {
          handleHapticCueTrigger(text, res.haptic_cue_ref, res.cue_id);
        }

        if (res.recommended_playback_action === "pause_before_speaking") {
          announce("Pausing workout playback for assistant instruction.");
        }
      }
    } catch (err) {
      console.warn("Failed to select cue candidate locally:", err);
    }
  }, [
    currentTime,
    isPlaying,
    cuePlan,
    coexistenceSettings,
    assistantMuted,
    recentlyDeliveredCueIds,
    setRecentlyDeliveredCueIds,
    updateLatestAutomaticCue,
    handleAudioCueAnnouncement,
    handleHapticCueTrigger,
    logSessionEvent,
    announce,
    setCurrentSpokenCue,
  ]);

  return { lastCheckedSecond };
}
