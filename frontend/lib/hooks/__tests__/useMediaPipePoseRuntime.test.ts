import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMediaPipePoseRuntime } from "../useMediaPipePoseRuntime";
import { useMediaPipePoseLandmarker } from "../useMediaPipePoseLandmarker";
import { Exercise } from "@/types";
import { NormalizedLandmark } from "../useMediaPipePoseLandmarker";

vi.mock("../useMediaPipePoseLandmarker", () => {
  return {
    useMediaPipePoseLandmarker: vi.fn(),
  };
});

describe("useMediaPipePoseRuntime Hook", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockTrack: any;
  let mockStream: MediaStream;

  const mockExercise: Exercise = {
    id: "ex-test",
    name: "Bicep Curl Challenge",
    start_time_seconds: 0,
    end_time_seconds: 30,
    counting_joint: "left_elbow",
    acceptable_ranges: {
      left_elbow: [40, 180],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockTrack = {
      readyState: "live",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    mockStream = {
      active: true,
      getTracks: () => [mockTrack],
    } as unknown as MediaStream;
  });

  test("initializes with offline/disabled state when stream is null", () => {
    vi.mocked(useMediaPipePoseLandmarker).mockReturnValue({
      isLoading: false,
      error: null,
      poseResult: null,
      isModelLoaded: false,
    });

    const { result } = renderHook(() =>
      useMediaPipePoseRuntime({
        stream: null,
        currentExercise: null,
        currentTimeMs: 0,
        isPlaying: false,
      })
    );

    expect(result.current.isTracking).toBe(false);
    expect(result.current.isReady).toBe(false);
    expect(result.current.providerSource).toBe("camera_mediapipe");
    expect(result.current.runtimeStatus).toBe("offline");
    expect(result.current.poseData).toBeNull();
    expect(result.current.trackingStatusLabel).toBe("Camera pose runtime offline");
    expect(result.current.poseAvailable).toBe(false);
    expect(result.current.latestRepEvent).toBeNull();
    expect(result.current.latestFormError).toBeNull();
  });

  test("activates tracking and updates state when active stream is provided", () => {
    vi.mocked(useMediaPipePoseLandmarker).mockReturnValue({
      isLoading: false,
      error: null,
      poseResult: null,
      isModelLoaded: true,
    });

    const { result } = renderHook(() =>
      useMediaPipePoseRuntime({
        stream: mockStream,
        currentExercise: null,
        currentTimeMs: 1000,
        isPlaying: true,
      })
    );

    expect(result.current.isTracking).toBe(true);
    expect(result.current.isReady).toBe(true);
    expect(result.current.providerSource).toBe("camera_mediapipe");
    expect(result.current.runtimeStatus).toBe("active");
  });

  test("derives visibility/confidence and required landmarks presence from mock landmarks", () => {
    // Left Elbow: left_shoulder(11), left_elbow(13), left_wrist(15)
    const mockLandmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      z: 0.0,
      visibility: 0.8, // standard high confidence
    }));

    // Make wrist occluded (low visibility)
    mockLandmarks[15] = { x: 0.5, y: 0.5, z: 0.0, visibility: 0.2 };

    vi.mocked(useMediaPipePoseLandmarker).mockReturnValue({
      isLoading: false,
      error: null,
      poseResult: {
        poseLandmarks: [mockLandmarks],
        poseWorldLandmarks: [mockLandmarks],
      },
      isModelLoaded: true,
    });

    const { result } = renderHook(() =>
      useMediaPipePoseRuntime({
        stream: mockStream,
        currentExercise: mockExercise,
        currentTimeMs: 1000,
        isPlaying: true,
        minVisibility: 0.5,
      })
    );

    expect(result.current.poseAvailable).toBe(true);
    expect(result.current.visibleLandmarkCount).toBe(32); // All except index 15
    expect(result.current.requiredLandmarksVisible).toBe(false); // Wrist at 15 is below 0.5
    expect(result.current.latestRepEvent).toBeNull();
    expect(result.current.latestFormError).toBeNull();
  });

  test("computes joint angles correctly from mock landmark triplets", () => {
    const mockLandmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
      x: 0,
      y: 0,
      z: 0,
      visibility: 0.9,
    }));

    // Create 90-degree left elbow angle: shoulder(11) -> elbow(13) -> wrist(15)
    mockLandmarks[11] = { x: 1, y: 1, z: 0, visibility: 0.9 };
    mockLandmarks[13] = { x: 1, y: 0, z: 0, visibility: 0.9 };
    mockLandmarks[15] = { x: 2, y: 0, z: 0, visibility: 0.9 };

    vi.mocked(useMediaPipePoseLandmarker).mockReturnValue({
      isLoading: false,
      error: null,
      poseResult: {
        poseLandmarks: [mockLandmarks],
        poseWorldLandmarks: [mockLandmarks],
      },
      isModelLoaded: true,
    });

    const { result } = renderHook(() =>
      useMediaPipePoseRuntime({
        stream: mockStream,
        currentExercise: mockExercise,
        currentTimeMs: 1000,
        isPlaying: true,
      })
    );

    expect(result.current.currentAngles.left_elbow).toBeCloseTo(90, 1);
  });

  test("stops MediaPipe tracking and sets runtimeStatus offline when stream stops or is removed", () => {
    vi.mocked(useMediaPipePoseLandmarker).mockReturnValue({
      isLoading: false,
      error: null,
      poseResult: null,
      isModelLoaded: true,
    });

    const { result, rerender } = renderHook(
      ({ stream }) =>
        useMediaPipePoseRuntime({
          stream,
          currentExercise: null,
          currentTimeMs: 1000,
          isPlaying: true,
        }),
      { initialProps: { stream: mockStream as MediaStream | null } }
    );

    expect(result.current.isTracking).toBe(true);

    // Stop stream
    act(() => {
      rerender({ stream: null });
    });

    expect(result.current.isTracking).toBe(false);
    expect(result.current.runtimeStatus).toBe("offline");
  });

  test("emits a MediaPipe rep event when a full repetition cycle is completed", () => {
    // 180 deg (extended)
    const mockLandmarks1: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
      x: 0.5, y: 0.5, z: 0, visibility: 0.9,
    }));
    mockLandmarks1[11] = { x: 1, y: 1, z: 0, visibility: 0.9 }; // shoulder
    mockLandmarks1[13] = { x: 1, y: 0, z: 0, visibility: 0.99 };   // elbow
    mockLandmarks1[15] = { x: 1, y: -1, z: 0, visibility: 0.95 }; // wrist

    // 45 deg (contracted)
    const mockLandmarks2: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
      x: 0.5, y: 0.5, z: 0, visibility: 0.9,
    }));
    mockLandmarks2[11] = { x: 1, y: 1, z: 0, visibility: 0.9 };
    mockLandmarks2[13] = { x: 1, y: 0, z: 0, visibility: 0.99 };
    mockLandmarks2[15] = { x: 2, y: 1, z: 0, visibility: 0.95 };

    // 110 deg (returning)
    const mockLandmarks3: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
      x: 0.5, y: 0.5, z: 0, visibility: 0.9,
    }));
    mockLandmarks3[11] = { x: 1, y: 0.36, z: 0, visibility: 0.9 };
    mockLandmarks3[13] = { x: 1, y: 0, z: 0, visibility: 0.99 };
    mockLandmarks3[15] = { x: 2, y: -0.36, z: 0, visibility: 0.95 };

    const mockLandmarks4 = mockLandmarks1; // back to extended

    // Mock landmarker behavior dynamically
    let currentMockLandmarks = mockLandmarks1;
    vi.mocked(useMediaPipePoseLandmarker).mockImplementation(() => {
      return {
        isLoading: false,
        error: null,
        poseResult: {
          poseLandmarks: [currentMockLandmarks],
          poseWorldLandmarks: [currentMockLandmarks],
        },
        isModelLoaded: true,
      };
    });

    const { result, rerender } = renderHook(
      ({ currentTimeMs, landmarks }) => {
        currentMockLandmarks = landmarks;
        return useMediaPipePoseRuntime({
          stream: mockStream,
          currentExercise: mockExercise,
          currentTimeMs,
          isPlaying: true,
          smoothingAlpha: 1.0,
        });
      },
      { initialProps: { currentTimeMs: 0, landmarks: mockLandmarks1 } }
    );

    // Rerender through phases to drive updates
    rerender({ currentTimeMs: 1000, landmarks: mockLandmarks2 });
    rerender({ currentTimeMs: 2000, landmarks: mockLandmarks3 });
    rerender({ currentTimeMs: 3000, landmarks: mockLandmarks4 });
    rerender({ currentTimeMs: 4000, landmarks: mockLandmarks4 });

    expect(result.current.latestRepEvent).not.toBeNull();
    expect(result.current.latestRepEvent?.rep_count).toBe(1);
    expect(result.current.latestRepEvent?.metadata?.provider).toBe("camera_mediapipe");
  });

  test("does not emit rep event if landmark visibility is below threshold", () => {
    const mockLandmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
      x: 0.5, y: 0.5, z: 0, visibility: 0.2, // low visibility!
    }));

    vi.mocked(useMediaPipePoseLandmarker).mockReturnValue({
      isLoading: false,
      error: null,
      poseResult: {
        poseLandmarks: [mockLandmarks],
        poseWorldLandmarks: [mockLandmarks],
      },
      isModelLoaded: true,
    });

    const { result, rerender } = renderHook(
      ({ currentTimeMs }) =>
        useMediaPipePoseRuntime({
          stream: mockStream,
          currentExercise: mockExercise,
          currentTimeMs,
          isPlaying: true,
          minVisibility: 0.5,
        }),
      { initialProps: { currentTimeMs: 0 } }
    );

    rerender({ currentTimeMs: 1000 });
    rerender({ currentTimeMs: 2000 });

    expect(result.current.latestRepEvent).toBeNull();
  });

  test("emits a FormError event when user has incorrect form", () => {
    const mockLandmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
      x: 0.5, y: 0.5, z: 0, visibility: 0.9,
    }));
    mockLandmarks[11] = { x: 1, y: 1, z: 0, visibility: 0.95 };
    mockLandmarks[13] = { x: 1, y: 0, z: 0, visibility: 0.99 };
    mockLandmarks[15] = { x: 1.364, y: 0.94, z: 0, visibility: 0.95 }; // ~21 deg

    vi.mocked(useMediaPipePoseLandmarker).mockReturnValue({
      isLoading: false,
      error: null,
      poseResult: {
        poseLandmarks: [mockLandmarks],
        poseWorldLandmarks: [mockLandmarks],
      },
      isModelLoaded: true,
    });

    const { result, rerender } = renderHook(
      ({ currentTimeMs }) =>
        useMediaPipePoseRuntime({
          stream: mockStream,
          currentExercise: mockExercise,
          currentTimeMs,
          isPlaying: true,
          smoothingAlpha: 1.0,
        }),
      { initialProps: { currentTimeMs: 0 } }
    );

    rerender({ currentTimeMs: 1000 });

    expect(result.current.latestFormError).not.toBeNull();
    expect(result.current.latestFormError?.joint).toBe("left_elbow");
    expect(result.current.latestFormError?.severity).toBe("medium"); // 40 - 21 = 19
  });
});
