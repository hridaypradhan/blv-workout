import React from "react";

export interface SetupAskAssistantSectionProps {
  handleAskQuestion: (e: React.FormEvent) => void;
  askInput: string;
  setAskInput: (input: string) => void;
  isPending: boolean;
  qaError: string | null;
  assistantResponse: string | null;
}

export function SetupAskAssistantSection({
  handleAskQuestion,
  askInput,
  setAskInput,
  isPending,
  qaError,
  assistantResponse,
}: SetupAskAssistantSectionProps) {
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl" aria-labelledby="ask-heading" id="ask-assistant-section">
      <h2 id="ask-heading" className="text-lg font-bold text-white mb-1">
        Ask Assistant
      </h2>
      <p className="text-sm text-slate-300 mb-4">
        Have questions about the moves? Ask the assistant for supplementary tips before starting.
      </p>

      <form onSubmit={handleAskQuestion} className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Ask e.g. 'How do I align my feet for a squats setup?'"
          value={askInput}
          onChange={(e) => setAskInput(e.target.value)}
          className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-yellow-400 rounded-xl text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400 transition-all"
          aria-label="Ask about today's exercises before starting"
          id="setup-ask-input"
        />
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-3 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-500 text-slate-100 font-bold rounded-xl text-sm border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 transition-all min-w-[80px] flex items-center justify-center"
          id="setup-ask-btn"
          aria-label={isPending ? "Assistant is responding" : undefined}
        >
          {isPending ? (
            <>
              <div className="w-5 h-5 border-2 border-slate-200 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              <span className="sr-only">Assistant is responding</span>
            </>
          ) : (
            "Send"
          )}
        </button>
      </form>

      {qaError && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400 font-medium flex items-center gap-2" role="alert">
          <svg
            className="w-5 h-5 flex-shrink-0"
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
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{qaError}</span>
        </div>
      )}

      {assistantResponse && (
        <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200">
          <span className="font-bold text-yellow-400 block mb-1">Assistant Response:</span>
          <p>{assistantResponse}</p>
        </div>
      )}
    </section>
  );
}
