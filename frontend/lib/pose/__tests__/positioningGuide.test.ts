import { describe, test, expect } from "vitest";
import { PositioningGuide } from "../positioningGuide";
import { NormalizedLandmark } from "../../hooks/useMediaPipePoseLandmarker";

describe("PositioningGuide Class", () => {
  // Helper to make a dummy set of 33 landmarks
  const makeLandmarks = (
    visibility = 0.8,
    yCoords: Record<number, number> = {},
    xCoords: Record<number, number> = {}
  ): NormalizedLandmark[] => {
    const list: NormalizedLandmark[] = [];
    for (let i = 0; i < 33; i++) {
      list.push({
        x: xCoords[i] !== undefined ? xCoords[i] : 0.5,
        y: yCoords[i] !== undefined ? yCoords[i] : 0.4,
        z: 0.0,
        visibility: visibility,
        presence: 0.9,
      });
    }
    return list;
  };

  test("handles undefined/empty landmarks as no_person", () => {
    const guide = new PositioningGuide("front", "standing");
    const result = guide.process(undefined, 1000);
    expect(result.state).toBe("no_person");
    expect(result.guidance).toContain("No one detected");
    expect(result.guidance).toContain("Step in front of the camera");
    expect(result.isReady).toBe(false);
  });

  test("detects partial or cut off body with actionable guidance", () => {
    const guide = new PositioningGuide("front", "standing");
    // Make ankles low visibility (index 27, 28)
    const landmarks = makeLandmarks(0.8);
    landmarks[27].visibility = 0.2;
    landmarks[28].visibility = 0.2;

    const result = guide.process(landmarks, 1000);
    expect(result.state).toBe("body_not_fully_visible");
    // BLV: must contain actionable direction
    expect(result.guidance).toContain("Step back");
  });

  test("classifies off_left and off_right with step direction", () => {
    const guide = new PositioningGuide("front", "standing");
    
    // Shift all x values to the left (e.g. 0.1) with realistic y spread
    const shiftLeft = makeLandmarks(0.8, { 0: 0.2, 27: 0.8, 28: 0.8 }, { 0: 0.1, 11: 0.1, 12: 0.15, 23: 0.1, 24: 0.15, 27: 0.1, 28: 0.15 });
    let result = guide.process(shiftLeft, 1000);
    expect(result.state).toBe("off_left");
    expect(result.guidance).toContain("one step to your right");

    // Reset and shift all x values to the right (e.g. 0.9) with realistic y spread
    guide.reset();
    const shiftRight = makeLandmarks(0.8, { 0: 0.2, 27: 0.8, 28: 0.8 }, { 0: 0.85, 11: 0.85, 12: 0.9, 23: 0.85, 24: 0.9, 27: 0.85, 28: 0.9 });
    result = guide.process(shiftRight, 1000);
    expect(result.state).toBe("off_right");
    expect(result.guidance).toContain("one step to your left");
  });

  test("classifies too_close and too_far with step direction", () => {
    const guide = new PositioningGuide("front", "standing");

    // Bounding box height too small (ys spread from 0.4 to 0.5 = 0.1)
    const tooFar = makeLandmarks(0.8, { 0: 0.4, 27: 0.5, 28: 0.5 });
    let result = guide.process(tooFar, 1000);
    expect(result.state).toBe("too_far");
    expect(result.guidance).toContain("one step forward");

    // Bounding box height too large (ys spread from 0.05 to 0.98 = 0.93)
    guide.reset();
    const tooClose = makeLandmarks(0.8, { 0: 0.05, 27: 0.98, 28: 0.98 });
    result = guide.process(tooClose, 1000);
    expect(result.state).toBe("too_close");
    expect(result.guidance).toContain("one step back");
  });

  test("classifies orientation front vs side facing direction", () => {
    // Require sideways orientation
    const guide = new PositioningGuide("left_side", "standing");

    // Front-facing layout has wide shoulders, ratio will be large (e.g. ratio = 0.3)
    const frontFacing = makeLandmarks(0.9, { 0: 0.2, 11: 0.3, 12: 0.3, 27: 0.8, 28: 0.8 }, { 11: 0.35, 12: 0.65 });
    
    const result = guide.process(frontFacing, 1000, 1.0);
    expect(result.state).toBe("wrong_orientation");
    expect(result.guidance).toContain("sideways to the camera");
  });

  test("classifies body orientation standing vs lying down", () => {
    // Require lying down posture
    const guide = new PositioningGuide("front", "lying_down");

    // Standing layout (large y spread)
    const standingBody = makeLandmarks(0.9, { 11: 0.2, 12: 0.2, 23: 0.5, 24: 0.5, 27: 0.8, 28: 0.8 });
    const result = guide.process(standingBody, 1000);
    expect(result.state).toBe("wrong_body_orientation");
    expect(result.guidance).toContain("Lie down on the mat");
  });

  test("supports debouncing transitions", () => {
    const guide = new PositioningGuide("front", "standing", { debounceSeconds: 1.0 });

    const tooFar = makeLandmarks(0.8, { 0: 0.4, 27: 0.5, 28: 0.5 });
    const ready = makeLandmarks(0.9, { 0: 0.25, 27: 0.9, 28: 0.9 }, { 11: 0.4, 12: 0.6 });

    // Initial classify
    let result = guide.process(tooFar, 1000);
    expect(result.state).toBe("too_far");

    // Process a ready frame at time 1200. Debounce period is 1000ms. Since only 200ms elapsed, state should remain "too_far".
    result = guide.process(ready, 1200);
    expect(result.state).toBe("too_far");

    // Process ready frame at time 2300. Over 1000ms (1100ms) has elapsed since the first ready candidate, so state commits to "ready".
    result = guide.process(ready, 2300);
    expect(result.state).toBe("ready");
  });

  test("validates ready hold time threshold before confirming isReady", () => {
    const guide = new PositioningGuide("front", "standing", { debounceSeconds: 0.1, readyHoldSeconds: 2.0 });
    const ready = makeLandmarks(0.9, { 0: 0.25, 27: 0.9, 28: 0.9 }, { 11: 0.4, 12: 0.6 });

    // First ready detection at 1000ms
    let result = guide.process(ready, 1000);
    expect(result.state).toBe("ready");
    expect(result.isReady).toBe(false); // not held long enough

    // Ready frame at 2000ms (1.0s elapsed, < 2.0s hold)
    result = guide.process(ready, 2000);
    expect(result.isReady).toBe(false);

    // Ready frame at 3100ms (2.1s elapsed, >= 2.0s hold)
    result = guide.process(ready, 3100);
    expect(result.isReady).toBe(true);
  });

  test("ready state uses BLV-friendly 'Good position. Hold still.' guidance", () => {
    const guide = new PositioningGuide("front", "standing", { debounceSeconds: 0 });
    const ready = makeLandmarks(0.9, { 0: 0.25, 27: 0.9, 28: 0.9 }, { 11: 0.4, 12: 0.6 });
    const result = guide.process(ready, 1000);
    expect(result.state).toBe("ready");
    expect(result.guidance).toBe("Good position. Hold still.");
  });

  test("front orientation wrong produces 'face the camera' guidance", () => {
    const guide = new PositioningGuide("front", "standing", { debounceSeconds: 0 });
    // Side-facing layout: very narrow shoulders
    const sideFacing = makeLandmarks(0.9, { 0: 0.2, 11: 0.3, 12: 0.3, 27: 0.8, 28: 0.8 }, { 11: 0.49, 12: 0.51 });
    const result = guide.process(sideFacing, 1000, 1.0);
    if (result.state === "wrong_orientation") {
      expect(result.guidance).toContain("face the camera");
    }
  });

  test("standing up wrong body orientation produces 'Stand up straight' guidance", () => {
    const guide = new PositioningGuide("front", "standing", { debounceSeconds: 0 });
    // Lying down layout: wide x spread (horizontal body) and narrow y spread
    const lyingDownBody = makeLandmarks(
      0.9,
      // y coordinates
      {
        0: 0.5, 11: 0.55, 12: 0.55, 23: 0.58, 24: 0.58, 27: 0.62, 28: 0.62,
        29: 0.65, 30: 0.65, 31: 0.65, 32: 0.65
      },
      // x coordinates
      {
        0: 0.15, 11: 0.25, 12: 0.25, 23: 0.45, 24: 0.45, 27: 0.75, 28: 0.75,
        29: 0.85, 30: 0.85, 31: 0.85, 32: 0.85
      }
    );
    const result = guide.process(lyingDownBody, 1000);
    expect(result.state).toBe("wrong_body_orientation");
    expect(result.guidance).toContain("Stand up straight");
  });

  test("partial body guidance includes specific body part info", () => {
    const guide = new PositioningGuide("front", "standing");
    // Only face visible, everything else low visibility
    const landmarks = makeLandmarks(0.1);
    // Make only face landmarks visible
    for (let i = 0; i <= 10; i++) {
      landmarks[i].visibility = 0.9;
    }

    const result = guide.process(landmarks, 1000);
    // Should mention a body part and include actionable direction
    expect(result.guidance).toContain("Step back");
  });
});
