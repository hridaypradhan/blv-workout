"use client";

import React, { useState, useEffect } from "react";
import PageWrapper from "@/components/layout/PageWrapper";
import EndpointList from "@/components/api-lab/EndpointList";
import RequestBuilder from "@/components/api-lab/RequestBuilder";
import ResponseViewer from "@/components/api-lab/ResponseViewer";
import { Endpoint, ApiResponseState } from "@/types/apiLab";
import { fetchOpenApiSchema, parseSchema } from "@/lib/apiLab";

export default function ApiLab() {
  const [backendUrl, setBackendUrl] = useState("http://localhost:8000");
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | null>(null);
  const [responseState, setResponseState] = useState<ApiResponseState | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  // Load Base URL from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("fitA11y_backend_url");
      if (stored) {
        setBackendUrl(stored);
        loadSchema(stored);
      } else {
        loadSchema("http://localhost:8000");
      }
    }
  }, []);

  const loadSchema = async (url: string) => {
    setSchemaLoading(true);
    setSchemaError(null);
    setEndpoints([]);
    setSelectedEndpoint(null);
    setResponseState(null);

    try {
      const rawSchema = await fetchOpenApiSchema(url);
      const parsed = parseSchema(rawSchema);
      setEndpoints(parsed);
      if (parsed.length > 0) {
        setSelectedEndpoint(parsed[0]);
      }
    } catch (err: unknown) {
      setSchemaError(err instanceof Error ? err.message : "Failed to load API schema.");
    } finally {
      setSchemaLoading(false);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBackendUrl(value);
    localStorage.setItem("fitA11y_backend_url", value);
  };

  const handleRefreshSchema = () => {
    loadSchema(backendUrl);
  };

  const handleSend = async (
    pathParams: Record<string, string>,
    queryParams: Record<string, string>,
    body: string,
    customHeaders: Record<string, string>
  ) => {
    if (!selectedEndpoint) return;

    setResponseState({
      status: null,
      statusText: "",
      duration: null,
      headers: {},
      body: "",
      error: null,
      loading: true
    });

    // Build URL
    let requestPath = selectedEndpoint.path;
    Object.entries(pathParams).forEach(([name, val]) => {
      requestPath = requestPath.replace(`{${name}}`, encodeURIComponent(val));
    });

    const searchParams = new URLSearchParams();
    Object.entries(queryParams).forEach(([name, val]) => {
      if (val.trim() !== "") {
        searchParams.append(name, val);
      }
    });

    const queryString = searchParams.toString();
    const cleanBaseUrl = backendUrl.replace(/\/$/, "");
    const fullUrl = `${cleanBaseUrl}${requestPath}${queryString ? `?${queryString}` : ""}`;

    // Prepare Request options
    const options: RequestInit = {
      method: selectedEndpoint.method,
      headers: customHeaders
    };

    if (["POST", "PUT", "PATCH"].includes(selectedEndpoint.method) && body.trim() !== "") {
      options.body = body;
    }

    const startTime = performance.now();

    try {
      const res = await fetch(fullUrl, options);
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      const responseBody = await res.text();

      // Extract headers
      const resHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        resHeaders[key] = value;
      });

      setResponseState({
        status: res.status,
        statusText: res.statusText,
        duration,
        headers: resHeaders,
        body: responseBody,
        error: null,
        loading: false
      });
    } catch (err: unknown) {
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      setResponseState({
        status: null,
        statusText: "",
        duration,
        headers: {},
        body: "",
        error: err instanceof Error ? err.message : "Network request failed. Check server or CORS logs.",
        loading: false
      });
    }
  };

  return (
    <PageWrapper id="api-lab-page-wrapper">
      <div className="max-w-7xl mx-auto py-4 space-y-6">
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white">API Lab</h1>
            <p className="text-slate-400 text-sm mt-1">
              Test and explore the FitA11y backend endpoints interactively directly from your browser.
            </p>
          </div>

          {/* Configurable Base URL */}
          <div className="flex items-end gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-md w-full md:w-auto">
            <div className="flex-1 md:w-64 space-y-1.5">
              <label htmlFor="backend-base-url" className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Backend Base URL
              </label>
              <input
                id="backend-base-url"
                type="text"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400 transition-colors"
                value={backendUrl}
                onChange={handleUrlChange}
              />
            </div>
            <button
              onClick={handleRefreshSchema}
              disabled={schemaLoading}
              className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-850 text-slate-200 border border-slate-700 hover:border-slate-600 font-bold text-sm px-4 py-2.5 rounded-xl transition-all h-[38px] flex items-center justify-center cursor-pointer"
              aria-label="Refresh endpoints schema"
            >
              {schemaLoading ? "Loading..." : "Load"}
            </button>
          </div>
        </div>

        {/* Dynamic Schema Errors */}
        {schemaError && (
          <div className="bg-red-950/20 border border-red-900/40 p-5 rounded-2xl space-y-3">
            <h3 className="text-red-400 font-bold text-sm">Failed to Load OpenAPI Specification</h3>
            <p className="text-xs text-red-300 leading-relaxed">
              Could not retrieve the schema file from: <code className="bg-red-950 px-1.5 py-0.5 rounded font-mono break-all">{backendUrl}/openapi.json</code>.
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Please check that the FastAPI server is running and the Backend Base URL is configured correctly.
            </p>
          </div>
        )}

        {/* Two-Pane Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Pane - Endpoint List */}
          <div className="lg:col-span-4 h-[600px]">
            {schemaLoading ? (
              <div className="flex flex-col items-center justify-center bg-slate-900 border border-slate-800 rounded-2xl h-full shadow-xl">
                <div className="w-8 h-8 border-4 border-yellow-400/20 border-t-yellow-400 rounded-full animate-spin mb-3" />
                <p className="text-xs text-slate-450">Retrieving API catalog...</p>
              </div>
            ) : (
              <EndpointList
                endpoints={endpoints}
                selectedEndpoint={selectedEndpoint}
                onSelect={(e) => {
                  setSelectedEndpoint(e);
                  setResponseState(null);
                }}
              />
            )}
          </div>

          {/* Right Pane - Request / Response Workspace */}
          <div className="lg:col-span-8 space-y-6">
            {selectedEndpoint ? (
              <>
                <RequestBuilder
                  endpoint={selectedEndpoint}
                  loading={responseState?.loading || false}
                  onSend={handleSend}
                />
                <ResponseViewer responseState={responseState} />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 h-96 shadow-xl">
                <svg
                  className="w-16 h-16 text-slate-800 mb-4"
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
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <p className="text-sm font-semibold">No endpoints are currently available.</p>
                <p className="text-xs text-slate-650 mt-1">Configure your Backend Base URL and load the schema to get started.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
