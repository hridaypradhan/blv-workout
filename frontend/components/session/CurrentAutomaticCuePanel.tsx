import React from "react";

interface CurrentAutomaticCuePanelProps {
  latestAutomaticCue: {
    text: string;
    type: string;
    timestamp: Date;
    videoTime: number;
  } | null;
  formatTime: (seconds: number) => string;
  isLoadingCuePlan: boolean;
  cuePlanError: string | null;
  isLoadingManifest: boolean;
  manifestError: string | null;
}

export default function CurrentAutomaticCuePanel({
  latestAutomaticCue,
  formatTime,
  isLoadingCuePlan,
  cuePlanError,
  isLoadingManifest,
  manifestError,
}: CurrentAutomaticCuePanelProps) {
  return (
    <section
      className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col justify-between transition-all duration-300"
      aria-label="Current Assistant Cue"
    >
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-2 border-b border-slate-800/65">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
            Current Assistant Cue
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {isLoadingCuePlan && (
              <span className="text-xs text-yellow-400/80 animate-pulse flex items-center gap-1" id="cueplan-loading-indicator">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400/80" />
                Loading cue plan...
              </span>
            )}
            {!isLoadingCuePlan && cuePlanError && (
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1" id="cueplan-error-indicator" title="Cue plan unavailable; using basic timeline cues. Q&A is still available.">
                Cue plan fallback active. Q&A still available.
              </span>
            )}
            {isLoadingManifest && !isLoadingCuePlan && (
              <span className="text-sm text-yellow-400 animate-pulse flex items-center gap-1.5" id="manifest-loading-indicator">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                Loading Manifest
              </span>
            )}
            {manifestError && !cuePlanError && (
              <span className="text-sm text-red-400 font-semibold flex items-center gap-1" id="manifest-error-indicator" title={manifestError}>
                Load Error
              </span>
            )}
            {latestAutomaticCue && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </div>
        </div>

        {manifestError && (
          <div className="p-3 bg-red-950/40 border border-red-500/20 text-red-200 rounded-2xl text-sm flex flex-col gap-1 mb-4 text-left" role="alert" id="manifest-error-alert">
            <span className="font-bold text-sm text-red-400 uppercase tracking-wider flex items-center gap-1">
              <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Manifest Loading Error
            </span>
            <p>Failed to load the sidecar assistance manifest. Voice cues and timeline anchors will be unavailable.</p>
            <p className="text-sm opacity-75">{manifestError}</p>
          </div>
        )}

        {!latestAutomaticCue ? (
          <div className="py-8 px-4 text-slate-500 text-sm font-medium italic text-center">
            No automatic cues received yet. Start workout playback to receive real-time corrections and guidance.
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in text-center">
            <p className="text-lg font-bold text-yellow-400 leading-relaxed">
              &quot;{latestAutomaticCue.text}&quot;
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                latestAutomaticCue.type === "correction"
                  ? "bg-red-500/10 text-red-400 border border-red-500/20"
                  : latestAutomaticCue.type === "cue_plan"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "bg-sky-500/10 text-sky-400 border border-sky-500/20"
              }`}>
                {latestAutomaticCue.type === "correction" ? "Form Correction" : latestAutomaticCue.type === "cue_plan" ? "Workout Cue" : "Assistant Cue"}
              </span>
              <span className="text-xs font-semibold text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                Video: {formatTime(latestAutomaticCue.videoTime)}
              </span>
              <span className="text-xs font-semibold text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                Received: {latestAutomaticCue.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
