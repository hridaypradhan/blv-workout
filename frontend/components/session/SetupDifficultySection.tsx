import React from "react";

export interface SetupDifficultySectionProps {
  difficulty: string;
  setDifficulty: (difficulty: string) => void;
}

export function SetupDifficultySection({
  difficulty,
  setDifficulty,
}: SetupDifficultySectionProps) {
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl" aria-labelledby="difficulty-heading" id="difficulty-section">
      <h2 id="difficulty-heading" className="text-lg font-bold text-white mb-2">
        How are you feeling today?
      </h2>
      <p className="text-sm text-slate-300 mb-4">
        The assistant adjusts its interruption level and haptic tolerances based on your current state (applicable for this session only).
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" role="radiogroup" aria-labelledby="difficulty-heading">
        {[
          { id: "diff-fresh", label: "Fresh", desc: "Push for perfect posture tolerances." },
          { id: "diff-norm", label: "Normal", desc: "Standard tolerances & correction rates." },
          { id: "diff-tired", label: "Tired", desc: "Relaxed threshold, gentle voice encouragement." },
        ].map((diff) => (
          <label
            key={diff.id}
            htmlFor={diff.id}
            className={`relative flex flex-col p-4 rounded-xl cursor-pointer select-none transition-all focus-within:ring-2 focus-within:ring-yellow-400 text-center ${
              difficulty === diff.id
                ? "bg-slate-950 border-2 border-yellow-400"
                : "bg-slate-950 border border-slate-800 hover:border-slate-700"
            }`}
          >
            <input
              type="radio"
              id={diff.id}
              name="difficulty"
              value={diff.id}
              checked={difficulty === diff.id}
              onChange={(e) => setDifficulty(e.target.value)}
              className="sr-only"
            />
            <span className="text-sm font-bold text-white mb-1">{diff.label}</span>
            <span className="text-sm text-slate-300 leading-normal">{diff.desc}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
