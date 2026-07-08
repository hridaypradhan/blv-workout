/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import YouTubePlayerPanel from "./YouTubePlayerPanel";
import SessionControls from "./SessionControls";

export interface LiveSessionPlaybackColumnProps {
  containerRef: React.RefObject<HTMLDivElement>;
  isReady: boolean;
  playerError: string | null;
  metadata: any;
  currentTime: number;
  duration: number;
  playbackRate: number;
  assistantMuted: boolean;
  isPlaying: boolean;
  isPrototypeTracking: boolean;
  currentAngles: any;
  handleSeek: (seconds: number, reason?: string) => void;
  setPlaybackRate: (rate: number) => void;
  handleToggleMute: (muted: boolean) => void;
  handleRepeatTrainerInstruction: () => void;
  play: () => void;
  pause: () => void;
  handleSkipSection: () => void;
  stopPoseTracking: () => void;
  startPoseTracking: () => void;
  formatTime: (seconds: number) => string;
  cameraPoseStatusLabel?: string;
  cameraPoseAvailable?: boolean;
  cameraPoseGuidance?: string;
  activePoseProvider?: "camera_mediapipe" | "prototype_pose";
  fallbackReason?: string | null;
  cameraDevices?: MediaDeviceInfo[];
  selectedCameraDeviceId?: string;
  activeDeviceId?: string;
  pendingDeviceId?: string;
  onSelectCameraDevice?: (deviceId: string) => void;
  cameraStatus?: string;
  onRetryCamera?: () => void;
  onTurnCameraOff?: () => void;
  onRetryAlignment?: () => void;
}

