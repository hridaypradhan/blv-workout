import { describe, test, expect, beforeEach, vi } from "vitest";
import {
  saveCameraPreference,
  getCameraPreference,
  clearCameraPreference,
} from "../cameraPreference";

describe("cameraPreference helper", () => {
  beforeEach(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.clear();
    }
  });

  test("saves and retrieves camera preference successfully", () => {
    saveCameraPreference("test-device-id", "Test External Camera");
    const pref = getCameraPreference();
    expect(pref).not.toBeNull();
    expect(pref?.deviceId).toBe("test-device-id");
    expect(pref?.label).toBe("Test External Camera");
    expect(pref?.timestamp).toBeLessThanOrEqual(Date.now());
  });

  test("returns null if no preference is saved", () => {
    const pref = getCameraPreference();
    expect(pref).toBeNull();
  });

  test("clears camera preference successfully", () => {
    saveCameraPreference("test-device-id", "Test External Camera");
    clearCameraPreference();
    const pref = getCameraPreference();
    expect(pref).toBeNull();
  });

  test("handles JSON parsing errors gracefully", () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("fita11y_preferred_camera", "invalid-json");
    }
    const pref = getCameraPreference();
    expect(pref).toBeNull();
  });

  test("does not throw if sessionStorage is unavailable", () => {
    // Temporarily break setItem
    vi.spyOn(window.sessionStorage, "setItem").mockImplementation(() => {
      throw new Error("Quota exceeded");
    });

    expect(() => {
      saveCameraPreference("device", "label");
    }).not.toThrow();

    vi.restoreAllMocks();
  });
});
