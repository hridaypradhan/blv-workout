/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLiveVoiceCommands, UseLiveVoiceCommandsProps } from "../useLiveVoiceCommands";

// Mock useSpeechRecognition — now returns lastResult with IDs
const mockStartListening = vi.fn();
const mockStopListening = vi.fn();
const mockClearLastResult = vi.fn();
let mockStatus = "idle" as "unsupported" | "idle" | "listening" | "error";
let mockLastTranscript = "";
let mockLastResult: { id: string; transcript: string; createdAt: number } | null = null;
let mockError: string | null = null;
let mockRawError: string | null = null;

vi.mock("../useSpeechRecognition", () => ({
  useSpeechRecognition: () => ({
    status: mockStatus,
    lastTranscript: mockLastTranscript,
    lastResult: mockLastResult,
    error: mockError,
    rawError: mockRawError,
    startListening: mockStartListening,
    stopListening: mockStopListening,
    clearLastResult: mockClearLastResult,
  }),
}));

// Mock parseVoiceCommand
vi.mock("@/lib/voice/voiceCommandParser", () => ({
  parseVoiceCommand: vi.fn((transcript: string) => {
    const norm = transcript.toLowerCase().trim();
    if (norm === "pause") return { type: "pause" };
    if (norm === "play" || norm === "resume") return { type: "resume" };
    if (norm === "rewind") return { type: "rewind", seconds: 10 };
    if (norm === "slow down") return { type: "slow_down" };
    if (norm === "normal speed") return { type: "normal_speed" };
    if (norm === "speed up") return { type: "speed_up" };
    if (norm === "next section") return { type: "next_section" };
    if (norm === "repeat instruction") return { type: "repeat_instruction" };
    if (norm === "mute") return { type: "mute_assistant" };
    if (norm === "unmute") return { type: "unmute_assistant" };
    if (norm.startsWith("ask ")) return { type: "ask_question", question: norm.slice(4) };
    if (norm === "end session") return { type: "end_session", confirmationNeeded: true };
    return { type: "rejected", reason: "unrecognized", transcript };
  }),
}));

/** Helper to set mock result with a unique ID */
let _testResultCounter = 0;
function setMockResult(transcript: string) {
  _testResultCounter++;
  mockLastTranscript = transcript;
  mockLastResult = {
    id: `test-${_testResultCounter}-${Date.now()}`,
    transcript,
    createdAt: Date.now(),
  };
}

