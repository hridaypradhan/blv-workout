"use client";

const STORAGE_KEY = "fita11y_preferred_camera";

export interface CameraPreference {
  deviceId: string;
  label: string;
  timestamp: number;
}

export function saveCameraPreference(deviceId: string, label: string = ""): void {
  if (typeof window === "undefined") return;
  const pref: CameraPreference = {
    deviceId,
    label,
    timestamp: Date.now(),
  };
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pref));
  } catch (e) {
    console.error("Failed to save camera preference:", e);
  }
}

export function getCameraPreference(): CameraPreference | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CameraPreference;
  } catch {
    return null;
  }
}

export function clearCameraPreference(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("Failed to clear camera preference:", e);
  }
}
