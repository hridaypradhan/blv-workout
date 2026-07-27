/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSessionEnd } from "../useSessionEnd";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("useSessionEnd Hook Tests", () => {
  test("calls onSuccess after finalizeSession succeeds and navigates to history", async () => {
    const api = await import("@/lib/api");
    const finalizeSpy = vi.spyOn(api, "finalizeSession").mockResolvedValue({ status: "success" } as any);
    const mockAnnounce = vi.fn();
    const mockOnSuccess = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useSessionEnd({
        sessionId: "test-session-123",
        videoId: "test-video",
        playbackEventsBuffer: [],
        repsBuffer: [],
        formErrorsBuffer: [],
        announce: mockAnnounce,
        onSuccess: mockOnSuccess,
      })
    );

    await act(async () => {
      await result.current.handleEndSession();
    });

    expect(finalizeSpy).toHaveBeenCalledTimes(1);
    expect(mockOnSuccess).toHaveBeenCalledTimes(1);
    expect(result.current.endError).toBeNull();

    finalizeSpy.mockRestore();
  });

  test("bypasses onSuccess and stays on page if finalizeSession fails", async () => {
    const api = await import("@/lib/api");
    const finalizeSpy = vi.spyOn(api, "finalizeSession").mockRejectedValue(new Error("Database save failed"));
    const mockAnnounce = vi.fn();
    const mockOnSuccess = vi.fn();

    const { result } = renderHook(() =>
      useSessionEnd({
        sessionId: "test-session-123",
        videoId: "test-video",
        playbackEventsBuffer: [],
        repsBuffer: [],
        formErrorsBuffer: [],
        announce: mockAnnounce,
        onSuccess: mockOnSuccess,
      })
    );

    await act(async () => {
      await result.current.handleEndSession();
    });

    expect(finalizeSpy).toHaveBeenCalledTimes(1);
    expect(mockOnSuccess).not.toHaveBeenCalled();
    expect(result.current.endError).toBe("Database save failed");

    finalizeSpy.mockRestore();
  });

  test("haptic delivery failure post-finalization does not prevent navigation or report data failure", async () => {
    const api = await import("@/lib/api");
    const finalizeSpy = vi.spyOn(api, "finalizeSession").mockResolvedValue({ status: "success" } as any);
    const mockAnnounce = vi.fn();
    const mockOnSuccess = vi.fn().mockRejectedValue(new Error("Haptic hardware offline"));

    const { result } = renderHook(() =>
      useSessionEnd({
        sessionId: "test-session-123",
        videoId: "test-video",
        playbackEventsBuffer: [],
        repsBuffer: [],
        formErrorsBuffer: [],
        announce: mockAnnounce,
        onSuccess: mockOnSuccess,
      })
    );

    await act(async () => {
      await result.current.handleEndSession();
    });

    expect(finalizeSpy).toHaveBeenCalledTimes(1);
    expect(mockOnSuccess).toHaveBeenCalledTimes(1);
    // Haptic failure post-finalization must not set endError
    expect(result.current.endError).toBeNull();

    finalizeSpy.mockRestore();
  });
});
