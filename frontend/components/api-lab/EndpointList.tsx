import React, { useState } from "react";
import { Endpoint } from "../../types/apiLab";

interface EndpointListProps {
  endpoints: Endpoint[];
  selectedEndpoint: Endpoint | null;
  onSelect: (endpoint: Endpoint) => void;
}

export default function EndpointList({
  endpoints,
  selectedEndpoint,
  onSelect
}: EndpointListProps) {
  const [search, setSearch] = useState("");

  // Group endpoints by tag
  const filtered = endpoints.filter(
    (e) =>
      e.path.toLowerCase().includes(search.toLowerCase()) ||
      (e.summary && e.summary.toLowerCase().includes(search.toLowerCase()))
  );

  const groups: Record<string, Endpoint[]> = {};
  filtered.forEach((e) => {
    const tag = e.tags[0] || "general";
    if (!groups[tag]) {
      groups[tag] = [];
    }
    groups[tag].push(e);
  });

  const getMethodBadgeClass = (method: string) => {
    switch (method.toUpperCase()) {
      case "GET":
        return "bg-blue-900/60 text-blue-300 border-blue-800";
      case "POST":
        return "bg-emerald-900/60 text-emerald-300 border-emerald-800";
      case "PATCH":
        return "bg-amber-900/60 text-amber-300 border-amber-800";
      case "DELETE":
        return "bg-rose-900/60 text-rose-300 border-rose-800";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
      {/* Search Header */}
      <div className="mb-4">
        <label htmlFor="endpoint-search" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
          Search Endpoints
        </label>
        <div className="relative">
          <input
            id="endpoint-search"
            type="text"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-yellow-400 transition-colors"
            placeholder="e.g. /health or /api/session"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs font-bold"
              aria-label="Clear search"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Endpoints List */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-6" role="list">
        {Object.entries(groups).map(([tag, list]) => (
          <div key={tag} className="space-y-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-yellow-400 border-b border-slate-800/80 pb-1 px-1">
              {tag}
            </h3>
            <div className="space-y-1">
              {list.map((e) => {
                const isSelected =
                  selectedEndpoint?.path === e.path && selectedEndpoint?.method === e.method;
                return (
                  <button
                    key={`${e.method}-${e.path}`}
                    onClick={() => onSelect(e)}
                    className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left border transition-all ${
                      isSelected
                        ? "bg-slate-800 border-slate-700 shadow-md"
                        : "bg-transparent border-transparent hover:bg-slate-800/40 hover:border-slate-800"
                    }`}
                    aria-current={isSelected ? "true" : undefined}
                  >
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded border uppercase tracking-wide shrink-0 ${getMethodBadgeClass(
                        e.method
                      )}`}
                    >
                      {e.method}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-100 break-all whitespace-normal" title={e.path}>{e.path}</p>
                      {e.summary && (
                        <p className="text-xs text-slate-500 truncate mt-0.5">{e.summary}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {Object.keys(groups).length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <p className="text-sm">No endpoints found matching search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
