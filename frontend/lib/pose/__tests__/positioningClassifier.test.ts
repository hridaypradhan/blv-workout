/**
 * Tests for positioningClassifier.ts pure functions.
 * These are deterministic: no React, no timers, no mocks needed.
 */

import { describe, test, expect } from "vitest";
import {
  computeShoulderRatio,
  detectCameraOrientation,
  detectBodyPosture,
  classifyLandmarks,
  classifyLandmarksWithBody,
  debouncePositionState,
  getPartialGuidance,
  BODY_REGIONS,
} from "../positioningClassifier";
import type { DebounceState } from "../positioningClassifier";
import type { NormalizedLandmark } from "../../hooks/useMediaPipePoseLandmarker";
import type { PositioningConfig } from "../positioningGuide";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a landmark array of 33 zeroed entries, then patch specific ones. */
function makeLandmarks(patches: Record<number, Partial<NormalizedLandmark>> = {}): NormalizedLandmark[] {
  const lm: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0,
  }));
  for (const [idx, patch] of Object.entries(patches)) {
    lm[Number(idx)] = { ...lm[Number(idx)], ...patch };
  }
  return lm;
}

const DEFAULT_CONFIG: Required<PositioningConfig> = {
  visibilityThreshold: 0.65,
  sideVisibilityThreshold: 0.5,
  minVisibleFraction: 0.85,
  minBoxHeightForGuidance: 0.15,
  targetHeightMin: 0.58,
  targetHeightMax: 0.88,
  sideMargin: 0.08,
  centerTolerance: 0.1,
  debounceSeconds: 1.8,
  readyHoldSeconds: 2.5,
  mirroredView: false,
};

// ---------------------------------------------------------------------------
// computeShoulderRatio
// ---------------------------------------------------------------------------

