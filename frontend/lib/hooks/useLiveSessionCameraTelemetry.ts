"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Exercise, RuntimeObservationContext } from "@/types";
import { getCameraPreference } from "@/lib/camera/cameraPreference";
import { getExercisePoseProfile } from "@/lib/pose/exercisePoseProfiles";
import { SESSION_EVENTS } from "@/lib/sessionEvents";
import { useCameraStream } from "@/lib/hooks/useCameraStream";
import { useMediaPipePoseRuntime } from "@/lib/hooks/useMediaPipePoseRuntime";

type CameraStreamState = ReturnType<typeof useCameraStream>;
type MediaPipePoseRuntime = ReturnType<typeof useMediaPipePoseRuntime>;

interface UseLiveSessionCameraTelemetryProps {
  cameraStream: CameraStreamState;
  mediaPipePoseRuntime: MediaPipePoseRuntime;
  currentExercise: Exercise | null;
  currentTimeMs: number;
  isReady: boolean;
  cameraGatesDisabled: boolean;
  isMediaPipeUsable: boolean;
  activePoseProvider: "camera_mediapipe" | "prototype_pose";
  fallbackReason: string | null;
  announce: (message: string) => void;
  logSessionEvent: (
    eventType: string,
    timestampMs: number,
    metadata?: Record<string, unknown>
  ) => void;
}

