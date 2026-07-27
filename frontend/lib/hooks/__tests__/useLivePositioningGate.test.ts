import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLivePositioningGate } from "../useLivePositioningGate";
import { SESSION_EVENTS } from "@/lib/sessionEvents";

describe("useLivePositioningGate hook", () => {
  const mockLogSessionEvent = vi.fn();
  const mockAnnounce = vi.fn();
  const mockHandleSeek = vi.fn();
  const mockRequestCamera = vi.fn().mockResolvedValue(undefined);
  const mockStopCamera = vi.fn();
  const mockRequestPause = vi.fn();
  const mockReleasePause = vi.fn();

  const mockCameraStream = {
    stream: {} as MediaStream | null,
    status: "ready",
    requestCamera: mockRequestCamera,
    stopCamera: mockStopCamera,
    selectedDeviceId: "device-1",
  };

  const mockPauseCoordinator = {
    requestPause: mockRequestPause,
    releasePause: mockReleasePause,
  };

  const currentExercise = {
    id: "ex-1",
    name: "Pushups",
    start_time_seconds: 15,
    end_time_seconds: 45,
  };

  const manifest = {
    exercise_timeline_anchors: [currentExercise],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCameraStream.stream = {} as MediaStream;
    mockCameraStream.status = "ready";
  });

  test("skip camera alignment prevents same exercise reopening", () => {
    const { result, rerender } = renderHook(
      (props) => useLivePositioningGate(props),
      {
        initialProps: {
          isReady: true,
          manifest,
          currentExercise,
          currentTime: 10,
          currentTimeMs: 10000,
          cameraStream: mockCameraStream,
          pauseCoordinator: mockPauseCoordinator,
          logSessionEvent: mockLogSessionEvent,
          announce: mockAnnounce,
          handleSeek: mockHandleSeek,
        },
      }
    );

    // Initial state: gate should be open since camera is ready
    expect(result.current.isLiveGateOpen).toBe(true);
    expect(result.current.liveGateExerciseName).toBe("Pushups");

    // Skip the gate
    act(() => {
      result.current.handleSkipLiveGate();
    });

    expect(result.current.isLiveGateOpen).toBe(false);
    expect(mockReleasePause).toHaveBeenCalledWith("positioning_gate", "Gate skipped by user");

    // Rerender within same exercise -> gate should NOT reopen
    rerender({
      isReady: true,
      manifest,
      currentExercise,
      currentTime: 20,
      currentTimeMs: 20000,
      cameraStream: mockCameraStream,
      pauseCoordinator: mockPauseCoordinator,
      logSessionEvent: mockLogSessionEvent,
      announce: mockAnnounce,
      handleSeek: mockHandleSeek,
    });

    expect(result.current.isLiveGateOpen).toBe(false);
  });

  test("camera unavailable does NOT open hard gate on transition", () => {
    // Set camera to unavailable/not ready
    mockCameraStream.status = "requesting";
    mockCameraStream.stream = null;

    const { result } = renderHook(
      (props) => useLivePositioningGate(props),
      {
        initialProps: {
          isReady: true,
          manifest,
          currentExercise,
          currentTime: 12,
          currentTimeMs: 12000,
          cameraStream: mockCameraStream,
          pauseCoordinator: mockPauseCoordinator,
          logSessionEvent: mockLogSessionEvent,
          announce: mockAnnounce,
          handleSeek: mockHandleSeek,
        },
      }
    );

    // Should NOT open hard gate modal
    expect(result.current.isLiveGateOpen).toBe(false);
    expect(result.current.exerciseGateStates["ex-1"]).toBe("skipped_camera");

    // Verify soft skip logging
    expect(mockLogSessionEvent).toHaveBeenCalledWith(
      SESSION_EVENTS.POSITIONING_GATE_SOFT_SKIPPED,
      12000,
      expect.objectContaining({
        exerciseName: "Pushups",
        reason: "camera_not_ready",
      })
    );
  });

  test("explicit retry alignment reopens gate manually", () => {
    // Start with camera ready -> gate opens automatically
    const { result } = renderHook(
      (props) => useLivePositioningGate(props),
      {
        initialProps: {
          isReady: true,
          manifest,
          currentExercise,
          currentTime: 10,
          currentTimeMs: 10000,
          cameraStream: mockCameraStream,
          pauseCoordinator: mockPauseCoordinator,
          logSessionEvent: mockLogSessionEvent,
          announce: mockAnnounce,
          handleSeek: mockHandleSeek,
        },
      }
    );

    expect(result.current.isLiveGateOpen).toBe(true);

    // User skips
    act(() => {
      result.current.handleSkipLiveGate();
    });
    expect(result.current.isLiveGateOpen).toBe(false);

    // User triggers manual retry alignment
    act(() => {
      result.current.handleRetryAlignment();
    });

    // Should explicitly open the gate
    expect(result.current.isLiveGateOpen).toBe(true);
    expect(mockRequestPause).toHaveBeenCalledWith("positioning_gate", expect.stringContaining("manually opened"));
    expect(mockRequestCamera).toHaveBeenCalledWith("device-1", true); // explicit request!
  });

  test("camera gates disabled for session prevents future gates", () => {
    const { result, rerender } = renderHook(
      (props) => useLivePositioningGate(props),
      {
        initialProps: {
          isReady: true,
          manifest,
          currentExercise,
          currentTime: 10,
          currentTimeMs: 10000,
          cameraStream: mockCameraStream,
          pauseCoordinator: mockPauseCoordinator,
          logSessionEvent: mockLogSessionEvent,
          announce: mockAnnounce,
          handleSeek: mockHandleSeek,
        },
      }
    );

    expect(result.current.isLiveGateOpen).toBe(true);

    // Disable gates for session
    act(() => {
      result.current.handleDisableCameraGates();
    });

    expect(result.current.isLiveGateOpen).toBe(false);
    expect(result.current.cameraGatesDisabled).toBe(true);
    expect(mockStopCamera).toHaveBeenCalled();

    // Move to next exercise
    const nextExercise = {
      id: "ex-2",
      name: "Squats",
      start_time_seconds: 50,
      end_time_seconds: 80,
    };
    const updatedManifest = {
      exercise_timeline_anchors: [currentExercise, nextExercise],
    };

    rerender({
      isReady: true,
      manifest: updatedManifest,
      currentExercise: nextExercise,
      currentTime: 52,
      currentTimeMs: 52000,
      cameraStream: mockCameraStream,
      pauseCoordinator: mockPauseCoordinator,
      logSessionEvent: mockLogSessionEvent,
      announce: mockAnnounce,
      handleSeek: mockHandleSeek,
    });

    // Gate should NOT open for the new exercise
    expect(result.current.isLiveGateOpen).toBe(false);
  });
});
