/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSessionLifecycleHaptics } from "../useSessionLifecycleHaptics";

describe("useSessionLifecycleHaptics Unit & Concurrency Tests", () => {
  test("does not fire start when player is not ready or gate is open", () => {
    const triggerMock = vi.fn().mockResolvedValue({ status: "success" });

    const { result } = renderHook(() =>
      useSessionLifecycleHaptics({
        sessionId: "test-sess-1",
        isReady: false,
        isPlaying: true,
        hasEnded: false,
        isLiveGateOpen: false,
        currentTime: 10,
        userProfile: null,
        triggerHapticEvent: triggerMock,
      })
    );

    expect(triggerMock).not.toHaveBeenCalled();
    expect(result.current.hasDeliveredStart).toBe(false);
  });

  test("waits until gate is closed and submits Start once when eligible", async () => {
    const triggerMock = vi.fn().mockResolvedValue({ status: "success" });

    let isGateOpen = true;

    const { result, rerender } = renderHook(() =>
      useSessionLifecycleHaptics({
        sessionId: "test-sess-1",
        isReady: true,
        isPlaying: true,
        hasEnded: false,
        isLiveGateOpen: isGateOpen,
        currentTime: 5,
        userProfile: null,
        triggerHapticEvent: triggerMock,
      })
    );

    expect(triggerMock).not.toHaveBeenCalled();

    // Close gate
    isGateOpen = false;
    await act(async () => {
      rerender();
    });

    expect(triggerMock).toHaveBeenCalledTimes(1);
    expect(triggerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cueType: "start",
        cueId: "session-start-test-sess-1",
      })
    );
    expect(result.current.hasDeliveredStart).toBe(true);
  });

  test("rerenders from currentTime progress do not create duplicate pending or delivered requests", async () => {
    const triggerMock = vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 50)));

    let currentTime = 1;

    const { rerender } = renderHook(() =>
      useSessionLifecycleHaptics({
        sessionId: "test-sess-1",
        isReady: true,
        isPlaying: true,
        hasEnded: false,
        isLiveGateOpen: false,
        currentTime,
        userProfile: null,
        triggerHapticEvent: triggerMock,
      })
    );

    // Rapid time rerenders while request is pending
    currentTime = 1.1;
    rerender();
    currentTime = 1.2;
    rerender();

    expect(triggerMock).toHaveBeenCalledTimes(1);
  });

  test("pause and resume does not replay a successful Start", async () => {
    const triggerMock = vi.fn().mockResolvedValue({ status: "success" });

    let isPlaying = true;

    const { result, rerender } = renderHook(() =>
      useSessionLifecycleHaptics({
        sessionId: "test-sess-1",
        isReady: true,
        isPlaying,
        hasEnded: false,
        isLiveGateOpen: false,
        currentTime: 2,
        userProfile: null,
        triggerHapticEvent: triggerMock,
      })
    );

    expect(triggerMock).toHaveBeenCalledTimes(1);

    // Pause
    isPlaying = false;
    await act(async () => {
      rerender();
    });

    // Resume
    isPlaying = true;
    await act(async () => {
      rerender();
    });

    expect(triggerMock).toHaveBeenCalledTimes(1);
    expect(result.current.hasDeliveredStart).toBe(true);
  });

  test("failed Start request clears pending guard allowing later retry", async () => {
    const triggerMock = vi.fn().mockRejectedValueOnce(new Error("Network Error")).mockResolvedValueOnce({ status: "success" });

    let isPlaying = true;

    const { result, rerender } = renderHook(() =>
      useSessionLifecycleHaptics({
        sessionId: "test-sess-1",
        isReady: true,
        isPlaying,
        hasEnded: false,
        isLiveGateOpen: false,
        currentTime: 2,
        userProfile: null,
        triggerHapticEvent: triggerMock,
      })
    );

    // First attempt failed
    expect(result.current.hasDeliveredStart).toBe(false);

    // Trigger state change (pause/resume) to retry
    isPlaying = false;
    rerender();
    isPlaying = true;
    await act(async () => {
      rerender();
    });

    expect(triggerMock).toHaveBeenCalledTimes(2);
    expect(result.current.hasDeliveredStart).toBe(true);
  });

  test("new session ID resets delivered and pending state", async () => {
    const triggerMock = vi.fn().mockResolvedValue({ status: "success" });

    let sessionId = "session-A";

    const { result, rerender } = renderHook(() =>
      useSessionLifecycleHaptics({
        sessionId,
        isReady: true,
        isPlaying: true,
        hasEnded: false,
        isLiveGateOpen: false,
        currentTime: 2,
        userProfile: null,
        triggerHapticEvent: triggerMock,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(triggerMock).toHaveBeenCalledTimes(1);
    expect(result.current.hasDeliveredStart).toBe(true);

    // Switch session
    sessionId = "session-B";
    await act(async () => {
      rerender();
    });

    expect(triggerMock).toHaveBeenCalledTimes(2);
    expect(triggerMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cueId: "session-start-session-B",
      })
    );
  });

  test("natural completion and manual trigger share Finish state without duplicates", async () => {
    const triggerMock = vi.fn().mockResolvedValue({ status: "success" });

    let hasEnded = false;

    const { result, rerender } = renderHook(() =>
      useSessionLifecycleHaptics({
        sessionId: "test-sess-1",
        isReady: true,
        isPlaying: true,
        hasEnded,
        isLiveGateOpen: false,
        currentTime: 120,
        userProfile: null,
        triggerHapticEvent: triggerMock,
      })
    );

    // Manual completion call
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await result.current.triggerFinishHaptic();
    });

    expect(triggerMock).toHaveBeenCalledTimes(2); // 1 start + 1 finish
    expect(result.current.hasDeliveredFinish).toBe(true);

    // Natural completion fires
    hasEnded = true;
    await act(async () => {
      rerender();
    });

    // Should NOT duplicate finish
    expect(triggerMock).toHaveBeenCalledTimes(2);
  });

  test("stale Start completion from a previous session cannot mutate the new session", async () => {
    let resolveSessionA!: (value: unknown) => void;
    let resolveSessionB!: (value: unknown) => void;
    const sessionARequest = new Promise((resolve) => {
      resolveSessionA = resolve;
    });
    const sessionBRequest = new Promise((resolve) => {
      resolveSessionB = resolve;
    });
    const triggerMock = vi
      .fn()
      .mockReturnValueOnce(sessionARequest)
      .mockReturnValueOnce(sessionBRequest);
    let sessionId = "session-A";

    const { result, rerender } = renderHook(() =>
      useSessionLifecycleHaptics({
        sessionId,
        isReady: true,
        isPlaying: true,
        hasEnded: false,
        isLiveGateOpen: false,
        currentTime: 2,
        userProfile: null,
        triggerHapticEvent: triggerMock,
      })
    );

    expect(result.current.isStartPending).toBe(true);
    sessionId = "session-B";
    await act(async () => {
      rerender();
    });
    expect(triggerMock).toHaveBeenCalledTimes(2);
    expect(result.current.isStartPending).toBe(true);

    await act(async () => {
      resolveSessionA({ status: "success" });
      await sessionARequest;
    });
    expect(result.current.hasDeliveredStart).toBe(false);
    expect(result.current.isStartPending).toBe(true);

    await act(async () => {
      resolveSessionB({ status: "success" });
      await sessionBRequest;
    });
    expect(result.current.hasDeliveredStart).toBe(true);
    expect(result.current.isStartPending).toBe(false);
  });

  test("stale Finish completion from a previous session cannot mutate the new session", async () => {
    let resolveSessionA!: (value: unknown) => void;
    let resolveSessionB!: (value: unknown) => void;
    const sessionARequest = new Promise((resolve) => {
      resolveSessionA = resolve;
    });
    const sessionBRequest = new Promise((resolve) => {
      resolveSessionB = resolve;
    });
    const triggerMock = vi
      .fn()
      .mockResolvedValueOnce({ status: "start-success" })
      .mockReturnValueOnce(sessionARequest)
      .mockResolvedValueOnce({ status: "start-success" })
      .mockReturnValueOnce(sessionBRequest);
    let sessionId = "session-A";

    const { result, rerender } = renderHook(() =>
      useSessionLifecycleHaptics({
        sessionId,
        isReady: true,
        isPlaying: true,
        hasEnded: false,
        isLiveGateOpen: false,
        currentTime: 120,
        userProfile: null,
        triggerHapticEvent: triggerMock,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      void result.current.triggerFinishHaptic();
    });
    sessionId = "session-B";
    await act(async () => {
      rerender();
    });
    await act(async () => {
      void result.current.triggerFinishHaptic();
    });
    expect(result.current.isFinishPending).toBe(true);

    await act(async () => {
      resolveSessionA({ status: "success" });
      await sessionARequest;
    });
    expect(result.current.hasDeliveredFinish).toBe(false);
    expect(result.current.isFinishPending).toBe(true);

    await act(async () => {
      resolveSessionB({ status: "success" });
      await sessionBRequest;
    });
    expect(result.current.hasDeliveredFinish).toBe(true);
    expect(result.current.isFinishPending).toBe(false);
  });

  test("failed Finish clears the pending guard and allows a retry", async () => {
    const triggerMock = vi
      .fn()
      .mockResolvedValueOnce({ status: "start-success" })
      .mockRejectedValueOnce(new Error("finish failed"))
      .mockResolvedValueOnce({ status: "finish-success" });

    const { result } = renderHook(() =>
      useSessionLifecycleHaptics({
        sessionId: "session-1",
        isReady: true,
        isPlaying: true,
        hasEnded: false,
        isLiveGateOpen: false,
        currentTime: 120,
        userProfile: null,
        triggerHapticEvent: triggerMock,
      })
    );

    await act(async () => {
      await result.current.triggerFinishHaptic();
    });
    expect(result.current.hasDeliveredFinish).toBe(false);
    expect(result.current.isFinishPending).toBe(false);

    await act(async () => {
      await result.current.triggerFinishHaptic();
    });
    expect(result.current.hasDeliveredFinish).toBe(true);
    expect(triggerMock).toHaveBeenCalledTimes(3);
  });
});
