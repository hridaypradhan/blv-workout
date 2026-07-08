import { RepEvent, FormError } from "@/types";

/**
 * Supported pose provider sources.
 * 'prototype' for fake/simulated timestamp-based tracking.
 * 'camera_mediapipe' for browser-based webcam tracking using MediaPipe.
 */
export type PoseProviderSource = "prototype" | "camera_mediapipe";

/**
 * Status of the pose detection runtime.
 */
export type PoseRuntimeStatus =
  | "offline"
  | "initializing"
  | "active"
  | "unavailable"
  | "error";

/**
 * Dictionary mapping joint names to current angles in degrees.
 */
export type JointAngles = Record<string, number>;

export type SpecificPoseStatus =
  | "model_loading"
  | "camera_unavailable"
  | "body_not_detected"
  | "too_close"
  | "lower_body_missing"
  | "required_joints_missing"
  | "low_confidence"
  | "unsupported_exercise"
  | "mediapipe_active"
  | "prototype_fallback_active";

export interface PoseStatusDetails {
  status: SpecificPoseStatus;
  label: string;
  guidance: string;
}

/**
 * Standard interface returned by pose tracking runtimes.
 */
export interface PoseRuntimeContract {
  poseData: object | null;
  isReady: boolean;
  providerSource: PoseProviderSource;
  runtimeStatus: PoseRuntimeStatus;
  isTracking: boolean;
  startTracking: () => void;
  stopTracking: () => void;
  currentAngles: JointAngles;
  latestRepEvent: RepEvent | null;
  latestFormError: FormError | null;
  trackingStatusLabel: string;
  specificPoseStatus?: SpecificPoseStatus;
  poseStatusDetails?: PoseStatusDetails;
}
