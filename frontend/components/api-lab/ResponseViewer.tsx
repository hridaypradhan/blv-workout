import React, { useState } from "react";
import { ApiResponseState } from "../../types/apiLab";

interface ResponseViewerProps {
  responseState: ApiResponseState | null;
}

export default function ResponseViewer({ responseState }: ResponseViewerProps) {
  const [activeTab, setActiveTab] = useState<"body" | "headers">("body");

  if (!responseState) {
    return (
      <div className="flex flex-col items-center justify-center bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 h-64 shadow-xl">
        <svg
          className="w-12 h-12 text-slate-700 mb-3"
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
            d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p className="text-sm font-semibold">Ready to test. Select an endpoint and click Send Request.</p>
      </div>
    );
  }

  const { status, statusText, duration, headers, body, error, loading } = responseState;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center h-64 shadow-xl">
        <div className="w-10 h-10 border-4 border-yellow-400/20 border-t-yellow-400 rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-400" aria-live="polite">Waiting for response...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-red-400">
            Network Error
          </h3>
        </div>
        <div className="bg-red-950/20 border border-red-900/40 p-4 rounded-xl space-y-2">
          <p className="text-xs font-semibold text-red-300 leading-relaxed">
            {error}
          </p>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            Ensure the FastAPI backend is running locally and CORS settings allow requests from your browser context.
          </p>
        </div>
      </div>
    );
  }

  const isSuccess = status && status >= 200 && status < 300;
  const isServerCrash = status && status >= 500;

  const getStatusColor = () => {
    if (isSuccess) return "text-emerald-400 bg-emerald-950/60 border-emerald-900";
    if (isServerCrash) return "text-red-400 bg-red-950/60 border-red-900";
    return "text-amber-400 bg-amber-950/60 border-amber-900";
  };

  // Format body helper
  const renderFormattedBody = () => {
    if (!body) return <span className="text-slate-600 italic">Empty response body</span>;
    try {
      const parsed = JSON.parse(body);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return body;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      {/* Response Status Panel */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-extrabold px-2.5 py-1 rounded border uppercase tracking-wider ${getStatusColor()}`}
            aria-live="polite"
          >
            {status} {statusText}
          </span>
          {duration !== null && (
            <span className="text-slate-400 text-xs font-semibold">
              Time: <span className="text-slate-200">{duration} ms</span>
            </span>
          )}
        </div>

        {/* Tab Selection */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800/80">
          <button
            onClick={() => setActiveTab("body")}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "body" ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Response Body
          </button>
          <button
            onClick={() => setActiveTab("headers")}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "headers" ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Headers
          </button>
        </div>
      </div>

      {/* Warnings block for server issues */}
      {!isSuccess && status !== null && (
        <div className="bg-amber-950/20 border border-amber-900/40 p-3.5 rounded-xl">
          <p className="text-xs text-amber-300 leading-relaxed font-semibold">
            {isServerCrash
              ? "⚠️ Backend returned a server error. The endpoint code might be raising a NotImplementedError or experiencing a traceback."
              : `⚠️ Request failed with status code ${status}. Check validation logs or request parameters.`}
          </p>
        </div>
      )}

      {/* Active Tab Panel */}
      <div className="relative">
        {activeTab === "body" ? (
          <pre
            id="response-body-pre"
            className="w-full font-mono text-[11px] bg-slate-950 border border-slate-800/80 rounded-xl p-4 text-slate-300 overflow-x-auto max-h-[400px] leading-relaxed"
          >
            <code>{renderFormattedBody()}</code>
          </pre>
        ) : (
          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 max-h-[400px] overflow-y-auto">
            {Object.keys(headers).length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80">
                    <th className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 pb-2">Header Name</th>
                    <th className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 pb-2 pl-4">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(headers).map(([key, val]) => (
                    <tr key={key} className="border-b border-slate-900 hover:bg-slate-900/30">
                      <td className="text-xs font-semibold text-slate-400 py-2.5 font-mono break-all">{key}</td>
                      <td className="text-xs text-slate-200 py-2.5 pl-4 font-mono break-all">{val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-slate-500 italic py-2">No headers recorded</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
