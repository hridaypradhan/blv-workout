/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHapticDeviceStatus, HapticStatusProvider } from "../useHapticDeviceStatus";

const mockGetHapticStatus = vi.fn();
const mockRefreshHapticStatus = vi.fn();

const mockFetch = vi.fn().mockImplementation(async (url: string) => {
  let path = url;
  if (url.startsWith("http://localhost:8000")) {
    path = url.replace("http://localhost:8000", "");
  }

  const okResponse = (data: any) => ({
    ok: true,
    status: 200,
    json: async () => data,
  });

  if (path === "/api/haptic/status") {
    const data = await mockGetHapticStatus();
    return okResponse(data);
  }
  if (path === "/api/haptic/refresh") {
    const data = await mockRefreshHapticStatus();
    return okResponse(data);
  }

  return { ok: false, status: 404, json: async () => ({ detail: "Not found" }) };
});

describe("useHapticDeviceStatus and HapticStatusProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(mockGetHapticStatus).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("connected");
    expect(result.current.isHardwareConnected).toBe(true);

    mockGetHapticStatus.mockClear();

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

    const { result } = renderHook(
      () => {
        const s1 = useHapticDeviceStatus();
        const s2 = useHapticDeviceStatus();
        return { s1, s2 };
      },
      { wrapper }
    );

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

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
});
