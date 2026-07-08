import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useLiveCueDelivery } from "../useLiveCueDelivery";
import { SESSION_EVENTS } from "@/lib/sessionEvents";

// Minimal mock cue plan with one candidate
function makeCuePlan(candidateId: string, startMs: number, endMs: number) {
  return {
    cue_candidates: [
      {
        id: candidateId,
        start_ms: startMs,
        end_ms: endMs,
        priority: "normal" as const,
        intent: "instruction" as const,
        allowed_modalities: ["audio" as const],
        text_variants: {
          moderate: "Keep your back straight",
        },
        interruption_policy_hint: "safe_gap_only" as const,
        haptic_cue_ref: null,
      },
    ],
  };
}

describe("useLiveCueDelivery", () => {
  const defaultProps = () => ({
    cuePlan: makeCuePlan("cue-1", 5000, 6000),
    currentTime: 5.5, // 5500ms, inside the cue window
    isPlaying: true,
    coexistenceSettings: {
      interruption_level: "brief_speech" as const,
      assistant_verbosity: "moderate" as const,
      pause_before_speaking: false,
      correction_frequency: "medium" as const,
    },
    assistantMuted: false,
    recentlyDeliveredCueIds: [] as string[],
    setRecentlyDeliveredCueIds: vi.fn(),
    updateLatestAutomaticCue: vi.fn(),
    handleAudioCueAnnouncement: vi.fn(),
    handleHapticCueTrigger: vi.fn(),
    logSessionEvent: vi.fn(),
    announce: vi.fn(),
    setCurrentSpokenCue: vi.fn(),
    isGateOpen: false,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("delivers cue normally when isGateOpen is false", () => {
    const props = defaultProps();
    renderHook(() => useLiveCueDelivery(props));

    // Cue should be added to recently delivered
    expect(props.setRecentlyDeliveredCueIds).toHaveBeenCalled();
    // Audio cue should be announced
    expect(props.handleAudioCueAnnouncement).toHaveBeenCalledWith("Keep your back straight");
    // Spoken cue should be set
    expect(props.setCurrentSpokenCue).toHaveBeenCalled();
    // Delivered event should be logged
    expect(props.logSessionEvent).toHaveBeenCalledWith(
      SESSION_EVENTS.ASSISTANT_CUE_DELIVERED,
      expect.any(Number),
      expect.objectContaining({ cue_id: "cue-1" })
    );
  });

  test("suppresses cue when isGateOpen is true and does NOT add to recentlyDeliveredCueIds", () => {
    const props = defaultProps();
    props.isGateOpen = true;
    renderHook(() => useLiveCueDelivery(props));

    // Cue should NOT be added to recently delivered (critical for re-selection after seek-back)
    expect(props.setRecentlyDeliveredCueIds).not.toHaveBeenCalled();
    // Audio cue should NOT be announced
    expect(props.handleAudioCueAnnouncement).not.toHaveBeenCalled();
    // Spoken cue should NOT be set
    expect(props.setCurrentSpokenCue).not.toHaveBeenCalled();
    // Suppression event should be logged with correct metadata
    expect(props.logSessionEvent).toHaveBeenCalledWith(
      SESSION_EVENTS.CUE_SUPPRESSED_BY_GATE,
      expect.any(Number),
      expect.objectContaining({
        cueId: "cue-1",
        text: "Keep your back straight",
        reason: "positioning_gate_active",
        modality: "audio",
      })
    );
    // Normal delivery event should NOT be logged
    expect(props.logSessionEvent).not.toHaveBeenCalledWith(
      SESSION_EVENTS.ASSISTANT_CUE_DELIVERED,
      expect.any(Number),
      expect.anything()
    );
  });

  test("does not deliver when not playing and gate is closed", () => {
    const props = defaultProps();
    props.isPlaying = false;
    props.isGateOpen = false;
    renderHook(() => useLiveCueDelivery(props));

    expect(props.setRecentlyDeliveredCueIds).not.toHaveBeenCalled();
    expect(props.handleAudioCueAnnouncement).not.toHaveBeenCalled();
    expect(props.logSessionEvent).not.toHaveBeenCalled();
  });
});
