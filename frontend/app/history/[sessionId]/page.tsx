"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import PageWrapper from "@/components/layout/PageWrapper";
import { getSession } from "@/lib/api";
import { Session } from "@/types";
import HistoryLoadingState from "@/components/history/HistoryLoadingState";
import HistoryErrorState from "@/components/history/HistoryErrorState";
import SessionSummaryHeader from "@/components/history/SessionSummaryHeader";
import SessionStatsGrid from "@/components/history/SessionStatsGrid";
import MovementCorrectionLog from "@/components/history/MovementCorrectionLog";
import PlaybackTimeline from "@/components/history/PlaybackTimeline";
import AssistantSummaryPanel from "@/components/history/AssistantSummaryPanel";
import ScreenReaderStatus from "@/components/accessibility/ScreenReaderStatus";

interface HistoryDetailPageProps {
  params: {
    sessionId: string;
  };
}

export default function HistoryDetail({ params }: HistoryDetailPageProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const fetchSessionData = useCallback(() => {
    setIsLoading(true);
    setError(null);
    setAnnouncement("Loading session report details...");
    getSession(params.sessionId)
      .then((data) => {
        setSession(data);
        setIsLoading(false);
        const titleText = data.video_title || `Video ${data.video_id ? data.video_id.substring(0, 8) : ""}`;
        setAnnouncement(`Session report loaded successfully for ${titleText}.`);
      })
      .catch((err) => {
        console.error("Failed to fetch session detail:", err);
        const errMsg = err.message || "Failed to load session details.";
        setError(errMsg);
        setIsLoading(false);
        setAnnouncement(`Failed to load session report: ${errMsg}`);
      });
  }, [params.sessionId]);

  useEffect(() => {
    fetchSessionData();
  }, [fetchSessionData]);

  const handlePlayVoiceSummary = () => {
    if (!session?.summary) return;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(session.summary);
      window.speechSynthesis.speak(utterance);
    }
  };

  if (isLoading) {
    return (
      <PageWrapper id="history-detail-wrapper">
        <ScreenReaderStatus content={announcement} />
        <div className="max-w-4xl mx-auto py-4">
          <div className="mb-6">
            <Link
              href="/history"
              className="inline-flex items-center text-xs font-bold text-slate-400 hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 rounded py-1 px-1.5"
            >
              Back to history list
            </Link>
          </div>
          <HistoryLoadingState title="Loading Report" description="Fetching session performance telemetry..." />
        </div>
      </PageWrapper>
    );
  }

  if (error || !session) {
    return (
      <PageWrapper id="history-detail-wrapper">
        <ScreenReaderStatus content={announcement} />
        <div className="max-w-4xl mx-auto py-4">
          <div className="mb-6">
            <Link
              href="/history"
              className="inline-flex items-center text-xs font-bold text-slate-400 hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 rounded py-1 px-1.5"
            >
              Back to history list
            </Link>
          </div>
          <HistoryErrorState
            error={error || "Session details could not be found."}
            onRetry={fetchSessionData}
            title="Report Load Failed"
          />
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper id="history-detail-wrapper">
      <ScreenReaderStatus content={announcement} />
      <div className="max-w-4xl mx-auto py-4">
        {/* Navigation link back to list */}
        <div className="mb-6">
          <Link
            href="/history"
            className="inline-flex items-center text-xs font-bold text-slate-400 hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 rounded py-1 px-1.5"
            id="back-to-history-btn"
          >
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
            Back to history list
          </Link>
        </div>

        {/* Session Summary Header */}
        <SessionSummaryHeader session={session} />

        {/* Core Stats Cards */}
        <SessionStatsGrid session={session} />

        {/* Movement Breakdown & Corrections */}
        <MovementCorrectionLog session={session} />

        {/* Haptic Telemetry Audit Snapshot Card */}
        {(() => {
          const hapticEvents = session.playback_events?.filter(
            (evt) =>
              evt.event_type === "haptic_cue_requested" ||
              evt.event_type === "haptic_cue_triggered" ||
              evt.event_type === "haptic_cue_failed"
          ) || [];
          const lastHapticEvent = hapticEvents.length > 0 ? hapticEvents[hapticEvents.length - 1] : null;

          if (!lastHapticEvent) return null;

          return (
            <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl mb-6" aria-labelledby="haptic-audit-heading">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <h2 id="haptic-audit-heading" className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
                  Last Haptic Telemetry Audit
                </h2>
                <span className="text-xs text-slate-400 font-mono">
                  Total haptic signals: {hapticEvents.length}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs font-mono">
                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl">
                  <span className="text-slate-500 block mb-1">Audit Event:</span>
                  <span className={`font-bold ${
                    lastHapticEvent.event_type === "haptic_cue_failed"
                      ? "text-red-400"
                      : lastHapticEvent.metadata?.delivery_mode === "hardware"
                      ? "text-sky-400"
                      : lastHapticEvent.metadata?.delivery_mode === "indicator" || lastHapticEvent.metadata?.delivery_mode === "dry_run"
                      ? "text-yellow-500"
                      : "text-slate-300"
                  }`}>
                    {lastHapticEvent.event_type.replace(/_/g, " ").toUpperCase()}
                  </span>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl">
                  <span className="text-slate-500 block mb-1">Resolved bHaptics Event:</span>
                  <span className="text-yellow-400 font-bold">
                    {lastHapticEvent.metadata?.bhaptics_event_name || "N/A"}
                  </span>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl">
                  <span className="text-slate-500 block mb-1">Delivery Mode:</span>
                  <span className="text-white capitalize">
                    {lastHapticEvent.metadata?.delivery_mode || "N/A"}
                  </span>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl">
                  <span className="text-slate-500 block mb-1">Active Provider:</span>
                  <span className="text-slate-300">
                    {lastHapticEvent.metadata?.provider || "N/A"}
                  </span>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl">
                  <span className="text-slate-500 block mb-1">Request ID:</span>
                  <span className="text-slate-400 select-all truncate block" title={lastHapticEvent.metadata?.request_id}>
                    {lastHapticEvent.metadata?.request_id || "N/A"}
                  </span>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl">
                  <span className="text-slate-500 block mb-1">Target Limbs / Positions:</span>
                  <span className="text-slate-300">
                    {lastHapticEvent.metadata?.target_positions?.join(", ") || lastHapticEvent.metadata?.target_limbs?.join(", ") || "None"}
                  </span>
                </div>

                <div className="sm:col-span-2 md:col-span-3 p-3 bg-slate-950 border border-slate-800/80 rounded-xl">
                  <span className="text-slate-500 block mb-1">Status Message / Diagnostics:</span>
                  <span className="text-slate-300">
                    {lastHapticEvent.metadata?.status_message || lastHapticEvent.metadata?.error || lastHapticEvent.metadata?.status || "No messages."}
                  </span>
                </div>
              </div>
            </section>
          );
        })()}

        {/* Playback Events Timeline */}
        <PlaybackTimeline session={session} />

        {/* Assistant Summary (With voice control) */}
        {session.summary && (
          <AssistantSummaryPanel summary={session.summary} onPlayVoiceSummary={handlePlayVoiceSummary} />
        )}
      </div>
    </PageWrapper>
  );
}

