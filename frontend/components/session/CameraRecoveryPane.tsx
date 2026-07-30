"use client";

import { CameraStreamStatus } from "@/lib/hooks/useCameraStream";

interface CameraRecoveryPaneProps {
  cameraStatus: CameraStreamStatus;
  cameraErrorMessage?: string | null;
  cameraDevices?: MediaDeviceInfo[];
  selectedCameraDeviceId?: string;
  preferredCameraLabel?: string;
  onRequestCamera?: (deviceId?: string, isExplicit?: boolean) => Promise<void>;
  onContinueWithoutCamera: () => void;
  onDisableCameraGatesForSession?: () => void;
  getActionableStatus: (status?: string) => string;
}

export function CameraRecoveryPane({
  cameraStatus,
  cameraErrorMessage,
  cameraDevices,
  selectedCameraDeviceId,
  preferredCameraLabel,
  onRequestCamera,
  onContinueWithoutCamera,
  onDisableCameraGatesForSession,
  getActionableStatus,
}: CameraRecoveryPaneProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-lg w-full mx-auto flex flex-col gap-6" id="camera-recovery-pane">
      <div className="text-center">
        <div className="w-16 h-16 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Camera Connection Problem</h3>
        <p className="text-sm text-slate-400">
          Workout playback is paused. We are trying to connect to your camera.
        </p>
      </div>

      <div className="border-t border-slate-800 pt-4 space-y-4">
        <div className="space-y-2 text-sm text-slate-300 bg-slate-950/40 p-4 rounded-2xl border border-slate-850">
          <p className="flex justify-between">
            <span className="font-semibold text-slate-400">Camera Status:</span>
            <span className="font-medium text-yellow-400">{getActionableStatus(cameraStatus)}</span>
          </p>
          {preferredCameraLabel && (
            <p className="flex justify-between">
              <span className="font-semibold text-slate-400">Preferred Camera:</span>
              <span className="font-medium text-slate-200">{preferredCameraLabel}</span>
            </p>
          )}
          {cameraErrorMessage && (
            <p className="text-red-400 text-xs mt-2 border-t border-slate-800 pt-2 font-medium">
              {cameraErrorMessage}
            </p>
          )}
        </div>

        {cameraDevices && cameraDevices.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="gate-camera-select" className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
              Select Camera
            </label>
            <select
              id="gate-camera-select"
              value={selectedCameraDeviceId || ""}
              onChange={(e) => onRequestCamera?.(e.target.value, true)}
              className="px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-300 focus:border-yellow-400 outline-none w-full"
            >
              {cameraDevices.map((device, idx) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => onRequestCamera?.(selectedCameraDeviceId, true)}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm transition-all border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
            id="retry-camera-btn"
          >
            Retry Selected Camera
          </button>

          <button
            type="button"
            onClick={onContinueWithoutCamera}
            className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-extrabold rounded-xl text-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
            id="continue-without-camera-btn"
          >
            Continue Without Camera
          </button>

          <button
            type="button"
            onClick={onDisableCameraGatesForSession}
            className="w-full py-2.5 bg-red-950/60 hover:bg-red-900/60 text-red-200 font-bold rounded-xl text-xs transition-all border border-red-900/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
            id="disable-gates-btn"
          >
            Disable Camera Checks for Session
          </button>
        </div>
      </div>
    </div>
  );
}
