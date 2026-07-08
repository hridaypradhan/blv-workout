/**
 * positioningGuidanceText.ts
 *
 * Pure BLV guidance text templates keyed by PositionState.
 * No pose math here — import classification state and produce human-readable strings.
 */

import { PositionState, CameraOrientation, BodyOrientation } from "./positioningTypes";

export function getBLVTextGuidance(
  state: PositionState,
  details: {
    partialGuidance?: string;
    cameraOrientation?: CameraOrientation;
    bodyOrientation?: BodyOrientation;
    mirroredView?: boolean;
  }
): string {
  const cameraOrientation = details.cameraOrientation ?? "front";
  const bodyOrientation = details.bodyOrientation ?? "standing";
  const mirroredView = details.mirroredView ?? false;

  switch (state) {
    case "no_person":
      return "No one detected. Step in front of the camera.";
    case "partial":
    case "body_not_fully_visible":
      return details.partialGuidance || "Part of your body is out of frame. Step back so your whole body is visible.";
    case "too_close":
      return "You're too close. Take one step back.";
    case "too_far":
      return "You're too far away. Take one step forward.";
    case "off_left":
      return mirroredView ? "Move one step to your left." : "Move one step to your right.";
    case "off_right":
      return mirroredView ? "Move one step to your right." : "Move one step to your left.";
    case "wrong_orientation":
      return cameraOrientation === "left_side" || cameraOrientation === "right_side"
        ? "Turn your body sideways to the camera."
        : "Turn your body to face the camera.";
    case "wrong_body_orientation":
      return bodyOrientation === "lying_down" ? "Lie down on the mat." : "Stand up straight.";
    case "ready":
      return "Good position. Hold still.";
    default:
      return "";
  }
}
