import React from "react";

interface SessionControlsProps {
  currentTime: number;
  playbackRate: number;
  assistantMuted: boolean;
  seek: (time: number) => void;
  setPlaybackRate: (rate: number) => void;
  setAssistantMuted: (muted: boolean) => void;
  handleRepeatTrainerInstruction: () => void;
}

export default function SessionControls({
  currentTime,
  playbackRate,
  assistantMuted,
  seek,
  setPlaybackRate,
  setAssistantMuted,
  handleRepeatTrainerInstruction,
}: SessionControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => seek(Math.max(currentTime - 10, 0))}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-sm font-semibold border border-slate-700 transition-all flex items-center gap-1.5"
          title="Rewind 10 seconds"
          aria-label="Rewind trainer video by 10 seconds"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              d="M4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z"
            />
          </svg>
          Rewind 10s
        </button>

        <button
          onClick={() => setPlaybackRate(playbackRate === 1.0 ? 0.75 : 1.0)}
          className={`px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all ${
            playbackRate === 0.75
              ? "bg-yellow-400 text-slate-950 border-yellow-400"
              : "bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700"
          }`}
          aria-pressed={playbackRate === 0.75}
          aria-label={playbackRate === 0.75 ? "Set video speed to normal" : "Slow down video speed to 0.75x"}
        >
          {playbackRate === 0.75 ? "Normal Speed (1.0x)" : "Slow Down (0.75x)"}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleRepeatTrainerInstruction}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-sm font-semibold border border-slate-700 transition-all flex items-center gap-1.5"
          aria-label="Repeat last trainer instruction cue"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
            />
          </svg>
          Repeat Last Trainer Instruction
        </button>

        <button
          onClick={() => setAssistantMuted(!assistantMuted)}
          className={`px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all ${
            assistantMuted
              ? "bg-red-500/10 text-red-400 border-red-500/30"
              : "bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700"
          }`}
          aria-pressed={assistantMuted}
          aria-label={assistantMuted ? "Unmute assistant voice" : "Mute assistant voice"}
        >
          {assistantMuted ? "Unmute Assistant" : "Mute Assistant"}
        </button>
      </div>
    </div>
  );
}
