"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Exercise } from "@/types";
import { getCameraPreference } from "@/lib/camera/cameraPreference";
import {
  buildRuntimeObservationContext,
  describeCameraKind,
} from "@/lib/camera/liveSessionCameraStatus";
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

        const preference = getCameraPreference();
        const { isIntegrated, preferenceWasExternal } = describeCameraKind(
          label,
          preference?.label
        );

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

  const runtimeObservationContext = useMemo(
    () =>
      buildRuntimeObservationContext({
        mediaPipePoseRuntime,
        currentExercise,
        isMediaPipeUsable,
      }),
    [currentExercise, isMediaPipeUsable, mediaPipePoseRuntime]
  );

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