describe("useLiveVoiceCommands", () => {
  const createProps = (overrides?: Partial<UseLiveVoiceCommandsProps>): UseLiveVoiceCommandsProps => ({
    isPlaying: true,
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    currentTime: 120,
    playbackRate: 1.0,
    setPlaybackRate: vi.fn(),
    handleSkipSection: vi.fn(),
    handleRepeatTrainerInstruction: vi.fn(),
    assistantMuted: false,
    setAssistantMuted: vi.fn(),
    submitQuestion: vi.fn(),
    announce: vi.fn(),
    logSessionEvent: vi.fn(),
    currentTimeMs: 120000,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    _testResultCounter = 0;
    mockStatus = "idle";
    mockLastTranscript = "";
    mockLastResult = null;
    mockError = null;
    mockRawError = null;

    // Mock speechSynthesis as not speaking by default
    Object.defineProperty(window, "speechSynthesis", {
      value: { speaking: false },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("returns voice status from speech recognition", () => {
    const props = createProps();
    const { result } = renderHook(() => useLiveVoiceCommands(props));
    expect(result.current.voiceStatus).toBe("idle");
  });

  test("startVoice calls startListening, logs event, and announces", () => {
    const props = createProps();
    const { result } = renderHook(() => useLiveVoiceCommands(props));

    act(() => {
      result.current.startVoice();
    });

    expect(mockStartListening).toHaveBeenCalledTimes(1);
    expect(props.logSessionEvent).toHaveBeenCalledWith(
      "voice_mic_enabled",
      expect.any(Number)
    );
    expect(props.announce).toHaveBeenCalledWith(
      "Voice control activated. Listening for commands."
    );
  });

  test("stopVoice calls stopListening, logs event, and announces", () => {
    const props = createProps();
    const { result } = renderHook(() => useLiveVoiceCommands(props));

    act(() => {
      result.current.stopVoice();
    });

    expect(mockStopListening).toHaveBeenCalledTimes(1);
    expect(props.logSessionEvent).toHaveBeenCalledWith(
      "voice_mic_disabled",
      expect.any(Number)
    );
    expect(props.announce).toHaveBeenCalledWith("Voice control deactivated.");
  });

  test("pause command calls pause handler", () => {
    const props = createProps();
    setMockResult("pause");

    renderHook(() => useLiveVoiceCommands(props));

    expect(props.pause).toHaveBeenCalledTimes(1);
    expect(props.announce).toHaveBeenCalledWith("Paused.");
    expect(props.logSessionEvent).toHaveBeenCalledWith(
      "voice_command_executed",
      expect.any(Number),
      expect.objectContaining({ command: "pause" })
    );
  });

  test("resume command calls play handler", () => {
    const props = createProps();
    setMockResult("resume");

    renderHook(() => useLiveVoiceCommands(props));

    expect(props.play).toHaveBeenCalledTimes(1);
    expect(props.announce).toHaveBeenCalledWith("Resumed.");
  });

  test("rewind command calls seek with rewind announcement", () => {
    const props = createProps();
    props.currentTime = 120;
    setMockResult("rewind");

    renderHook(() => useLiveVoiceCommands(props));

    expect(props.seek).toHaveBeenCalledTimes(1);
    expect(props.seek).toHaveBeenCalledWith(
      expect.any(Number),
      "Rewound 10 seconds."
    );
  });

  test("slow down command calls setPlaybackRate with 0.75", () => {
    const props = createProps();
    setMockResult("slow down");

    renderHook(() => useLiveVoiceCommands(props));

    expect(props.setPlaybackRate).toHaveBeenCalledWith(0.75);
    expect(props.announce).toHaveBeenCalledWith("Slowed to 0.75x.");
  });

  test("normal speed command calls setPlaybackRate with 1.0", () => {
    const props = createProps();
    setMockResult("normal speed");

    renderHook(() => useLiveVoiceCommands(props));

    expect(props.setPlaybackRate).toHaveBeenCalledWith(1.0);
  });

  test("speed up command calls setPlaybackRate with 1.5", () => {
    const props = createProps();
    setMockResult("speed up");

    renderHook(() => useLiveVoiceCommands(props));

    expect(props.setPlaybackRate).toHaveBeenCalledWith(1.5);
  });

  test("next section command calls handleSkipSection", () => {
    const props = createProps();
    setMockResult("next section");

    renderHook(() => useLiveVoiceCommands(props));

    expect(props.handleSkipSection).toHaveBeenCalledTimes(1);
  });

  test("repeat instruction command calls handleRepeatTrainerInstruction", () => {
    const props = createProps();
    setMockResult("repeat instruction");

    renderHook(() => useLiveVoiceCommands(props));

    expect(props.handleRepeatTrainerInstruction).toHaveBeenCalledTimes(1);
  });

  test("mute command calls setAssistantMuted with true", () => {
    const props = createProps();
    setMockResult("mute");

    renderHook(() => useLiveVoiceCommands(props));

    expect(props.setAssistantMuted).toHaveBeenCalledWith(true);
    expect(props.announce).toHaveBeenCalledWith("Assistant muted.");
  });

  test("unmute command calls setAssistantMuted with false", () => {
    const props = createProps();
    setMockResult("unmute");

    renderHook(() => useLiveVoiceCommands(props));

    expect(props.setAssistantMuted).toHaveBeenCalledWith(false);
    expect(props.announce).toHaveBeenCalledWith("Assistant unmuted.");
  });

  test("ask question command calls submitQuestion with voice source", () => {
    const props = createProps();
    setMockResult("ask how is my form");

    renderHook(() => useLiveVoiceCommands(props));

    expect(props.submitQuestion).toHaveBeenCalledWith("how is my form", "voice");
  });

  test("rejected command announces not recognized and logs rejection", () => {
    const props = createProps();
    setMockResult("the weather is nice");

    renderHook(() => useLiveVoiceCommands(props));

    expect(props.announce).toHaveBeenCalledWith("Voice command not recognized.");
    expect(props.logSessionEvent).toHaveBeenCalledWith(
      "voice_command_rejected",
      expect.any(Number),
      expect.objectContaining({ reason: "unrecognized" })
    );
  });

  test("end session command announces confirmation needed", () => {
    const props = createProps();
    setMockResult("end session");

    renderHook(() => useLiveVoiceCommands(props));

    expect(props.announce).toHaveBeenCalledWith(
      "To end the session, please use the End & Save Session button."
    );
  });

  // --- ID-based dedup tests ---

  test("same result ID is processed once only, even across re-renders", () => {
    const props = createProps();
    setMockResult("pause");

    const { rerender } = renderHook(() => useLiveVoiceCommands(props));

    expect(props.pause).toHaveBeenCalledTimes(1);

    // Rerender with same mockLastResult (same ID) — should NOT re-execute
    rerender();
    expect(props.pause).toHaveBeenCalledTimes(1);

    // Another rerender
    rerender();
    expect(props.pause).toHaveBeenCalledTimes(1);
  });

  test("same transcript from a new result ID can be processed if genuinely spoken again", () => {
    const props = createProps();
    setMockResult("pause");

    const { rerender } = renderHook(() => useLiveVoiceCommands(props));
    expect(props.pause).toHaveBeenCalledTimes(1);

    // Simulate the user speaking "pause" again — new result ID
    setMockResult("pause");
    rerender();
    expect(props.pause).toHaveBeenCalledTimes(2);
  });

  test("null lastResult does not trigger any execution", () => {
    const props = createProps();
    mockLastResult = null;
    mockLastTranscript = "";

    renderHook(() => useLiveVoiceCommands(props));

    expect(props.pause).not.toHaveBeenCalled();
    expect(props.play).not.toHaveBeenCalled();
    // Only voice_recognition_error may be logged; no command events
    const commandLogs = (props.logSessionEvent as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: any[]) => c[0] === "voice_command_executed" || c[0] === "voice_command_recognized"
    );
    expect(commandLogs.length).toBe(0);
  });

  // --- Q&A pending guard tests ---

  test("ask_question does not re-submit while Q&A is pending", () => {
    const props = createProps({ isQnAPending: true });
    setMockResult("ask how is my form");

    renderHook(() => useLiveVoiceCommands(props));

    expect(props.submitQuestion).not.toHaveBeenCalled();
    expect(props.announce).toHaveBeenCalledWith(
      "Please wait for the current question to finish."
    );
  });

  test("ask_question submits normally when Q&A is not pending", () => {
    const props = createProps({ isQnAPending: false });
    setMockResult("ask how is my form");

    renderHook(() => useLiveVoiceCommands(props));

    expect(props.submitQuestion).toHaveBeenCalledWith("how is my form", "voice");
    expect(props.submitQuestion).toHaveBeenCalledTimes(1);
  });

  // --- Non-Q&A commands still work with isPending ---

  test("non-Q&A commands still execute when isQnAPending is true", () => {
    const props = createProps({ isQnAPending: true });
    setMockResult("pause");

    renderHook(() => useLiveVoiceCommands(props));

    expect(props.pause).toHaveBeenCalledTimes(1);
  });

  // --- Speech synthesis collision guard ---

  test("skips command when speechSynthesis is speaking", () => {
    const props = createProps();
    Object.defineProperty(window, "speechSynthesis", {
      value: { speaking: true },
      writable: true,
      configurable: true,
    });

    setMockResult("pause");

    renderHook(() => useLiveVoiceCommands(props));

    expect(props.pause).not.toHaveBeenCalled();
    expect(props.announce).toHaveBeenCalledWith(
      "Please wait for assistant to finish speaking."
    );
  });

  // --- Status and error passthrough ---

  test("unsupported status is reflected from speech recognition", () => {
    mockStatus = "unsupported";
    const props = createProps();
    const { result } = renderHook(() => useLiveVoiceCommands(props));
    expect(result.current.voiceStatus).toBe("unsupported");
  });

  test("voiceError and voiceRawError are surfaced from speech recognition", () => {
    mockStatus = "error";
    mockError = "Browser speech service is unavailable. Manual controls still work.";
    mockRawError = "network";
    const props = createProps();
    const { result } = renderHook(() => useLiveVoiceCommands(props));
    expect(result.current.voiceError).toBe(
      "Browser speech service is unavailable. Manual controls still work."
    );
    expect(result.current.voiceRawError).toBe("network");
  });

  test("speech recognition error triggers telemetry log", () => {
    mockRawError = "network";
    mockError = "Browser speech service is unavailable. Manual controls still work.";
    mockStatus = "error";
    const props = createProps();
    renderHook(() => useLiveVoiceCommands(props));

    expect(props.logSessionEvent).toHaveBeenCalledWith(
      "voice_recognition_error",
      expect.any(Number),
      expect.objectContaining({
        rawError: "network",
        message: "Browser speech service is unavailable. Manual controls still work.",
      })
    );
  });

  test("repeated identical error does not spam telemetry", () => {
    mockRawError = "network";
    mockError = "Browser speech service is unavailable. Manual controls still work.";
    mockStatus = "error";
    const props = createProps();
    const { rerender } = renderHook(() => useLiveVoiceCommands(props));

    const errorLogCount = (props.logSessionEvent as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: any[]) => c[0] === "voice_recognition_error"
    ).length;
    expect(errorLogCount).toBe(1);

    // Rerender with same error — should not log again
    rerender();
    const errorLogCount2 = (props.logSessionEvent as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: any[]) => c[0] === "voice_recognition_error"
    ).length;
    expect(errorLogCount2).toBe(1);
  });

  // --- clearLastResult is called after processing ---

  test("clearLastResult is called after processing a result", () => {
    const props = createProps();
    setMockResult("pause");

    renderHook(() => useLiveVoiceCommands(props));

    expect(mockClearLastResult).toHaveBeenCalledTimes(1);
  });

  // --- Lifecycle hooks ---

  test("startVoice calls onBeforeListening if provided", () => {
    const onBefore = vi.fn();
    const props = createProps({ onBeforeListening: onBefore });
    const { result } = renderHook(() => useLiveVoiceCommands(props));

    act(() => {
      result.current.startVoice();
    });

    expect(onBefore).toHaveBeenCalledTimes(1);
    expect(mockStartListening).toHaveBeenCalledTimes(1);
  });

  test("stopVoice calls onAfterListening if provided", () => {
    const onAfter = vi.fn();
    const props = createProps({ onAfterListening: onAfter });
    const { result } = renderHook(() => useLiveVoiceCommands(props));

    act(() => {
      result.current.stopVoice();
    });

    expect(onAfter).toHaveBeenCalledTimes(1);
    expect(mockStopListening).toHaveBeenCalledTimes(1);
  });
});