export function LiveSessionPlaybackColumn({
  containerRef,
  isReady,
  playerError,
  metadata,
  currentTime,
  duration,
  playbackRate,
  assistantMuted,
  isPlaying,
  isPrototypeTracking,
  currentAngles,
  handleSeek,
  setPlaybackRate,
  handleToggleMute,
  handleRepeatTrainerInstruction,
  play,
  pause,
  handleSkipSection,
  stopPoseTracking,
  startPoseTracking,
  formatTime,
  cameraPoseStatusLabel,
  cameraPoseAvailable,
  cameraPoseGuidance,
  activePoseProvider,
  fallbackReason,
  cameraDevices,
  selectedCameraDeviceId,
  activeDeviceId,
  pendingDeviceId,
  onSelectCameraDevice,
  cameraStatus,
  onRetryCamera,
  onTurnCameraOff,
  onRetryAlignment,
}: LiveSessionPlaybackColumnProps) {
  return (
    <div className="lg:col-span-8 flex flex-col gap-6 order-2 lg:order-1">
      <YouTubePlayerPanel
        containerRef={containerRef}
        isReady={isReady}
        playerError={playerError}
        metadata={metadata ? {
          title: metadata.title || undefined,
          channel_name: metadata.channel_name || undefined,
          duration: metadata.duration || undefined,
        } : null}
        currentTime={currentTime}
        duration={duration}
        playbackRate={playbackRate}
        formatTime={formatTime}
      >
        <SessionControls
          currentTime={currentTime}
          playbackRate={playbackRate}
          assistantMuted={assistantMuted}
          seek={handleSeek}
          setPlaybackRate={setPlaybackRate}
          setAssistantMuted={handleToggleMute}
          handleRepeatTrainerInstruction={handleRepeatTrainerInstruction}
          isPlaying={isPlaying}
          play={play}
          pause={pause}
          handleSkipSection={handleSkipSection}
        />
      </YouTubePlayerPanel>

      {/* Bottom Pose Feed Panel */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4" aria-label="Pose Tracker Cam">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all ${isPrototypeTracking ? "bg-emerald-950/40 border-emerald-500/20 text-emerald-400" : "bg-slate-950 border-slate-800 text-slate-600"}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              {isPrototypeTracking
                ? cameraPoseStatusLabel || "Camera tracking active"
                : "Pose tracking unavailable"}
            </h3>
            <p className="text-xs text-slate-400">
              {isPrototypeTracking
                ? cameraPoseGuidance || "Real-time camera observation is active."
                : "Pose tracking is currently offline."}
            </p>
            {isPrototypeTracking && Object.keys(currentAngles).length > 0 && (
              <div className="mt-1 flex flex-wrap gap-2 text-xs font-bold text-slate-300">
                {Object.entries(currentAngles).map(([joint, val]) => (
                  <span key={joint} className="bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                    {joint.replace("_", " ")}: {(val as number).toFixed(0)}{"\u00b0"}
                  </span>
                ))}
              </div>
            )}
            {cameraPoseStatusLabel && (
              <div className="mt-2 text-xs border-t border-slate-800/80 pt-2 flex flex-col gap-2.5">
                <div className="flex flex-col gap-1 text-[11px] text-slate-300">
                  <p className="flex justify-between">
                    <span className="font-semibold text-slate-400">Selected Camera:</span>
                    <span>
                      {cameraDevices?.find(d => d.deviceId === selectedCameraDeviceId)?.label || selectedCameraDeviceId || "None"}
                    </span>
                  </p>
                  <p className="flex justify-between">
                    <span className="font-semibold text-slate-400">Active Stream:</span>
                    <span className={activeDeviceId ? "text-emerald-400 font-medium" : "text-slate-500"}>
                      {activeDeviceId 
                        ? cameraDevices?.find(d => d.deviceId === activeDeviceId)?.label || activeDeviceId
                        : "None (Fallback Simulation)"}
                    </span>
                  </p>
                  {pendingDeviceId && (
                    <p className="flex justify-between text-yellow-400 font-medium animate-pulse">
                      <span>Trying:</span>
                      <span>
                        {cameraDevices?.find(d => d.deviceId === pendingDeviceId)?.label || pendingDeviceId}
                      </span>
                    </p>
                  )}
                  <p className="flex justify-between">
                    <span className="font-semibold text-slate-400">Status:</span>
                    <span className="font-medium text-yellow-400 text-right max-w-[200px]">
                      {cameraPoseStatusLabel}
                    </span>
                  </p>
                </div>

                {cameraDevices && cameraDevices.length > 0 && (
                  <div className="flex flex-col gap-1 w-full max-w-[250px]">
                    <label htmlFor="live-camera-select" className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                      Change Camera
                    </label>
                    <select
                      id="live-camera-select"
                      value={selectedCameraDeviceId || ""}
                      onChange={(e) => onSelectCameraDevice?.(e.target.value)}
                      className="px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 font-medium focus:border-yellow-400 outline-none w-full transition-all"
                    >
                      {cameraDevices.map((device, idx) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Camera ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 mt-1">
                  {onRetryCamera && (
                    <button
                      type="button"
                      onClick={onRetryCamera}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold rounded-lg border border-slate-700 transition-all text-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
                      id="live-retry-camera-btn"
                    >
                      Retry Camera
                    </button>
                  )}
                  {cameraStatus === "ready" && onTurnCameraOff && (
                    <button
                      type="button"
                      onClick={onTurnCameraOff}
                      className="px-2.5 py-1 bg-red-950/40 hover:bg-red-900/40 text-[10px] font-bold rounded-lg border border-red-900/30 transition-all text-red-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
                      id="live-disable-gates-btn"
                    >
                      Turn Camera Off
                    </button>
                  )}
                  {cameraStatus === "ready" && onRetryAlignment && (
                    <button
                      type="button"
                      onClick={onRetryAlignment}
                      className="px-2.5 py-1 bg-yellow-400/10 hover:bg-yellow-400/20 text-[10px] font-bold rounded-lg border border-yellow-400/30 transition-all text-yellow-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
                      id="live-retry-align-btn"
                    >
                      Retry Alignment
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 font-semibold italic" aria-live="polite">
                  {activePoseProvider === "camera_mediapipe"
                    ? "Camera tracking active: MediaPipe is powering reps and form analysis."
                    : "Camera tracking fallback: Simulated prototype is powering reps and form analysis."}
                </span>
                {activePoseProvider === "prototype_pose" && fallbackReason && (
                  <span className="sr-only">Fallback explanation: {fallbackReason}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {process.env.NODE_ENV === "development" && (
          <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={isPrototypeTracking ? stopPoseTracking : startPoseTracking}
              className="px-3 py-1.5 text-[10px] font-semibold rounded-lg border transition-all text-slate-400 border-slate-800 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-700"
              aria-label={isPrototypeTracking ? "Stop simulation" : "Start simulation"}
            >
              {isPrototypeTracking ? "Stop Simulation" : "Start Simulation"} (Developer Control)
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
