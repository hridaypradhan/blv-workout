"use client";

import React, { useEffect, useRef, useState } from "react";
import { useMediaPipePoseLandmarker } from "@/lib/hooks/useMediaPipePoseLandmarker";
import { PositioningGuide, PositioningResult } from "@/lib/pose/positioningGuide";
import { CameraOrientation, BodyOrientation } from "@/lib/pose/positioningTypes";

export interface SetupPositioningGuidePanelProps {
  stream: MediaStream | null;
  requiredCameraOrientation: CameraOrientation;
  requiredBodyOrientation: BodyOrientation;
  onReadyChange?: (isReady: boolean) => void;
  onGuidanceChange?: (guidance: string, isReady: boolean) => void;
}

export function SetupPositioningGuidePanel({
  stream,
  requiredCameraOrientation,
  requiredBodyOrientation,
  onReadyChange,
  onGuidanceChange,
}: SetupPositioningGuidePanelProps) {
  const {
    poseResult,
    isLoading: isModelLoading,
    error: modelError,
    isModelLoaded,
  } = useMediaPipePoseLandmarker({ stream });

  const [guideResult, setGuideResult] = useState<PositioningResult | null>(null);

  const guideRef = useRef<PositioningGuide | null>(null);

  // Instantiates the PositioningGuide whenever requirements change
  useEffect(() => {
    guideRef.current = new PositioningGuide(requiredCameraOrientation, requiredBodyOrientation, {
      debounceSeconds: 1.0,
      readyHoldSeconds: 2.0,
    });

    return () => {
      guideRef.current?.reset();
    };
  }, [requiredCameraOrientation, requiredBodyOrientation]);

  // Feed inference results to the PositioningGuide classifier
  useEffect(() => {
    if (!guideRef.current) return;

    const now = Date.now();
    // Use the first detected pose landmarks
    const landmarks = poseResult?.poseLandmarks?.[0];
    const result = guideRef.current.process(landmarks, now);
    setGuideResult(result);

    if (onReadyChange) {
      onReadyChange(result.isReady);
    }
    if (onGuidanceChange) {
      onGuidanceChange(result.guidance, result.isReady);
    }
  }, [poseResult, onReadyChange, onGuidanceChange]);

  // If the stream is inactive or turned off, reset guide state
  useEffect(() => {
    if (!stream) {
      setGuideResult(null);
      if (onReadyChange) {
        onReadyChange(false);
      }
      if (onGuidanceChange) {
        onGuidanceChange("Awaiting active camera stream...", false);
      }
    }
  }, [stream, onReadyChange, onGuidanceChange]);

  if (!stream) {
    return null;
  }

  // Choose style colors based on positioning state
  const getStateColorClasses = () => {
    if (!guideResult) return "bg-slate-800 text-slate-400 border-slate-700";
    switch (guideResult.state) {
      case "ready":
        return guideResult.isReady
          ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/30"
          : "bg-yellow-950/40 text-yellow-400 border-yellow-500/30";
      case "no_person":
        return "bg-slate-900/60 text-slate-400 border-slate-800";
      case "partial":
      case "body_not_fully_visible":
        return "bg-yellow-950/30 text-yellow-500 border-yellow-500/20";
      default:
        return "bg-red-950/30 text-red-400 border-red-500/20";
    }
  };

  return (
    <div className="mt-4 p-4 rounded-2xl border bg-slate-900/60 border-slate-800/80 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse" />
          Alignment Guide
        </h3>
        {isModelLoading && (
          <span className="text-xs text-slate-400 animate-pulse">Loading posture engine...</span>
        )}
      </div>

      {modelError && (
        <div
          role="alert"
          className="p-3 bg-red-950/40 border border-red-500/20 rounded-xl text-xs text-red-400"
        >
          Failed to load pose landmarks: {modelError}
        </div>
      )}

      {isModelLoaded && stream && (
        <div className="space-y-2">
          {/* Active alignment instructions */}
          <div
            className={`p-3 border rounded-xl flex flex-col gap-1 transition-all ${getStateColorClasses()}`}
          >
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Current Instruction
            </span>
            <p className="text-sm font-semibold leading-relaxed">
              {guideResult ? guideResult.guidance : "Standing in view of camera..."}
            </p>
          </div>

          {/* Setup verification statement */}
          <p className="text-[11px] text-slate-500 leading-normal">
            This alignment check runs locally in your browser. It does not send any data to a server.
          </p>

          {/* Screen reader live announcements */}
          <div className="sr-only" aria-live="polite">
            {guideResult
              ? `Stance update: ${guideResult.guidance}. ${guideResult.isReady ? "Ready to begin workout." : ""}`
              : "Awaiting video landmarks detection."}
          </div>
        </div>
      )}
    </div>
  );
}
