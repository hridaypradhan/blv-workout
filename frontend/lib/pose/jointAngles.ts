import { NormalizedLandmark } from "@/lib/hooks/useMediaPipePoseLandmarker";

export const LANDMARK_INDICES = {
  left_shoulder: 11,
  right_shoulder: 12,
  left_elbow: 13,
  right_elbow: 14,
  left_wrist: 15,
  right_wrist: 16,
  left_hip: 23,
  right_hip: 24,
  left_knee: 25,
  right_knee: 26,
  left_ankle: 27,
  right_ankle: 28,
};

/**
 * Calculates the 2D angle (in degrees) formed by three landmarks on the x-y plane.
 * B is the vertex (the joint itself).
 */
export function calculateTripletAngle2D(
  a: NormalizedLandmark,
  b: NormalizedLandmark,
  c: NormalizedLandmark
): number {
  const baX = a.x - b.x;
  const baY = a.y - b.y;

  const bcX = c.x - b.x;
  const bcY = c.y - b.y;

  const dot = baX * bcX + baY * bcY;
  const magBA = Math.sqrt(baX * baX + baY * baY);
  const magBC = Math.sqrt(bcX * bcX + bcY * bcY);

  if (magBA === 0 || magBC === 0) {
    return 0;
  }

  let cosVal = dot / (magBA * magBC);
  // Clamp to avoid floating point precision issues
  if (cosVal > 1) cosVal = 1;
  if (cosVal < -1) cosVal = -1;

  const radians = Math.acos(cosVal);
  return (radians * 180) / Math.PI;
}

/**
 * Calculates the 3D angle (in degrees) formed by three landmarks including the z coordinate.
 * B is the vertex (the joint itself).
 */
export function calculateTripletAngle3D(
  a: NormalizedLandmark,
  b: NormalizedLandmark,
  c: NormalizedLandmark
): number {
  const baX = a.x - b.x;
  const baY = a.y - b.y;
  const baZ = (a.z ?? 0) - (b.z ?? 0);

  const bcX = c.x - b.x;
  const bcY = c.y - b.y;
  const bcZ = (c.z ?? 0) - (b.z ?? 0);

  const dot = baX * bcX + baY * bcY + baZ * bcZ;
  const magBA = Math.sqrt(baX * baX + baY * baY + baZ * baZ);
  const magBC = Math.sqrt(bcX * bcX + bcY * bcY + bcZ * bcZ);

  if (magBA === 0 || magBC === 0) {
    return 0;
  }

  let cosVal = dot / (magBA * magBC);
  // Clamp to avoid floating point precision issues
  if (cosVal > 1) cosVal = 1;
  if (cosVal < -1) cosVal = -1;

  const radians = Math.acos(cosVal);
  return (radians * 180) / Math.PI;
}

/**
 * Extracts key joint angles from a list of landmarks.
 * Uses 2D projections since standard exercise constraints align with camera coordinates.
 */
export function extractJointAngles(landmarks: NormalizedLandmark[]): Record<string, number> {
  const angles: Record<string, number> = {};

  const getLM = (idx: number): NormalizedLandmark | undefined => landmarks[idx];

  // Left Elbow: left_shoulder(11) -> left_elbow(13) -> left_wrist(15)
  const lShoulder = getLM(LANDMARK_INDICES.left_shoulder);
  const lElbow = getLM(LANDMARK_INDICES.left_elbow);
  const lWrist = getLM(LANDMARK_INDICES.left_wrist);
  if (lShoulder && lElbow && lWrist) {
    angles.left_elbow = calculateTripletAngle2D(lShoulder, lElbow, lWrist);
  }

  // Right Elbow: right_shoulder(12) -> right_elbow(14) -> right_wrist(16)
  const rShoulder = getLM(LANDMARK_INDICES.right_shoulder);
  const rElbow = getLM(LANDMARK_INDICES.right_elbow);
  const rWrist = getLM(LANDMARK_INDICES.right_wrist);
  if (rShoulder && rElbow && rWrist) {
    angles.right_elbow = calculateTripletAngle2D(rShoulder, rElbow, rWrist);
  }

  // Left Knee: left_hip(23) -> left_knee(25) -> left_ankle(27)
  const lHip = getLM(LANDMARK_INDICES.left_hip);
  const lKnee = getLM(LANDMARK_INDICES.left_knee);
  const lAnkle = getLM(LANDMARK_INDICES.left_ankle);
  if (lHip && lKnee && lAnkle) {
    angles.left_knee = calculateTripletAngle2D(lHip, lKnee, lAnkle);
  }

  // Right Knee: right_hip(24) -> right_knee(26) -> right_ankle(28)
  const rHip = getLM(LANDMARK_INDICES.right_hip);
  const rKnee = getLM(LANDMARK_INDICES.right_knee);
  const rAnkle = getLM(LANDMARK_INDICES.right_ankle);
  if (rHip && rKnee && rAnkle) {
    angles.right_knee = calculateTripletAngle2D(rHip, rKnee, rAnkle);
  }

  // Left Hip: left_shoulder(11) -> left_hip(23) -> left_knee(25)
  if (lShoulder && lHip && lKnee) {
    angles.left_hip = calculateTripletAngle2D(lShoulder, lHip, lKnee);
  }

  // Right Hip: right_shoulder(12) -> right_hip(24) -> right_knee(26)
  if (rShoulder && rHip && rKnee) {
    angles.right_hip = calculateTripletAngle2D(rShoulder, rHip, rKnee);
  }

  return angles;
}

/**
 * Calculates a 2D angle only if all three landmarks satisfy a minimum visibility threshold.
 */
export function calculateTripletAngle2DConfidenceAware(
  a: NormalizedLandmark | undefined,
  b: NormalizedLandmark | undefined,
  c: NormalizedLandmark | undefined,
  minVisibility: number = 0.5
): number | undefined {
  if (!a || !b || !c) return undefined;
  if (
    (a.visibility ?? 0) < minVisibility ||
    (b.visibility ?? 0) < minVisibility ||
    (c.visibility ?? 0) < minVisibility
  ) {
    return undefined;
  }
  return calculateTripletAngle2D(a, b, c);
}

/**
 * Exponential moving average (EMA) smoothing helper.
 * alpha is the weight of the new reading (between 0 and 1).
 */
export function smoothAngle(
  current: number,
  previous: number | undefined,
  alpha: number = 0.3
): number {
  if (previous === undefined || isNaN(previous)) {
    return current;
  }
  return alpha * current + (1 - alpha) * previous;
}

/**
 * Selects the active side ('left' or 'right') based on preferred setting or higher confidence.
 */
export function selectActiveSide(
  leftConfidence: number,
  rightConfidence: number,
  preferredSide?: "left" | "right" | "both"
): "left" | "right" {
  if (preferredSide === "left") return "left";
  if (preferredSide === "right") return "right";
  return leftConfidence >= rightConfidence ? "left" : "right";
}

