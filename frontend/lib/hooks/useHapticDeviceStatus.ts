"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { getHapticStatus, refreshHapticStatus as apiRefreshHapticStatus } from "../api/haptic";
import { HapticStatusResponse, HapticDeviceStatus, HapticProviderStatus } from "../../types";

export interface HapticStatusContextType {
  status: HapticProviderStatus;
  isLoading: boolean;
  error: string | null;
  isHardwareConnected: boolean;
  isPlayerAvailable: boolean;
  isConfigured: boolean;
  statusText: string;
  deviceStatuses: HapticDeviceStatus[];
  announcement: string;
  refresh: () => Promise<void>;
}

export const HapticStatusContext = createContext<HapticStatusContextType | null>(null);

export function HapticStatusProvider({ children }: { children: React.ReactNode }) {
  const [statusResponse, setStatusResponse] = useState<HapticStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const lastFetchTimeRef = useRef<number>(0);

  const fetchStatus = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const data = await getHapticStatus();
      setStatusResponse(data);
      lastFetchTimeRef.current = Date.now();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch haptic status");
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      await apiRefreshHapticStatus();
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh haptic status");
    } finally {
      setIsLoading(false);
    }
  }, [fetchStatus]);

  useEffect(() => {
    // Initial fetch on mount
    fetchStatus();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const now = Date.now();
        if (now - lastFetchTimeRef.current > 60000) {
          fetchStatus();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchStatus]);

  const value = deriveHapticStatusValues(statusResponse, isLoading, error, refresh);

  return React.createElement(HapticStatusContext.Provider, { value }, children);
}

// Helper to derive hook UI fields from raw API response
function deriveHapticStatusValues(
  statusResponse: HapticStatusResponse | null,
  isLoading: boolean,
  error: string | null,
  refresh: () => Promise<void>
): HapticStatusContextType {
  const status = statusResponse?.status || "disabled";
  const devices = statusResponse?.devices || {};
  const isHardwareConnected = statusResponse?.hardware_available || false;
  const isPlayerAvailable = statusResponse?.player_available || false;
  const isConfigured = status !== "not_configured" && status !== "disabled";

  const leftArmConnected = devices.left_arm?.connected || false;
  const rightArmConnected = devices.right_arm?.connected || false;
  const leftLegConnected = devices.left_leg?.connected || false;
  const rightLegConnected = devices.right_leg?.connected || false;

  let statusText = "Haptic hardware integration disabled. Events will use indicator mode.";
  let announcement = "Haptic integration disabled.";

  if (status === "connected") {
    statusText = "bHaptics sleeves connected.";
    announcement = "Both bHaptics sleeves are connected.";
  } else if (status === "partially_connected") {
    const connectedLimbs: string[] = [];
    if (leftArmConnected) connectedLimbs.push("Left Arm");
    if (rightArmConnected) connectedLimbs.push("Right Arm");
    if (leftLegConnected) connectedLimbs.push("Left Leg");
    if (rightLegConnected) connectedLimbs.push("Right Leg");

    if (connectedLimbs.length === 1) {
      statusText = `${connectedLimbs[0]} connected.`;
      announcement = `${connectedLimbs[0]} connected.`;
    } else if (connectedLimbs.length > 1) {
      statusText = "Multiple limbs connected.";
      announcement = `${connectedLimbs.join(", ")} connected.`;
    } else {
      statusText = "One sleeve connected.";
      announcement = "One sleeve connected.";
    }
  } else if (status === "initialized_no_devices") {
    statusText = "bHaptics Player ready, no sleeves connected.";
    announcement = "bHaptics Player ready, but no sleeves connected.";
  } else if (status === "player_unavailable") {
    statusText = "bHaptics Player is offline. Please open bHaptics Player.";
    announcement = "bHaptics Player is offline. Please open bHaptics Player.";
  } else if (status === "not_configured") {
    statusText = "bHaptics App ID or API key are not configured.";
    announcement = "bHaptics App ID or API key are not configured.";
  } else if (status === "sdk_unavailable") {
    statusText = "bHaptics integration unavailable. Events will use indicator mode.";
    announcement = "bHaptics integration unavailable. Events will use indicator mode.";
  } else if (status === "python_unsupported") {
    statusText = "bHaptics integration unavailable (unsupported Python version). Events will use indicator mode.";
    announcement = "bHaptics integration unavailable. Events will use indicator mode.";
  } else if (status === "disabled") {
    statusText = "Haptic hardware integration disabled. Events will use indicator mode.";
    announcement = "Haptic hardware integration disabled.";
  } else if (status === "error") {
    statusText = "An error occurred with the haptic provider connection.";
    announcement = "Haptic provider error.";
  }

  const deviceStatuses = Object.values(devices);

  return {
    status,
    isLoading,
    error,
    isHardwareConnected,
    isPlayerAvailable,
    isConfigured,
    statusText,
    deviceStatuses,
    announcement,
    refresh,
  };
}

export function useHapticDeviceStatus() {
  const context = useContext(HapticStatusContext);

  // Fallback to local state (primarily for direct unit test mounts outside HapticStatusProvider)
  const [statusResponse, setStatusResponse] = useState<HapticStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    if (context) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const data = await getHapticStatus();
      setStatusResponse(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch haptic status");
    } finally {
      inFlightRef.current = false;
    }
  }, [context]);

  const refresh = useCallback(async () => {
    if (context) {
      return context.refresh();
    }
    setIsLoading(true);
    try {
      await apiRefreshHapticStatus();
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh haptic status");
    } finally {
      setIsLoading(false);
    }
  }, [context, fetchStatus]);

  useEffect(() => {
    if (context) return;
    fetchStatus();
  }, [context, fetchStatus]);

  if (context) {
    return context;
  }

  const fallbackValue = deriveHapticStatusValues(statusResponse, isLoading, error, refresh);
  return fallbackValue;
}
