import React from "react";

export interface GuidanceInstructionsPanelProps {
  currentGuidance: string;
  handleRepeatGuidance: () => void;
}

export function GuidanceInstructionsPanel({
  currentGuidance,
  handleRepeatGuidance,
}: GuidanceInstructionsPanelProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-base font-bold text-slate-300">Positioning Guidance</h3>

      {/* Accessible Announcement Area */}
      <div
        aria-live="assertive"
        className="p-4 bg-slate-950 border border-slate-850 rounded-xl flex flex-col gap-1.5"
      >
        <span className="text-xs uppercase font-extrabold tracking-widest text-slate-400">
          Current Instruction
        </span>
        <p className="text-lg font-bold leading-normal text-white">{currentGuidance}</p>
      </div>

      {/* Repeat Button */}
      <button
        type="button"
        onClick={handleRepeatGuidance}
        className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs border border-slate-700 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
        aria-label="Repeat current alignment instruction aloud"
      >
        Repeat Instruction Aloud
      </button>
    </div>
  );
}
