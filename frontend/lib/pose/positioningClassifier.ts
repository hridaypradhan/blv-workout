/**
 * positioningClassifier.ts
 *
 * Pure pose classification math — no state, no React, no text guidance.
 * All functions are deterministic: same landmarks in → same result out.
 */

import { PositionState, CameraOrientation } from "./positioningTypes";
import { NormalizedLandmark } from "../hooks/useMediaPipePoseLandmarker";
import { PositioningConfig } from "./positioningGuide";

// ---------------------------------------------------------------------------
// Body region / landmark metadata
// ---------------------------------------------------------------------------

export const BODY_REGIONS: { label: string; indices: number[] }[] = [
  { label: "face", indices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  { label: "shoulders", indices: [11, 12] },
  { label: "arms", indices: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22] },
  { label: "hips", indices: [23, 24] },
  { label: "knees", indices: [25, 26] },
  { label: "ankles", indices: [27, 28] },
  { label: "feet", indices: [29, 30, 31, 32] },
];

export const BOTTOM_ONLY_REGIONS = ["ankles", "feet", "knees"];

export const LANDMARK_NAMES: Record<number, string> = {
  0: "face", 1: "face", 2: "face", 3: "face", 4: "face",
  5: "face", 6: "face", 7: "face", 8: "face", 9: "face", 10: "face",
  11: "left shoulder", 12: "right shoulder",
  13: "left elbow", 14: "right elbow",
  15: "left wrist", 16: "right wrist",
  23: "left hip", 24: "right hip",
  25: "left knee", 26: "right knee",
  27: "left ankle", 28: "right ankle",
  29: "left foot", 30: "right foot",
  31: "left foot", 32: "right foot",
};

// ---------------------------------------------------------------------------
// Partial guidance text builder
// ---------------------------------------------------------------------------

export function getPartialGuidance(visibleIndices: number[], landmarks: NormalizedLandmark[]): string {
  const visible = new Set(visibleIndices);
  const active = BODY_REGIONS.filter((r) => r.indices.some((idx) => visible.has(idx))).map(
    (r) => r.label
  );

  if (active.length === 0) {
    return "No one detected. Step in front of the camera.";
  }

  const bottomOnly = active.every((r) => BOTTOM_ONLY_REGIONS.includes(r));
  const top = active.includes("face") || active.includes("shoulders");
  const hasHips = active.includes("hips");
  const hasLegs = active.includes("knees") || active.includes("ankles") || active.includes("feet");

  if (top && !hasLegs) {
    return "I can see your upper body but not your feet. Step back one step.";
  }
  if (top && hasHips && !hasLegs) {
    return "I can see your shoulders and hips but not your feet. Step back one step.";
  }
  if (bottomOnly) {
    return "Only your lower body is visible. Step back so your whole body is in frame.";
  }

  if (active.length === 1) {
    const region = BODY_REGIONS.find((r) => r.label === active[0])!;
    let bestIdx = region.indices[0];
    let maxVis = -1;
    for (const idx of region.indices) {
      if (landmarks[idx] && (landmarks[idx].visibility ?? 0) > maxVis) {
        maxVis = landmarks[idx].visibility ?? 0;
        bestIdx = idx;
      }
    }
    const part = LANDMARK_NAMES[bestIdx] || active[0];
    return `I can only see your ${part}. Step back so your whole body is in frame.`;
  }

  return "Part of your body is out of frame. Step back so your whole body is visible.";
}

// ---------------------------------------------------------------------------
// Shoulder ratio (orientation detection helper)
// ---------------------------------------------------------------------------

export function computeShoulderRatio(lm: NormalizedLandmark[], aspectRatio: number): number {
  const visibleYs = lm.filter((p) => (p.visibility ?? 0) >= 0.5).map((p) => p.y);
  if (visibleYs.length === 0) return 0.0;
  const bodyHeight = Math.max(...visibleYs) - Math.min(...visibleYs);
  if (bodyHeight < 0.01) return 0.0;

  const leftShoulder = lm[11];
  const rightShoulder = lm[12];
  if (!leftShoulder || !rightShoulder) return 0.0;

  const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x) * aspectRatio;
  return shoulderWidth / bodyHeight;
}

