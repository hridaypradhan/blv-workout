import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSetupVoiceCommands } from "../useSetupVoiceCommands";

// Mock base speech recognition hook
vi.mock("../useSpeechRecognition", () => ({
  useSpeechRecognition: vi.fn(() => ({
    status: "listening",
    lastResult: null,
    error: null,
    startListening: vi.fn(),
    stopListening: vi.fn(),
    clearLastResult: vi.fn(),
  })),
}));

import { useSpeechRecognition } from "../useSpeechRecognition";

describe("useSetupVoiceCommands Hook", () => {
  const mockUseSpeechRecognition = vi.mocked(useSpeechRecognition);

  const defaultActions = {
    requestCamera: vi.fn().mockResolvedValue(undefined),
    stopCamera: vi.fn(),
    onStartAlignment: vi.fn(),
    onCancelAlignment: vi.fn(),
    onRepeatGuidance: vi.fn(),
    onCancelCountdown: vi.fn(),
    onStartWorkout: vi.fn(),
    onChooseDifficulty: vi.fn(),
    onAskAssistant: vi.fn(),
    isAlignmentOpen: false,
    isCountdownActive: false,
    isCameraStreamReady: false,
    isStarting: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock SpeechSynthesis
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        speak: vi.fn(),
        cancel: vi.fn(),
      },
      writable: true,
    });
    const windowContext = window as unknown as Record<string, unknown>;
    windowContext.SpeechSynthesisUtterance = vi.fn();
  });

  test("executes enable camera command when triggered", () => {
    mockUseSpeechRecognition.mockReturnValue({
      status: "listening",
      lastResult: { id: "1", transcript: "start camera", createdAt: Date.now() },
      error: null,
      startListening: vi.fn(),
      stopListening: vi.fn(),
      clearLastResult: vi.fn(),
    });

    renderHook(() => useSetupVoiceCommands(defaultActions));

    expect(defaultActions.requestCamera).toHaveBeenCalled();
  });

  test("rejects start alignment command if camera stream is not ready", () => {
    mockUseSpeechRecognition.mockReturnValue({
      status: "listening",
      lastResult: { id: "2", transcript: "start alignment", createdAt: Date.now() },
      error: null,
      startListening: vi.fn(),
      stopListening: vi.fn(),
      clearLastResult: vi.fn(),
    });

    const { result } = renderHook(() =>
      useSetupVoiceCommands({
        ...defaultActions,
        isCameraStreamReady: false, // stream not ready
      })
    );

    expect(defaultActions.onStartAlignment).not.toHaveBeenCalled();
    expect(result.current.announcement).toContain("Alignment rejected");
  });

  test("executes start alignment if camera stream is ready", () => {
    mockUseSpeechRecognition.mockReturnValue({
      status: "listening",
      lastResult: { id: "3", transcript: "start alignment", createdAt: Date.now() },
      error: null,
      startListening: vi.fn(),
      stopListening: vi.fn(),
      clearLastResult: vi.fn(),
    });

    renderHook(() =>
      useSetupVoiceCommands({
        ...defaultActions,
        isCameraStreamReady: true,
      })
    );

    expect(defaultActions.onStartAlignment).toHaveBeenCalled();
  });

  test("handles unrecognized command by setting announcement but not speaking", () => {
    mockUseSpeechRecognition.mockReturnValue({
      status: "listening",
      lastResult: { id: "4", transcript: "unrecognized noise here", createdAt: Date.now() },
      error: null,
      startListening: vi.fn(),
      stopListening: vi.fn(),
      clearLastResult: vi.fn(),
    });

    const { result } = renderHook(() => useSetupVoiceCommands(defaultActions));

    expect(result.current.announcement).toContain("Unknown setup command");
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
  });

  test("ignores unrecognized command silently when isSpeakingOrRecentlySpoken is true", () => {
    const { setLastSpeechEndTime, resetSpeechRegistry } = require("../../voice/speechRegistry");
    resetSpeechRegistry();
    setLastSpeechEndTime(Date.now()); // simulates just finished speaking

    mockUseSpeechRecognition.mockReturnValue({
      status: "listening",
      lastResult: { id: "5", transcript: "unrecognized noise during TTS", createdAt: Date.now() },
      error: null,
      startListening: vi.fn(),
      stopListening: vi.fn(),
      clearLastResult: vi.fn(),
    });

    const { result } = renderHook(() => useSetupVoiceCommands(defaultActions));

    expect(result.current.announcement).toBeNull();
  });

  test("allows priority cancel command to run even when isSpeakingOrRecentlySpoken is true", () => {
    const { setLastSpeechEndTime, resetSpeechRegistry } = require("../../voice/speechRegistry");
    resetSpeechRegistry();
    setLastSpeechEndTime(Date.now()); // simulates just finished speaking

    mockUseSpeechRecognition.mockReturnValue({
      status: "listening",
      lastResult: { id: "6", transcript: "cancel alignment", createdAt: Date.now() },
      error: null,
      startListening: vi.fn(),
      stopListening: vi.fn(),
      clearLastResult: vi.fn(),
    });

    renderHook(() =>
      useSetupVoiceCommands({
        ...defaultActions,
        isAlignmentOpen: true,
      })
    );

    expect(defaultActions.onCancelAlignment).toHaveBeenCalled();
  });
});
