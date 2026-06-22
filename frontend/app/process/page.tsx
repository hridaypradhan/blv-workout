"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import PageWrapper from "@/components/layout/PageWrapper";
import { ProcessingStage } from "@/types";
import { submitVideo, getSSEUrl } from "@/lib/api";
import { PIPELINE_STEPS } from "@/lib/formatters/preprocessingFormatters";

/** Return the ordinal index of a stage within PIPELINE_STEPS (-1 if not found). */
function stageIndex(stage: ProcessingStage): number {
  return PIPELINE_STEPS.findIndex((s) => s.key === stage);
}

export default function ProcessVideo() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [currentStage, setCurrentStage] = useState<ProcessingStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAutoSubmitted, setHasAutoSubmitted] = useState(false);
  const [sseWarning, setSseWarning] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  /** Cleanup SSE connection on unmount. */
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  /** Open an EventSource and listen for status updates. */
  const connectSSE = useCallback((vid: string) => {
    // Close any existing connection
    eventSourceRef.current?.close();

    const es = new EventSource(getSSEUrl(vid));
    eventSourceRef.current = es;

    es.addEventListener("status", (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const stage = data.stage as ProcessingStage;
        setCurrentStage(stage);

        // Clear SSE warning upon receiving any valid update event
        setSseWarning(null);

        if (stage === ProcessingStage.FAILED) {
          setError(data.error || "An unknown error occurred.");
          es.close();
        } else if (stage === ProcessingStage.COMPLETED) {
          es.close();
        }
      } catch (err) {
        console.warn("Received malformed SSE event data:", event.data, err);
      }
    });

    es.onerror = () => {
      // EventSource will auto-reconnect, but if the job is already
      // terminal we don't want to keep reconnecting.
      if (
        currentStage === ProcessingStage.COMPLETED ||
        currentStage === ProcessingStage.FAILED
      ) {
        es.close();
      } else {
        // Show connection warning but do not fail the job as SSE auto-reconnects
        setSseWarning("Connection to preparation updates was interrupted. Reconnecting...");
      }
    };
  }, [currentStage]);

  /** Helper to trigger URL submission */
  const submitUrl = useCallback(async (url: string) => {
    setError(null);
    setCurrentStage(null);
    setSseWarning(null);
    setIsSubmitting(true);

    try {
      const result = await submitVideo(url);
      setCurrentStage(ProcessingStage.SUBMITTED);
      connectSSE(result.video_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit video.");
    } finally {
      setIsSubmitting(false);
    }
  }, [connectSSE]);

  /** Auto-submit on mount if URL parameter is present */
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlParam = params.get("url");
      if (urlParam && !hasAutoSubmitted) {
        setYoutubeUrl(urlParam);
        setHasAutoSubmitted(true);
        submitUrl(urlParam);
      }
    }
  }, [submitUrl, hasAutoSubmitted]);

  /** Handle form submission. */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitUrl(youtubeUrl);
  };

  /** Whether the assistance preparation pipeline is actively running. */
  const isProcessing =
    currentStage !== null &&
    currentStage !== ProcessingStage.COMPLETED &&
    currentStage !== ProcessingStage.FAILED;

  const isCompleted = currentStage === ProcessingStage.COMPLETED;
  const isFailed = currentStage === ProcessingStage.FAILED;
  const activeIdx = currentStage ? stageIndex(currentStage) : -1;

  /** Determine visual state for a step. */
  function stepState(idx: number) {
    if (currentStage === null) return "idle";
    if (isFailed) {
      // Mark all steps up to current as completed, current as failed
      if (idx < activeIdx) return "completed";
      if (idx === activeIdx) return "failed";
      return "idle";
    }
    if (isCompleted) {
      if (idx <= activeIdx) return "completed";
      return "idle";
    }
    if (idx < activeIdx) return "completed";
    if (idx === activeIdx) return "active";
    return "idle";
  }

  /** Status badge text. */
  function badgeText() {
    if (isFailed) return "Failed";
    if (isCompleted) return "Completed";
    if (isProcessing) return "Preparing...";
    return "Idle";
  }

  /** Status badge classes. */
  function badgeClasses() {
    if (isFailed)
      return "bg-red-500/10 text-red-400 border-red-500/30";
    if (isCompleted)
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    if (isProcessing)
      return "bg-yellow-400/10 text-yellow-400 border-yellow-400/30";
    return "bg-slate-800 text-slate-400 border-slate-700";
  }

  return (
    <PageWrapper id="process-video-wrapper">
      <div className="max-w-3xl mx-auto py-4">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-white">Prepare Video Assistance</h1>
          <p className="text-slate-400 text-sm mt-1">
            Submit any YouTube video link to generate an assistance sidecar manifest containing expected movement windows, haptic cues, and pacing structures.
          </p>
        </div>

        {/* URL Input Form */}
        <section
          className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl mb-6 md:mb-8"
          aria-labelledby="url-form-heading"
        >
          <h2 id="url-form-heading" className="text-xl font-bold text-white mb-4">
            Video Details
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="youtube-url" className="block text-sm font-semibold text-slate-200">
                YouTube URL
              </label>
              <input
                type="url"
                id="youtube-url"
                required
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                disabled={isProcessing}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-yellow-400 rounded-xl text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isProcessing}
              className="w-full px-6 py-3.5 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold rounded-xl text-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-yellow-400"
              id="submit-process-btn"
            >
              {isSubmitting
                ? "Submitting..."
                : isProcessing
                ? "Preparing..."
                : "Prepare Assistance"}
            </button>
          </form>
        </section>

        {/* Error Message */}
        {error && (
          <div
            className="mb-6 md:mb-8 bg-red-500/10 border border-red-500/30 rounded-2xl p-4 sm:p-6"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-red-400 mt-0.5 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <h3 className="text-sm font-bold text-red-400">Preparation Failed</h3>
                <p className="text-sm text-red-300/80 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {isCompleted && (
          <div className="mb-6 md:mb-8 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <h3 className="text-sm font-bold text-emerald-400">
                  Preparation Complete
                </h3>
                <p className="text-sm text-emerald-300/80 mt-1">
                  Assistance sidecar is ready. You can now start assisted playback of the YouTube video.
                </p>
                <Link
                  href="/video-library"
                  className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-semibold rounded-lg text-xs border border-emerald-500/30 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                >
                  Go to Video Library
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Processing Stages Indicator */}
        <section
          className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl"
          aria-labelledby="status-heading"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 id="status-heading" className="text-xl font-bold text-white">
              Preparation Progress
            </h2>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-md border uppercase tracking-wider ${badgeClasses()}`}
            >
              {badgeText()}
            </span>
          </div>

          {/* Accessible live region for screen readers */}
          <div aria-live="polite" className="sr-only" id="status-announcer">
            {currentStage && (
              <span>
                {isFailed
                  ? `Preparation failed: ${error}`
                  : isCompleted
                  ? "Assistance preparation completed successfully."
                  : `Current stage: ${PIPELINE_STEPS[activeIdx]?.name || currentStage}`}
              </span>
            )}
          </div>

          {sseWarning && (
            <div
              className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium rounded-2xl flex items-center gap-3 animate-pulse"
              role="status"
              aria-live="polite"
            >
              <svg className="w-5 h-5 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.228 10H17M4 4h7M4 4v5h5" />
              </svg>
              <div>
                <p className="font-semibold">Connection to preparation updates was interrupted.</p>
                <p className="text-xs text-slate-400 mt-0.5">Reconnecting...</p>
              </div>
            </div>
          )}

          {/* List of steps */}
          <div
            className="space-y-0"
            role="feed"
            aria-busy={isProcessing}
          >
            {PIPELINE_STEPS.map((step, idx) => {
              const state = stepState(idx);
              const dotClasses =
                state === "completed"
                  ? "bg-emerald-500 border-emerald-400 text-white"
                  : state === "active"
                  ? "bg-yellow-400 border-yellow-300 text-slate-900 animate-pulse"
                  : state === "failed"
                  ? "bg-red-500 border-red-400 text-white"
                  : "bg-slate-950 border-slate-700 text-slate-400";
              const titleClasses =
                state === "completed"
                  ? "text-emerald-400"
                  : state === "active"
                  ? "text-yellow-400"
                  : state === "failed"
                  ? "text-red-400"
                  : "text-slate-400";
              const descClasses =
                state === "idle" ? "text-slate-500" : "text-slate-300";
              const statusLabel =
                state === "completed"
                  ? " - Done"
                  : state === "active"
                  ? " - In progress"
                  : state === "failed"
                  ? " - Failed"
                  : "";

              return (
                <div
                  key={step.key}
                  className="flex gap-4 items-stretch"
                  aria-label={`Stage ${idx + 1}: ${step.name}${statusLabel}`}
                >
                  {/* Left Marker Column */}
                  <div className="flex flex-col items-center shrink-0 w-6">
                    {/* Step dot */}
                    <div
                      className={`flex items-center justify-center w-6 h-6 rounded-full border-2 font-bold text-xs transition-all duration-300 shrink-0 ${dotClasses}`}
                      aria-hidden="true"
                    >
                      {state === "completed" ? (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : state === "failed" ? (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      ) : (
                        idx + 1
                      )}
                    </div>
                    {/* Connector line segment */}
                    {idx < PIPELINE_STEPS.length - 1 && (
                      <div className="w-0.5 bg-slate-800 grow" />
                    )}
                  </div>

                  {/* Text description Column */}
                  <div className="pb-8 flex-1 min-w-0">
                    <h3
                      className={`text-sm font-bold transition-colors ${titleClasses}`}
                    >
                      {step.name}
                      {statusLabel && (
                        <span className="font-normal text-xs ml-1.5 opacity-75">
                          {statusLabel}
                        </span>
                      )}
                    </h3>
                    <p className={`text-xs mt-1 ${descClasses}`}>
                      {step.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </PageWrapper>
  );
}
