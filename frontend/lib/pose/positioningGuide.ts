/**
 * positioningGuide.ts
 *
 * Stateful orchestrator: wraps the pure classifier math and guidance text
 * modules into a class API consumed by SetupPositioningGuidePanel and tests.
 *
 * Pure math → positioningClassifier.ts
 * BLV text  → positioningGuidanceText.ts
 */

import { PositionState, CameraOrientation, BodyOrientation } from "./positioningTypes";
import { NormalizedLandmark } from "../hooks/useMediaPipePoseLandmarker";
import { getBLVTextGuidance } from "./positioningGuidanceText";
import {
  classifyLandmarksWithBody,
  detectCameraOrientation,
  computeShoulderRatio,
  DebounceState,
  debouncePositionState,
} from "./positioningClassifier";

// Re-export text helper for backward compat (some components import it directly).
export { getBLVTextGuidance };

// ---------------------------------------------------------------------------
// Config + result types (kept here as the public surface of this module)
// ---------------------------------------------------------------------------

export interface PositioningConfig {
  visibilityThreshold?: number;
  sideVisibilityThreshold?: number;
  minVisibleFraction?: number;
  minBoxHeightForGuidance?: number;
  targetHeightMin?: number;
  targetHeightMax?: number;
  sideMargin?: number;
  centerTolerance?: number;
  debounceSeconds?: number;
  readyHoldSeconds?: number;
  mirroredView?: boolean;
}

export interface PositioningResult {
  state: PositionState;
  guidance: string;
  isReady: boolean;
  visibleFraction: number;
}

// ---------------------------------------------------------------------------
// PositioningGuide — stateful orchestrator
// ---------------------------------------------------------------------------

export class PositioningGuide {
  private config: Required<PositioningConfig>;
  private cameraOrientation: CameraOrientation;
  private bodyOrientation: BodyOrientation;

  private debounceState: DebounceState = {
    committedState: null,
    candidateState: null,
    candidateSince: 0,
  };

  private lastAnnouncedGuidance: string | null = null;
  private readySince: number | null = null;
  private readyConfirmed = false;
  private personalFrontRatio: number | null = null;

  constructor(
    cameraOrientation: CameraOrientation = "front",
    bodyOrientation: BodyOrientation = "standing",
    config?: PositioningConfig
  ) {
    this.cameraOrientation = cameraOrientation;
    this.bodyOrientation = bodyOrientation;
    this.config = {
      visibilityThreshold: config?.visibilityThreshold ?? 0.65,
      sideVisibilityThreshold: config?.sideVisibilityThreshold ?? 0.5,
      minVisibleFraction: config?.minVisibleFraction ?? 0.85,
      minBoxHeightForGuidance: config?.minBoxHeightForGuidance ?? 0.15,
      targetHeightMin: config?.targetHeightMin ?? 0.58,
      targetHeightMax: config?.targetHeightMax ?? 0.88,
      sideMargin: config?.sideMargin ?? 0.08,
      centerTolerance: config?.centerTolerance ?? 0.1,
      debounceSeconds: config?.debounceSeconds ?? 1.8,
      readyHoldSeconds: config?.readyHoldSeconds ?? 2.5,
      mirroredView: config?.mirroredView ?? false,
    };
  }

  public process(
    landmarks: NormalizedLandmark[] | undefined,
    now: number,
    aspectRatio = 1.33
  ): PositioningResult {
    if (!landmarks || landmarks.length === 0) {
      const { result: state, next } = debouncePositionState(
        this.debounceState,
        "no_person",
        now,
        this.config.debounceSeconds
      );
      this.debounceState = next;
      const isReady = this.updateReady(state, now);
      return {
        state,
        guidance: "No one detected. Step in front of the camera.",
        isReady,
        visibleFraction: 0,
      };
    }

    const { rawState, visibleFraction, partialGuidance, bestLm } =
      classifyLandmarksWithBody(
        landmarks,
        this.cameraOrientation,
        this.bodyOrientation === "lying_down" ? "lying_down" : "standing",
        this.config
      );

    const { result: state, next } = debouncePositionState(
      this.debounceState,
      rawState,
      now,
      this.config.debounceSeconds
    );
    this.debounceState = next;

    let finalState: PositionState = state;

    if (state === "ready") {
      const actualFacing = detectCameraOrientation(bestLm, aspectRatio, this.personalFrontRatio);
      const requiresSide =
        this.cameraOrientation === "left_side" || this.cameraOrientation === "right_side";

      if (requiresSide) {
        if (actualFacing !== "side") finalState = "wrong_orientation";
      } else {
        if (actualFacing === "side") finalState = "wrong_orientation";
      }

      if (finalState === "ready" && this.bodyOrientation !== "standing") {
        // Additional lying-down check already handled by classifyLandmarksWithBody;
        // this branch handles the edge case where body orientation wasn't confidently
        // detected but we're in a ready state that requires lying_down.
        // classifyLandmarksWithBody handles it — no additional check needed here.
      }
    }

    const isReady = this.updateReady(finalState, now, bestLm, aspectRatio);

    const guidance = getBLVTextGuidance(finalState, {
      partialGuidance,
      cameraOrientation: this.cameraOrientation,
      bodyOrientation: this.bodyOrientation,
      mirroredView: this.config.mirroredView,
    });

    return {
      state: finalState,
      guidance,
      isReady,
      visibleFraction,
    };
  }

  private updateReady(
    state: PositionState,
    now: number,
    lm?: NormalizedLandmark[],
    aspectRatio = 1.33
  ): boolean {
    if (state !== "ready") {
      this.readySince = null;
      this.readyConfirmed = false;
      return false;
    }

    if (lm && this.personalFrontRatio === null) {
      const ratio = computeShoulderRatio(lm, aspectRatio);
      if (ratio >= 0.22) {
        this.personalFrontRatio = ratio;
        console.log(`[positioning] calibrated front ratio: ${ratio.toFixed(3)}`);
      }
    }

    if (this.readySince === null) {
      this.readySince = now;
      return false;
    }

    const confirmed = now - this.readySince >= this.config.readyHoldSeconds * 1000;
    if (confirmed) this.readyConfirmed = true;
    return confirmed;
  }

  public reset() {
    this.debounceState = { committedState: null, candidateState: null, candidateSince: 0 };
    this.lastAnnouncedGuidance = null;
    this.readySince = null;
    this.readyConfirmed = false;
    this.personalFrontRatio = null;
  }
}

// ---------------------------------------------------------------------------
// Pose requirement helper (public utility — anchor name → orientation config)
// ---------------------------------------------------------------------------

export interface PoseRequirementSimple {
  cameraOrientation: CameraOrientation;
  bodyOrientation: BodyOrientation;
}

export function getPoseRequirementForAnchor(anchorName: string): PoseRequirementSimple {
  const name = anchorName.toLowerCase();
  if (
    name.includes("pushup") ||
    name.includes("push-up") ||
    name.includes("plank") ||
    name.includes("lying") ||
    name.includes("bridge") ||
    name.includes("floor")
  ) {
    return { cameraOrientation: "left_side", bodyOrientation: "lying_down" };
  }
  if (name.includes("squat") || name.includes("lunge")) {
    return { cameraOrientation: "front", bodyOrientation: "standing" };
  }
  return { cameraOrientation: "front", bodyOrientation: "standing" };
}