// ---------------------------------------------------------------------------
// Camera-facing orientation detection
// ---------------------------------------------------------------------------

export function detectCameraOrientation(
  lm: NormalizedLandmark[],
  aspectRatio: number,
  personalFrontRatio: number | null
): "front" | "side" | "unknown" {
  const ratio = computeShoulderRatio(lm, aspectRatio);
  if (ratio === 0.0) return "unknown";

  const fallbackFrontRatio = 0.22;
  const sideFraction = 0.55;

  let frontThresh = fallbackFrontRatio;
  let sideThresh = fallbackFrontRatio * sideFraction;

  if (personalFrontRatio !== null) {
    frontThresh = personalFrontRatio * 0.75;
    sideThresh = personalFrontRatio * sideFraction;
  }

  if (ratio >= frontThresh) return "front";
  if (ratio <= sideThresh) return "side";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Body posture orientation detection
// ---------------------------------------------------------------------------

export function detectBodyPosture(lm: NormalizedLandmark[]): "standing" | "lying_down" | "unknown" {
  const bodySpreadLandmarks = [11, 12, 23, 24, 27, 28];
  const ys = bodySpreadLandmarks
    .map((i) => lm[i])
    .filter((p) => p && (p.visibility ?? 0) >= 0.4)
    .map((p) => p.y);

  if (ys.length < 4) return "unknown";

  const spread = Math.max(...ys) - Math.min(...ys);
  const standingSpread = 0.45;
  const lyingSpread = 0.28;

  if (spread > standingSpread) return "standing";
  if (spread < lyingSpread) return "lying_down";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Raw landmark classification (visibility + bounding box analysis)
// ---------------------------------------------------------------------------

export interface ClassifyResult {
  rawState: PositionState;
  visibleFraction: number;
  partialGuidance?: string;
  bestLm: NormalizedLandmark[];
}

export function classifyLandmarks(
  lm: NormalizedLandmark[],
  cameraOrientation: CameraOrientation,
  config: Required<PositioningConfig>
): ClassifyResult {
  const visibleAll = lm
    .map((l, i) => ({ landmark: l, idx: i }))
    .filter((item) => (item.landmark.visibility ?? 0) >= config.visibilityThreshold)
    .map((item) => item.idx);

  if (visibleAll.length === 0) {
    return { rawState: "no_person", visibleFraction: 0, bestLm: lm };
  }

  const requiresSide =
    cameraOrientation === "left_side" || cameraOrientation === "right_side";
  let visibleFraction = 0;
  let anklesVisible = false;

  if (requiresSide) {
    const thresh = config.sideVisibilityThreshold;
    const requiredScores = [
      lm[0]?.visibility ?? 0,
      Math.max(lm[11]?.visibility ?? 0, lm[12]?.visibility ?? 0),
      Math.max(lm[23]?.visibility ?? 0, lm[24]?.visibility ?? 0),
      Math.max(lm[27]?.visibility ?? 0, lm[28]?.visibility ?? 0),
    ];
    visibleFraction = requiredScores.filter((s) => s >= thresh).length / requiredScores.length;
    anklesVisible = Math.max(lm[27]?.visibility ?? 0, lm[28]?.visibility ?? 0) >= thresh;
  } else {
    const requiredIndices = [0, 11, 12, 23, 24, 27, 28];
    const visibleRequired = requiredIndices.filter(
      (i) => lm[i] && (lm[i].visibility ?? 0) >= config.visibilityThreshold
    );
    visibleFraction = visibleRequired.length / requiredIndices.length;
    anklesVisible = visibleRequired.includes(27) && visibleRequired.includes(28);
  }

  if (visibleFraction < config.minVisibleFraction || !anklesVisible) {
    return {
      rawState: "body_not_fully_visible",
      visibleFraction,
      partialGuidance: getPartialGuidance(visibleAll, lm),
      bestLm: lm,
    };
  }

  const xs = visibleAll.map((i) => lm[i].x);
  const ys = visibleAll.map((i) => lm[i].y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);

  const boxHeight = yMax - yMin;
  const boxWidth = xMax - xMin;
  const boxCenterX = (xMin + xMax) / 2.0;

  // Confident body orientation mismatch: check before distance/centering.
  const actualBody = detectBodyPosture(lm);
  const isLyingDownConfidently = actualBody === "lying_down" && boxWidth > 0.35;
  const isStandingConfidently = actualBody === "standing";

  // Note: wrong_body_orientation check against requiredBodyOrientation happens
  // in PositioningGuide.process() after this function returns, to keep this
  // function dependency-free from bodyOrientation config.
  // We still need to surface it here for the standing case when gate is for lying.
  // The caller passes bodyOrientation via the classify call, so we accept it as a param.
  // Handled in classifyLandmarksWithBody below.

  void isLyingDownConfidently; // used in classifyLandmarksWithBody
  void isStandingConfidently;

  if (boxHeight < config.minBoxHeightForGuidance) {
    return { rawState: "too_far", visibleFraction, bestLm: lm };
  }

  const centerOff = boxCenterX - 0.5;
  const offImageLeft = xMin < config.sideMargin || centerOff < -config.centerTolerance;
  const offImageRight = xMax > 1.0 - config.sideMargin || centerOff > config.centerTolerance;

  let userOffLeft = false;
  let userOffRight = false;
  if (config.mirroredView) {
    userOffLeft = offImageRight;
    userOffRight = offImageLeft;
  } else {
    userOffLeft = offImageLeft;
    userOffRight = offImageRight;
  }

  if (userOffLeft) return { rawState: "off_left", visibleFraction, bestLm: lm };
  if (userOffRight) return { rawState: "off_right", visibleFraction, bestLm: lm };

  if (boxHeight > config.targetHeightMax) {
    return { rawState: "too_close", visibleFraction, bestLm: lm };
  }
  if (boxHeight < config.targetHeightMin) {
    return { rawState: "too_far", visibleFraction, bestLm: lm };
  }

  return { rawState: "ready", visibleFraction, bestLm: lm };
}

// ---------------------------------------------------------------------------
// Full classification including body orientation gating
// ---------------------------------------------------------------------------

export function classifyLandmarksWithBody(
  lm: NormalizedLandmark[],
  cameraOrientation: CameraOrientation,
  bodyOrientation: "standing" | "lying_down",
  config: Required<PositioningConfig>
): ClassifyResult {
  const result = classifyLandmarks(lm, cameraOrientation, config);

  // If partially visible or no person — don't override with body orientation
  if (result.rawState !== "ready" && result.rawState !== "too_far") {
    // Still check for confident wrong-body-orientation before distance cues
    if (result.rawState === "body_not_fully_visible" || result.rawState === "no_person") {
      return result;
    }
  }

  // Confident body orientation mismatch check (done after bounding box is available)
  const xs = result.bestLm
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => (l.visibility ?? 0) >= config.visibilityThreshold)
    .map(({ l }) => l.x);
  const boxWidth = xs.length > 0 ? Math.max(...xs) - Math.min(...xs) : 0;

  const actualBody = detectBodyPosture(lm);
  const isLyingDownConfidently = actualBody === "lying_down" && boxWidth > 0.35;
  const isStandingConfidently = actualBody === "standing";

  if (isLyingDownConfidently && bodyOrientation === "standing") {
    return { rawState: "wrong_body_orientation", visibleFraction: result.visibleFraction, bestLm: lm };
  }
  if (isStandingConfidently && bodyOrientation === "lying_down") {
    return { rawState: "wrong_body_orientation", visibleFraction: result.visibleFraction, bestLm: lm };
  }

  return result;
}

// ---------------------------------------------------------------------------
// State debouncer (pure — caller tracks committed/candidate state)
// ---------------------------------------------------------------------------

export interface DebounceState {
  committedState: PositionState | null;
  candidateState: PositionState | null;
  candidateSince: number;
}

export function debouncePositionState(
  ds: DebounceState,
  rawState: PositionState,
  now: number,
  debounceSeconds: number
): { result: PositionState; next: DebounceState } {
  let { committedState, candidateState, candidateSince } = ds;

  if (committedState === null) {
    committedState = rawState;
  }

  if (rawState !== candidateState) {
    candidateState = rawState;
    candidateSince = now;
  } else if (
    rawState !== committedState &&
    now - candidateSince >= debounceSeconds * 1000
  ) {
    committedState = rawState;
  }

  return {
    result: committedState,
    next: { committedState, candidateState, candidateSince },
  };
}
