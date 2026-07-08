"use client";

import React, { useEffect, useRef } from "react";
import { CameraStreamStatus } from "@/lib/hooks/useCameraStream";
import { saveCameraPreference } from "@/lib/camera/cameraPreference";

export interface CameraSetupPreviewProps {
  status: CameraStreamStatus;
  statusLabel: string;
  errorMessage: string | null;
  stream: MediaStream | null;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string;
  setSelectedDeviceId: (id: string) => void;
  requestCamera: (id?: string) => Promise<void>;
  stopCamera: () => void;
  onStartAlignment?: () => void;
}

export function CameraSetupPreview({
  status,
  statusLabel,
  errorMessage,
  stream,
  devices,
  selectedDeviceId,
  setSelectedDeviceId,
  requestCamera,
  stopCamera,
  onStartAlignment,
}: CameraSetupPreviewProps) {

  const videoRef = useRef<HTMLVideoElement>(null);

  // Bind media stream to video element when ready
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Handle device change
  const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDeviceId = e.target.value;
    setSelectedDeviceId(newDeviceId);
    const selectedDevice = devices.find((d) => d.deviceId === newDeviceId);
    saveCameraPreference(newDeviceId, selectedDevice?.label || "");
    // If camera is already active, switch immediately
    if (status === "ready") {
      requestCamera(newDeviceId);
    }
  };

  return (
    <div className="flex flex-col h-full justify-between gap-4">
      <div>
        <h2 id="camera-heading" className="text-lg font-bold text-white mb-2">
          Setup Camera Preview
        </h2>
        <p className="text-sm text-slate-300 mb-4">
          Enable your camera to verify your position and preview the feed.
          <span className="block mt-1 font-semibold text-yellow-400">
            Note: Camera preview is used for setup. MediaPipe setup alignment runs locally when the camera is enabled. Live workout repetition counting and form checking use local MediaPipe tracking for supported exercises, falling back to prototype simulation automatically when unavailable.
          </span>
        </p>
      </div>

      {/* Video Stream Preview Box */}
      <div className="relative flex-1 min-h-[220px] bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center justify-center overflow-hidden">
        {status === "ready" && stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            aria-label="Camera preview feed"
            className="w-full h-full object-cover rounded-2xl"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <svg
              className="w-12 h-12 text-slate-600 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm text-slate-400 font-medium">
              Camera preview is currently offline.
            </p>
          </div>
        )}

        {/* Floating status display for overlay/diagnostics */}
        <div className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur border border-slate-800 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-200">
          Status: {status.toUpperCase()}
        </div>
      </div>

      {/* Controls & Device Selection */}
      <div className="space-y-3">
        {/* Screen Reader status alert */}
        <div className="sr-only" aria-live="polite">
          {statusLabel}
        </div>

        {/* Error notification block */}
        {errorMessage && (
          <div
            role="alert"
            className="p-3 bg-red-950/40 border border-red-500/20 rounded-xl text-xs text-red-400 font-medium"
          >
            {errorMessage}
          </div>
        )}

        {/* Actions Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {status === "ready" ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={stopCamera}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-sm border border-slate-700 transition-all text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
                aria-label="Stop camera preview"
              >
                Stop Camera
              </button>
              {onStartAlignment && (
                <button
                  type="button"
                  onClick={onStartAlignment}
                  className="px-4 py-2.5 bg-yellow-500 hover:bg-yellow-450 text-slate-950 font-bold rounded-xl text-sm transition-all text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
                  aria-label="Start hands-free camera alignment mode"
                >
                  Start Camera Alignment
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => requestCamera()}
              disabled={status === "requesting"}
              className="px-4 py-2.5 bg-yellow-500 hover:bg-yellow-450 disabled:bg-yellow-600/50 text-slate-950 font-bold rounded-xl text-sm transition-all text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
              aria-label="Start camera preview"
            >
              {status === "requesting" ? "Connecting..." : "Enable Camera"}
            </button>
          )}

          {/* Camera Selection Dropdown */}
          {devices.length > 0 && (
            <div className="flex-1 flex flex-col gap-1">
              <label htmlFor="camera-select" className="sr-only">
                Select Camera Device
              </label>
              <select
                id="camera-select"
                value={selectedDeviceId}
                onChange={handleDeviceChange}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-300 font-medium focus:border-yellow-400 transition-all outline-none"
              >
                {devices.map((device, idx) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
