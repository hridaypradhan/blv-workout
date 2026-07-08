import React from "react";

export interface SetupAudioCoexistenceSectionProps {
  interruptionLevel: string;
  setInterruptionLevel: (level: string) => void;
  pauseBeforeSpeaking: boolean;
  setPauseBeforeSpeaking: (pause: boolean) => void;
}

export function SetupAudioCoexistenceSection({
  interruptionLevel,
  setInterruptionLevel,
  pauseBeforeSpeaking,
  setPauseBeforeSpeaking,
}: SetupAudioCoexistenceSectionProps) {
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl" aria-labelledby="audio-coexistence-heading" id="audio-coexistence-section">
      <h2 id="audio-coexistence-heading" className="text-lg font-bold text-white mb-2">
        Audio Coexistence (Session Overrides)
      </h2>
      <p className="text-sm text-slate-300 mb-4">
        Configure how the assistant coexists with the trainer&apos;s audio. (These selections will override your saved defaults for this session only).
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6" role="radiogroup" aria-labelledby="audio-coexistence-heading">
        {[
          { id: "setup-int-silent", value: "silent", label: "Silent", desc: "No voice feedback. Playback is entirely uninterrupted." },
          { id: "setup-int-haptic", value: "haptic_only", label: "Haptic Only", desc: "Vibration cues on sleeves. Speech is fully silenced." },
          { id: "setup-int-brief", value: "brief_speech", label: "Brief Speech", desc: "Short correction words only during clear speech gaps." },
          { id: "setup-int-full", value: "full_speech", label: "Full Speech", desc: "Ducks YouTube audio to deliver complete form guidance." },
        ].map((lvl) => (
          <label
            key={lvl.id}
            htmlFor={lvl.id}
            className={`relative flex flex-col p-4 rounded-xl cursor-pointer select-none transition-all focus-within:ring-2 focus-within:ring-yellow-400 ${
              interruptionLevel === lvl.value
                ? "bg-slate-950 border-2 border-yellow-400"
                : "bg-slate-950 border border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                id={lvl.id}
                name="interruption-level"
                value={lvl.value}
                checked={interruptionLevel === lvl.value}
                onChange={(e) => setInterruptionLevel(e.target.value)}
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