export function useLiveSessionCameraTelemetry({
  cameraStream,
  mediaPipePoseRuntime,
  currentExercise,
  currentTimeMs,
  isReady,
  cameraGatesDisabled,
  isMediaPipeUsable,
  activePoseProvider,
  fallbackReason,
  announce,
  logSessionEvent,
}: UseLiveSessionCameraTelemetryProps) {
  const {
    status,
    stream,
    devices = [],
    selectedDeviceId = "",
    activeDeviceId = "",
    errorMessage,
    requestCamera,
  } = cameraStream;

  const autoStartRanRef = useRef(false);
  useEffect(() => {
    if (autoStartRanRef.current) return;
    autoStartRanRef.current = true;
    const preference = getCameraPreference();
    requestCamera(preference?.deviceId).catch((error: unknown) => {
      console.error("Failed to auto-start camera on session mount:", error);
    });
  }, [requestCamera]);

  useEffect(() => {
    if (!isReady || !currentExercise || cameraGatesDisabled || status !== "idle") {
      return;
    }
    requestCamera().catch((error: unknown) => {
      console.error("Auto camera request on transition failed:", error);
    });
  }, [
    cameraGatesDisabled,
    currentExercise,
    isReady,
    requestCamera,
    status,
  ]);

  const lastStreamDeviceIdRef = useRef<string | null>(null);
  const lastStreamStatusRef = useRef<string>("idle");
  useEffect(() => {
    if (status === "ready" && stream) {
      const activeDevice = devices.find(
        (device) => device.deviceId === activeDeviceId
      );
      const label = activeDevice?.label || "";

      if (
        activeDeviceId !== lastStreamDeviceIdRef.current ||
        lastStreamStatusRef.current !== "ready"
      ) {
        lastStreamDeviceIdRef.current = activeDeviceId;
        lastStreamStatusRef.current = "ready";

        const integratedLabels = [
          "integrated",
          "built-in",
          "facetime",
          "front",
          "isight",
          "internal",
        ];
        const isIntegrated = integratedLabels.some((token) =>
          label.toLowerCase().includes(token)
        );
        const preference = getCameraPreference();
        const preferenceLabel = (preference?.label || "").toLowerCase();
        const preferenceWasExternal =
          Boolean(preference) &&
          !integratedLabels.some((token) => preferenceLabel.includes(token));

        if (isIntegrated) {
          announce(
            preferenceWasExternal && activeDeviceId !== preference?.deviceId
              ? "External webcam unavailable. Switched to integrated webcam."
              : "Using integrated webcam."
          );
        } else {
          announce("Using external webcam.");
        }
      }
    } else if (
      status !== "idle" &&
      status !== "requesting" &&
      status !== lastStreamStatusRef.current
    ) {
      lastStreamStatusRef.current = status;
      lastStreamDeviceIdRef.current = null;
      announce("Camera unavailable. Using simulated fallback.");
    }
  }, [activeDeviceId, announce, devices, status, stream]);

  const runtimeObservationContext = useMemo(() => {
    const mediaPipeActive = mediaPipePoseRuntime.runtimeStatus === "active";
    const poseAvailable = mediaPipePoseRuntime.poseAvailable;
    const landmarksVisible = mediaPipePoseRuntime.requiredLandmarksVisible;
    const exerciseSupported = getExercisePoseProfile(currentExercise).supported;

    let observationCapability: RuntimeObservationContext["observation_capability"] =
      "not_available";
    let notes =
      "Camera is offline or fallback simulation is active. The assistant cannot see you.";
    let reliablePoseAvailable = false;

    if (isMediaPipeUsable && poseAvailable && landmarksVisible) {
      reliablePoseAvailable = true;
      observationCapability = "available";
      notes =
        "Real-time camera observation using browser-local MediaPipe is active and reliable.";
    } else if (mediaPipeActive && (!poseAvailable || !landmarksVisible)) {
      observationCapability = "low_confidence";
      notes =
        "Camera is present and active, but posture detection confidence is low or required joints are obscured.";
    } else if (!exerciseSupported && currentExercise) {
      notes = `Pose tracking is not supported for exercise: ${currentExercise.name}. Falling back to prototype simulation.`;
    } else if (mediaPipePoseRuntime.runtimeStatus === "initializing") {
      notes = "Camera pose tracking is initializing (loading model).";
    }

    return {
      pose_available: reliablePoseAvailable,
      pose_confidence: mediaPipeActive
        ? mediaPipePoseRuntime.landmarkConfidence
        : null,
      observation_capability: observationCapability,
      latest_form_error:
        reliablePoseAvailable && mediaPipePoseRuntime.latestFormError
          ? {
              ...mediaPipePoseRuntime.latestFormError,
              provider: "camera_mediapipe",
            }
          : null,
      latest_rep_event:
        reliablePoseAvailable && mediaPipePoseRuntime.latestRepEvent
          ? {
              rep_count: mediaPipePoseRuntime.latestRepEvent.rep_count,
              exercise_id: mediaPipePoseRuntime.latestRepEvent.exercise_id,
              provider: "camera_mediapipe",
            }
          : null,
      notes,
    } satisfies RuntimeObservationContext;
  }, [
    currentExercise,
    isMediaPipeUsable,
    mediaPipePoseRuntime.landmarkConfidence,
    mediaPipePoseRuntime.latestFormError,
    mediaPipePoseRuntime.latestRepEvent,
    mediaPipePoseRuntime.poseAvailable,
    mediaPipePoseRuntime.requiredLandmarksVisible,
    mediaPipePoseRuntime.runtimeStatus,
  ]);

  const handleSelectCameraDevice = useCallback(
    async (deviceId?: string, isExplicit = true) => {
      const device = devices.find((candidate) => candidate.deviceId === deviceId);
      logSessionEvent(SESSION_EVENTS.CAMERA_DEVICE_SELECTED, currentTimeMs, {
        selectedDeviceId: deviceId || "",
        selectedDeviceLabel: device?.label || "",
      });
      await requestCamera(deviceId, isExplicit);
    },
    [currentTimeMs, devices, logSessionEvent, requestCamera]
  );

  const cameraPoseStatusLabel = useMemo(() => {
    if (cameraGatesDisabled || status === "idle") {
      return "Camera off. Using fallback tracking.";
    }
    const selectedDevice = devices.find(
      (device) => device.deviceId === selectedDeviceId
    );
    if (status === "requesting") {
      return `Trying ${selectedDevice?.label || "Camera"}...`;
    }
    if (status === "ready") {
      return selectedDeviceId !== activeDeviceId
        ? `${
            selectedDevice?.label || "Selected camera"
          } failed. Using integrated webcam fallback.`
        : "Camera ready. Retry alignment available.";
    }
    if (
      status === "error" ||
      status === "permission_denied" ||
      status === "not_found"
    ) {
      return `${
        selectedDevice?.label || "Camera"
      } did not start. Using fallback tracking.`;
    }
    return "Camera unavailable.";
  }, [
    activeDeviceId,
    cameraGatesDisabled,
    devices,
    selectedDeviceId,
    status,
  ]);

  const cameraPoseGuidance = useMemo(
    () =>
      activePoseProvider === "camera_mediapipe"
        ? mediaPipePoseRuntime.poseStatusDetails?.guidance ||
          "Real-time camera observation is active."
        : "Simulated fallback tracking is active. Assistive voice and haptic guidance are fully operational.",
    [activePoseProvider, mediaPipePoseRuntime.poseStatusDetails]
  );
  const preferredCameraLabel = getCameraPreference()?.label;

  const previousCameraStatusRef = useRef<string>("idle");
  const previousDeviceIdRef = useRef<string>("");
  useEffect(() => {
    if (!isReady) return;

    const previousStatus = previousCameraStatusRef.current;
    const previousDeviceId = previousDeviceIdRef.current;
    const activeDevice = devices.find(
      (device) => device.deviceId === activeDeviceId
    );
    const selectedDevice = devices.find(
      (device) => device.deviceId === selectedDeviceId
    );

    if (status === "requesting" && previousStatus !== "requesting") {
      logSessionEvent(SESSION_EVENTS.CAMERA_REQUESTED, currentTimeMs, {
        requestedDeviceId: selectedDeviceId,
        requestedDeviceLabel: selectedDevice?.label || "",
      });
    }
    if (status === "ready" && previousStatus !== "ready") {
      logSessionEvent(SESSION_EVENTS.CAMERA_READY, currentTimeMs, {
        activeDeviceId,
        activeDeviceLabel: activeDevice?.label || "",
        selectedDeviceId,
        selectedDeviceLabel: selectedDevice?.label || "",
        status,
        provider: "camera_mediapipe",
      });
    }
    if (
      ["permission_denied", "not_found", "error"].includes(status) &&
      previousStatus !== status
    ) {
      logSessionEvent(SESSION_EVENTS.CAMERA_FAILED, currentTimeMs, {
        status,
        error: errorMessage || "Unknown camera error",
        fallbackReason:
          status === "permission_denied"
            ? "permission_denied"
            : "device_not_found",
        selectedDeviceId,
        selectedDeviceLabel: selectedDevice?.label || "",
      });
    }
    if (
      status === "ready" &&
      previousStatus === "ready" &&
      activeDeviceId !== previousDeviceId &&
      previousDeviceId !== ""
    ) {
      logSessionEvent(SESSION_EVENTS.CAMERA_DEVICE_CHANGED, currentTimeMs, {
        previousDeviceId,
        activeDeviceId,
        activeDeviceLabel: activeDevice?.label || "",
      });
    }

    previousCameraStatusRef.current = status;
    previousDeviceIdRef.current = activeDeviceId;
  }, [
    activeDeviceId,
    currentTimeMs,
    devices,
    errorMessage,
    isReady,
    logSessionEvent,
    selectedDeviceId,
    status,
  ]);

  const previousPoseProviderRef = useRef<string>("prototype_pose");
  useEffect(() => {
    if (!isReady) return;
    if (
      activePoseProvider === "prototype_pose" &&
      previousPoseProviderRef.current === "camera_mediapipe"
    ) {
      logSessionEvent(SESSION_EVENTS.CAMERA_FALLBACK_USED, currentTimeMs, {
        reason: fallbackReason || "camera_disabled_or_unavailable",
        provider: "prototype_pose",
      });
    }
    previousPoseProviderRef.current = activePoseProvider;
  }, [
    activePoseProvider,
    currentTimeMs,
    fallbackReason,
    isReady,
    logSessionEvent,
  ]);

  const previousRuntimeStatusRef = useRef<string>("");
  useEffect(() => {
    if (!isReady) return;
    const runtimeStatus = mediaPipePoseRuntime.runtimeStatus;
    if (runtimeStatus !== previousRuntimeStatusRef.current) {
      logSessionEvent(
        SESSION_EVENTS.POSE_RUNTIME_STATUS_CHANGED,
        currentTimeMs,
        {
          status: runtimeStatus,
          provider: "camera_mediapipe",
        }
      );
      previousRuntimeStatusRef.current = runtimeStatus;
    }
  }, [
    currentTimeMs,
    isReady,
    logSessionEvent,
    mediaPipePoseRuntime.runtimeStatus,
  ]);

  const previousGatesDisabledRef = useRef(false);
  useEffect(() => {
    if (!isReady) return;
    if (cameraGatesDisabled && !previousGatesDisabledRef.current) {
      logSessionEvent(
        SESSION_EVENTS.CAMERA_DISABLED_FOR_SESSION,
        currentTimeMs,
        { reason: "user_disabled_gates" }
      );
    }
    previousGatesDisabledRef.current = cameraGatesDisabled;
  }, [cameraGatesDisabled, currentTimeMs, isReady, logSessionEvent]);

  return {
    runtimeObservationContext,
    handleSelectCameraDevice,
    cameraPoseStatusLabel,
    cameraPoseGuidance,
    preferredCameraLabel,
  };
}
