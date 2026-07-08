import { describe, test, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePlaybackPauseCoordinator } from "../usePlaybackPauseCoordinator";

describe("usePlaybackPauseCoordinator", () => {
  test("requests and releases pause correctly", () => {
    const playMock = vi.fn();
    const pauseMock = vi.fn();
    const logSpy = vi.fn();

    const { result } = renderHook(() =>
      usePlaybackPauseCoordinator(playMock, pauseMock, logSpy, 1000, () => false)
    );

    // Initial state
    expect(result.current.activeOwners.size).toBe(0);

    // Request gate pause
    act(() => {
      result.current.requestPause("positioning_gate", "Gate opened");
    });
    expect(result.current.activeOwners.has("positioning_gate")).toBe(true);
    expect(pauseMock).toHaveBeenCalledTimes(1);
    expect(playMock).not.toHaveBeenCalled();

    // Release gate pause
    act(() => {
      result.current.releasePause("positioning_gate", "Gate completed");
    });
    expect(result.current.activeOwners.size).toBe(0);
    expect(playMock).toHaveBeenCalledTimes(1);
  });

  test("does not resume if another owner is active", () => {
    const playMock = vi.fn();
    const pauseMock = vi.fn();
    const logSpy = vi.fn();

    const { result } = renderHook(() =>
      usePlaybackPauseCoordinator(playMock, pauseMock, logSpy, 1000, () => false)
    );

    // Request manual pause
    act(() => {
      result.current.requestPause("user_manual", "User clicked pause");
    });
    // Request gate pause
    act(() => {
      result.current.requestPause("positioning_gate", "Gate opened");
    });

    expect(result.current.activeOwners.size).toBe(2);
    expect(pauseMock).toHaveBeenCalledTimes(2);

    // Release gate pause
    act(() => {
      result.current.releasePause("positioning_gate", "Gate completed");
    });

    // Should NOT resume because user_manual is still active
    expect(result.current.activeOwners.has("user_manual")).toBe(true);
    expect(playMock).not.toHaveBeenCalled();
  });

  test("does not resume if isEnding returns true", () => {
    const playMock = vi.fn();
    const pauseMock = vi.fn();
    const logSpy = vi.fn();

    const { result } = renderHook(() =>
      usePlaybackPauseCoordinator(playMock, pauseMock, logSpy, 1000, () => true)
    );

    act(() => {
      result.current.requestPause("positioning_gate", "Gate opened");
    });
    act(() => {
      result.current.releasePause("positioning_gate", "Gate completed");
    });

    expect(playMock).not.toHaveBeenCalled();
  });

  test("does not resume if skipResume is true", () => {
    const playMock = vi.fn();
    const pauseMock = vi.fn();
    const logSpy = vi.fn();

    const { result } = renderHook(() =>
      usePlaybackPauseCoordinator(playMock, pauseMock, logSpy, 1000, () => false)
    );

    act(() => {
      result.current.requestPause("positioning_gate", "Gate opened");
    });
    act(() => {
      result.current.releasePause("positioning_gate", "Gate completed", true);
    });

    expect(playMock).not.toHaveBeenCalled();
    expect(result.current.activeOwners.size).toBe(0);
  });

  test("releasing a missing owner does not resume playback or corrupt state", () => {
    const playMock = vi.fn();
    const pauseMock = vi.fn();
    const logSpy = vi.fn();

    const { result } = renderHook(() =>
      usePlaybackPauseCoordinator(playMock, pauseMock, logSpy, 1000, () => false)
    );

    // Release an owner that was never requested
    act(() => {
      result.current.releasePause("assistant_speech", "Spurious release");
    });

    expect(playMock).not.toHaveBeenCalled();
    expect(pauseMock).not.toHaveBeenCalled();
    expect(result.current.activeOwners.size).toBe(0);
  });

  test("duplicate requestPause from same owner does not double-call pauseVideo", () => {
    const playMock = vi.fn();
    const pauseMock = vi.fn();
    const logSpy = vi.fn();

    const { result } = renderHook(() =>
      usePlaybackPauseCoordinator(playMock, pauseMock, logSpy, 1000, () => false)
    );

    act(() => {
      result.current.requestPause("user_manual", "First pause");
    });
    act(() => {
      result.current.requestPause("user_manual", "Duplicate pause");
    });

    // pauseVideo should only be called once
    expect(pauseMock).toHaveBeenCalledTimes(1);
    expect(result.current.activeOwners.size).toBe(1);
  });

  test("event metadata includes owner, reason, activeOwners, and willResume", () => {
    const playMock = vi.fn();
    const pauseMock = vi.fn();
    const logSpy = vi.fn();

    const { result } = renderHook(() =>
      usePlaybackPauseCoordinator(playMock, pauseMock, logSpy, 5000, () => false)
    );

    // Request pause
    act(() => {
      result.current.requestPause("positioning_gate", "Gate opened");
    });

    expect(logSpy).toHaveBeenCalledWith(
      "pause_coordinator_request",
      5000,
      expect.objectContaining({
        owner: "positioning_gate",
        reason: "Gate opened",
        activeOwners: ["positioning_gate"],
      })
    );

    // Release pause
    act(() => {
      result.current.releasePause("positioning_gate", "Gate done");
    });

    expect(logSpy).toHaveBeenCalledWith(
      "pause_coordinator_release",
      5000,
      expect.objectContaining({
        owner: "positioning_gate",
        reason: "Gate done",
        activeOwners: [],
        willResume: true,
      })
    );
  });

  test("manual play via user_manual release resumes when it is the only active owner", () => {
    const playMock = vi.fn();
    const pauseMock = vi.fn();
    const logSpy = vi.fn();

    const { result } = renderHook(() =>
      usePlaybackPauseCoordinator(playMock, pauseMock, logSpy, 1000, () => false)
    );

    // User manually pauses
    act(() => {
      result.current.requestPause("user_manual", "User paused");
    });
    expect(pauseMock).toHaveBeenCalledTimes(1);

    // User manually plays
    act(() => {
      result.current.releasePause("user_manual", "User resumed");
    });

    expect(playMock).toHaveBeenCalledTimes(1);
    expect(result.current.activeOwners.size).toBe(0);
  });
});
