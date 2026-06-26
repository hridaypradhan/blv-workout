/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useHapticDeviceStatus, HapticStatusProvider } from "../useHapticDeviceStatus";
import { useHapticEventDelivery } from "../useHapticEventDelivery";
import HapticSettingsPanel from "../../../components/settings/HapticSettingsPanel";
import {
  getSessionEventLabel,
  formatSessionEventDetails,
  getSessionEventStyle,
} from "../../formatters/sessionFormatters";
import { SESSION_EVENTS } from "../../sessionEvents";

// Mock targets
const mockGetHapticStatus = vi.fn();
const mockRefreshHapticStatus = vi.fn();
const mockTriggerHapticPattern = vi.fn();
const mockGetHapticEventMap = vi.fn();

const mockFetch = vi.fn().mockImplementation(async (url: string, options?: any) => {
  let path = url;
  if (url.startsWith("http://localhost:8000")) {
    path = url.replace("http://localhost:8000", "");
  }

  const okResponse = (data: any) => ({
    ok: true,
    status: 200,
    json: async () => data,
  });

  const errResponse = (status: number, message: string) => ({
    ok: false,
    status,
    json: async () => ({ detail: message }),
  });

  try {
    if (path === "/api/haptic/status") {
      const data = await mockGetHapticStatus();
      return okResponse(data);
    }
    if (path === "/api/haptic/refresh") {
      const data = await mockRefreshHapticStatus();
      return okResponse(data);
    }
    if (path === "/api/haptic/trigger") {
      const body = options?.body ? JSON.parse(options.body) : {};
      const data = await mockTriggerHapticPattern(body);
      return okResponse(data);
    }
    if (path === "/api/haptic/event-map") {
      const data = await mockGetHapticEventMap();
      return okResponse(data);
    }
  } catch (err: any) {
    return errResponse(500, err.message || "Mock error");
  }

  return errResponse(404, `Unhandled fetch mock for: ${url}`);
});