describe("computeShoulderRatio", () => {
  test("returns 0 when no landmarks are above visibility threshold", () => {
    const lm = makeLandmarks();
    expect(computeShoulderRatio(lm, 1.33)).toBe(0);
  });

  test("computes a positive ratio when shoulders are visible and spread", () => {
    const lm = makeLandmarks({
      0: { y: 0.1, visibility: 0.9 },
      11: { x: 0.3, y: 0.35, visibility: 0.9 },
      12: { x: 0.7, y: 0.35, visibility: 0.9 },
      27: { y: 0.95, visibility: 0.9 },
      28: { y: 0.95, visibility: 0.9 },
    });
    const ratio = computeShoulderRatio(lm, 1.33);
    expect(ratio).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// detectCameraOrientation
// ---------------------------------------------------------------------------

describe("detectCameraOrientation", () => {
  test("returns unknown when shoulder ratio is 0", () => {
    const lm = makeLandmarks(); // all visibility 0
    expect(detectCameraOrientation(lm, 1.33, null)).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// detectBodyPosture
// ---------------------------------------------------------------------------

describe("detectBodyPosture", () => {
  test("returns unknown when fewer than 4 spread landmarks are visible", () => {
    const lm = makeLandmarks();
    expect(detectBodyPosture(lm)).toBe("unknown");
  });

  test("returns standing when y-spread is large", () => {
    const lm = makeLandmarks({
      11: { y: 0.1, visibility: 0.9 },
      12: { y: 0.1, visibility: 0.9 },
      23: { y: 0.5, visibility: 0.9 },
      24: { y: 0.5, visibility: 0.9 },
      27: { y: 0.92, visibility: 0.9 },
      28: { y: 0.92, visibility: 0.9 },
    });
    expect(detectBodyPosture(lm)).toBe("standing");
  });

  test("returns lying_down when y-spread is small", () => {
    const lm = makeLandmarks({
      11: { y: 0.4, visibility: 0.9 },
      12: { y: 0.42, visibility: 0.9 },
      23: { y: 0.45, visibility: 0.9 },
      24: { y: 0.47, visibility: 0.9 },
      27: { y: 0.5, visibility: 0.9 },
      28: { y: 0.52, visibility: 0.9 },
    });
    expect(detectBodyPosture(lm)).toBe("lying_down");
  });
});

// ---------------------------------------------------------------------------
// classifyLandmarks
// ---------------------------------------------------------------------------

describe("classifyLandmarks", () => {
  test("returns no_person when no landmarks exceed visibility threshold", () => {
    const lm = makeLandmarks(); // all visibility 0
    const result = classifyLandmarks(lm, "front", DEFAULT_CONFIG);
    expect(result.rawState).toBe("no_person");
  });

  test("returns body_not_fully_visible when ankles are not visible", () => {
    // Make face + shoulders visible but not ankles
    const lm = makeLandmarks({
      0: { x: 0.5, y: 0.1, visibility: 0.9 },
      11: { x: 0.4, y: 0.35, visibility: 0.9 },
      12: { x: 0.6, y: 0.35, visibility: 0.9 },
      23: { x: 0.45, y: 0.6, visibility: 0.9 },
      24: { x: 0.55, y: 0.6, visibility: 0.9 },
      // 27, 28 remain at 0 visibility
    });
    const result = classifyLandmarks(lm, "front", DEFAULT_CONFIG);
    expect(result.rawState).toBe("body_not_fully_visible");
  });
});

// ---------------------------------------------------------------------------
// classifyLandmarksWithBody
// ---------------------------------------------------------------------------

describe("classifyLandmarksWithBody", () => {
  test("returns wrong_body_orientation when standing body detected but lying_down required", () => {
    // A standing person: large y-spread AND wide x-spread (box width > 0 is needed for confidence)
    const lm = makeLandmarks({
      0: { x: 0.45, y: 0.05, visibility: 0.9 },
      11: { x: 0.3, y: 0.25, visibility: 0.9 },
      12: { x: 0.7, y: 0.25, visibility: 0.9 },
      23: { x: 0.4, y: 0.55, visibility: 0.9 },
      24: { x: 0.6, y: 0.55, visibility: 0.9 },
      27: { x: 0.45, y: 0.92, visibility: 0.9 },
      28: { x: 0.55, y: 0.92, visibility: 0.9 },
    });
    const result = classifyLandmarksWithBody(lm, "left_side", "lying_down", DEFAULT_CONFIG);
    expect(result.rawState).toBe("wrong_body_orientation");
  });
});

// ---------------------------------------------------------------------------
// debouncePositionState
// ---------------------------------------------------------------------------

describe("debouncePositionState", () => {
  test("commits first state immediately", () => {
    const ds: DebounceState = { committedState: null, candidateState: null, candidateSince: 0 };
    const { result } = debouncePositionState(ds, "too_far", 1000, 1.8);
    expect(result).toBe("too_far");
  });

  test("holds previous committed state before debounce window elapses", () => {
    const ds: DebounceState = { committedState: "too_far", candidateState: null, candidateSince: 0 };
    const { result, next } = debouncePositionState(ds, "ready", 500, 1.8);
    expect(result).toBe("too_far"); // still holding
    // Try again just before the debounce window
    const { result: result2 } = debouncePositionState(next, "ready", 500 + 1799, 1.8);
    expect(result2).toBe("too_far");
  });

  test("commits new state after debounce window elapses", () => {
    const ds: DebounceState = { committedState: "too_far", candidateState: null, candidateSince: 0 };
    const { next } = debouncePositionState(ds, "ready", 1000, 1.8);
    // After 1.8s the new state should commit
    const { result } = debouncePositionState(next, "ready", 1000 + 1800, 1.8);
    expect(result).toBe("ready");
  });
});

// ---------------------------------------------------------------------------
// getPartialGuidance
// ---------------------------------------------------------------------------

describe("getPartialGuidance", () => {
  test("returns no_person message when visible indices is empty", () => {
    const msg = getPartialGuidance([], makeLandmarks());
    expect(msg).toContain("No one detected");
  });

  test("returns upper-body message when only face/shoulders visible", () => {
    const visibleIndices = [0, 1, 11, 12]; // face + shoulders
    const msg = getPartialGuidance(visibleIndices, makeLandmarks());
    expect(msg).toContain("upper body");
  });

  test("BODY_REGIONS has expected number of regions", () => {
    expect(BODY_REGIONS.length).toBeGreaterThan(5);
  });
});
