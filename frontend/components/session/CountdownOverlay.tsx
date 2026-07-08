import React from "react";

export interface CountdownOverlayProps {
  countdown: number | null;
  handleCancelCountdown: () => void;
}

export function CountdownOverlay({
  countdown,
  handleCancelCountdown,
}: CountdownOverlayProps) {
  if (countdown === null) return null;

  return (
    <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
      <span className="text-[120px] font-extrabold text-yellow-400 animate-ping animate-duration-1000">
        {countdown}
      </span>
      <p className="text-xl font-bold text-white mt-4">Hold still...</p>
      <button
        type="button"
        onClick={handleCancelCountdown}
        className="mt-6 px-6 py-2.5 bg-red-600 hover:bg-red-500 font-bold rounded-xl text-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
        aria-label="Cancel countdown and continue adjusting position"
      >
        Cancel Countdown
      </button>
    </div>
  );
}
