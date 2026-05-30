"use client";

import { useState, useEffect } from "react";
import { SidecarManifest, AssistantCue, AudioCoexistenceSettings } from "../../types";

export function useAssistantCueQueue(
  manifest: SidecarManifest | null,
  currentTimeMs: number,
  settings: AudioCoexistenceSettings
) {
  const [cueQueue, setCueQueue] = useState<AssistantCue[]>([]);
  const [activeCue, setActiveCue] = useState<AssistantCue | null>(null);

  // TODO: Implement queue matching and audio coexistence orchestration.
  // 1. Consume the `speaking_opportunity_map` and `trainer_instruction_events` from the manifest.
  // 2. Identify candidate cues matching the current time context.
  // 3. Filter/suppress cues according to `settings.interruption_level` and `settings.assistant_verbosity`.
  // 4. Implement TTS queue delivery, optionally ducing or pausing the YouTube player.

  useEffect(() => {
    if (!manifest) return;

    // Stub logic: Scan manifest for timeline-relevant events
    console.log(
      `Scanning sidecar manifest at ${currentTimeMs}ms. Interruption level is: ${settings.interruption_level}`
    );
  }, [manifest, currentTimeMs, settings]);

  return {
    cueQueue,
    activeCue,
    setCueQueue,
    setActiveCue,
  };
}
