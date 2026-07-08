import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCameraStream, useCameraLifecycleCleanup } from "../useCameraStream";
import { saveCameraPreference } from "@/lib/camera/cameraPreference";

vi.mock("next/navigation", () => ({
  usePathname: () => "/current-path",
}));

describe("useCameraStream", () => {
  let originalMediaDevices: MediaDevices | undefined;

  beforeEach(() => {
    if (typeof window !== "undefined") {
      originalMediaDevices = navigator.mediaDevices;
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (typeof window !== "undefined") {
      if (originalMediaDevices) {
        Object.defineProperty(navigator, "mediaDevices", {
          writable: true,
          configurable: true,
          value: originalMediaDevices,
        });
      } else {
        Object.defineProperty(navigator, "mediaDevices", {
          writable: true,
          configurable: true,
          value: undefined,
        });
      }
    }
  });

  test("handles unsupported browser when navigator.mediaDevices is missing", async () => {
    if (typeof window !== "undefined") {
      Object.defineProperty(navigator, "mediaDevices", {
        writable: true,
        configurable: true,
        value: undefined,
      });
    }

    const { result } = renderHook(() => useCameraStream({ autoEnumerate: false }));

    expect(result.current.status).toBe("idle");

    await act(async () => {
      await result.current.requestCamera();
    });

    expect(result.current.status).toBe("unsupported");
    expect(result.current.errorMessage).toBe("Camera access is not supported by your browser.");
  });

  test("successfully requests camera permission and returns stream", async () => {
    const mockTrack = {
      stop: vi.fn(),
      getSettings: () => ({ deviceId: "cam-1" }),
    };
    const mockStream = {
      getTracks: () => [mockTrack],
      getVideoTracks: () => [mockTrack],
    };

    const mockGetUserMedia = vi.fn().mockResolvedValue(mockStream);
    const mockEnumerateDevices = vi.fn().mockResolvedValue([
      { kind: "videoinput", deviceId: "cam-1", label: "Front Camera" },
    ]);

    if (typeof window !== "undefined") {
      Object.defineProperty(navigator, "mediaDevices", {
        writable: true,
        configurable: true,
        value: {
          getUserMedia: mockGetUserMedia,
          enumerateDevices: mockEnumerateDevices,
        },
      });
    }

    const { result } = renderHook(() => useCameraStream({ autoEnumerate: false }));

    expect(result.current.status).toBe("idle");

    await act(async () => {
      await result.current.requestCamera();
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.stream).toBe(mockStream);
    expect(result.current.selectedDeviceId).toBe("cam-1");
    expect(mockGetUserMedia).toHaveBeenCalled();
  });

  test("handles permission denied error", async () => {
    const error = new Error("Permission denied");
    error.name = "NotAllowedError";
    const mockGetUserMedia = vi.fn().mockRejectedValue(error);
    const mockEnumerateDevices = vi.fn().mockResolvedValue([]);

    if (typeof window !== "undefined") {
      Object.defineProperty(navigator, "mediaDevices", {
        writable: true,
        configurable: true,
        value: {
          getUserMedia: mockGetUserMedia,
          enumerateDevices: mockEnumerateDevices,
        },
      });
    }

    const { result } = renderHook(() => useCameraStream({ autoEnumerate: false }));

    await act(async () => {
      await result.current.requestCamera();
    });

    expect(result.current.status).toBe("permission_denied");
    expect(result.current.errorMessage).toContain("permission was denied");
  });

  test("handles camera not found error", async () => {
    const error = new Error("Not found");
    error.name = "NotFoundError";
    const mockGetUserMedia = vi.fn().mockRejectedValue(error);
    const mockEnumerateDevices = vi.fn().mockResolvedValue([]);

    if (typeof window !== "undefined") {
      Object.defineProperty(navigator, "mediaDevices", {
        writable: true,
        configurable: true,
        value: {
          getUserMedia: mockGetUserMedia,
          enumerateDevices: mockEnumerateDevices,
        },
      });
    }

    const { result } = renderHook(() => useCameraStream({ autoEnumerate: false }));

    await act(async () => {
      await result.current.requestCamera();
    });

    expect(result.current.status).toBe("not_found");
    expect(result.current.errorMessage).toContain("No camera device found");
  });

  test("stops tracks when stopCamera is called", async () => {
    const mockTrack = {
      stop: vi.fn(),
      getSettings: () => ({ deviceId: "cam-1" }),
    };
    const mockStream = {
      getTracks: () => [mockTrack],
      getVideoTracks: () => [mockTrack],
    };

    const mockGetUserMedia = vi.fn().mockResolvedValue(mockStream);
    const mockEnumerateDevices = vi.fn().mockResolvedValue([]);

    if (typeof window !== "undefined") {
      Object.defineProperty(navigator, "mediaDevices", {
        writable: true,
        configurable: true,
        value: {
          getUserMedia: mockGetUserMedia,
          enumerateDevices: mockEnumerateDevices,
        },
      });
    }

    const { result } = renderHook(() => useCameraStream({ autoEnumerate: false }));

    await act(async () => {
      await result.current.requestCamera();
    });

    expect(result.current.status).toBe("ready");

    act(() => {
      result.current.stopCamera();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.stream).toBeNull();
    expect(mockTrack.stop).toHaveBeenCalled();
  });

  test("stops tracks on unmount", async () => {
    const mockTrack = { stop: vi.fn(), getSettings: () => ({ deviceId: "cam-1" }) };
    const mockStream = { getTracks: () => [mockTrack], getVideoTracks: () => [mockTrack] };
    const mockGetUserMedia = vi.fn().mockResolvedValue(mockStream);

    if (typeof window !== "undefined") {
      Object.defineProperty(navigator, "mediaDevices", {
        writable: true,
        configurable: true,
        value: {
          getUserMedia: mockGetUserMedia,
          enumerateDevices: vi.fn().mockResolvedValue([]),
        },
      });
    }

    const { result, unmount } = renderHook(() => useCameraStream({ autoEnumerate: false }));

    await act(async () => {
      await result.current.requestCamera();
    });

    expect(result.current.status).toBe("ready");

    unmount();

    expect(mockTrack.stop).toHaveBeenCalled();
  });

  test("cleans up old stream when switching camera devices", async () => {
    const track1 = { stop: vi.fn(), getSettings: () => ({ deviceId: "cam-1" }) };
    const stream1 = { getTracks: () => [track1], getVideoTracks: () => [track1] };

    const track2 = { stop: vi.fn(), getSettings: () => ({ deviceId: "cam-2" }) };
    const stream2 = { getTracks: () => [track2], getVideoTracks: () => [track2] };

    const mockGetUserMedia = vi.fn()
      .mockResolvedValueOnce(stream1)
      .mockResolvedValueOnce(stream2);

    if (typeof window !== "undefined") {
      Object.defineProperty(navigator, "mediaDevices", {
        writable: true,
        configurable: true,
        value: {
          getUserMedia: mockGetUserMedia,
          enumerateDevices: vi.fn().mockResolvedValue([]),
        },
      });
    }

    const { result } = renderHook(() => useCameraStream({ autoEnumerate: false }));

    await act(async () => {
      await result.current.requestCamera("cam-1");
    });
    expect(result.current.selectedDeviceId).toBe("cam-1");

    await act(async () => {
      await result.current.requestCamera("cam-2");
    });
    expect(result.current.selectedDeviceId).toBe("cam-2");

    expect(track1.stop).toHaveBeenCalled();
  });

  test("handles repeated stopCamera calls without throwing and remains idle", async () => {
    const mockTrack = { stop: vi.fn(), getSettings: () => ({ deviceId: "cam-1" }) };
    const mockStream = { getTracks: () => [mockTrack], getVideoTracks: () => [mockTrack] };
    const mockGetUserMedia = vi.fn().mockResolvedValue(mockStream);

    if (typeof window !== "undefined") {
      Object.defineProperty(navigator, "mediaDevices", {
        writable: true,
        configurable: true,
        value: {
          getUserMedia: mockGetUserMedia,
          enumerateDevices: vi.fn().mockResolvedValue([]),
        },
      });
    }

    const { result } = renderHook(() => useCameraStream({ autoEnumerate: false }));

    await act(async () => {
      await result.current.requestCamera();
    });

    act(() => {
      expect(() => result.current.stopCamera()).not.toThrow();
    });
    act(() => {
      expect(() => result.current.stopCamera()).not.toThrow();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.stream).toBeNull();
  });

  describe("useCameraLifecycleCleanup", () => {
    test("stops active streams on beforeunload, navigation-start, and cleanup unmount", async () => {
      const mockTrack = { stop: vi.fn(), readyState: "live", getSettings: () => ({ deviceId: "cam-1" }) };
      const mockStream = { getTracks: () => [mockTrack], getVideoTracks: () => [mockTrack] };
      const mockGetUserMedia = vi.fn().mockResolvedValue(mockStream);

      if (typeof window !== "undefined") {
        Object.defineProperty(navigator, "mediaDevices", {
          writable: true,
          configurable: true,
          value: {
            getUserMedia: mockGetUserMedia,
            enumerateDevices: vi.fn().mockResolvedValue([]),
          },
        });
      }

      // 1. request a stream so it is registered as active
      const { result: streamHook } = renderHook(() => useCameraStream({ autoEnumerate: false }));
      await act(async () => {
        await streamHook.current.requestCamera();
      });

      // 2. render lifecycle cleanup hook
      const { unmount } = renderHook(() => useCameraLifecycleCleanup());

      // 3. dispatch navigation-start event
      const navEvent = new Event("navigation-start");
      window.dispatchEvent(navEvent);

      expect(mockTrack.stop).toHaveBeenCalled();
      mockTrack.stop.mockClear();

      // 4. Request camera again to register another active stream
      await act(async () => {
        await streamHook.current.requestCamera();
      });

      // 5. dispatch beforeunload event
      const beforeunloadEvent = new Event("beforeunload");
      window.dispatchEvent(beforeunloadEvent);

      expect(mockTrack.stop).toHaveBeenCalled();
      mockTrack.stop.mockClear();

      // 6. Request camera again to register another active stream
      await act(async () => {
        await streamHook.current.requestCamera();
      });

      // 7. Unmount the hook
      unmount();
      expect(mockTrack.stop).toHaveBeenCalled();
    });
  });

  describe("preferred camera fallback sequence", () => {
    beforeEach(() => {
      if (typeof window !== "undefined") {
        window.sessionStorage.clear();
      }
    });

    test("matches exact deviceId when preferred camera is found", async () => {
      const mockTrack = {
        stop: vi.fn(),
        getSettings: () => ({ deviceId: "pref-external" }),
        label: "Preferred Logitech Webcam",
      };
      const mockStream = {
        getTracks: () => [mockTrack],
        getVideoTracks: () => [mockTrack],
      };

      const mockGetUserMedia = vi.fn().mockImplementation((constraints) => {
        if (constraints.video?.deviceId?.exact === "pref-external") {
          return Promise.resolve(mockStream);
        }
        return Promise.reject(new Error("Device not found"));
      });

      const mockEnumerateDevices = vi.fn().mockResolvedValue([
        { kind: "videoinput", deviceId: "pref-external", label: "Preferred Logitech Webcam" },
        { kind: "videoinput", deviceId: "internal-cam", label: "FaceTime HD Camera (Built-in)" },
      ]);

      if (typeof window !== "undefined") {
        Object.defineProperty(navigator, "mediaDevices", {
          writable: true,
          configurable: true,
          value: {
            getUserMedia: mockGetUserMedia,
            enumerateDevices: mockEnumerateDevices,
          },
        });
      }

      const { result } = renderHook(() => useCameraStream({ autoEnumerate: false }));

      // Save preference beforehand
      saveCameraPreference("pref-external", "Preferred Logitech Webcam");

      await act(async () => {
        await result.current.requestCamera();
      });

      expect(result.current.status).toBe("ready");
      expect(result.current.selectedDeviceId).toBe("pref-external");
    });

    test("falls back to another external webcam if preferred camera is unavailable", async () => {
      const mockTrack = {
        stop: vi.fn(),
        getSettings: () => ({ deviceId: "other-external" }),
        label: "Other Logitech Webcam",
      };
      const mockStream = {
        getTracks: () => [mockTrack],
        getVideoTracks: () => [mockTrack],
      };

      const mockGetUserMedia = vi.fn().mockImplementation((constraints) => {
        // Preferred fails, other external succeeds
        if (constraints.video?.deviceId?.exact === "pref-external") {
          return Promise.reject(new Error("Device offline"));
        }
        if (constraints.video?.deviceId?.exact === "other-external") {
          return Promise.resolve(mockStream);
        }
        return Promise.reject(new Error("Device not found"));
      });

      const mockEnumerateDevices = vi.fn().mockResolvedValue([
        { kind: "videoinput", deviceId: "pref-external", label: "Preferred Logitech Webcam" },
        { kind: "videoinput", deviceId: "other-external", label: "Other Logitech Webcam" },
        { kind: "videoinput", deviceId: "internal-cam", label: "Built-in FaceTime Camera" },
      ]);

      if (typeof window !== "undefined") {
        Object.defineProperty(navigator, "mediaDevices", {
          writable: true,
          configurable: true,
          value: {
            getUserMedia: mockGetUserMedia,
            enumerateDevices: mockEnumerateDevices,
          },
        });
      }

      const { result } = renderHook(() => useCameraStream({ autoEnumerate: false }));

      // Save preference beforehand
      saveCameraPreference("pref-external", "Preferred Logitech Webcam");

      await act(async () => {
        await result.current.requestCamera();
      });

      expect(result.current.status).toBe("ready");
      expect(result.current.selectedDeviceId).toBe("pref-external");
      expect(result.current.activeDeviceId).toBe("other-external");
    });

    test("falls back to integrated camera when external cameras are offline", async () => {
      const mockTrack = {
        stop: vi.fn(),
        getSettings: () => ({ deviceId: "internal-cam" }),
        label: "Built-in FaceTime Camera",
      };
      const mockStream = {
        getTracks: () => [mockTrack],
        getVideoTracks: () => [mockTrack],
      };

      const mockGetUserMedia = vi.fn().mockImplementation((constraints) => {
        if (constraints.video?.deviceId?.exact === "internal-cam") {
          return Promise.resolve(mockStream);
        }
        return Promise.reject(new Error("Device offline"));
      });

      const mockEnumerateDevices = vi.fn().mockResolvedValue([
        { kind: "videoinput", deviceId: "pref-external", label: "Preferred Logitech Webcam" },
        { kind: "videoinput", deviceId: "internal-cam", label: "Built-in FaceTime Camera" },
      ]);

      if (typeof window !== "undefined") {
        Object.defineProperty(navigator, "mediaDevices", {
          writable: true,
          configurable: true,
          value: {
            getUserMedia: mockGetUserMedia,
            enumerateDevices: mockEnumerateDevices,
          },
        });
      }

      const { result } = renderHook(() => useCameraStream({ autoEnumerate: false }));

      // Save preference beforehand
      saveCameraPreference("pref-external", "Preferred Logitech Webcam");

      await act(async () => {
        await result.current.requestCamera();
      });

      expect(result.current.status).toBe("ready");
      expect(result.current.selectedDeviceId).toBe("pref-external");
      expect(result.current.activeDeviceId).toBe("internal-cam");
    });

    test("explicit camera selection failure does not silently overwrite selection and retry selected works", async () => {
      const mockTrack = {
        stop: vi.fn(),
        getSettings: () => ({ deviceId: "pref-external" }),
        label: "Preferred Logitech Webcam",
      };
      const mockStream = {
        getTracks: () => [mockTrack],
        getVideoTracks: () => [mockTrack],
      };

      const mockGetUserMedia = vi.fn().mockImplementation((constraints) => {
        if (constraints.video?.deviceId?.exact === "pref-external") {
          return Promise.reject(new Error("Device hardware failed"));
        }
        return Promise.resolve(mockStream);
      });

      const mockEnumerateDevices = vi.fn().mockResolvedValue([
        { kind: "videoinput", deviceId: "pref-external", label: "Preferred Logitech Webcam" },
        { kind: "videoinput", deviceId: "internal-cam", label: "Built-in FaceTime Camera" },
      ]);

      if (typeof window !== "undefined") {
        Object.defineProperty(navigator, "mediaDevices", {
          writable: true,
          configurable: true,
          value: {
            getUserMedia: mockGetUserMedia,
            enumerateDevices: mockEnumerateDevices,
          },
        });
      }

      const { result } = renderHook(() => useCameraStream({ autoEnumerate: false }));

      // Explicit selected camera request
      await act(async () => {
        await result.current.requestCamera("pref-external", true);
      });

      // Should fail explicitly instead of silently falling back
      expect(result.current.status).toBe("error");
      expect(result.current.selectedDeviceId).toBe("pref-external");
      expect(result.current.activeDeviceId).toBe("");
      expect(result.current.errorMessage).toContain("failed to start");

      // Now update mock to succeed and retry
      mockGetUserMedia.mockImplementation((constraints) => {
        if (constraints.video?.deviceId?.exact === "pref-external") {
          return Promise.resolve(mockStream);
        }
        return Promise.reject(new Error("Device not found"));
      });

      await act(async () => {
        await result.current.requestCamera(result.current.selectedDeviceId, true);
      });

      // Should succeed now
      expect(result.current.status).toBe("ready");
      expect(result.current.selectedDeviceId).toBe("pref-external");
      expect(result.current.activeDeviceId).toBe("pref-external");
    });
  });
});
