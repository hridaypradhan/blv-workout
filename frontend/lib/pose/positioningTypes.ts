/**
 * Discrete positioning states emitted by the PositioningGuide.
 */
export type PositionState =
  | "no_person"
  | "partial"
  | "body_not_fully_visible"
  | "too_close"
  | "too_far"
  | "off_left"
  | "off_right"
  | "wrong_orientation"
  | "wrong_body_orientation"
  | "ready";

/**
 * Intended camera orientation relative to the user's body.
 */
export type CameraOrientation = "front" | "left_side" | "right_side";

/**
 * Expected body alignment/posture for an exercise.
 */
export type BodyOrientation = "standing" | "lying_down";

/**
 * Setup/positioning requirement for a specific exercise.
 */
export interface PoseRequirement {
  exerciseId: string;
  requiredCameraOrientation: CameraOrientation;
  requiredBodyOrientation: BodyOrientation;
  minVisibleLandmarks?: number[]; // list of required landmark indices
  targetHeightMin?: number;      // target height bounds relative to the frame
  targetHeightMax?: number;
}
