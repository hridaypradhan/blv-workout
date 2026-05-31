import React from "react";

interface YouTubePlayerPanelProps {
  containerRef: React.RefObject<HTMLDivElement>;
  isReady: boolean;
  playerError: string | null;
  metadata: {
    title?: string;
    channel_name?: string;
    duration?: number;
  } | null;
  currentTime: number;
  duration: number;
  playbackRate: number;
  formatTime: (seconds: number) => string;
  children?: React.ReactNode;
}

export default function YouTubePlayerPanel({
  containerRef,
  isReady,
  playerError,
  metadata,
  currentTime,
  duration,
  playbackRate,
  formatTime,
  children,
}: YouTubePlayerPanelProps) {
  return (
    <section
      className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col justify-between"
      aria-label="Embedded Trainer Video Player"
    >
      <div className="flex justify-between items-start sm:items-center gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <span className="text-xs uppercase font-extrabold text-red-500 tracking-wider block mb-0.5">
            Original YouTube Trainer Playback
          </span>
          <h2 className="text-lg font-bold text-white leading-snug">
            {metadata?.title || "Workout Assistance Companion"}
          </h2>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 text-xs text-slate-400 shrink-0 whitespace-nowrap pt-1 sm:pt-0">
          <span>Speed: {playbackRate}x</span>
          <span className="tabular-nums bg-slate-950 px-2 py-1 rounded-md border border-slate-800/80">
            {formatTime(currentTime)}&nbsp;/&nbsp;{formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Real YouTube Player Mount Frame */}
      <div className="relative aspect-video bg-slate-950 border border-slate-800 rounded-2xl mb-6 overflow-hidden flex items-center justify-center">
        <div ref={containerRef} className="w-full h-full absolute inset-0" />

        {!isReady && !playerError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-20">
            <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xs text-slate-400">Loading trainer video player...</p>
          </div>
        )}

        {playerError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 p-6 z-20 text-center">
            <span className="text-red-500 text-3xl mb-2" role="img" aria-label="Warning">
              ⚠️
            </span>
            <p className="text-sm font-bold text-white mb-1">Player Error</p>
            <p className="text-xs text-slate-400">{playerError}</p>
          </div>
        )}
      </div>

      {/* In-App Playback Adjustments */}
      <div className="flex flex-col gap-4 border-t border-slate-800/60 pt-4" aria-label="Playback Options">
        {/* Custom FitA11y Progress Bar (clear of iframe to prevent controls clipping) */}
        <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-850" aria-hidden="true">
          <div
            className="bg-red-600 h-full rounded-full transition-all"
            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />
        </div>

        {children}
      </div>
    </section>
  );
}
