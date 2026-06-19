import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSpokenCuePlayback, UseSpokenCuePlaybackProps } from "../useSpokenCuePlayback";
import { InterruptionLevel, FeedbackModality, AssistantVerbosity } from "../../../types";

// --- Mock speech synthesis classes ---
class MockSpeechSynthesisUtterance {
  text: string;
  rate = 1.0;
  voice: SpeechSynthesisVoice | null = null;
  onend: ((ev: SpeechSynthesisEvent) => void) | null = null;
  onerror: ((ev: SpeechSynthesisErrorEvent) => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

class MockSpeechSynthesis {
  activeUtterance: MockSpeechSynthesisUtterance | null = null;
  voices: SpeechSynthesisVoice[] = [];
  onSpeak: ((utterance: MockSpeechSynthesisUtterance) => void) | null = null;
  onCancel: (() => void) | null = null;

  speak(utterance: MockSpeechSynthesisUtterance) {
    this.activeUtterance = utterance;
    if (this.onSpeak) {
      this.onSpeak(utterance);
    }
  }

  cancel() {
    if (this.activeUtterance) {
      const utterance = this.activeUtterance;
      this.activeUtterance = null;
      if (utterance.onerror) {
        // Trigger cancel event
        const errorEvent = {
          error: "interrupted",
          type: "error",
        } as SpeechSynthesisErrorEvent;
        utterance.onerror(errorEvent);
      }
    }
    if (this.onCancel) {
      this.onCancel();
    }
  }

  getVoices() {
    return this.voices;
  }

  addEventListener() {}
  removeEventListener() {}
}

describe("useSpokenCuePlayback Hook", () => {
  let mockSpeechSynth: MockSpeechSynthesis;

  beforeEach(() => {
    mockSpeechSynth = new MockSpeechSynthesis();
    vi.stubGlobal("speechSynthesis", mockSpeechSynth);
    vi.stubGlobal("SpeechSynthesisUtterance", MockSpeechSynthesisUtterance);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const createProps = (overrides?: Partial<UseSpokenCuePlaybackProps>): UseSpokenCuePlaybackProps => {
    return {
      cueId: "cue-1",
      shouldDeliver: true,
      modality: "audio",
      text: "Keep your chest up",
      recommendedPlaybackAction: "none",
      assistantMuted: false,
      audioCoexistenceSettings: {
        interruption_level: InterruptionLevel.BRIEF_SPEECH,
        assistant_verbosity: AssistantVerbosity.MODERATE,
        pause_before_speaking: true,
        correction_frequency: "medium",
      },
      voiceSettings: {
        tts_rate: 1.2,
        voice_id: "google-us",
      },
      feedbackModalities: [FeedbackModality.AUDIO, FeedbackModality.HAPTIC],
      videoId: "video-123",
      sessionId: "session-456",
      currentTime: 10.0,
      isPlaying: true,
      play: vi.fn(),
      pause: vi.fn(),
      getVolume: vi.fn(() => 50),
      setVolume: vi.fn(),
      isPlayerMuted: vi.fn(() => false),
      timestampMs: 10000,
      seekEpoch: 0,
      ...overrides,
    };
  };

  test("speaks an eligible audio cue", () => {
    const props = createProps();
    const speakSpy = vi.spyOn(mockSpeechSynth, "speak");

    renderHook((p) => useSpokenCuePlayback(p), { initialProps: props });

    expect(speakSpy).toHaveBeenCalledTimes(1);
    const utterance = speakSpy.mock.calls[0][0] as MockSpeechSynthesisUtterance;
    expect(utterance.text).toBe("Keep your chest up");
    expect(utterance.rate).toBe(1.2);
  });

  test("muted assistant does not speak", () => {
    const props = createProps({ assistantMuted: true });
    const speakSpy = vi.spyOn(mockSpeechSynth, "speak");

    renderHook((p) => useSpokenCuePlayback(p), { initialProps: props });

    expect(speakSpy).not.toHaveBeenCalled();
  });

  test("haptic-only cue does not speak", () => {
    const props = createProps({ modality: "haptic" });
    const speakSpy = vi.spyOn(mockSpeechSynth, "speak");

    renderHook((p) => useSpokenCuePlayback(p), { initialProps: props });

    expect(speakSpy).not.toHaveBeenCalled();
  });

  test("does not speak when interruption level is silent or haptic-only", () => {
    const propsSilent = createProps({
      audioCoexistenceSettings: {
        interruption_level: InterruptionLevel.SILENT,
        assistant_verbosity: AssistantVerbosity.MODERATE,
        pause_before_speaking: true,
        correction_frequency: "medium",
      },
    });
    const speakSpy = vi.spyOn(mockSpeechSynth, "speak");

    renderHook((p) => useSpokenCuePlayback(p), { initialProps: propsSilent });
    expect(speakSpy).not.toHaveBeenCalled();

    const propsHapticOnly = createProps({
      audioCoexistenceSettings: {
        interruption_level: InterruptionLevel.HAPTIC_ONLY,
        assistant_verbosity: AssistantVerbosity.MODERATE,
        pause_before_speaking: true,
        correction_frequency: "medium",
      },
    });
    renderHook((p) => useSpokenCuePlayback(p), { initialProps: propsHapticOnly });
    expect(speakSpy).not.toHaveBeenCalled();
  });

  test("duplicate cue IDs do not speak twice", () => {
    const props = createProps();
    const speakSpy = vi.spyOn(mockSpeechSynth, "speak");

    const { rerender } = renderHook((p) => useSpokenCuePlayback(p), { initialProps: props });

    expect(speakSpy).toHaveBeenCalledTimes(1);

    // Re-render with the same cue ID
    rerender(createProps());

    expect(speakSpy).toHaveBeenCalledTimes(1);
  });

  test("mute cancels speech and does not later speak stale cue", () => {
    const props = createProps();
    const cancelSpy = vi.spyOn(mockSpeechSynth, "cancel");
    const speakSpy = vi.spyOn(mockSpeechSynth, "speak");

    const { rerender } = renderHook((p) => useSpokenCuePlayback(p), { initialProps: props });

    expect(speakSpy).toHaveBeenCalledTimes(1);
    cancelSpy.mockClear();
    speakSpy.mockClear();

    // Mute: cancels active speech
    rerender(createProps({ assistantMuted: true }));
    expect(cancelSpy).toHaveBeenCalledTimes(1);

    // Try to re-render with a new cue, but still muted
    rerender(createProps({ cueId: "cue-2", text: "Stale cue text", assistantMuted: true }));
    expect(speakSpy).not.toHaveBeenCalled();

    // Unmute after a delay (current time is now 20 seconds, while stale cue timestamp was 10 seconds)
    rerender(
      createProps({
        cueId: "cue-2",
        text: "Stale cue text",
        assistantMuted: false,
        currentTime: 20.0,
      })
    );
    // Should not speak because the cue timestamp (10s) is stale compared to currentTime (20s)
    expect(speakSpy).not.toHaveBeenCalled();
  });

  test("pause_before_speaking pauses and resumes only when the hook paused it", async () => {
    const playMock = vi.fn();
    const pauseMock = vi.fn();
    const props = createProps({
      recommendedPlaybackAction: "pause_before_speaking",
      isPlaying: true,
      play: playMock,
      pause: pauseMock,
    });

    let activeUtterance: MockSpeechSynthesisUtterance | null = null;
    mockSpeechSynth.onSpeak = (utt) => {
      activeUtterance = utt;
    };

    renderHook((p) => useSpokenCuePlayback(p), { initialProps: props });

    // Should pause immediately before speaking
    expect(pauseMock).toHaveBeenCalledTimes(1);
    expect(playMock).not.toHaveBeenCalled();

    // Trigger onend event to signal speech finished
    await act(async () => {
      if (activeUtterance && activeUtterance.onend) {
        activeUtterance.onend({} as SpeechSynthesisEvent);
      }
    });

    // Should resume playback after speaking is finished
    expect(playMock).toHaveBeenCalledTimes(1);
  });

  test("cancel during pause_before_speaking restores safely", () => {
    const playMock = vi.fn();
    const pauseMock = vi.fn();
    const props = createProps({
      recommendedPlaybackAction: "pause_before_speaking",
      isPlaying: true,
      play: playMock,
      pause: pauseMock,
    });

    const { rerender } = renderHook((p) => useSpokenCuePlayback(p), { initialProps: props });

    expect(pauseMock).toHaveBeenCalledTimes(1);
    expect(playMock).not.toHaveBeenCalled();

    // Trigger mute (cancellation with restore playback allowed)
    rerender(createProps({ assistantMuted: true, play: playMock, pause: pauseMock }));
    
    // Play should be called to restore video playback
    expect(playMock).toHaveBeenCalledTimes(1);
  });

  test("duck_audio lowers volume before speech", () => {
    const setVolumeMock = vi.fn();
    const props = createProps({
      recommendedPlaybackAction: "duck_audio",
      getVolume: () => 80,
      setVolume: setVolumeMock,
      isPlayerMuted: () => false,
    });

    renderHook((p) => useSpokenCuePlayback(p), { initialProps: props });

    // Should lower volume to 25
    expect(setVolumeMock).toHaveBeenCalledWith(25);
  });

  test("duck_audio restores volume on speech end", async () => {
    const setVolumeMock = vi.fn();
    const props = createProps({
      recommendedPlaybackAction: "duck_audio",
      getVolume: () => 80,
      setVolume: setVolumeMock,
      isPlayerMuted: () => false,
    });

    let activeUtterance: MockSpeechSynthesisUtterance | null = null;
    mockSpeechSynth.onSpeak = (utt) => {
      activeUtterance = utt;
    };

    renderHook((p) => useSpokenCuePlayback(p), { initialProps: props });

    expect(setVolumeMock).toHaveBeenCalledWith(25);
    setVolumeMock.mockClear();

    // Trigger end of speech
    await act(async () => {
      if (activeUtterance && activeUtterance.onend) {
        activeUtterance.onend({} as SpeechSynthesisEvent);
      }
    });

    // Volume should be restored to original (80)
    expect(setVolumeMock).toHaveBeenCalledWith(80);
  });

  test("duck_audio restores volume on cancel/unmount", () => {
    const setVolumeMock = vi.fn();
    const props = createProps({
      recommendedPlaybackAction: "duck_audio",
      getVolume: () => 80,
      setVolume: setVolumeMock,
      isPlayerMuted: () => false,
    });

    const { unmount } = renderHook((p) => useSpokenCuePlayback(p), { initialProps: props });

    expect(setVolumeMock).toHaveBeenCalledWith(25);
    setVolumeMock.mockClear();

    // Unmount triggers cancellation and restores original volume
    unmount();

    expect(setVolumeMock).toHaveBeenCalledWith(80);
  });

  test("duck_audio does not unmute a muted player", () => {
    const setVolumeMock = vi.fn();
    const props = createProps({
      recommendedPlaybackAction: "duck_audio",
      getVolume: () => 80,
      setVolume: setVolumeMock,
      isPlayerMuted: () => true, // player is muted
    });

    renderHook((p) => useSpokenCuePlayback(p), { initialProps: props });

    // Should NOT call setVolume because the player is muted (never unmute or change volume)
    expect(setVolumeMock).not.toHaveBeenCalled();
  });

  test("duck_audio does not raise volume when current volume is already below duck target", () => {
    const setVolumeMock = vi.fn();
    const props = createProps({
      recommendedPlaybackAction: "duck_audio",
      getVolume: () => 15, // volume is already below 25
      setVolume: setVolumeMock,
      isPlayerMuted: () => false,
    });

    renderHook((p) => useSpokenCuePlayback(p), { initialProps: props });

    // Should NOT call setVolume(25) because raising volume is forbidden during ducking
    expect(setVolumeMock).not.toHaveBeenCalled();
  });

  test("active speech cancels on seekEpoch change", () => {
    const props = createProps({ seekEpoch: 0 });
    const cancelSpy = vi.spyOn(mockSpeechSynth, "cancel");
    const { rerender } = renderHook((p) => useSpokenCuePlayback(p), { initialProps: props });

    expect(mockSpeechSynth.activeUtterance).not.toBeNull();
    cancelSpy.mockClear();

    // Change seekEpoch
    rerender(createProps({ seekEpoch: 1 }));

    expect(cancelSpy).toHaveBeenCalledTimes(1);
    expect(mockSpeechSynth.activeUtterance).toBeNull();
  });

  test("ducked volume restores on seekEpoch change", () => {
    const setVolumeMock = vi.fn();
    const props = createProps({
      recommendedPlaybackAction: "duck_audio",
      getVolume: () => 80,
      setVolume: setVolumeMock,
      isPlayerMuted: () => false,
      seekEpoch: 0,
    });

    const { rerender } = renderHook((p) => useSpokenCuePlayback(p), { initialProps: props });

    expect(setVolumeMock).toHaveBeenCalledWith(25);
    setVolumeMock.mockClear();

    // Change seekEpoch
    rerender(
      createProps({
        recommendedPlaybackAction: "duck_audio",
        getVolume: () => 80,
        setVolume: setVolumeMock,
        isPlayerMuted: () => false,
        seekEpoch: 1,
      })
    );

    // Ducking should be restored to 80
    expect(setVolumeMock).toHaveBeenCalledWith(80);
  });

  test("paused-by-speech playback does not resume after seekEpoch change", () => {
    const playMock = vi.fn();
    const pauseMock = vi.fn();
    const props = createProps({
      recommendedPlaybackAction: "pause_before_speaking",
      isPlaying: true,
      play: playMock,
      pause: pauseMock,
      seekEpoch: 0,
    });

    const { rerender } = renderHook((p) => useSpokenCuePlayback(p), { initialProps: props });

    // Should pause playback
    expect(pauseMock).toHaveBeenCalledTimes(1);
    expect(playMock).not.toHaveBeenCalled();

    // Trigger seek (cancellation with restore playback NOT allowed)
    rerender(
      createProps({
        recommendedPlaybackAction: "pause_before_speaking",
        isPlaying: true,
        play: playMock,
        pause: pauseMock,
        seekEpoch: 1,
      })
    );

    // Play should NOT be called to restore video playback because it was a user seek
    expect(playMock).not.toHaveBeenCalled();
  });
});
