import { describe, test, expect } from "vitest";
import {
  calculateTripletAngle2D,
  calculateTripletAngle3D,
  extractJointAngles,
  LANDMARK_INDICES,
} from "../jointAngles";
import { NormalizedLandmark } from "@/lib/hooks/useMediaPipePoseLandmarker";

describe("jointAngles math & extractors", () => {
  test("calculateTripletAngle2D computes correct 2D angles", () => {
    // 180 degree line
    const a1: NormalizedLandmark = { x: 0, y: 0, z: 0 };
    const b1: NormalizedLandmark = { x: 1, y: 0, z: 0 };
    const c1: NormalizedLandmark = { x: 2, y: 0, z: 0 };
    expect(calculateTripletAngle2D(a1, b1, c1)).toBeCloseTo(180, 1);

    // 90 degree corner
    const a2: NormalizedLandmark = { x: 1, y: 1, z: 0 };
    const b2: NormalizedLandmark = { x: 1, y: 0, z: 0 };
    const c2: NormalizedLandmark = { x: 2, y: 0, z: 0 };
    expect(calculateTripletAngle2D(a2, b2, c2)).toBeCloseTo(90, 1);

    // 45 degree angle
    const a3: NormalizedLandmark = { x: 2, y: 1, z: 0 };
    const b3: NormalizedLandmark = { x: 1, y: 0, z: 0 };
    const c3: NormalizedLandmark = { x: 2, y: 0, z: 0 };
    expect(calculateTripletAngle2D(a3, b3, c3)).toBeCloseTo(45, 1);
  });

  test("calculateTripletAngle3D computes correct 3D angles", () => {
    // 90 degrees in 3D (X-Y vs Y-Z planes)
    const a: NormalizedLandmark = { x: 1, y: 1, z: 0 };
    const b: NormalizedLandmark = { x: 1, y: 0, z: 0 };
    const c: NormalizedLandmark = { x: 1, y: 0, z: 1 };
    expect(calculateTripletAngle3D(a, b, c)).toBeCloseTo(90, 1);

    // 180 degrees in 3D
    const a2: NormalizedLandmark = { x: 0, y: 0, z: 0 };
    const b2: NormalizedLandmark = { x: 0, y: 0, z: 1 };
    const c2: NormalizedLandmark = { x: 0, y: 0, z: 2 };
    expect(calculateTripletAngle3D(a2, b2, c2)).toBeCloseTo(180, 1);
  });

  test("extractJointAngles correctly processes landmarks array", () => {
    // Build a mock landmarks array with length 33
    const mockLandmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
      x: 0,
      y: 0,
      z: 0,
      visibility: 0.9,
    }));

    // Left Elbow: shoulder(11) -> elbow(13) -> wrist(15)
    // Create a 90 degree angle
    mockLandmarks[LANDMARK_INDICES.left_shoulder] = { x: 1, y: 1, z: 0, visibility: 0.9 };
    mockLandmarks[LANDMARK_INDICES.left_elbow] = { x: 1, y: 0, z: 0, visibility: 0.99 };
    mockLandmarks[LANDMARK_INDICES.left_wrist] = { x: 2, y: 0, z: 0, visibility: 0.95 };

    // Left Knee: hip(23) -> knee(25) -> ankle(27)
    // Create a 180 degree angle
    mockLandmarks[LANDMARK_INDICES.left_hip] = { x: 1, y: 0, z: 0, visibility: 0.9 };
    mockLandmarks[LANDMARK_INDICES.left_knee] = { x: 2, y: 0, z: 0, visibility: 0.99 };
    mockLandmarks[LANDMARK_INDICES.left_ankle] = { x: 3, y: 0, z: 0, visibility: 0.95 };

    const angles = extractJointAngles(mockLandmarks);

    expect(angles.left_elbow).toBeCloseTo(90, 1);
    expect(angles.left_knee).toBeCloseTo(180, 1);
    // Right elbow should not be present since landmarks are all at (0,0) resulting in 0 length vector
    expect(angles.right_elbow).toBe(0);
  });
});
