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

interface HistoryDetailPageProps {
  params: {
    sessionId: string;
  };
}

export default function HistoryDetail({ params }: HistoryDetailPageProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessionData = useCallback(() => {
    setIsLoading(true);
    setError(null);
    getSession(params.sessionId)
      .then((data) => {
        setSession(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch session detail:", err);
        setError(err.message || "Failed to load session details.");
        setIsLoading(false);
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

