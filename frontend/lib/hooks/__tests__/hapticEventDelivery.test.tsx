/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHapticEventDelivery } from "../useHapticEventDelivery";
import { SESSION_EVENTS } from "../../sessionEvents";

const mockTriggerHapticPattern = vi.fn();

const mockFetch = vi.fn().mockImplementation(async (url: string, options?: any) => {
  let path = url;
  if (url.startsWith("http://localhost:8000")) {
    path = url.replace("http://localhost:8000", "");
  }

  if (path === "/api/haptic/trigger") {
    const body = options?.body ? JSON.parse(options.body) : {};
    const data = await mockTriggerHapticPattern(body);
    return { ok: true, status: 200, json: async () => data };
  }

  return { ok: false, status: 404, json: async () => ({ detail: "Not found" }) };
});

describe("useHapticEventDelivery Hook Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("logs telemetry and handles hardware success trigger", async () => {
    const announceMock = vi.fn();
    const logTelemetryMock = vi.fn();

    mockTriggerHapticPattern.mockResolvedValue({
      delivery_mode: "hardware",
      event_name: "assist_start_high_01",
      submitted_to_sdk: true,
      message: "Triggered bHaptics event",
    });

    const { result } = renderHook(() =>
      useHapticEventDelivery(announceMock, logTelemetryMock)
    );

    await act(async () => {
      await result.current.triggerHapticEvent({
        cueType: "start",
        vibrationId: "start_high_01_v-09-11-4-3",
        intensity: 0.8,
        currentTimeMs: 1000,
      });
    });

    expect(logTelemetryMock).toHaveBeenCalledWith(
      SESSION_EVENTS.HAPTIC_CUE_TRIGGERED,
      1000,
      expect.objectContaining({
        cue_type: "start",
        delivery_mode: "hardware",
      })
    );
    expect(announceMock).toHaveBeenCalledWith("Haptic fired: start.");
    expect(result.current.recentEvents.length).toBe(1);
  });

  test("handles indicator/dry_run trigger delivery modes", async () => {
    const announceMock = vi.fn();
    const logTelemetryMock = vi.fn();

    mockTriggerHapticPattern.mockResolvedValue({
      delivery_mode: "indicator",
      event_name: "assist_reps_high_01",
      submitted_to_sdk: false,
      message: "Simulated indicator feedback",
    });

    const { result } = renderHook(() =>
      useHapticEventDelivery(announceMock, logTelemetryMock)
    );

    await act(async () => {
      await result.current.triggerHapticEvent({
        cueType: "reps",
        vibrationId: "reps_high_01_v-09-16-1-43",
        intensity: 0.7,
        currentTimeMs: 5000,
      });
    });

    expect(logTelemetryMock).toHaveBeenCalledWith(
      SESSION_EVENTS.HAPTIC_CUE_TRIGGERED,
      5000,
      expect.objectContaining({
        cue_type: "reps",
        delivery_mode: "indicator",
      })
    );
    expect(announceMock).toHaveBeenCalledWith("Haptic indicator: reps.");
  });

  test("handles failed trigger delivery mode", async () => {
    const announceMock = vi.fn();
    const logTelemetryMock = vi.fn();

    mockTriggerHapticPattern.mockResolvedValue({
      delivery_mode: "failed",
      event_name: "assist_speed_up_high_01",
      submitted_to_sdk: false,
      message: "Hardware unavailable",
    });

    const { result } = renderHook(() =>
      useHapticEventDelivery(announceMock, logTelemetryMock)
    );

    await act(async () => {
      await result.current.triggerHapticEvent({
        cueType: "speed_up",
        vibrationId: "speed_up_high_01_v-09-10-3-52",
        intensity: 0.8,
        currentTimeMs: 8000,
      });
    });

    expect(logTelemetryMock).toHaveBeenLastCalledWith(
      SESSION_EVENTS.HAPTIC_CUE_FAILED,
      8000,
      expect.objectContaining({
        cue_type: "speed_up",
        delivery_mode: "failed",
      })
    );
  });
});
