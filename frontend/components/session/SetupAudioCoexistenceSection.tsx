import React from "react";

export interface SetupAudioCoexistenceSectionProps {
  pauseBeforeSpeaking: boolean;
  setPauseBeforeSpeaking: (pause: boolean) => void;
  assistantVerbosity: string;
  setAssistantVerbosity: (verbosity: string) => void;
}

export function SetupAudioCoexistenceSection({
  pauseBeforeSpeaking,
  setPauseBeforeSpeaking,
  assistantVerbosity,
  setAssistantVerbosity,
}: SetupAudioCoexistenceSectionProps) {
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl" aria-labelledby="audio-coexistence-heading" id="audio-coexistence-section">
      <h2 id="audio-coexistence-heading" className="text-lg font-bold text-white mb-2">
        Audio Settings
      </h2>
      <p className="text-sm text-slate-300 mb-4">
        Full speech is always enabled. The assistant delivers complete form guidance alongside the trainer&apos;s audio.
      </p>

      {/* Assistant Verbosity */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6" role="radiogroup" aria-label="Assistant verbosity level">
        {[
          { id: "setup-verbosity-minimal", value: "minimal", label: "Minimal", desc: "Short, essential corrections only." },
          { id: "setup-verbosity-moderate", value: "moderate", label: "Moderate", desc: "Balanced guidance with clear context." },
          { id: "setup-verbosity-detailed", value: "detailed", label: "Detailed", desc: "Thorough explanations and cues." },
        ].map((lvl) => (
          <label
            key={lvl.id}
            htmlFor={lvl.id}
            className={`relative flex flex-col p-4 rounded-xl cursor-pointer select-none transition-all focus-within:ring-2 focus-within:ring-yellow-400 ${
              assistantVerbosity === lvl.value
                ? "bg-slate-950 border-2 border-yellow-400"
                : "bg-slate-950 border border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                id={lvl.id}
                name="assistant-verbosity"
                value={lvl.value}
                checked={assistantVerbosity === lvl.value}
                onChange={(e) => setAssistantVerbosity(e.target.value)}
                className="w-4 h-4 text-yellow-400 bg-slate-900 border-slate-800 focus:ring-yellow-400"
              />
              <span className="text-sm font-bold text-white">{lvl.label}</span>
            </div>
            <span className="text-sm text-slate-300 mt-1.5">{lvl.desc}</span>
          </label>
        ))}
      </div>

      {/* Pause Before Speaking Toggle */}
      <div className="flex items-center justify-between gap-4 p-4 bg-slate-950 border border-slate-800 rounded-2xl">
        <div className="flex flex-col gap-0.5">
          <label htmlFor="pause-before-speaking" className="text-sm font-bold text-slate-200 cursor-pointer">
            Pause Before Speaking
          </label>
          <span className="text-sm text-slate-300">Briefly pauses the YouTube video when the assistant speaks a correction.</span>
        </div>
        <input
          type="checkbox"
          id="pause-before-speaking"
          checked={pauseBeforeSpeaking}
          onChange={(e) => setPauseBeforeSpeaking(e.target.checked)}
          className="w-10 h-5 bg-slate-900 border-slate-800 text-yellow-400 focus:ring-yellow-400 rounded-full cursor-pointer accent-yellow-400"
        />
      </div>
    </section>
  );
}
