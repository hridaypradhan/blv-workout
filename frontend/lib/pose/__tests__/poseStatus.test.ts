import { describe, test, expect } from "vitest";
import { determineSpecificPoseStatus } from "../poseStatus";
import { SQUAT_PROFILE, BICEP_CURL_PROFILE, DEFAULT_PROFILE } from "../exercisePoseProfiles";
import { NormalizedLandmark } from "../../hooks/useMediaPipePoseLandmarker";

describe("determineSpecificPoseStatus", () => {
  const dummyLandmark = (vis = 0.9, y = 0.5): NormalizedLandmark => ({
    x: 0.5,
    y,
    z: 0.0,
    visibility: vis,
  });

  const fullBodyLandmarks = (vis = 0.9): NormalizedLandmark[] =>
    Array.from({ length: 33 }, () => dummyLandmark(vis));

  test("handles model loading state", () => {
    const res = determineSpecificPoseStatus({
      streamActive: true,
      runtimeStatus: "initializing",
      rawPoseLandmarks: null,
      landmarkConfidence: 0.0,
      profile: SQUAT_PROFILE,
      fallbackActive: true,
    });
    expect(res.status).toBe("model_loading");
    expect(res.label).toBe("Camera unavailable");
    expect(res.guidance).toBe("Loading MediaPipe model...");
  });

  test("handles camera unavailable when stream is inactive", () => {
    const res = determineSpecificPoseStatus({
      streamActive: false,
      runtimeStatus: "active",
      rawPoseLandmarks: null,
      landmarkConfidence: 0.0,
      profile: SQUAT_PROFILE,
      fallbackActive: true,
    });
    expect(res.status).toBe("camera_unavailable");
    expect(res.label).toBe("Camera unavailable");
    expect(res.guidance).toBe("This exercise is using fallback tracking.");
  });

  test("handles unsupported exercise status", () => {
    const res = determineSpecificPoseStatus({
      streamActive: true,
      runtimeStatus: "active",
      rawPoseLandmarks: fullBodyLandmarks(),
      landmarkConfidence: 0.9,
      profile: DEFAULT_PROFILE,
      fallbackActive: true,
    });
    expect(res.status).toBe("unsupported_exercise");
    expect(res.label).toBe("Prototype fallback active");
    expect(res.guidance).toBe("This exercise is using fallback tracking.");
  });

  test("handles body not detected (null landmarks)", () => {
    const res = determineSpecificPoseStatus({
      streamActive: true,
      runtimeStatus: "active",
      rawPoseLandmarks: null,
      landmarkConfidence: 0.0,
      profile: SQUAT_PROFILE,
      fallbackActive: false,
    });
    expect(res.status).toBe("body_not_detected");
    expect(res.label).toBe("Camera visible but required joints missing");
    expect(res.guidance).toContain("Step back so your whole body is visible");
  });

  test("handles low confidence/poor lighting", () => {
    const res = determineSpecificPoseStatus({
      streamActive: true,
      runtimeStatus: "active",
      rawPoseLandmarks: fullBodyLandmarks(0.3),
      landmarkConfidence: 0.3,
      profile: SQUAT_PROFILE,
      minConfidence: 0.5,
      fallbackActive: false,
    });
    expect(res.status).toBe("low_confidence");
    expect(res.label).toBe("Camera visible but required joints missing");
    expect(res.guidance).toBe("Move into brighter light.");
  });

  test("handles too close/body cropped", () => {
    // Landmarks y-coords spanning too large a range (e.g. from 0.05 to 0.95)
    const landmarks = fullBodyLandmarks();
    landmarks[0].y = 0.05;
    landmarks[28].y = 0.95;

    const res = determineSpecificPoseStatus({
      streamActive: true,
      runtimeStatus: "active",
      rawPoseLandmarks: landmarks,
      landmarkConfidence: 0.9,
      profile: SQUAT_PROFILE,
      fallbackActive: false,
    });
    expect(res.status).toBe("too_close");
    expect(res.label).toBe("Camera visible but required joints missing");
    expect(res.guidance).toBe("You're too close. Take one step back.");
  });

  test("handles lower body missing for squats - knees missing", () => {
    const landmarks = fullBodyLandmarks();
    // knees: 25, 26
    landmarks[25].visibility = 0.1;
    landmarks[26].visibility = 0.1;

    const res = determineSpecificPoseStatus({
      streamActive: true,
      runtimeStatus: "active",
      rawPoseLandmarks: landmarks,
      landmarkConfidence: 0.95,
      profile: SQUAT_PROFILE,
      minVisibility: 0.5,
      fallbackActive: false,
    });
    expect(res.status).toBe("lower_body_missing");
    expect(res.guidance).toBe("Step back until your knees are visible.");
  });

  test("handles lower body missing for squats - ankles missing", () => {
    const landmarks = fullBodyLandmarks();
    // ankles: 27, 28
    landmarks[27].visibility = 0.1;
    landmarks[28].visibility = 0.1;

    const res = determineSpecificPoseStatus({
      streamActive: true,
      runtimeStatus: "active",
      rawPoseLandmarks: landmarks,
      landmarkConfidence: 0.95,
      profile: SQUAT_PROFILE,
      minVisibility: 0.5,
      fallbackActive: false,
    });
    expect(res.status).toBe("lower_body_missing");
    expect(res.guidance).toBe("Tilt the camera lower so your ankles are visible.");
  });

  test("handles required joints missing for bicep curl", () => {
    const landmarks = fullBodyLandmarks();
    // Bicep Curl profile requires 11, 12, 13, 14, 15, 16
    landmarks[13].visibility = 0.1; // elbow missing

    const res = determineSpecificPoseStatus({
      streamActive: true,
      runtimeStatus: "active",
      rawPoseLandmarks: landmarks,
      landmarkConfidence: 0.95,
      profile: BICEP_CURL_PROFILE,
      minVisibility: 0.5,
      fallbackActive: false,
    });
    expect(res.status).toBe("required_joints_missing");
    expect(res.guidance).toBe("Adjust camera so your active joints are in frame.");
  });

  test("squat does not care if shoulders are missing, only hips/knees/ankles", () => {
    const landmarks = fullBodyLandmarks();
    landmarks[11].visibility = 0.1; // shoulder missing, but not in SQUAT_PROFILE required list
    landmarks[12].visibility = 0.1;

    const res = determineSpecificPoseStatus({
      streamActive: true,
      runtimeStatus: "active",
      rawPoseLandmarks: landmarks,
      landmarkConfidence: 0.95,
      profile: SQUAT_PROFILE,
      minVisibility: 0.5,
      fallbackActive: false,
    });
    expect(res.status).toBe("mediapipe_active");
  });

  test("bicep curl does not care if ankles or knees are missing", () => {
    const landmarks = fullBodyLandmarks();
    landmarks[25].visibility = 0.1; // knee missing
    landmarks[27].visibility = 0.1; // ankle missing

    const res = determineSpecificPoseStatus({
      streamActive: true,
      runtimeStatus: "active",
      rawPoseLandmarks: landmarks,
      landmarkConfidence: 0.95,
      profile: BICEP_CURL_PROFILE,
      minVisibility: 0.5,
      fallbackActive: false,
    });
    expect(res.status).toBe("mediapipe_active");
  });

  test("handles prototype fallback active", () => {
    const res = determineSpecificPoseStatus({
      streamActive: true,
      runtimeStatus: "active",
      rawPoseLandmarks: fullBodyLandmarks(),
      landmarkConfidence: 0.95,
      profile: SQUAT_PROFILE,
      fallbackActive: true,
    });
    expect(res.status).toBe("prototype_fallback_active");
  });
});
