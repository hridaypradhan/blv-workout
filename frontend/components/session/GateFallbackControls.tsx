import React from "react";

export interface GateFallbackControlsProps {
  handleManualComplete: () => void;
  isActionPending: boolean;
  actionButtonLabel: string;
}

export function GateFallbackControls({
  handleManualComplete,
  isActionPending,
  actionButtonLabel,
}: GateFallbackControlsProps) {
  return (
    <div className="border-t border-slate-800 pt-4 mt-auto">
      <p className="text-xs text-slate-400 mb-3 leading-normal">
        You can skip alignment and continue. Audio and haptic guidance will still be provided without camera positioning.
      </p>
      <button
        type="button"
        onClick={handleManualComplete}
        disabled={isActionPending}
        className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 disabled:bg-yellow-800 disabled:text-slate-500 text-slate-950 font-extrabold rounded-xl text-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 focus-visible:outline-offset-2"
        aria-label="Skip camera alignment and continue workout"
      >
        {isActionPending ? "Starting workout..." : actionButtonLabel}
      </button>
    </div>
  );
}
