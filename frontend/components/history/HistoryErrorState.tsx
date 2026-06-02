import React from "react";

interface HistoryErrorStateProps {
  error: string;
  onRetry: () => void;
  title?: string;
}

export default function HistoryErrorState({
  error,
  onRetry,
  title = "Failed to Load History",
}: HistoryErrorStateProps) {
  return (
    <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[40vh] text-center p-6 bg-slate-900 border border-slate-800 rounded-3xl">
      <span className="text-red-500 text-5xl mb-4" role="img" aria-label="Error">⚠️</span>
      <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
      <p className="text-sm text-slate-400 mb-6">{error}</p>
      <button
        onClick={onRetry}
        className="px-5 py-3 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold rounded-xl text-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
      >
        Retry Loading
      </button>
    </div>
  );
}

