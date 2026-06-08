"use client";

import React, { useEffect, useState } from "react";
import PageWrapper from "@/components/layout/PageWrapper";
import { getSessionHistory } from "@/lib/api";
import { getActiveUserId } from "@/lib/prototypeUser";
import { Session } from "@/types";
import HistoryLoadingState from "@/components/history/HistoryLoadingState";
import HistoryErrorState from "@/components/history/HistoryErrorState";
import HistoryEmptyState from "@/components/history/HistoryEmptyState";
import SessionHistoryTable from "@/components/history/SessionHistoryTable";
import SessionHistoryMobileList from "@/components/history/SessionHistoryMobileList";
import ScreenReaderStatus from "@/components/accessibility/ScreenReaderStatus";

export default function HistoryList() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const fetchHistory = () => {
    setIsLoading(true);
    setError(null);
    setAnnouncement("Loading session history...");
    getSessionHistory(getActiveUserId())
      .then((data) => {
        setSessions(data);
        setIsLoading(false);
        if (data.length === 0) {
          setAnnouncement("Session history loaded. No completed sessions found.");
        } else {
          setAnnouncement(`Session history loaded. Found ${data.length} completed sessions.`);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch session history:", err);
        const errMsg = err.message || "Failed to load session history.";
        setError(errMsg);
        setIsLoading(false);
        setAnnouncement(`Failed to load session history: ${errMsg}`);
      });
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  if (isLoading) {
    return (
      <PageWrapper id="history-list-wrapper">
        <ScreenReaderStatus content={announcement} />
        <div className="max-w-4xl mx-auto py-4">
          <h1 className="text-3xl font-extrabold text-white mb-8">Session History</h1>
          <HistoryLoadingState />
        </div>
      </PageWrapper>
    );
  }

  if (error) {
    return (
      <PageWrapper id="history-list-wrapper">
        <ScreenReaderStatus content={announcement} />
        <div className="max-w-4xl mx-auto py-4">
          <h1 className="text-3xl font-extrabold text-white mb-8">Session History</h1>
          <HistoryErrorState error={error} onRetry={fetchHistory} />
        </div>
      </PageWrapper>
    );
  }

  if (sessions.length === 0) {
    return (
      <PageWrapper id="history-list-wrapper">
        <ScreenReaderStatus content={announcement} />
        <div className="max-w-4xl mx-auto py-4">
          <h1 className="text-3xl font-extrabold text-white mb-8">Session History</h1>
          <HistoryEmptyState />
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper id="history-list-wrapper">
      <ScreenReaderStatus content={announcement} />
      <div className="max-w-4xl mx-auto py-4">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-white">Session History</h1>
          <p className="text-slate-400 text-sm mt-1">
            Review your past assisted playback sessions and tracked performance stats.
          </p>
        </div>

        {/* Sessions list */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl overflow-hidden shadow-xl" aria-label="Completed Sessions Log">
          <SessionHistoryTable sessions={sessions} />
          <SessionHistoryMobileList sessions={sessions} />
        </section>
      </div>
    </PageWrapper>
  );
}

