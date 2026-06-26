import { useState, useCallback } from "react";
import { triggerHapticPattern } from "../api/haptic";
import { HapticTriggerResponse } from "../../types";
import { SESSION_EVENTS } from "../sessionEvents";

export interface HapticEventLog {
  timestamp: number;
  eventName: string;
  deliveryMode: "hardware" | "indicator" | "dry_run" | "failed";
  targetLimbs: string[];
  statusMessage: string;
}

export function useHapticEventDelivery(
  announce: (msg: string) => void,
  logSessionEvent?: (eventType: string, timestampMs: number, metadata?: Record<string, unknown>) => void
) {
  const [lastResult, setLastResult] = useState<HapticTriggerResponse | null>(null);
  const [recentEvents, setRecentEvents] = useState<HapticEventLog[]>([]);

  const addEventLog = useCallback((log: HapticEventLog) => {
    setRecentEvents((prev) => [log, ...prev].slice(0, 5));
  }, []);

  const triggerHapticEvent = useCallback(
    async (params: {
      cueType: string;
      vibrationId: string;
      intensity: number;
      limbs?: string[];
      text?: string;
      cueId?: string | null;
      currentTimeMs: number;
    }) => {
      const { cueType, vibrationId, intensity, limbs = ["left_arm", "right_arm"], text = "", cueId = null, currentTimeMs } = params;

      // Log requested telemetry
      if (logSessionEvent) {
        logSessionEvent(SESSION_EVENTS.HAPTIC_CUE_REQUESTED, currentTimeMs, {
          text,
          modality: "haptic",
          priority: "normal",
          cue_id: cueId,
          cue_type: cueType,
          selected_vibration_id: vibrationId,
        });
      }

      try {
        const res = await triggerHapticPattern(
          null, // sleeveSides is resolved by the backend or limbs
          null, // patternName is resolved by backend
          intensity,
          cueType,
          vibrationId,
          limbs
        );

        setLastResult(res);

        const deliveryMode = res.delivery_mode || "dry_run";
        const eventName = res.bhaptics_event_name || cueType;
        const targetPositions = res.target_positions || limbs;
        const statusMessage = res.status_message || "";

        // Add to recent event logs
        addEventLog({
          timestamp: Date.now(),
          eventName,
          deliveryMode,
          targetLimbs: targetPositions,
          statusMessage,
        });

        // Announcements & Telemetry
        if (deliveryMode === "hardware") {
          announce(`Haptic fired: ${eventName}.`);
          if (logSessionEvent) {
            logSessionEvent(SESSION_EVENTS.HAPTIC_CUE_TRIGGERED, currentTimeMs, {
              delivery_mode: "hardware",
              bhaptics_event_name: eventName,
              request_id: res.request_id,
              hardware_available: true,
              player_available: true,
              target_positions: targetPositions,
              status_message: statusMessage,
              cue_type: cueType,
              selected_vibration_id: vibrationId,
              selected_wav: res.selected_wav,
              target_limbs: res.target_limbs,
              provider: res.provider,
              status: res.status,
              intensity,
              text,
              cue_id: cueId,
            });
          }
        } else if (deliveryMode === "indicator" || deliveryMode === "dry_run") {
          announce(`Haptic indicator: ${eventName}.`);
          if (logSessionEvent) {
            logSessionEvent(SESSION_EVENTS.HAPTIC_CUE_TRIGGERED, currentTimeMs, {
              delivery_mode: deliveryMode,
              bhaptics_event_name: eventName,
              request_id: res.request_id,
              hardware_available: res.hardware_available || false,
              player_available: res.player_available || false,
              target_positions: targetPositions,
              status_message: statusMessage,
              cue_type: cueType,
              selected_vibration_id: vibrationId,
              selected_wav: res.selected_wav,
              target_limbs: res.target_limbs,
              provider: res.provider,
              status: res.status,
              intensity,
              text,
              cue_id: cueId,
            });
          }
        } else {
          // delivery_mode === "failed"
          announce("Haptic delivery failed.");
          if (logSessionEvent) {
            logSessionEvent(SESSION_EVENTS.HAPTIC_CUE_FAILED, currentTimeMs, {
              delivery_mode: "failed",
              bhaptics_event_name: eventName,
              request_id: res.request_id,
              hardware_available: res.hardware_available || false,
              player_available: res.player_available || false,
              target_positions: targetPositions,
              status_message: statusMessage,
              cue_type: cueType,
              selected_vibration_id: vibrationId,
              intensity,
              error: statusMessage,
              text,
              cue_id: cueId,
            });
          }
        }

        return res;
      } catch (err) {
        announce("Haptic delivery failed.");
        const errorMessage = err instanceof Error ? err.message : String(err);
        addEventLog({
          timestamp: Date.now(),
          eventName: cueType,
          deliveryMode: "failed",
          targetLimbs: limbs,
          statusMessage: errorMessage,
        });

        if (logSessionEvent) {
          logSessionEvent(SESSION_EVENTS.HAPTIC_CUE_FAILED, currentTimeMs, {
            delivery_mode: "failed",
            bhaptics_event_name: cueType,
            target_positions: limbs,
            status_message: errorMessage,
            cue_type: cueType,
            selected_vibration_id: vibrationId,
            intensity,
            error: errorMessage,
            text,
            cue_id: cueId,
          });
        }
        throw err;
      }
    },
    [announce, logSessionEvent, addEventLog]
  );

  return {
    lastResult,
    recentEvents,
    triggerHapticEvent,
  };
}
