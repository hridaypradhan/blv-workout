import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMediaPipePoseLandmarker } from "../useMediaPipePoseLandmarker";
import {
  MEDIAPIPE_LOCAL_MODEL_PATH,
  MEDIAPIPE_CDN_MODEL_URL,
} from "../useMediaPipePoseLandmarker";

vi.mock("@mediapipe/tasks-vision", () => {
  return {
    FilesetResolver: {
      forVisionTasks: vi.fn().mockResolvedValue({}),
    },
    PoseLandmarker: {
      createFromOptions: vi.fn().mockResolvedValue({
        close: vi.fn(),
        detectForVideo: vi.fn(),
      }),
    },
  };
});

import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

describe("useMediaPipePoseLandmarker Hook", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = vi.fn();
    HTMLMediaElement.prototype.load = vi.fn();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("does not initialize MediaPipe when stream is null", () => {
    const { result } = renderHook(() => useMediaPipePoseLandmarker({ stream: null }));

    expect(result.current.isModelLoaded).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(FilesetResolver.forVisionTasks).not.toHaveBeenCalled();
    expect(PoseLandmarker.createFromOptions).not.toHaveBeenCalled();
  });

  test("initializes MediaPipe and resolves wasm when a valid stream is provided", async () => {
    const mockStream = {};
    const { result, rerender } = renderHook(
      ({ stream }) => useMediaPipePoseLandmarker({ stream }),
      { initialProps: { stream: null as MediaStream | null } }
    );

    expect(result.current.isModelLoaded).toBe(false);

    // Provide active camera stream
    act(() => {
      rerender({ stream: mockStream as MediaStream });
    });

    await vi.waitFor(() => {
      expect(FilesetResolver.forVisionTasks).toHaveBeenCalled();
      expect(PoseLandmarker.createFromOptions).toHaveBeenCalled();
    });
  });

  test("uses local model path when local HEAD request succeeds", async () => {
    // Simulate a successful HEAD response for the local file
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response);

    const mockStream = {} as MediaStream;
    act(() => {
      renderHook(() => useMediaPipePoseLandmarker({ stream: mockStream }));
    });

    await vi.waitFor(() => {
      expect(PoseLandmarker.createFromOptions).toHaveBeenCalled();
    });

    const callArgs = (PoseLandmarker.createFromOptions as ReturnType<typeof vi.fn>).mock.calls[0];
    const options = callArgs[1];
    expect(options.baseOptions.modelAssetPath).toBe(MEDIAPIPE_LOCAL_MODEL_PATH);
  });

  test("falls back to CDN model when local HEAD request returns non-ok status", async () => {
    // Simulate 404 on the local file
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);

    const mockStream = {} as MediaStream;
    act(() => {
      renderHook(() => useMediaPipePoseLandmarker({ stream: mockStream }));
    });

    await vi.waitFor(() => {
      expect(PoseLandmarker.createFromOptions).toHaveBeenCalled();
    });

    const callArgs = (PoseLandmarker.createFromOptions as ReturnType<typeof vi.fn>).mock.calls[0];
    const options = callArgs[1];
    expect(options.baseOptions.modelAssetPath).toBe(MEDIAPIPE_CDN_MODEL_URL);
  });

  test("falls back to CDN model when local HEAD request throws a network error", async () => {
    // Simulate a complete network failure (e.g. fetch not implemented in this env)
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const mockStream = {} as MediaStream;
    act(() => {
      renderHook(() => useMediaPipePoseLandmarker({ stream: mockStream }));
    });

    await vi.waitFor(() => {
      expect(PoseLandmarker.createFromOptions).toHaveBeenCalled();
    });

    const callArgs = (PoseLandmarker.createFromOptions as ReturnType<typeof vi.fn>).mock.calls[0];
    const options = callArgs[1];
    expect(options.baseOptions.modelAssetPath).toBe(MEDIAPIPE_CDN_MODEL_URL);
  });
});