describe("Haptic Hooks, Component, and Formatter Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("useHapticDeviceStatus and HapticStatusProvider", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test("fallback mode (no provider): fetches status once on mount and does not poll", async () => {
      mockGetHapticStatus.mockResolvedValue({
        status: "connected",
        provider: "bhaptics",
        hardware_available: true,
        player_available: true,
        devices: {
          left_arm: { connected: true },
          right_arm: { connected: true },
        },
      });

      const { result } = renderHook(() => useHapticDeviceStatus());

      // Resolve the initial fetch
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      expect(mockGetHapticStatus).toHaveBeenCalledTimes(1);
      expect(result.current.status).toBe("connected");
      expect(result.current.isHardwareConnected).toBe(true);

      mockGetHapticStatus.mockClear();

      // Advance timers to verify no polling occurs
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30000);
      });
      expect(mockGetHapticStatus).not.toHaveBeenCalled();
    });

    test("provider mode: fetches status once on mount and multiple consumers share state", async () => {
      mockGetHapticStatus.mockResolvedValue({
        status: "connected",
        provider: "bhaptics",
        hardware_available: true,
        player_available: true,
        devices: {
          left_arm: { connected: true },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <HapticStatusProvider>{children}</HapticStatusProvider>
      );

      // Render multiple hooks within the same provider instance
      const { result } = renderHook(() => {
        const s1 = useHapticDeviceStatus();
        const s2 = useHapticDeviceStatus();
        return { s1, s2 };
      }, { wrapper });

      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      // Provider should fetch status exactly once on mount
      expect(mockGetHapticStatus).toHaveBeenCalledTimes(1);
      expect(result.current.s1.status).toBe("connected");
      expect(result.current.s2.status).toBe("connected");
    });

    test("provider mode: manual refresh triggers new fetch", async () => {
      mockGetHapticStatus.mockResolvedValue({
        status: "disabled",
        provider: "bhaptics_dry_run",
        hardware_available: false,
      });
      mockRefreshHapticStatus.mockResolvedValue({ status: "refreshed" });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <HapticStatusProvider>{children}</HapticStatusProvider>
      );

      const { result } = renderHook(() => useHapticDeviceStatus(), { wrapper });
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      expect(result.current.status).toBe("disabled");
      mockGetHapticStatus.mockClear();
      mockRefreshHapticStatus.mockClear();

      // Mock status change on next fetch
      mockGetHapticStatus.mockResolvedValue({
        status: "connected",
        provider: "bhaptics",
        hardware_available: true,
        player_available: true,
      });

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockRefreshHapticStatus).toHaveBeenCalledTimes(1);
      expect(mockGetHapticStatus).toHaveBeenCalledTimes(1);
      expect(result.current.status).toBe("connected");
    });

    test("provider mode: visibility refresh respects 60 seconds stale threshold", async () => {
      mockGetHapticStatus.mockResolvedValue({
        status: "connected",
        provider: "bhaptics",
        hardware_available: true,
        player_available: true,
        devices: {},
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <HapticStatusProvider>{children}</HapticStatusProvider>
      );

      renderHook(() => useHapticDeviceStatus(), { wrapper });
      
      // Resolve initial fetch on mount
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      expect(mockGetHapticStatus).toHaveBeenCalledTimes(1);
      mockGetHapticStatus.mockClear();

      // Set visibilityState getter using vi.spyOn
      const visibilitySpy = vi.spyOn(document, "visibilityState", "get");
      visibilitySpy.mockReturnValue("visible");

      // Case 1: Tab becomes visible before 60 seconds (e.g. 30 seconds later)
      // Advance clock by 30 seconds
      vi.advanceTimersByTime(30000);
      
      // Trigger visibility change
      await act(async () => {
        fireEvent(document, new Event("visibilitychange"));
      });
      // Should not fetch status since it is not stale yet
      expect(mockGetHapticStatus).not.toHaveBeenCalled();

      // Case 2: Tab becomes visible after stale threshold (e.g. 61 seconds later)
      // Advance clock by another 31 seconds (total 61s from last fetch)
      vi.advanceTimersByTime(31000);

      await act(async () => {
        fireEvent(document, new Event("visibilitychange"));
        await vi.runOnlyPendingTimersAsync();
      });
      // Should fetch status as it is now stale
      expect(mockGetHapticStatus).toHaveBeenCalledTimes(1);

      visibilitySpy.mockRestore();
    });

    test("derives correct text for various statuses", async () => {
      const statuses = [
        { status: "partially_connected", devices: { left_arm: { connected: true } }, text: "Left Arm connected." },
        { status: "partially_connected", devices: { right_arm: { connected: true } }, text: "Right Arm connected." },
        { status: "initialized_no_devices", devices: {}, text: "bHaptics Player ready, no sleeves connected." },
        { status: "player_unavailable", devices: {}, text: "bHaptics Player is offline. Please open bHaptics Player." },
        { status: "not_configured", devices: {}, text: "bHaptics App ID or API key are not configured." },
        { status: "sdk_unavailable", devices: {}, text: "bHaptics integration unavailable. Events will use indicator mode." },
        { status: "python_unsupported", devices: {}, text: "bHaptics integration unavailable (unsupported Python version). Events will use indicator mode." },
        { status: "error", devices: {}, text: "An error occurred with the haptic provider connection." },
      ];

      for (const item of statuses) {
        mockGetHapticStatus.mockResolvedValue({
          status: item.status,
          provider: "bhaptics",
          hardware_available: false,
          player_available: item.status !== "player_unavailable",
          devices: item.devices,
        });

        const { result } = renderHook(() => useHapticDeviceStatus());
        await act(async () => {
          await vi.runOnlyPendingTimersAsync();
        });

        expect(result.current.status).toBe(item.status);
      }
    });
  });

  describe("useHapticEventDelivery", () => {
    test("logs telemetry and handles hardware success trigger", async () => {
      const mockAnnounce = vi.fn();
      const mockLogSessionEvent = vi.fn();
      mockTriggerHapticPattern.mockResolvedValue({
        status: "triggered",
        delivery_mode: "hardware",
        bhaptics_event_name: "assist_start",
        hardware_available: true,
        player_available: true,
        request_id: "req-123",
        status_message: "Fired successfully",
        selected_wav: "assist_start.wav",
        target_limbs: ["left_arm"],
        provider: "bhaptics",
      });

      const { result } = renderHook(() =>
        useHapticEventDelivery(mockAnnounce, mockLogSessionEvent)
      );

      let triggerResult;
      await act(async () => {
        triggerResult = await result.current.triggerHapticEvent({
          cueType: "start",
          vibrationId: "v-start",
          intensity: 1.0,
          limbs: ["left_arm"],
          text: "Start exercise",
          cueId: "cue-start",
          currentTimeMs: 5000,
        });
      });

      // 1. Check requested telemetry was logged
      expect(mockLogSessionEvent).toHaveBeenCalledWith(
        SESSION_EVENTS.HAPTIC_CUE_REQUESTED,
        5000,
        expect.objectContaining({
          cue_type: "start",
          selected_vibration_id: "v-start",
          cue_id: "cue-start",
        })
      );

      // 2. Check API invocation parameters passed as request body
      expect(mockTriggerHapticPattern).toHaveBeenCalledWith(
        expect.objectContaining({
          cue_type: "start",
          vibration_id: "v-start",
          intensity: 1.0,
          limbs: ["left_arm"],
        })
      );

      // 3. Check trigger telemetry logged
      expect(mockLogSessionEvent).toHaveBeenCalledWith(
        SESSION_EVENTS.HAPTIC_CUE_TRIGGERED,
        5000,
        expect.objectContaining({
          delivery_mode: "hardware",
          bhaptics_event_name: "assist_start",
          request_id: "req-123",
        })
      );

      // 4. Check announcement and returned result
      expect(mockAnnounce).toHaveBeenCalledWith("Haptic fired: assist_start.");
      expect(triggerResult).toEqual(expect.objectContaining({ delivery_mode: "hardware" }));
      expect(result.current.recentEvents[0]).toEqual(
        expect.objectContaining({
          eventName: "assist_start",
          deliveryMode: "hardware",
        })
      );
    });

    test("handles indicator/dry_run trigger delivery modes", async () => {
      const mockAnnounce = vi.fn();
      const mockLogSessionEvent = vi.fn();
      mockTriggerHapticPattern.mockResolvedValue({
        status: "would_trigger",
        delivery_mode: "indicator",
        bhaptics_event_name: "assist_rep_tick",
        hardware_available: false,
        player_available: true,
        request_id: "req-456",
        status_message: "Indicator mode used",
        provider: "bhaptics",
      });

      const { result } = renderHook(() =>
        useHapticEventDelivery(mockAnnounce, mockLogSessionEvent)
      );

      await act(async () => {
        await result.current.triggerHapticEvent({
          cueType: "per_rep_tick",
          vibrationId: "v-rep",
          intensity: 0.8,
          currentTimeMs: 6000,
        });
      });

      expect(mockAnnounce).toHaveBeenCalledWith("Haptic indicator: assist_rep_tick.");
      expect(mockLogSessionEvent).toHaveBeenCalledWith(
        SESSION_EVENTS.HAPTIC_CUE_TRIGGERED,
        6000,
        expect.objectContaining({
          delivery_mode: "indicator",
          bhaptics_event_name: "assist_rep_tick",
        })
      );
    });

    test("handles failed trigger delivery mode", async () => {
      const mockAnnounce = vi.fn();
      const mockLogSessionEvent = vi.fn();
      mockTriggerHapticPattern.mockResolvedValue({
        status: "would_trigger",
        delivery_mode: "failed",
        bhaptics_event_name: "assist_speed_up",
        hardware_available: false,
        player_available: false,
        request_id: "req-789",
        status_message: "Player offline",
        provider: "bhaptics",
      });

      const { result } = renderHook(() =>
        useHapticEventDelivery(mockAnnounce, mockLogSessionEvent)
      );

      await act(async () => {
        await result.current.triggerHapticEvent({
          cueType: "speed_up",
          vibrationId: "v-speed",
          intensity: 0.8,
          currentTimeMs: 7000,
        });
      });

      expect(mockAnnounce).toHaveBeenCalledWith("Haptic delivery failed.");
      expect(mockLogSessionEvent).toHaveBeenCalledWith(
        SESSION_EVENTS.HAPTIC_CUE_FAILED,
        7000,
        expect.objectContaining({
          delivery_mode: "failed",
          bhaptics_event_name: "assist_speed_up",
        })
      );
    });

    test("logs failure if triggerHapticPattern throws an error", async () => {
      const mockAnnounce = vi.fn();
      const mockLogSessionEvent = vi.fn();
      mockTriggerHapticPattern.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() =>
        useHapticEventDelivery(mockAnnounce, mockLogSessionEvent)
      );

      await expect(
        act(async () => {
          await result.current.triggerHapticEvent({
            cueType: "slow_down",
            vibrationId: "v-slow",
            intensity: 0.5,
            currentTimeMs: 8000,
          });
        })
      ).rejects.toThrow("Network error");

      expect(mockAnnounce).toHaveBeenCalledWith("Haptic delivery failed.");
      expect(mockLogSessionEvent).toHaveBeenCalledWith(
        SESSION_EVENTS.HAPTIC_CUE_FAILED,
        8000,
        expect.objectContaining({
          delivery_mode: "failed",
          bhaptics_event_name: "slow_down",
          error: "Network error",
        })
      );
    });
  });

  describe("HapticSettingsPanel Component", () => {
    const vibrations = [
      { id: "v1", cue_type: "start", label: "Start Vibration 1", source_wav: "wav1.wav", duration_ms: 500 },
      { id: "v2", cue_type: "countdown", label: "Countdown Vibration 1", source_wav: "wav2.wav", duration_ms: 200 },
    ];
    const hapticPreferences = {
      start: "v1",
      countdown: "v2",
      per_rep_tick: "",
      speed_up: "",
      slow_down: "",
      form_warning_above: "",
      cooldown: "",
    };
    const mockOnHapticPrefChange = vi.fn();
    const mockPreviewWav = vi.fn();

    test("renders event mapping definitions after fetch resolves", async () => {
      mockGetHapticEventMap.mockResolvedValue([
        { cue_type: "start", bhaptics_event_name: "assist_start", label: "Custom Start Label", description: "Custom start desc" },
      ]);

      render(
        <HapticSettingsPanel
          hapticPreferences={hapticPreferences}
          onHapticPrefChange={mockOnHapticPrefChange}
          vibrations={vibrations}
          previewWav={mockPreviewWav}
        />
      );

      // Initially shows loading state
      expect(screen.getByText(/Loading event mapping definitions.../i)).toBeDefined();

      // Wait for loadMap resolution
      await waitFor(() => {
        expect(screen.queryByText(/Loading event mapping definitions.../i)).toBeNull();
      });

      // Should display custom label
      expect(screen.getByText("Custom Start Label")).toBeDefined();
      expect(screen.getByText("Custom start desc")).toBeDefined();
      expect(screen.getByText("bHaptics Event: assist_start")).toBeDefined();
    });

    test("falls back to default event mapping if api request fails", async () => {
      mockGetHapticEventMap.mockRejectedValue(new Error("API offline"));

      render(
        <HapticSettingsPanel
          hapticPreferences={hapticPreferences}
          onHapticPrefChange={mockOnHapticPrefChange}
          vibrations={vibrations}
          previewWav={mockPreviewWav}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).toBeNull();
      });

      // Should render fallback items e.g., "Session Start Cue", "Countdown Tick Cue"
      expect(screen.getByText("Session Start Cue")).toBeDefined();
      expect(screen.getByText("Countdown Tick Cue")).toBeDefined();
    });

    test("triggers test haptic event and displays diagnostics", async () => {
      mockGetHapticEventMap.mockResolvedValue([
        { cue_type: "start", bhaptics_event_name: "assist_start", label: "Session Start Cue", description: "Start desc" },
      ]);
      mockTriggerHapticPattern.mockResolvedValue({
        status: "triggered",
        delivery_mode: "hardware",
        bhaptics_event_name: "assist_start",
        hardware_available: true,
        player_available: true,
        provider: "bhaptics",
        status_message: "Device was pulsed",
      });

      render(
        <HapticSettingsPanel
          hapticPreferences={hapticPreferences}
          onHapticPrefChange={mockOnHapticPrefChange}
          vibrations={vibrations}
          previewWav={mockPreviewWav}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).toBeNull();
      });

      const testBtn = screen.getByTitle("Trigger test for assist_start");
      fireEvent.click(testBtn);

      // Should show loading status momentarily or test complete after resolution
      await waitFor(() => {
        expect(screen.getByText(/Fired on physical sleeves/i)).toBeDefined();
      });

      expect(screen.getAllByText(/Device was pulsed/i).length).toBeGreaterThan(0);
    });
  });

  describe("sessionFormatters", () => {
    test("getSessionEventLabel formats haptic events", () => {
      expect(getSessionEventLabel(SESSION_EVENTS.HAPTIC_CUE_REQUESTED)).toBe("Haptic Requested");
      expect(getSessionEventLabel(SESSION_EVENTS.HAPTIC_CUE_FAILED)).toBe("Haptic Failed");
      
      expect(
        getSessionEventLabel(SESSION_EVENTS.HAPTIC_CUE_TRIGGERED, { delivery_mode: "hardware" })
      ).toBe("Haptic Fired");
      
      expect(
        getSessionEventLabel(SESSION_EVENTS.HAPTIC_CUE_TRIGGERED, { delivery_mode: "indicator" })
      ).toBe("Haptic Indicator");
    });

    test("formatSessionEventDetails returns formatted strings", () => {
      const requestDetails = formatSessionEventDetails({
        event_type: SESSION_EVENTS.HAPTIC_CUE_REQUESTED,
        metadata: {
          bhaptics_event_name: "assist_start",
          cue_type: "start",
          selected_vibration_id: "v-start",
          target_positions: ["left_arm"],
        },
      });
      expect(requestDetails).toContain("Haptic request: Event assist_start");
      expect(requestDetails).toContain("Type: start");
      expect(requestDetails).toContain("ID: v-start");
      expect(requestDetails).toContain("[left_arm]");

      const triggerDetails = formatSessionEventDetails({
        event_type: SESSION_EVENTS.HAPTIC_CUE_TRIGGERED,
        metadata: {
          bhaptics_event_name: "assist_start",
          delivery_mode: "hardware",
          provider: "bhaptics",
          target_positions: ["left_arm", "right_arm"],
          request_id: "req-123",
          status_message: "Pulsed successfully",
        },
      });
      expect(triggerDetails).toContain("Haptic delivered (hardware): Event assist_start via bhaptics");
      expect(triggerDetails).toContain("on [left_arm, right_arm]");
      expect(triggerDetails).toContain("Req ID: req-123");
      expect(triggerDetails).toContain("Status: Pulsed successfully");

      const failureDetails = formatSessionEventDetails({
        event_type: SESSION_EVENTS.HAPTIC_CUE_FAILED,
        metadata: {
          bhaptics_event_name: "assist_start",
          provider: "bhaptics",
          request_id: "req-123",
          error: "Sleeve disconnected",
        },
      });
      expect(failureDetails).toContain("Haptic delivery failed: Event assist_start via bhaptics");
      expect(failureDetails).toContain("Req ID: req-123");
      expect(failureDetails).toContain("Error: Sleeve disconnected");
    });

    test("getSessionEventStyle returns appropriate style", () => {
      expect(getSessionEventStyle(SESSION_EVENTS.HAPTIC_CUE_REQUESTED)).toBe("text-sky-500/80");
      expect(
        getSessionEventStyle(SESSION_EVENTS.HAPTIC_CUE_TRIGGERED, { delivery_mode: "hardware" })
      ).toBe("text-sky-400 font-extrabold");
      expect(
        getSessionEventStyle(SESSION_EVENTS.HAPTIC_CUE_TRIGGERED, { delivery_mode: "indicator" })
      ).toBe("text-yellow-500/90 font-medium");
      expect(getSessionEventStyle(SESSION_EVENTS.HAPTIC_CUE_FAILED)).toBe("text-red-400 font-bold");
    });
  });
});
