import React from "react";

interface HistoryLoadingStateProps {
  title?: string;
  description?: string;
}


export default function HistoryLoadingState({
  title = "Loading History",
  description = "Fetching your completed sessions...",
}: HistoryLoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
      <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-4" />
      <h2 className="text-lg font-bold text-white mb-2">{title}</h2>
      <p className="text-sm text-slate-400">{description}</p>
    </div>
  );
}

