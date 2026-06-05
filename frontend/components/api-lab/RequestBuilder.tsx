import React, { useState, useEffect } from "react";
import { Endpoint } from "../../types/apiLab";
import { apiSamples } from "../../lib/apiSamples";

interface RequestBuilderProps {
  endpoint: Endpoint;
  loading: boolean;
  onSend: (
    pathParams: Record<string, string>,
    queryParams: Record<string, string>,
    body: string,
    headers: Record<string, string>
  ) => void;
}

export default function RequestBuilder({
  endpoint,
  loading,
  onSend
}: RequestBuilderProps) {
  const sampleKey = `${endpoint.method} ${endpoint.path}`;
  const sample = apiSamples[sampleKey];

  // Request inputs state
  const [pathParams, setPathParams] = useState<Record<string, string>>({});
  const [queryParams, setQueryParams] = useState<Record<string, string>>({});
  const [headers, setHeaders] = useState<Record<string, string>>({
    "Content-Type": "application/json"
  });
  const [body, setBody] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Safety confirm for DELETE
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Show expected output toggle state
  const [showExpected, setShowExpected] = useState(true);
  const [copied, setCopied] = useState(false);

  // Load sample or default values on endpoint change
  useEffect(() => {
    // Reset state
    const initialPath: Record<string, string> = {};
    const initialQuery: Record<string, string> = {};

    endpoint.parameters.forEach((p) => {
      if (p.in === "path") {
        initialPath[p.name] = sample?.pathParams?.[p.name] || "";
      } else if (p.in === "query") {
        initialQuery[p.name] = sample?.queryParams?.[p.name] || "";
      }
    });

    setPathParams(initialPath);
    setQueryParams(initialQuery);
    setBody(sample?.body || "");
    setHeaders({
      "Content-Type": "application/json"
    });
    setJsonError(null);
    setConfirmDelete(false);
    setShowExpected(true);
    setCopied(false);
  }, [endpoint, sample]);

  const handleCopyExpected = () => {
    if (!sample?.response) return;
    navigator.clipboard.writeText(sample.response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Validate JSON body
  const handleBodyChange = (value: string) => {
    setBody(value);
    if (!value.trim()) {
      setJsonError(null);
      return;
    }
    try {
      JSON.parse(value);
      setJsonError(null);
    } catch (err: unknown) {
      setJsonError(err instanceof Error ? err.message : "Invalid JSON syntax");
    }
  };

  const handleSend = () => {
    if (endpoint.method === "DELETE" && !confirmDelete) {
      return;
    }
    if (body.trim() && jsonError) {
      return; // prevent sending invalid JSON
    }
    onSend(pathParams, queryParams, body, headers);
  };

  const hasBody = ["POST", "PUT", "PATCH"].includes(endpoint.method);

  const getMethodBadgeClass = (method: string) => {
    switch (method.toUpperCase()) {
      case "GET":
        return "text-blue-400 bg-blue-950/60 border-blue-900";
      case "POST":
        return "text-emerald-400 bg-emerald-950/60 border-emerald-900";
      case "PATCH":
        return "text-amber-400 bg-amber-950/60 border-amber-900";
      case "DELETE":
        return "text-rose-400 bg-rose-950/60 border-rose-900";
      default:
        return "text-slate-400 bg-slate-900 border-slate-800";
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Endpoint Info Header */}
      <div className="flex items-start justify-between border-b border-slate-800 pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span
              className={`text-xs font-extrabold px-2.5 py-1 rounded border uppercase tracking-wider ${getMethodBadgeClass(
                endpoint.method
              )}`}
            >
              {endpoint.method}
            </span>
            <h2 className="text-lg font-bold text-white break-all whitespace-normal">{endpoint.path}</h2>
          </div>
          {endpoint.summary && (
            <p className="text-slate-400 text-sm mt-1">{endpoint.summary}</p>
          )}
          {endpoint.description && (
            <p className="text-slate-400 text-xs mt-2 italic leading-relaxed">
              {endpoint.description}
            </p>
          )}
        </div>

        {sample && (
          <button
            onClick={() => {
              // Reload sample explicitly
              setBody(sample.body || "");
              if (sample.pathParams) {
                setPathParams((prev) => ({ ...prev, ...sample.pathParams }));
              }
              if (sample.queryParams) {
                setQueryParams((prev) => ({ ...prev, ...sample.queryParams }));
              }
              setJsonError(null);
            }}
            className="text-xs font-bold text-yellow-400 hover:text-yellow-300 border border-yellow-400/30 hover:border-yellow-400/60 px-3 py-1.5 rounded-xl transition-all"
            aria-label="Load sample payload data"
          >
            Reset Sample
          </button>
        )}
      </div>

      {/* Path Parameters Section */}
      {Object.keys(pathParams).length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
            Path Parameters
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.keys(pathParams).map((paramName) => (
              <div key={paramName} className="space-y-1">
                <label
                  htmlFor={`path-param-${paramName}`}
                  className="block text-xs font-semibold text-slate-300"
                >
                  {paramName} <span className="text-red-500">*</span>
                </label>
                <input
                  id={`path-param-${paramName}`}
                  type="text"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-yellow-400 transition-colors"
                  value={pathParams[paramName]}
                  onChange={(e) =>
                    setPathParams((prev) => ({ ...prev, [paramName]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Query Parameters Section */}
      {Object.keys(queryParams).length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
            Query Parameters
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.keys(queryParams).map((paramName) => (
              <div key={paramName} className="space-y-1">
                <label
                  htmlFor={`query-param-${paramName}`}
                  className="block text-xs font-semibold text-slate-300"
                >
                  {paramName}
                </label>
                <input
                  id={`query-param-${paramName}`}
                  type="text"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-yellow-400 transition-colors"
                  value={queryParams[paramName]}
                  onChange={(e) =>
                    setQueryParams((prev) => ({ ...prev, [paramName]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Body Area */}
      {hasBody && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label
              htmlFor="request-body-input"
              className="text-xs font-extrabold uppercase tracking-wider text-slate-400"
            >
              Request JSON Body
            </label>
            {jsonError && (
              <span className="text-sm bg-red-950 border border-red-800 text-red-400 font-semibold px-2 py-0.5 rounded">
                Invalid JSON
              </span>
            )}
          </div>
          <textarea
            id="request-body-input"
            rows={8}
            className={`w-full font-mono text-xs bg-slate-950 border rounded-xl p-4 text-slate-300 focus:outline-none focus:ring-1 focus:ring-yellow-400 transition-colors ${
              jsonError ? "border-red-800 focus:border-red-500" : "border-slate-800 focus:border-yellow-400"
            }`}
            placeholder='{\n  "key": "value"\n}'
            value={body}
            onChange={(e) => handleBodyChange(e.target.value)}
          />
          {jsonError && (
            <p className="text-red-400 text-sm leading-relaxed">{jsonError}</p>
          )}
        </div>
      )}

      {/* Expected Response (Sample) Section */}
      {sample?.response && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Expected Output (Sample Response)
            </h3>
            <button
              type="button"
              onClick={() => setShowExpected(!showExpected)}
              className="text-xs font-bold text-yellow-400 hover:text-yellow-300 transition-colors focus:outline-none"
            >
              {showExpected ? "Hide Sample Response" : "Show Sample Response"}
            </button>
          </div>
          {showExpected && (
            <div className="relative group">
              <pre className="font-mono text-xs bg-slate-950 border border-slate-800/80 rounded-xl p-4 text-emerald-400 overflow-x-auto max-h-64 leading-relaxed shadow-inner">
                <code>{sample.response}</code>
              </pre>
              <button
                type="button"
                onClick={handleCopyExpected}
                className="absolute top-3 right-3 text-xs font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg px-2.5 py-1.5 transition-all shadow-md active:scale-95"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 border-t border-slate-800">
        {endpoint.method === "DELETE" && (
          <label className="flex items-center gap-3 bg-rose-950/20 border border-rose-900/40 p-3 rounded-xl cursor-pointer w-full sm:w-auto">
            <input
              type="checkbox"
              className="w-4 h-4 rounded text-rose-500 bg-slate-950 border-slate-800 focus:ring-rose-500 focus:ring-offset-slate-900 cursor-pointer"
              checked={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.checked)}
            />
            <span className="text-xs font-semibold text-rose-300 select-none">
              Confirm Delete Operation
            </span>
          </label>
        )}

        <button
          onClick={handleSend}
          disabled={loading || (endpoint.method === "DELETE" && !confirmDelete) || (hasBody && !!jsonError)}
          className={`w-full sm:w-auto sm:ml-auto px-6 py-3 font-extrabold text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 ${
            endpoint.method === "DELETE"
              ? confirmDelete
                ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/10 cursor-pointer"
                : "bg-slate-800 text-slate-500 cursor-not-allowed"
              : hasBody && jsonError
              ? "bg-slate-800 text-slate-500 cursor-not-allowed"
              : "bg-yellow-400 hover:bg-yellow-300 text-slate-950 shadow-yellow-400/10 cursor-pointer"
          }`}
          aria-live="polite"
        >
          {loading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Sending...
            </>
          ) : (
            "Send Request"
          )}
        </button>
      </div>
    </div>
  );
}
