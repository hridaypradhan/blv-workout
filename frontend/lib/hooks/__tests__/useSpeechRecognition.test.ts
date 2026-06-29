/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useSpeechRecognition,
  mapSpeechError,
} from "../useSpeechRecognition";

// ---------------------------------------------------------------------------
// Mock SpeechRecognition constructor
// ---------------------------------------------------------------------------
interface MockRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
}

let mockRecognitionInstance: MockRecognition | null = null;

function createMockSpeechRecognition(): MockRecognition {
  const instance: MockRecognition = {
    lang: "",
    continuous: false,
    interimResults: false,
    maxAlternatives: 1,
    onresult: null,
    onerror: null,
    onend: null,
    start: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
  };
  mockRecognitionInstance = instance;
  return instance;
}

// ---------------------------------------------------------------------------
// mapSpeechError — pure function tests
// ---------------------------------------------------------------------------
describe("mapSpeechError", () => {
  test("maps 'network' to service unavailable message", () => {
    expect(mapSpeechError("network")).toBe(
      "Browser speech service is unavailable. Manual controls still work."
    );
  });

  test("maps 'not-allowed' to permission message", () => {
    expect(mapSpeechError("not-allowed")).toBe(
      "Microphone or speech recognition permission is blocked."
    );
  });

  test("maps 'service-not-allowed' to permission message", () => {
    expect(mapSpeechError("service-not-allowed")).toBe(
      "Microphone or speech recognition permission is blocked."
    );
  });

  test("maps 'no-speech' to no speech detected message", () => {
    expect(mapSpeechError("no-speech")).toBe(
      "No speech was detected. Try again."
    );
  });

  test("maps 'audio-capture' to no microphone message", () => {
    expect(mapSpeechError("audio-capture")).toBe(
      "No microphone was detected."
    );
  });

  test("maps unknown code to generic fallback", () => {
    expect(mapSpeechError("something-else")).toBe(
      "Voice recognition encountered an error."
    );
  });
});

