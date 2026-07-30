import { describe, test, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePrototypePoseRuntime } from "../usePrototypePoseRuntime";
import { ExerciseTimelineAnchor } from "@/types";

describe("usePrototypePoseRuntime", () => {
  const mockAnchor: ExerciseTimelineAnchor = {
    id: "ex-1",
    name: "Squat Challenge",
    start_time_seconds: 0,
    end_time_seconds: 30,
    counting_joint: "left_knee",
    acceptable_ranges: {
      left_knee: [75, 180],
    },
  };

  test("initializes with offline/disabled state", () => {
    const { result } = renderHook(() =>
      usePrototypePoseRuntime({
        currentTimeMs: 0,
        activeAnchor: null,
        isPlaying: false,
      })
    );

    expect(result.current.isTracking).toBe(false);
    expect(result.current.isReady).toBe(false);
    expect(result.current.providerSource).toBe("prototype");
    expect(result.current.runtimeStatus).toBe("offline");
    expect(result.current.poseData).toBeNull();
    expect(result.current.trackingStatusLabel).toBe("Prototype fallback active");
    expect(result.current.currentAngles).toEqual({});
    expect(result.current.latestRepEvent).toBeNull();
    expect(result.current.latestFormError).toBeNull();
  });

  test("starts tracking and sets status when startTracking is called", () => {
    const { result } = renderHook(() =>
      usePrototypePoseRuntime({
        currentTimeMs: 0,
        activeAnchor: null,
        isPlaying: false,
      })
    );

    act(() => {
      result.current.startTracking();
    });

    expect(result.current.isTracking).toBe(true);
    expect(result.current.isReady).toBe(true);
    expect(result.current.providerSource).toBe("prototype");
    expect(result.current.runtimeStatus).toBe("active");
    expect(result.current.poseData).toEqual({ tracking: true, source: "prototype" });
    expect(result.current.trackingStatusLabel).toBe("Prototype fallback active");
  });

  test("stops tracking and resets state when stopTracking is called", () => {
    const { result } = renderHook(() =>
      usePrototypePoseRuntime({
        currentTimeMs: 1000,
        activeAnchor: mockAnchor,
        isPlaying: true,
      })
    );

    act(() => {
      result.current.startTracking();
    });

    expect(result.current.runtimeStatus).toBe("active");

    act(() => {
      result.current.stopTracking();
    });

    expect(result.current.isTracking).toBe(false);
    expect(result.current.isReady).toBe(false);
    expect(result.current.providerSource).toBe("prototype");
    expect(result.current.runtimeStatus).toBe("offline");
    expect(result.current.poseData).toBeNull();
    expect(result.current.trackingStatusLabel).toBe("Prototype fallback active");
    expect(result.current.currentAngles).toEqual({});
    expect(result.current.latestRepEvent).toBeNull();
    expect(result.current.latestFormError).toBeNull();
  });

  test("simulates joint angles during active play and tracking", () => {
    const { result, rerender } = renderHook(
      ({ currentTimeMs, isPlaying }) =>
        usePrototypePoseRuntime({
          currentTimeMs,
          activeAnchor: mockAnchor,
          isPlaying,
        }),
      {
        initialProps: {
          currentTimeMs: 0,
          isPlaying: true,
        },
      }
    );

    act(() => {
      result.current.startTracking();
    });

    // Cycle duration is 4000ms. At cycle = 0, sin(0) is 0, so phase is 0.5.
    // Squat knee angle calculation: 72.0 + (170.0 - 72.0) * 0.5 = 72 + 49 = 121 degrees.
    expect(result.current.currentAngles.left_knee).toBeCloseTo(121.0, 1);

    // Rerender at 1000ms (cycle = 0.25, sin(pi/2) is 1, phase is 1.0)
    // Squat knee angle calculation: 72.0 + (170.0 - 72.0) * 1.0 = 170 degrees.
    rerender({ currentTimeMs: 1000, isPlaying: true });
    expect(result.current.currentAngles.left_knee).toBeCloseTo(170.0, 1);
  });

  test("triggers rep completed events based on cycle progression", () => {
    const { result, rerender } = renderHook(
      ({ currentTimeMs }) =>
        usePrototypePoseRuntime({
          currentTimeMs,
          activeAnchor: mockAnchor,
          isPlaying: true,
        }),
      {
        initialProps: {
          currentTimeMs: 0,
        },
      }
    );

    act(() => {
      result.current.startTracking();
    });

    // Advance past one full cycle (4000ms) to trigger a repetition event
    rerender({ currentTimeMs: 2000 });
    rerender({ currentTimeMs: 4100 });

    expect(result.current.latestRepEvent).not.toBeNull();
    expect(result.current.latestRepEvent!.rep_count).toBe(1);
    expect(result.current.latestRepEvent!.exercise_id).toBe("ex-1");
  });

  test("triggers form error when angle falls out of acceptable range", () => {
    const { result, rerender } = renderHook(
      ({ currentTimeMs }) =>
        usePrototypePoseRuntime({
          currentTimeMs,
          activeAnchor: mockAnchor,
          isPlaying: true,
        }),
      {
        initialProps: {
          currentTimeMs: 0,
        },
      }
    );

    act(() => {
      result.current.startTracking();
    });

    // At currentTimeMs = 3000 (cycle = 0.75, sin(1.5*pi) is -1, phase is 0)
    // Knee angle is 72.0 degrees (which is below the min range 75 degrees)
    rerender({ currentTimeMs: 3000 });

    expect(result.current.latestFormError).not.toBeNull();
    expect(result.current.latestFormError!.joint).toBe("left_knee");
    expect(result.current.latestFormError!.observed_angle).toBeCloseTo(72.0, 1);
    expect(result.current.latestFormError!.severity).toBe("low"); // diff 3 (75 - 72) <= 10
  });
});
