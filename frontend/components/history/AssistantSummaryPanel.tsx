import React from "react";

interface AssistantSummaryPanelProps {
  summary: string;
  onPlayVoiceSummary: () => void;
}

export default function AssistantSummaryPanel({ summary, onPlayVoiceSummary }: AssistantSummaryPanelProps) {
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl" aria-labelledby="summary-heading">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h2 id="summary-heading" className="text-lg font-bold text-white">
          Assistant Summary
        </h2>
        <button
          onClick={onPlayVoiceSummary}
          className="inline-flex items-center justify-center px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold rounded-xl text-xs border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
          aria-label="Read Assistant Summary Aloud"
          id="speak-summary-btn"
        >
          <svg
            className="w-4 h-4 mr-2 text-yellow-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
            />
          </svg>
          Read Aloud
        </button>
      </div>

      <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
        <p className="text-sm text-slate-300 leading-relaxed">
          {summary}
        </p>
      </div>
    </section>
  );
}
