"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { saveCameraPreference, getCameraPreference } from "@/lib/camera/cameraPreference";

export type CameraStreamStatus =
  | "idle"
  | "requesting"
  | "ready"
  | "permission_denied"
  | "not_found"
  | "unsupported"
  | "error";

export interface UseCameraStreamProps {
  autoEnumerate?: boolean;
}

// Keep a global registry of active camera streams to guarantee cleanup on route transitions
let activeStreams: MediaStream[] = [];

export function registerActiveStream(stream: MediaStream) {
  if (typeof window !== "undefined" && !activeStreams.includes(stream)) {
    activeStreams.push(stream);
  }
}

export function unregisterActiveStream(stream: MediaStream) {
  if (typeof window !== "undefined") {
    activeStreams = activeStreams.filter((s) => s !== stream);
  }
}

export function stopAllActiveCameraStreams() {
  if (typeof window !== "undefined") {
    activeStreams.forEach((stream) => {
      try {
        stream.getTracks().forEach((track) => {
          if (track.readyState === "live") {
            track.stop();
          }
        });
      } catch (e) {
        console.error("Failed to stop track during global cleanup:", e);
      }
    });
    activeStreams = [];
  }
}

export function useCameraLifecycleCleanup() {
  const pathname = usePathname();

  useEffect(() => {
    const handleCleanup = () => {
      stopAllActiveCameraStreams();
    };
    window.addEventListener("beforeunload", handleCleanup);
    window.addEventListener("navigation-start", handleCleanup);

    return () => {
      window.removeEventListener("beforeunload", handleCleanup);
      window.removeEventListener("navigation-start", handleCleanup);
      stopAllActiveCameraStreams();
    };
  }, [pathname]);
}

