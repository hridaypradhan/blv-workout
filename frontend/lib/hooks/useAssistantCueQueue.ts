"use client";

import { useState, useEffect, useRef } from "react";
import {
  SidecarManifest,
  AssistantCue,
  AudioCoexistenceSettings,
  InterruptionLevel,
  AssistantPersona,
  SpeakingOpportunityMode,
} from "../../types";

export function useAssistantCueQueue(
  manifest: SidecarManifest | null,
  currentTimeMs: number,
  settings: AudioCoexistenceSettings
) {
  const [cueQueue, setCueQueue] = useState<AssistantCue[]>([]);
  const [activeCue, setActiveCue] = useState<AssistantCue | null>(null);

  const triggeredKeys = useRef<Set<string>>(new Set());
  const prevTimeMs = useRef<number>(0);

  // Clear triggered cues if user seeks backward significantly
  useEffect(() => {
    if (currentTimeMs < prevTimeMs.current - 1500) {
      triggeredKeys.current.clear();
    }
    prevTimeMs.current = currentTimeMs;
  }, [currentTimeMs]);

  useEffect(() => {
    if (!manifest) return;

    const currentLevel = settings.interruption_level;

    // If silent, do not deliver any cues
    if (currentLevel === InterruptionLevel.SILENT) {
      return;
    }

    const newCues: AssistantCue[] = [];

    // 1. Scan trainer instruction events
    if (manifest.trainer_instruction_events) {
      manifest.trainer_instruction_events.forEach((evt, idx) => {
        const eventKey = `trainer-event-${idx}-${evt.timestamp_ms}`;
        if (triggeredKeys.current.has(eventKey)) return;

        // Trigger if current time is within 1.5 seconds of the event start time
        if (evt.timestamp_ms !== undefined && evt.timestamp_ms !== null) {
          if (currentTimeMs >= evt.timestamp_ms && currentTimeMs <= evt.timestamp_ms + 1500) {
            triggeredKeys.current.add(eventKey);

            // Filter by interruption level
            // Trainer instructions are voice cues. If HAPTIC_ONLY, skip voice.
            if (currentLevel === InterruptionLevel.HAPTIC_ONLY) return;

            newCues.push({
              text: evt.text,
              persona: AssistantPersona.SUPPORTIVE,
              modality: "audio",
              priority: "normal",
              timestamp_ms: evt.timestamp_ms,
            });
          }
        }
      });
    }

    // 2. Scan speaking opportunity windows
    if (manifest.speaking_opportunity_map) {
      manifest.speaking_opportunity_map.forEach((win, idx) => {
        const windowKey = `speaking-window-${idx}-${win.start_ms}`;
        if (triggeredKeys.current.has(windowKey)) return;

        // Trigger at start of speaking opportunity window
        if (currentTimeMs >= win.start_ms && currentTimeMs <= win.start_ms + 1500) {
          triggeredKeys.current.add(windowKey);

          const isHaptic = win.mode === SpeakingOpportunityMode.HAPTIC_ONLY;
          const modality = isHaptic ? "haptic" : "audio";

          // If HAPTIC_ONLY setting, filter out audio modalities
          if (currentLevel === InterruptionLevel.HAPTIC_ONLY && modality === "audio") {
            return;
          }

          newCues.push({
            text: `[Cue window: ${win.context || "supplementary guidance"}]`,
            persona: AssistantPersona.SUPPORTIVE,
            modality: modality,
            priority: "normal",
            timestamp_ms: win.start_ms,
          });
        }
      });
    }

    if (newCues.length > 0) {
      setCueQueue((prev) => [...prev, ...newCues]);
      setActiveCue(newCues[newCues.length - 1]);
    }
  }, [manifest, currentTimeMs, settings]);

  return {
    cueQueue,
    activeCue,
    setCueQueue,
    setActiveCue,
  };
}
