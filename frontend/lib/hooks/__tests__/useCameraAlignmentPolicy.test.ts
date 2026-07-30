/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { renderHook, act } from "@testing-library/react";
import { useCameraAlignmentPolicy } from "../useCameraAlignmentPolicy";

describe("useCameraAlignmentPolicy", () => {
  const mockManifest = {
    exercise_timeline_anchors: [
      {
        id: "ex-1",
        name: "Barbell Squat",
        start_time_seconds: 10,
        end_time_seconds: 40,
        counting_joint: "knee",
      },
      {
        id: "ex-2",
        name: "Rest Period",
        start_time_seconds: 40,
        end_time_seconds: 50,
      },
    ],
  };

  const supportedExercise = {
    id: "ex-1",
    name: "Barbell Squat",
    start_time_seconds: 10,
    end_time_seconds: 40,
    counting_joint: "knee",
  };

  const unsupportedExercise = {
    id: "ex-2",
    name: "Plank Hold",
    start_time_seconds: 40,
    end_time_seconds: 50,
  };

  test("pre-workout checkpoint opens once when session is ready and camera is available", () => {
    const { result } = renderHook(() =>
      useCameraAlignmentPolicy({
        isReady: true,
        manifest: mockManifest,
        currentExercise: null,
        currentTime: 0,
        currentTimeMs: 0,
        cameraStreamStatus: "ready",
        mediaPipeRuntimeStatus: "active",
        poseAvailable: true,
        requiredLandmarksVisible: true,
        landmarkConfidence: 0.9,
        cameraGatesDisabled: false,
      })
    );

    expect(result.current.gateType).toBe("pre_workout");
    expect(result.current.shouldOpenHardGate).toBe(true);
    expect(result.current.policyState).toBe("pre_workout_required");
  });

  test("pre-exercise checkpoint opens once for supported exercise after pre-workout is handled", () => {
    const { result, rerender } = renderHook(
      ({ currentExercise, currentTime }) =>
        useCameraAlignmentPolicy({
          isReady: true,
          manifest: mockManifest,
          currentExercise,
          currentTime,
          currentTimeMs: currentTime * 1000,
          cameraStreamStatus: "ready",
          mediaPipeRuntimeStatus: "active",
          poseAvailable: true,
          requiredLandmarksVisible: true,
          landmarkConfidence: 0.9,
          cameraGatesDisabled: false,
        }),
      {
        initialProps: {
          currentExercise: null as any,
          currentTime: 0,
        },
      }
    );

    // Complete pre-workout
    act(() => {
      result.current.markPreWorkoutHandled("completed");
    });

    // Move into supported exercise
    rerender({
      currentExercise: supportedExercise,
      currentTime: 12,
    });

    expect(result.current.gateType).toBe("pre_exercise");
    expect(result.current.shouldOpenHardGate).toBe(true);
    expect(result.current.policyState).toBe("pre_exercise_required");

    // Complete exercise checkpoint
    act(() => {
      result.current.markExerciseCheckpointHandled("ex-1", "completed");
    });

    expect(result.current.shouldOpenHardGate).toBe(false);
    expect(result.current.policyState).toBe("aligned");
  });

  test("unsupported exercise uses soft fallback without hard gate", () => {
    const { result } = renderHook(() =>
      useCameraAlignmentPolicy({
        isReady: true,
        manifest: mockManifest,
        currentExercise: unsupportedExercise,
        currentTime: 42,
        currentTimeMs: 42000,
        cameraStreamStatus: "ready",
        mediaPipeRuntimeStatus: "active",
        poseAvailable: false,
        requiredLandmarksVisible: false,
        landmarkConfidence: 0,
        cameraGatesDisabled: false,
      })
    );

    // Pre-workout handled check
    act(() => {
      result.current.markPreWorkoutHandled("completed");
    });

    expect(result.current.shouldOpenHardGate).toBe(false);
    expect(result.current.isSoftFallback).toBe(true);
    expect(result.current.policyState).toBe("fallback_active");
  });

  test("camera unavailable during pre-exercise checkpoint soft-fallbacks without hard gate", () => {
    const { result } = renderHook(() =>
      useCameraAlignmentPolicy({
        isReady: true,
        manifest: mockManifest,
        currentExercise: supportedExercise,
        currentTime: 12,
        currentTimeMs: 12000,
        cameraStreamStatus: "error",
        mediaPipeRuntimeStatus: "offline",
        poseAvailable: false,
        requiredLandmarksVisible: false,
        landmarkConfidence: 0,
        cameraGatesDisabled: false,
      })
    );

    act(() => {
      result.current.markPreWorkoutHandled("completed");
    });

    expect(result.current.shouldOpenHardGate).toBe(false);
    expect(result.current.isSoftFallback).toBe(true);
    expect(result.current.policyState).toBe("fallback_active");
  });

  test("brief pose loss (<2s) does not open gate", () => {
    const { result, rerender } = renderHook(
      ({ currentTimeMs, requiredLandmarksVisible }) =>
        useCameraAlignmentPolicy({
          isReady: true,
          manifest: mockManifest,
          currentExercise: supportedExercise,
          currentTime: 15,
          currentTimeMs,
          cameraStreamStatus: "ready",
          mediaPipeRuntimeStatus: "active",
          poseAvailable: requiredLandmarksVisible,
          requiredLandmarksVisible,
          landmarkConfidence: requiredLandmarksVisible ? 0.9 : 0.2,
          cameraGatesDisabled: false,
        }),
      {
        initialProps: {
          currentTimeMs: 15000,
          requiredLandmarksVisible: true,
        },
      }
    );

    act(() => {
      result.current.markPreWorkoutHandled("completed");
      result.current.markExerciseCheckpointHandled("ex-1", "completed");
    });

    expect(result.current.policyState).toBe("aligned");

    // Pose dips for 1.5 seconds
    rerender({
      currentTimeMs: 16500,
      requiredLandmarksVisible: false,
    });

    expect(result.current.shouldOpenHardGate).toBe(false);
    expect(result.current.policyState).toBe("monitoring");
  });

  test("low confidence loss (3-5s) shows low_confidence_warning status without hard gate", () => {
    const { result, rerender } = renderHook(
      ({ currentTimeMs, requiredLandmarksVisible }) =>
        useCameraAlignmentPolicy({
          isReady: true,
          manifest: mockManifest,
          currentExercise: supportedExercise,
          currentTime: 15,
          currentTimeMs,
          cameraStreamStatus: "ready",
          mediaPipeRuntimeStatus: "active",
          poseAvailable: true,
          requiredLandmarksVisible,
          landmarkConfidence: requiredLandmarksVisible ? 0.9 : 0.3,
          cameraGatesDisabled: false,
        }),
      {
        initialProps: {
          currentTimeMs: 15000,
          requiredLandmarksVisible: true,
        },
      }
    );

    act(() => {
      result.current.markPreWorkoutHandled("completed");
      result.current.markExerciseCheckpointHandled("ex-1", "completed");
    });

    // Start loss
    rerender({ currentTimeMs: 16000, requiredLandmarksVisible: false });
    // Advance 3.5s
    rerender({ currentTimeMs: 19500, requiredLandmarksVisible: false });

    expect(result.current.shouldOpenHardGate).toBe(false);
    expect(result.current.policyState).toBe("low_confidence_warning");
  });

  test("sustained pose loss (>=5s) triggers mid-exercise realignment hard gate", () => {
    const { result, rerender } = renderHook(
      ({ currentTimeMs, requiredLandmarksVisible }) =>
        useCameraAlignmentPolicy({
          isReady: true,
          manifest: mockManifest,
          currentExercise: supportedExercise,
          currentTime: 15,
          currentTimeMs,
          cameraStreamStatus: "ready",
          mediaPipeRuntimeStatus: "active",
          poseAvailable: true,
          requiredLandmarksVisible,
          landmarkConfidence: requiredLandmarksVisible ? 0.9 : 0.3,
          cameraGatesDisabled: false,
        }),
      {
        initialProps: {
          currentTimeMs: 15000,
          requiredLandmarksVisible: true,
        },
      }
    );

    act(() => {
      result.current.markPreWorkoutHandled("completed");
      result.current.markExerciseCheckpointHandled("ex-1", "completed");
    });

    // Start loss
    rerender({ currentTimeMs: 16000, requiredLandmarksVisible: false });
    // Advance 5.5s
    rerender({ currentTimeMs: 21500, requiredLandmarksVisible: false });

    expect(result.current.shouldOpenHardGate).toBe(true);
    expect(result.current.gateType).toBe("mid_exercise_realign");
    expect(result.current.policyState).toBe("mid_exercise_realign_required");
  });

  test("mid-exercise realignment can re-arm after cooldown if tracking is still lost", () => {
    const { result, rerender } = renderHook(
      ({ currentTimeMs, requiredLandmarksVisible }) =>
        useCameraAlignmentPolicy({
          isReady: true,
          manifest: mockManifest,
          currentExercise: supportedExercise,
          currentTime: 15,
          currentTimeMs,
          cameraStreamStatus: "ready",
          mediaPipeRuntimeStatus: "active",
          poseAvailable: requiredLandmarksVisible,
          requiredLandmarksVisible,
          landmarkConfidence: requiredLandmarksVisible ? 0.9 : 0.2,
          cameraGatesDisabled: false,
        }),
      {
        initialProps: {
          currentTimeMs: 15000,
          requiredLandmarksVisible: true,
        },
      }
    );

    act(() => {
      result.current.markPreWorkoutHandled("completed");
      result.current.markExerciseCheckpointHandled("ex-1", "completed");
    });

    rerender({ currentTimeMs: 16000, requiredLandmarksVisible: false });
    rerender({ currentTimeMs: 21500, requiredLandmarksVisible: false });
    expect(result.current.shouldOpenHardGate).toBe(true);

    act(() => {
      result.current.dismissRealignment();
    });

    expect(result.current.shouldOpenHardGate).toBe(false);

    rerender({ currentTimeMs: 37000, requiredLandmarksVisible: false });
    expect(result.current.shouldOpenHardGate).toBe(true);
    expect(result.current.gateType).toBe("mid_exercise_realign");
  });

  test("disabling camera gates prevents all automatic hard gates", () => {
    const { result } = renderHook(() =>
      useCameraAlignmentPolicy({
        isReady: true,
        manifest: mockManifest,
        currentExercise: supportedExercise,
        currentTime: 12,
        currentTimeMs: 12000,
        cameraStreamStatus: "ready",
        mediaPipeRuntimeStatus: "active",
        poseAvailable: true,
        requiredLandmarksVisible: true,
        landmarkConfidence: 0.9,
        cameraGatesDisabled: true,
      })
    );

    expect(result.current.shouldOpenHardGate).toBe(false);
    expect(result.current.policyState).toBe("camera_disabled");
  });

  test("user manual retry explicitly requests hard gate", () => {
    const { result } = renderHook(() =>
      useCameraAlignmentPolicy({
        isReady: true,
        manifest: mockManifest,
        currentExercise: supportedExercise,
        currentTime: 15,
        currentTimeMs: 15000,
        cameraStreamStatus: "ready",
        mediaPipeRuntimeStatus: "active",
        poseAvailable: true,
        requiredLandmarksVisible: true,
        landmarkConfidence: 0.9,
        cameraGatesDisabled: false,
        isManualRetryGate: true,
      })
    );

    expect(result.current.shouldOpenHardGate).toBe(true);
    expect(result.current.policyState).toBe("pre_exercise_required");
  });
});
