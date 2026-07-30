/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
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

  const mockMediaPipeRuntime: any = {
    isReady: true,
    runtimeStatus: "active",
    poseAvailable: true,
    requiredLandmarksVisible: true,
    landmarkConfidence: 0.9,
    poseStatusDetails: { guidance: "Aligned" },
  };

  const mockPauseCoordinator = {
    requestPause: mockRequestPause,
    releasePause: mockReleasePause,
  };

  const currentExercise = {
    id: "ex-1",
    name: "Barbell Squat",
    start_time_seconds: 15,
    end_time_seconds: 45,
    counting_joint: "knee",
  };

  const manifest = {
    exercise_timeline_anchors: [currentExercise],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCameraStream.stream = {} as MediaStream;
    mockCameraStream.status = "ready";
    mockMediaPipeRuntime.isReady = true;
    mockMediaPipeRuntime.runtimeStatus = "active";
    mockMediaPipeRuntime.poseAvailable = true;
    mockMediaPipeRuntime.requiredLandmarksVisible = true;
  });

  test("skip camera alignment prevents same exercise reopening", () => {
    const { result, rerender } = renderHook(
      (props) => useLivePositioningGate(props),
      {
        initialProps: {
          isReady: true,
          manifest,
          currentExercise: null as any,
          currentTime: 0,
          currentTimeMs: 0,
          cameraStream: mockCameraStream,
          mediaPipePoseRuntime: mockMediaPipeRuntime,
          pauseCoordinator: mockPauseCoordinator,
          logSessionEvent: mockLogSessionEvent,
          announce: mockAnnounce,
          handleSeek: mockHandleSeek,
        },
      }
    );

    // Initial pre-workout gate is open
    expect(result.current.isLiveGateOpen).toBe(true);

    // Skip pre-workout gate
    act(() => {
      result.current.handleSkipLiveGate();
    });

    expect(result.current.isLiveGateOpen).toBe(false);

    // Transition to exercise -> pre-exercise gate opens
    rerender({
      isReady: true,
      manifest,
      currentExercise,
      currentTime: 15,
      currentTimeMs: 15000,
      cameraStream: mockCameraStream,
      mediaPipePoseRuntime: mockMediaPipeRuntime,
      pauseCoordinator: mockPauseCoordinator,
      logSessionEvent: mockLogSessionEvent,
      announce: mockAnnounce,
      handleSeek: mockHandleSeek,
    });

    expect(result.current.isLiveGateOpen).toBe(true);

    // Skip exercise gate
    act(() => {
      result.current.handleSkipLiveGate();
    });

    expect(result.current.isLiveGateOpen).toBe(false);

    // Rerender within same exercise -> gate should NOT reopen
    rerender({
      isReady: true,
      manifest,
      currentExercise,
      currentTime: 20,
      currentTimeMs: 20000,
      cameraStream: mockCameraStream,
      mediaPipePoseRuntime: mockMediaPipeRuntime,
      pauseCoordinator: mockPauseCoordinator,
      logSessionEvent: mockLogSessionEvent,
      announce: mockAnnounce,
      handleSeek: mockHandleSeek,
    });

    expect(result.current.isLiveGateOpen).toBe(false);
  });

  test("camera unavailable does NOT open hard gate on transition", () => {
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
          mediaPipePoseRuntime: mockMediaPipeRuntime,
          pauseCoordinator: mockPauseCoordinator,
          logSessionEvent: mockLogSessionEvent,
          announce: mockAnnounce,
          handleSeek: mockHandleSeek,
        },
      }
    );

    // Mark pre-workout complete
    act(() => {
      result.current.alignmentPolicy.markPreWorkoutHandled("completed");
    });

    // Should NOT open hard gate modal
    expect(result.current.isLiveGateOpen).toBe(false);
    expect(result.current.isSoftFallback).toBe(true);
  });

  test("explicit retry alignment reopens gate manually", () => {
    const { result } = renderHook(
      (props) => useLivePositioningGate(props),
      {
        initialProps: {
          isReady: true,
          manifest,
          currentExercise: null as any,
          currentTime: 0,
          currentTimeMs: 0,
          cameraStream: mockCameraStream,
          mediaPipePoseRuntime: mockMediaPipeRuntime,
          pauseCoordinator: mockPauseCoordinator,
          logSessionEvent: mockLogSessionEvent,
          announce: mockAnnounce,
          handleSeek: mockHandleSeek,
        },
      }
    );

    expect(result.current.isLiveGateOpen).toBe(true);

    // User skips pre-workout
    act(() => {
      result.current.handleSkipLiveGate();
    });
    expect(result.current.isLiveGateOpen).toBe(false);
    mockLogSessionEvent.mockClear();

    // User triggers manual retry alignment
    act(() => {
      result.current.handleRetryAlignment();
    });

    // Should explicitly open the gate
    expect(result.current.isLiveGateOpen).toBe(true);
    expect(mockLogSessionEvent).toHaveBeenCalledTimes(1);
    expect(mockLogSessionEvent).toHaveBeenCalledWith(
      SESSION_EVENTS.POSITIONING_GATE_OPENED,
      expect.any(Number),
      expect.objectContaining({ trigger: "user_retry_alignment" })
    );
    expect(mockRequestPause).toHaveBeenCalledWith("positioning_gate", expect.stringContaining("Camera gate opened"));
    expect(mockRequestCamera).toHaveBeenCalledWith("device-1", true);
  });

  test("camera gates disabled for session prevents future gates", () => {
    const { result, rerender } = renderHook(
      (props) => useLivePositioningGate(props),
      {
        initialProps: {
          isReady: true,
          manifest,
          currentExercise: null as any,
          currentTime: 0,
          currentTimeMs: 0,
          cameraStream: mockCameraStream,
          mediaPipePoseRuntime: mockMediaPipeRuntime,
          pauseCoordinator: mockPauseCoordinator,
          logSessionEvent: mockLogSessionEvent,
          announce: mockAnnounce,
          handleSeek: mockHandleSeek,
        },
      }
    );

    expect(result.current.isLiveGateOpen).toBe(true);
    mockLogSessionEvent.mockClear();

    // Disable gates for session
    act(() => {
      result.current.handleDisableCameraGates();
    });

    expect(result.current.isLiveGateOpen).toBe(false);
    expect(result.current.cameraGatesDisabled).toBe(true);
    expect(mockStopCamera).toHaveBeenCalled();
    expect(mockLogSessionEvent).not.toHaveBeenCalledWith(
      SESSION_EVENTS.CAMERA_DISABLED_FOR_SESSION,
      expect.any(Number),
      expect.any(Object)
    );

    const nextExercise = {
      id: "ex-2",
      name: "Barbell Squat",
      start_time_seconds: 50,
      end_time_seconds: 80,
      counting_joint: "knee",
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
      mediaPipePoseRuntime: mockMediaPipeRuntime,
      pauseCoordinator: mockPauseCoordinator,
      logSessionEvent: mockLogSessionEvent,
      announce: mockAnnounce,
      handleSeek: mockHandleSeek,
    });

    // Gate should NOT open for the new exercise
    expect(result.current.isLiveGateOpen).toBe(false);
  });
});
