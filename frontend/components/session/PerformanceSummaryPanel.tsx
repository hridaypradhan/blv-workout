import React from "react";

interface PerformanceSummaryPanelProps {
  currentExercise: {
    id: string;
    name: string;
    description_accessible?: string | null;
    counting_joint?: string | null;
    start_time_seconds: number;
    end_time_seconds: number;
  } | null;
  lastHandledRep: number;
  currentTime: number;
  formatTime: (seconds: number) => string;
}

export default function PerformanceSummaryPanel({
  currentExercise,
  lastHandledRep,
  currentTime,
  formatTime,
}: PerformanceSummaryPanelProps) {
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col justify-between text-center" aria-label="Tracked Performance Summary">
      <div>
        <span className="text-xs uppercase font-extrabold text-yellow-400 tracking-wider block mb-1">
          Active Exercise Section
        </span>
        <h2 className="text-xl font-bold text-white mb-2">
          {currentExercise ? currentExercise.name : "Break / Transition"}
        </h2>
      </div>
      <div className="my-4 py-4 px-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col justify-center">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-1">
          {currentExercise ? "Supplementary Target Cues" : "Your Tracked Performance"}
        </span>
        <span className={`font-extrabold text-yellow-400 tracking-tight block ${currentExercise ? "text-xl font-bold leading-relaxed" : "text-5xl"}`}>
          {currentExercise ? (
            currentExercise.description_accessible || "Follow YouTube instructions"
          ) : (
            "Ready"
          )}
        </span>
        {currentExercise && (
          <span className="text-sm text-slate-400 mt-2 block">
            Joint: <strong className="text-slate-200 capitalize">{currentExercise.counting_joint || "any"}</strong> | Target: Follow trainer
            {lastHandledRep >= 0 && (
              <span className="block text-yellow-400 font-bold mt-1 text-sm" id="rep-completion-telemetry-badge">
                Completed: {lastHandledRep} reps
              </span>
            )}
          </span>
        )}
      </div>

      <div>
        <div className="flex justify-between items-center text-sm text-slate-400 px-1 mb-1.5">
          <span>Section Progress</span>
          <span>
            {currentExercise
              ? `${formatTime(currentTime - currentExercise.start_time_seconds)} / ${formatTime(currentExercise.end_time_seconds - currentExercise.start_time_seconds)}`
              : "No active exercise"}
          </span>
        </div>
        <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
          <div
            className="bg-yellow-400 h-full rounded-full transition-all"
            style={{
              width: currentExercise
                ? `${((currentTime - currentExercise.start_time_seconds) / (currentExercise.end_time_seconds - currentExercise.start_time_seconds)) * 100}%`
                : "0%"
            }}
          />
        </div>
      </div>
    </section>
  );
}
