import React from "react";

interface QnAChatPanelProps {
  qaMessages: Array<{ sender: "assistant" | "user"; text: string }>;
  chatInput: string;
  setChatInput: (val: string) => void;
  isPending: boolean;
  qaError: string | null;
  handleSendMessage: (e: React.FormEvent) => void;
}

export default function QnAChatPanel({
  qaMessages,
  chatInput,
  setChatInput,
  isPending,
  qaError,
  handleSendMessage,
}: QnAChatPanelProps) {
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl flex-1 flex flex-col justify-between min-h-[300px]" aria-labelledby="assistant-feed-heading">
      <div>
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800/65">
          <h2 id="assistant-feed-heading" className="text-sm font-bold text-slate-400 uppercase tracking-wider">
            Workout Q&A Chat
          </h2>
        </div>

        <div
          className="space-y-4 mb-4 pr-1 max-h-[220px] lg:max-h-[320px] overflow-y-auto"
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {qaMessages.length === 0 ? (
            <div className="p-3 rounded-2xl text-sm leading-relaxed max-w-[90%] bg-slate-950 border border-slate-800 text-slate-300 self-start">
              <p className="font-bold text-xs mb-1 opacity-70">ASSISTANT</p>
              <p>Welcome! Stand 6 feet back. We are preparing to assist with your YouTube workout.</p>
            </div>
          ) : (
            qaMessages.map((msg, index) => (
              <div
                key={index}
                className={`p-3 rounded-2xl text-sm leading-relaxed max-w-[90%] ${msg.sender === "assistant"
                    ? "bg-slate-950 border border-slate-800 text-slate-300 self-start"
                    : "bg-yellow-400 text-slate-950 font-medium ml-auto"
                  }`}
              >
                <p className="font-bold text-xs mb-1 opacity-70">
                  {msg.sender === "assistant" ? "ASSISTANT" : "YOU"}
                </p>
                <p>{msg.text}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="w-full border-t border-slate-800/80 pt-4 flex flex-col">
        {isPending && (
          <div className="text-xs text-yellow-400 animate-pulse px-1 mb-2 font-medium" id="assistant-responding-indicator">
            Assistant is responding...
          </div>
        )}
        {qaError && (
          <div className="text-xs text-red-400 px-1 mb-2 font-semibold flex items-center gap-1" id="qa-error-display">
            <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Error: {qaError}
          </div>
        )}
        <form onSubmit={handleSendMessage} className="w-full flex flex-col gap-2">
          <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              placeholder={isPending ? "Responding..." : "Ask about form..."}
              disabled={isPending}
              className="flex-1 w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-yellow-400 rounded-xl text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400 transition-all disabled:opacity-50"
              aria-label="Ask assistant about movement setup or form"
              id="live-chat-input"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
            />
            <button
              type="submit"
              disabled={isPending || !chatInput.trim()}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-500 text-slate-100 font-bold rounded-xl text-sm border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 shrink-0 transition-all self-end sm:self-auto h-[42px] flex items-center justify-center"
              id="live-chat-btn"
            >
              {isPending ? "Sending..." : "Send"}
            </button>
          </div>
          <span className="text-[11px] text-slate-500 px-1">
            Ask about movement setup or form correction tips.
          </span>
        </form>
      </div>
    </section>
  );
}
