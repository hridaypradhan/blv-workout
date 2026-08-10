import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePoseSessionEvents } from "../usePoseSessionEvents";
import { PoseRuntimeContract } from "@/lib/pose/poseRuntimeTypes";
import { Exercise, RepEvent, FormError } from "@/types";
import { SESSION_EVENTS } from "@/lib/sessionEvents";

// Mock generateCorrection API
vi.mock("@/lib/api", () => ({
  generateCorrection: vi.fn(() => Promise.resolve({ text: "Keep back straight", modality: "speech" })),
}));

describe("usePoseSessionEvents hook", () => {
  const mockExercise: Exercise = {
    id: "ex-1",
    name: "Squats",
    start_time_seconds: 0,
    end_time_seconds: 30,
    counting_joint: "left_knee",
  };

  const defaultProps = {
    sessionId: "session-123",
    currentTimeMs: 5000,
    currentExercise: mockExercise,
    isPlaying: true,
    userProfile: null,
    announce: vi.fn(),
    updateLatestAutomaticCue: vi.fn(),
    logSessionEvent: vi.fn(),
    triggerHapticEvent: vi.fn(() => Promise.resolve({})),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("buffers repetition events with camera_mediapipe provider when active", () => {
    const mockRepEvent: RepEvent = {
      rep_count: 1,
      timestamp: new Date().toISOString(),
      session_id: "session-123",
      exercise_id: "ex-1",
    };

    const activePoseRuntime: PoseRuntimeContract = {
      poseData: {},
      isReady: true,
      providerSource: "camera_mediapipe",
      runtimeStatus: "active",
      isTracking: true,
      startTracking: vi.fn(),
      stopTracking: vi.fn(),
      currentAngles: { left_knee: 90 },
      latestRepEvent: mockRepEvent,
      latestFormError: null,
      trackingStatusLabel: "Active",
    };

    const { result } = renderHook(() =>
      usePoseSessionEvents({
        ...defaultProps,
        activePoseRuntime,
      })
    );

    // Initial render should process the rep event
    expect(result.current.latestRepCount).toBe(1);
    expect(result.current.repsBufferRef.current).toHaveLength(1);
    expect(result.current.repsBufferRef.current[0].rep_count).toBe(1);
    expect(result.current.repsBufferRef.current[0].metadata?.provider).toBe("camera_mediapipe");
    expect(result.current.repsBufferRef.current[0].metadata?.fallback_reason).toBeUndefined();

    // Verify correct generic session event was logged
    expect(defaultProps.logSessionEvent).toHaveBeenCalledWith(
      SESSION_EVENTS.POSE_REP_DETECTED,
      5000,
      expect.objectContaining({ provider: "camera_mediapipe" })
    );
  });

  test("buffers repetition events with prototype_pose and fallback reason when in fallback", () => {
    const mockRepEvent: RepEvent = {
      rep_count: 2,
      timestamp: new Date().toISOString(),
      session_id: "session-123",
      exercise_id: "ex-1",
    };

    const activePoseRuntime: PoseRuntimeContract = {
      poseData: {},
      isReady: true,
      providerSource: "prototype",
      runtimeStatus: "active",
      isTracking: true,
      startTracking: vi.fn(),
      stopTracking: vi.fn(),
      currentAngles: { left_knee: 90 },
      latestRepEvent: mockRepEvent,
      latestFormError: null,
      trackingStatusLabel: "Simulated",
    };

    const { result } = renderHook(() =>
      usePoseSessionEvents({
        ...defaultProps,
        activePoseRuntime,
      })
    );

    expect(result.current.latestRepCount).toBe(1);
    expect(result.current.repsBufferRef.current[0].metadata?.provider).toBe("prototype_pose");
    expect(result.current.repsBufferRef.current[0].metadata?.fallback_reason).toBeDefined();

    // Verify correct prototype session event was logged
    expect(defaultProps.logSessionEvent).toHaveBeenCalledWith(
      SESSION_EVENTS.PROTOTYPE_REP_DETECTED,
      5000,
      expect.objectContaining({ provider: "prototype_pose" })
    );
  });

  test("buffers form error events with camera_mediapipe provider when active", () => {
    const mockFormError: FormError = {
      joint: "left_knee",
      observed_angle: 60,
      expected_range: [75, 180],
      severity: "medium",
      message: "observed knee angle 60 out of range",
    };

    const activePoseRuntime: PoseRuntimeContract = {
      poseData: {},
      isReady: true,
      providerSource: "camera_mediapipe",
      runtimeStatus: "active",
      isTracking: true,
      startTracking: vi.fn(),
      stopTracking: vi.fn(),
      currentAngles: { left_knee: 60 },
      latestRepEvent: null,
      latestFormError: mockFormError,
      trackingStatusLabel: "Active",
    };

    const { result } = renderHook(() =>
      usePoseSessionEvents({
        ...defaultProps,
        activePoseRuntime,
      })
    );

    expect(result.current.formErrorsBufferRef.current).toHaveLength(1);
    expect(result.current.formErrorsBufferRef.current[0].form_error.joint).toBe("left_knee");
    expect(result.current.formErrorsBufferRef.current[0].form_error.metadata?.provider).toBe("camera_mediapipe");
    expect(result.current.formErrorsBufferRef.current[0].form_error.metadata?.fallback_reason).toBeUndefined();

    // Verify generic form error event logged
    expect(defaultProps.logSessionEvent).toHaveBeenCalledWith(
      SESSION_EVENTS.POSE_FORM_ERROR_DETECTED,
      5000,
      expect.objectContaining({ provider: "camera_mediapipe" })
    );
  });

  test("buffers richer form error metadata (correction_kind, offender_joint) and passes to correction payload", () => {
    const mockFormError: FormError = {
      joint: "left_knee",
      observed_angle: 50,
      expected_range: [75, 180],
      severity: "high",
      message: "Pay attention to your left knee position",
      metadata: {
        correction_kind: "position",
        offender_angle: "knee_left",
        offender_joint: "left knee",
        provider: "camera_mediapipe",
      },
    };

    const activePoseRuntime: PoseRuntimeContract = {
      poseData: {},
      isReady: true,
      providerSource: "camera_mediapipe",
      runtimeStatus: "active",
      isTracking: true,
      startTracking: vi.fn(),
      stopTracking: vi.fn(),
      currentAngles: { knee_left: 50 },
      latestRepEvent: null,
      latestFormError: mockFormError,
      trackingStatusLabel: "Active",
    };

    const { result } = renderHook(() =>
      usePoseSessionEvents({
        ...defaultProps,
        activePoseRuntime,
      })
    );

    expect(result.current.formErrorsBufferRef.current).toHaveLength(1);
    const buffered = result.current.formErrorsBufferRef.current[0];
    expect(buffered.form_error.metadata?.correction_kind).toBe("position");
    expect(buffered.form_error.metadata?.offender_angle).toBe("knee_left");
    expect(buffered.form_error.metadata?.offender_joint).toBe("left knee");

    expect(defaultProps.logSessionEvent).toHaveBeenCalledWith(
      SESSION_EVENTS.POSE_FORM_ERROR_DETECTED,
      5000,
      expect.objectContaining({
        provider: "camera_mediapipe",
        correction_kind: "position",
        offender_angle: "knee_left",
        offender_joint: "left knee",
      })
    );
  });

  test("invokes onCorrectionReady callback when correction is generated", async () => {
    const mockFormError: FormError = {
      joint: "left_knee",
      observed_angle: 60,
      expected_range: [75, 180],
      severity: "medium",
      message: "observed knee angle 60 out of range",
    };

    const activePoseRuntime: PoseRuntimeContract = {
      poseData: {},
      isReady: true,
      providerSource: "camera_mediapipe",
      runtimeStatus: "active",
      isTracking: true,
      startTracking: vi.fn(),
      stopTracking: vi.fn(),
      currentAngles: { left_knee: 60 },
      latestRepEvent: null,
      latestFormError: mockFormError,
      trackingStatusLabel: "Active",
    };

    const onCorrectionReady = vi.fn();

    renderHook(() =>
      usePoseSessionEvents({
        ...defaultProps,
        activePoseRuntime,
        onCorrectionReady,
      })
    );

    await vi.waitFor(() => {
      expect(onCorrectionReady).toHaveBeenCalledTimes(1);
    });

    expect(onCorrectionReady).toHaveBeenCalledWith(
      { text: "Keep back straight", modality: "speech" },
      5000,
      mockFormError
    );
  });

  test("logs ASSISTANT_CORRECTION_SUPPRESSED when canVoiceCorrection returns false", () => {
    const mockFormError: FormError = {
      joint: "left_knee",
      observed_angle: 60,
      expected_range: [75, 180],
      severity: "medium",
      message: "knee position error",
    };

    const activePoseRuntime: PoseRuntimeContract = {
      poseData: {},
      isReady: true,
      providerSource: "camera_mediapipe",
      runtimeStatus: "active",
      isTracking: true,
      startTracking: vi.fn(),
      stopTracking: vi.fn(),
      currentAngles: { left_knee: 60 },
      latestRepEvent: null,
      latestFormError: mockFormError,
      trackingStatusLabel: "Active",
    };

    renderHook(() =>
      usePoseSessionEvents({
        ...defaultProps,
        activePoseRuntime,
        canVoiceCorrection: () => false,
      })
    );

    expect(defaultProps.logSessionEvent).toHaveBeenCalledWith(
      SESSION_EVENTS.ASSISTANT_CORRECTION_SUPPRESSED,
      5000,
      expect.objectContaining({
        reason: "persona_correction_cap_reached",
      })
    );
  });
});
