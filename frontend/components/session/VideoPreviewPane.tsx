import React from "react";

export interface VideoPreviewPaneProps {
  stream: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  children?: React.ReactNode;
}

export function VideoPreviewPane({
  stream,
  videoRef,
  children,
}: VideoPreviewPaneProps) {
  return (
    <div className="relative bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col items-center justify-center min-h-[300px]">
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          aria-label="Camera alignment feed"
          className="w-full h-full object-cover rounded-2xl"
        />
      ) : (
        <div className="text-center px-6">
          <p className="text-slate-300 font-semibold mb-2">Camera not available.</p>
          <p className="text-sm text-slate-400 leading-relaxed">
            You can continue without camera alignment. Audio and haptic guidance will still be provided during the workout, falling back to simulated tracking.
          </p>
        </div>
      )}

      {children}
    </div>
  );
}