// ---------------------------------------------------------------------------
// useSpeechRecognition hook tests
// ---------------------------------------------------------------------------
describe("useSpeechRecognition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecognitionInstance = null;
    // By default, install a supported mock
    (window as any).SpeechRecognition = undefined;
    (window as any).webkitSpeechRecognition = createMockSpeechRecognition.bind(null) as any;
  });

  afterEach(() => {
    delete (window as any).SpeechRecognition;
    delete (window as any).webkitSpeechRecognition;
    vi.restoreAllMocks();
  });

  // -- Unsupported browser --
  test("returns 'unsupported' when browser has no SpeechRecognition", () => {
    delete (window as any).SpeechRecognition;
    delete (window as any).webkitSpeechRecognition;

    const { result } = renderHook(() => useSpeechRecognition());
    expect(result.current.status).toBe("unsupported");
  });

  test("startListening in unsupported browser sets status to 'unsupported'", () => {
    delete (window as any).SpeechRecognition;
    delete (window as any).webkitSpeechRecognition;

    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    expect(result.current.status).toBe("unsupported");
  });

  // -- Successful start --
  test("startListening sets status to 'listening'", () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    expect(result.current.status).toBe("listening");
    expect(mockRecognitionInstance!.start).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
    expect(result.current.rawError).toBeNull();
  });

  // -- Manual stop --
  test("stopListening sets status to 'idle' with no error", () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });
    expect(result.current.status).toBe("listening");

    act(() => {
      result.current.stopListening();
    });
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.rawError).toBeNull();
  });

  // -- Network error --
  test("network error sets status to 'error' with user-friendly message", () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    act(() => {
      mockRecognitionInstance!.onerror!({ error: "network", message: "" });
    });

    expect(result.current.status).toBe("error");
    expect(result.current.rawError).toBe("network");
    expect(result.current.error).toBe(
      "Browser speech service is unavailable. Manual controls still work."
    );
  });

  // -- THE CORE BUG FIX: onend after onerror --
  test("onend after network error does NOT overwrite status to 'idle'", () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    // Simulate the browser firing onerror followed by onend
    act(() => {
      mockRecognitionInstance!.onerror!({ error: "network", message: "" });
    });

    act(() => {
      mockRecognitionInstance!.onend!();
    });

    // Status should remain "error", NOT be reset to "idle"
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe(
      "Browser speech service is unavailable. Manual controls still work."
    );
  });

  // -- Retry clears previous error --
  test("retry clears previous error before attempting start", () => {
    const { result } = renderHook(() => useSpeechRecognition());

    // First attempt → error
    act(() => {
      result.current.startListening();
    });
    act(() => {
      mockRecognitionInstance!.onerror!({ error: "network", message: "" });
    });
    expect(result.current.status).toBe("error");
    expect(result.current.error).not.toBeNull();

    // Retry — new instance created, error cleared
    act(() => {
      result.current.startListening();
    });
    // After retry the status should be listening (assuming start succeeds)
    expect(result.current.status).toBe("listening");
    expect(result.current.error).toBeNull();
    expect(result.current.rawError).toBeNull();
  });

  // -- Intentional stop aborted --
  test("aborted during intentional stop does not show error", () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });
    const instance = mockRecognitionInstance!;

    // Simulate stopListening being called (sets isStoppingRef = true)
    act(() => {
      result.current.stopListening();
    });

    // Now simulate the browser firing aborted onerror after stop
    act(() => {
      instance.onerror!({ error: "aborted", message: "" });
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  // -- Non-intentional aborted --
  test("non-intentional aborted is treated as error", () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    // aborted fires without an intentional stop
    act(() => {
      mockRecognitionInstance!.onerror!({ error: "aborted", message: "" });
    });

    expect(result.current.status).toBe("error");
    expect(result.current.rawError).toBe("aborted");
  });

  // -- no-speech error --
  test("no-speech error sets correct user-friendly message", () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    act(() => {
      mockRecognitionInstance!.onerror!({ error: "no-speech", message: "" });
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("No speech was detected. Try again.");
    expect(result.current.rawError).toBe("no-speech");
  });

  // -- Normal end (silence) sets idle --
  test("onend without error sets status to idle (silence timeout)", () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    // Browser auto-stops after silence — no onerror, just onend
    act(() => {
      mockRecognitionInstance!.onend!();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  // -- Transcript delivery --
  test("onresult with final result updates lastTranscript", () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    act(() => {
      mockRecognitionInstance!.onresult!({
        resultIndex: 0,
        results: {
          length: 1,
          0: {
            isFinal: true,
            length: 1,
            0: { transcript: " pause ", confidence: 0.9 },
          },
        },
      });
    });

    expect(result.current.lastTranscript).toBe("pause");
  });

  // -- start() throwing --
  test("start() throwing sets status to error with message", () => {
    // Override the mock to throw on start
    (window as any).webkitSpeechRecognition = class {
      lang = "";
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult = null;
      onerror = null;
      onend = null;
      start() {
        throw new Error("not-allowed");
      }
      stop() {}
      abort() {}
    };

    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("not-allowed");
    expect(result.current.rawError).toBe("start-exception");
  });

  // -- Consumable result model (lastResult) --
  test("onresult with final result produces a lastResult with id, transcript, and createdAt", () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    act(() => {
      mockRecognitionInstance!.onresult!({
        resultIndex: 0,
        results: {
          length: 1,
          0: {
            isFinal: true,
            length: 1,
            0: { transcript: " pause ", confidence: 0.9 },
          },
        },
      });
    });

    expect(result.current.lastResult).not.toBeNull();
    expect(result.current.lastResult!.transcript).toBe("pause");
    expect(typeof result.current.lastResult!.id).toBe("string");
    expect(result.current.lastResult!.id.length).toBeGreaterThan(0);
    expect(typeof result.current.lastResult!.createdAt).toBe("number");
    // lastTranscript should also be set for display
    expect(result.current.lastTranscript).toBe("pause");
  });

  test("multiple final results produce different result IDs", () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    act(() => {
      mockRecognitionInstance!.onresult!({
        resultIndex: 0,
        results: {
          length: 1,
          0: {
            isFinal: true,
            length: 1,
            0: { transcript: "pause", confidence: 0.9 },
          },
        },
      });
    });

    const firstId = result.current.lastResult!.id;

    act(() => {
      mockRecognitionInstance!.onresult!({
        resultIndex: 1,
        results: {
          length: 2,
          0: {
            isFinal: true,
            length: 1,
            0: { transcript: "pause", confidence: 0.9 },
          },
          1: {
            isFinal: true,
            length: 1,
            0: { transcript: "resume", confidence: 0.9 },
          },
        },
      });
    });

    const secondId = result.current.lastResult!.id;
    expect(secondId).not.toBe(firstId);
    expect(result.current.lastResult!.transcript).toBe("resume");
  });

  test("clearLastResult sets lastResult to null", () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    act(() => {
      mockRecognitionInstance!.onresult!({
        resultIndex: 0,
        results: {
          length: 1,
          0: {
            isFinal: true,
            length: 1,
            0: { transcript: "pause", confidence: 0.9 },
          },
        },
      });
    });

    expect(result.current.lastResult).not.toBeNull();

    act(() => {
      result.current.clearLastResult();
    });

    expect(result.current.lastResult).toBeNull();
    // lastTranscript should still be available for display
    expect(result.current.lastTranscript).toBe("pause");
  });

  test("after clearing, same transcript spoken again produces a new result with a new ID", () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    // First utterance
    act(() => {
      mockRecognitionInstance!.onresult!({
        resultIndex: 0,
        results: {
          length: 1,
          0: {
            isFinal: true,
            length: 1,
            0: { transcript: "pause", confidence: 0.9 },
          },
        },
      });
    });

    const firstId = result.current.lastResult!.id;

    act(() => {
      result.current.clearLastResult();
    });

    // Second utterance with same text
    act(() => {
      mockRecognitionInstance!.onresult!({
        resultIndex: 1,
        results: {
          length: 2,
          0: {
            isFinal: true,
            length: 1,
            0: { transcript: "ignored old", confidence: 0.5 },
          },
          1: {
            isFinal: true,
            length: 1,
            0: { transcript: "pause", confidence: 0.9 },
          },
        },
      });
    });

    expect(result.current.lastResult).not.toBeNull();
    expect(result.current.lastResult!.transcript).toBe("pause");
    expect(result.current.lastResult!.id).not.toBe(firstId);
  });

  test("lastResult is null initially", () => {
    const { result } = renderHook(() => useSpeechRecognition());
    expect(result.current.lastResult).toBeNull();
  });
});