export function useCameraStream({ autoEnumerate = true }: UseCameraStreamProps = {}) {
  const [status, setStatus] = useState<CameraStreamStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  
  // Explicit device states
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [activeDeviceId, setActiveDeviceId] = useState<string>("");
  const [pendingDeviceId, setPendingDeviceId] = useState<string>("");

  const streamRef = useRef<MediaStream | null>(null);
  streamRef.current = stream;

  const activeRequestIdRef = useRef<number>(0);
  const pendingDeviceIdRef = useRef<string>("");

  // Stop camera helper
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      unregisterActiveStream(streamRef.current);
      streamRef.current = null;
    }
    setStream(null);
    setActiveDeviceId("");
    setPendingDeviceId("");
    pendingDeviceIdRef.current = "";
    setStatus("idle");
    setErrorMessage(null);
  }, []);

  // Enumerate video devices
  const refreshDevices = useCallback(async () => {
    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.enumerateDevices
    ) {
      setStatus("unsupported");
      return;
    }
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter((d) => d.kind === "videoinput");
      setDevices(videoDevices);

      if (videoDevices.length > 0) {
        setSelectedDeviceId((prev) => {
          const exists = videoDevices.some((d) => d.deviceId === prev);
          const pref = getCameraPreference();
          if (pref && videoDevices.some((d) => d.deviceId === pref.deviceId)) {
            return pref.deviceId;
          }
          return exists && prev ? prev : videoDevices[0].deviceId;
        });
      }
    } catch (err: unknown) {
      console.error("Failed to enumerate camera devices:", err);
    }
  }, []);

  // Request camera access with fallback device hierarchy
  const requestCamera = useCallback(async (deviceId?: string, isExplicit = false) => {
    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setStatus("unsupported");
      setErrorMessage("Camera access is not supported by your browser.");
      return;
    }

    const preference = getCameraPreference();
    const targetDeviceId = deviceId || preference?.deviceId || selectedDeviceId;

    // Guard: ignore auto-requests if currently in flight for the same device
    if (status === "requesting" && pendingDeviceIdRef.current === targetDeviceId && !isExplicit) {
      return;
    }

    const requestId = ++activeRequestIdRef.current;
    pendingDeviceIdRef.current = targetDeviceId || "";
    setPendingDeviceId(targetDeviceId || "");
    setSelectedDeviceId(targetDeviceId || "");
    setStatus("requesting");
    setErrorMessage(null);

    // Stop current stream first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      unregisterActiveStream(streamRef.current);
      streamRef.current = null;
    }
    setStream(null);
    setActiveDeviceId("");

    try {
      const constraints: MediaStreamConstraints = {
        video: targetDeviceId ? { deviceId: { exact: targetDeviceId } } : true,
        audio: false,
      };
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Race condition check
      if (requestId !== activeRequestIdRef.current) {
        newStream.getTracks().forEach((track) => track.stop());
        return;
      }

      registerActiveStream(newStream);
      setStream(newStream);
      setStatus("ready");
      setPendingDeviceId("");
      pendingDeviceIdRef.current = "";

      // Re-enumerate to ensure we have fresh labels
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter((d) => d.kind === "videoinput");
      setDevices(videoDevices);

      const videoTrack = newStream.getVideoTracks()[0];
      let activeId = targetDeviceId;
      let activeLabel = "";
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        activeId = settings.deviceId || targetDeviceId || "";
        activeLabel = videoTrack.label || videoDevices.find((d) => d.deviceId === activeId)?.label || "";
      }

      setActiveDeviceId(activeId);
      if (activeId) {
        setSelectedDeviceId(activeId);
        // Only save preference on successful stream initialization
        saveCameraPreference(activeId, activeLabel);
      }

    } catch (err: any) {
      console.warn(`Camera request failed for deviceId ${targetDeviceId}:`, err);

      if (requestId !== activeRequestIdRef.current) {
        return;
      }

      // If user explicitly chose this camera, fail without automatic fallback
      if (isExplicit) {
        const isPermDenied = err.name === "NotAllowedError" || err.name === "PermissionDeniedError";
        const isNotFound = err.name === "NotFoundError" || err.name === "DevicesNotFoundError";
        setStatus(isPermDenied ? "permission_denied" : (isNotFound ? "not_found" : "error"));
        setPendingDeviceId("");
        pendingDeviceIdRef.current = "";
        
        if (isPermDenied) {
          setErrorMessage("Camera permission was denied. Please check your browser settings.");
        } else if (isNotFound) {
          setErrorMessage("No camera device found on this system.");
        } else {
          const deviceLabel = devices.find((d) => d.deviceId === targetDeviceId)?.label || targetDeviceId || "Selected camera";
          setErrorMessage(`${deviceLabel} failed to start: ${err.message || err.name || "Unknown error"}`);
        }
        return;
      }

      // Auto-fallback sequence (runs only for implicit auto-starts)
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices.filter((d) => d.kind === "videoinput");
        setDevices(videoDevices);

        const fallbackOptions = videoDevices.filter((d) => d.deviceId !== targetDeviceId);
        if (fallbackOptions.length === 0) {
          throw new Error("No fallback camera available.");
        }

        // Try first fallback
        const fallbackDevice = fallbackOptions[0];
        const fallbackConstraints: MediaStreamConstraints = {
          video: { deviceId: { exact: fallbackDevice.deviceId } },
          audio: false,
        };
        const fallbackStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);

        if (requestId !== activeRequestIdRef.current) {
          fallbackStream.getTracks().forEach((track) => track.stop());
          return;
        }

        registerActiveStream(fallbackStream);
        setStream(fallbackStream);
        setStatus("ready");
        setPendingDeviceId("");
        pendingDeviceIdRef.current = "";

        const videoTrack = fallbackStream.getVideoTracks()[0];
        const activeId = videoTrack?.getSettings()?.deviceId || fallbackDevice.deviceId;
        setActiveDeviceId(activeId);
        
        // Keep selectedDeviceId pointing to targetDeviceId so the UI knows we are on fallback
        if (targetDeviceId) {
          setSelectedDeviceId(targetDeviceId);
        }
        const targetLabel = devices.find((d) => d.deviceId === targetDeviceId)?.label || "Preferred camera";
        setErrorMessage(`${targetLabel} failed. Using fallback camera.`);

      } catch (fallbackErr: any) {
        if (requestId !== activeRequestIdRef.current) return;

        // Try generic video: true constraint
        try {
          const genericStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          if (requestId !== activeRequestIdRef.current) {
            genericStream.getTracks().forEach((track) => track.stop());
            return;
          }
          registerActiveStream(genericStream);
          setStream(genericStream);
          setStatus("ready");
          setPendingDeviceId("");
          pendingDeviceIdRef.current = "";

          const videoTrack = genericStream.getVideoTracks()[0];
          const activeId = videoTrack?.getSettings()?.deviceId || "";
          setActiveDeviceId(activeId);
          if (targetDeviceId) {
            setSelectedDeviceId(targetDeviceId);
          }
          setErrorMessage("Preferred camera failed. Using fallback camera.");
        } catch (finalErr: any) {
          if (requestId !== activeRequestIdRef.current) return;
          console.error("All camera startup attempts failed:", finalErr);
          const isPermDenied = finalErr.name === "NotAllowedError" || finalErr.name === "PermissionDeniedError";
          const isNotFound = finalErr.name === "NotFoundError" || finalErr.name === "DevicesNotFoundError";
          
          setStatus(isPermDenied ? "permission_denied" : (isNotFound ? "not_found" : "error"));
          setPendingDeviceId("");
          pendingDeviceIdRef.current = "";
          
          if (isPermDenied) {
            setErrorMessage("Camera permission was denied. Please check your browser settings.");
          } else if (isNotFound) {
            setErrorMessage("No camera device found on this system.");
          } else {
            setErrorMessage(finalErr.message || "All camera startup attempts failed.");
          }
        }
      }
    }
  }, [selectedDeviceId, status, devices]);

  // Enumerate devices on mount
  useEffect(() => {
    if (autoEnumerate) {
      refreshDevices();
    }
  }, [autoEnumerate, refreshDevices]);

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        unregisterActiveStream(streamRef.current);
      }
    };
  }, []);

  // Screen reader status label
  const statusLabel = {
    idle: "Camera is currently inactive.",
    requesting: "Requesting camera permission from the browser...",
    ready: "Camera feed is active and running.",
    permission_denied: "Camera permission was denied. Please allow camera access in your browser settings to preview.",
    not_found: "No camera device was found on this system.",
    unsupported: "Your browser does not support camera feeds.",
    error: `Camera error: ${errorMessage || "Unknown error occurred."}`,
  }[status];

  return {
    status,
    statusLabel,
    errorMessage,
    stream,
    devices,
    selectedDeviceId,
    activeDeviceId,
    pendingDeviceId,
    setSelectedDeviceId,
    requestCamera,
    stopCamera,
    refreshDevices,
  };
}
