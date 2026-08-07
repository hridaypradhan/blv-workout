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

/**
 * Triplet definitions for 16 joint angles (vertex landmark is the middle item).
 */
export const ANGLE_TRIPLETS: Record<string, [string, string, string]> = {
  neck_left: ["LEFT_HIP", "LEFT_SHOULDER", "LEFT_EAR"],
  neck_right: ["RIGHT_HIP", "RIGHT_SHOULDER", "RIGHT_EAR"],
  shoulder_left: ["LEFT_HIP", "LEFT_SHOULDER", "LEFT_ELBOW"],
  shoulder_right: ["RIGHT_HIP", "RIGHT_SHOULDER", "RIGHT_ELBOW"],
  elbow_left: ["LEFT_SHOULDER", "LEFT_ELBOW", "LEFT_WRIST"],
  elbow_right: ["RIGHT_SHOULDER", "RIGHT_ELBOW", "RIGHT_WRIST"],
  wrist_left: ["LEFT_ELBOW", "LEFT_WRIST", "LEFT_INDEX"],
  wrist_right: ["RIGHT_ELBOW", "RIGHT_WRIST", "RIGHT_INDEX"],
  body_line_left: ["LEFT_SHOULDER", "LEFT_HIP", "LEFT_ANKLE"],
  body_line_right: ["RIGHT_SHOULDER", "RIGHT_HIP", "RIGHT_ANKLE"],
  hip_left: ["LEFT_SHOULDER", "LEFT_HIP", "LEFT_KNEE"],
  hip_right: ["RIGHT_SHOULDER", "RIGHT_HIP", "RIGHT_KNEE"],
  knee_left: ["LEFT_HIP", "LEFT_KNEE", "LEFT_ANKLE"],
  knee_right: ["RIGHT_HIP", "RIGHT_KNEE", "RIGHT_ANKLE"],
  ankle_left: ["LEFT_KNEE", "LEFT_ANKLE", "LEFT_FOOT_INDEX"],
  ankle_right: ["RIGHT_KNEE", "RIGHT_ANKLE", "RIGHT_FOOT_INDEX"],
};

/**
 * Undirected bone-pair alignment angle definitions.
 */
export const ALIGNMENT_PAIRS: Record<string, [string, string]> = {
  torso_shin_left: ["torso_left", "shin_left"],
  torso_shin_right: ["torso_right", "shin_right"],
  torso_forearm_left: ["torso_left", "forearm_left"],
  torso_forearm_right: ["torso_right", "forearm_right"],
};

/**
 * Spoken accessible cues for bone-pair alignment angles.
 */
export const ALIGNMENT_CUES: Record<string, string> = {
  torso_shin_left: "Keep your back and shins tilting together; do not let your chest drop or your shins cave.",
  torso_shin_right: "Keep your back and shins tilting together; do not let your chest drop or your shins cave.",
  torso_forearm_left: "Keep your forearm angle steady against your torso; do not swing the weight.",
  torso_forearm_right: "Keep your forearm angle steady against your torso; do not swing the weight.",
};

/**
 * Human-readable spoken/display labels for angles.
 */
export const ANGLE_LABELS: Record<string, string> = {
  neck_left: "left neck",
  neck_right: "right neck",
  shoulder_left: "left shoulder",
  shoulder_right: "right shoulder",
  elbow_left: "left elbow",
  elbow_right: "right elbow",
  wrist_left: "left wrist",
  wrist_right: "right wrist",
  body_line_left: "left body line",
  body_line_right: "right body line",
  hip_left: "left hip",
  hip_right: "right hip",
  knee_left: "left knee",
  knee_right: "right knee",
  ankle_left: "left ankle",
  ankle_right: "right ankle",
  torso_shin_left: "left back-and-shin line",
  torso_shin_right: "right back-and-shin line",
  torso_forearm_left: "left forearm-to-torso angle",
  torso_forearm_right: "right forearm-to-torso angle",
};

/**
 * Angle groups by body region.
 */
export const BODY_REGION_ANGLES: Record<string, string[]> = {
  upper_body: [
    "neck_left", "neck_right",
    "shoulder_left", "shoulder_right",
    "elbow_left", "elbow_right",
    "wrist_left", "wrist_right",
    "torso_forearm_left", "torso_forearm_right",
  ],
  lower_body: [
    "hip_left", "hip_right",
    "knee_left", "knee_right",
    "ankle_left", "ankle_right",
    "torso_shin_left", "torso_shin_right",
  ],
  core: [
    "neck_left", "neck_right",
    "shoulder_left", "shoulder_right",
    "body_line_left", "body_line_right",
    "hip_left", "hip_right",
  ],
  full_body: [
    "neck_left", "neck_right",
    "shoulder_left", "shoulder_right",
    "elbow_left", "elbow_right",
    "wrist_left", "wrist_right",
    "body_line_left", "body_line_right",
    "hip_left", "hip_right",
    "knee_left", "knee_right",
    "ankle_left", "ankle_right",
    "torso_shin_left", "torso_shin_right",
    "torso_forearm_left", "torso_forearm_right",
  ],
};

/**
 * Resolves mirrored left/right angle or bone names (_left <-> _right, or left_ <-> right_).
 */
export function mirrorSideName(name: string): string {
  if (name.endsWith("_left")) {
    return name.slice(0, -5) + "_right";
  }
  if (name.endsWith("_right")) {
    return name.slice(0, -6) + "_left";
  }
  if (name.startsWith("left_")) {
    return "right_" + name.slice(5);
  }
  if (name.startsWith("right_")) {
    return "left_" + name.slice(6);
  }
  return name;
}

/**
 * Returns a human-readable label or side-less joint description for an angle key.
 */
export function jointLabel(name: string): string {
  if (ANGLE_LABELS[name]) {
    return ANGLE_LABELS[name];
  }
  let cleanName = name;
  for (const suffix of ["_left", "_right"]) {
    if (cleanName.endsWith(suffix)) {
      cleanName = cleanName.slice(0, -suffix.length);
      break;
    }
  }
  return cleanName.replace(/_/g, " ");
}

/**
 * Resolves the angle value for `name` from an angles map, falling back to its
 * mirrored counterpart (_left <-> _right, or left_ <-> right_).
 */
export function resolveSide(angles: Record<string, number>, name: string): number | undefined {
  if (!angles || !name) return undefined;

  const tryLookup = (k: string): number | undefined => {
    const val = angles[k];
    if (val !== undefined && !isNaN(val)) return val;
    return undefined;
  };

  // Direct lookup
  let v = tryLookup(name);
  if (v !== undefined) return v;

  // Normalized prefix/suffix format (e.g. left_elbow <-> elbow_left)
  let altName = name;
  if (name.startsWith("left_")) {
    altName = `${name.slice(5)}_left`;
  } else if (name.startsWith("right_")) {
    altName = `${name.slice(6)}_right`;
  } else if (name.endsWith("_left")) {
    altName = `left_${name.slice(0, -5)}`;
  } else if (name.endsWith("_right")) {
    altName = `right_${name.slice(0, -6)}`;
  }

  v = tryLookup(altName);
  if (v !== undefined) return v;

  // Mirrored side lookup
  const mirroredDirect = mirrorSideName(name);
  v = tryLookup(mirroredDirect);
  if (v !== undefined) return v;

  const mirroredAlt = mirrorSideName(altName);
  v = tryLookup(mirroredAlt);
  if (v !== undefined) return v;

  return undefined;
}
