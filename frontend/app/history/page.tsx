"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import PageWrapper from "@/components/layout/PageWrapper";
import { getSessionHistory } from "@/lib/api";
import { PROTOTYPE_USER_ID } from "@/lib/prototypeUser";
import { Session } from "@/types";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function formatDuration(startStr: string | null | undefined, endStr: string | null | undefined): string {
  if (!startStr || !endStr) return "-";
  try {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return "-";
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.round((diffMs % 60000) / 1000);
    if (diffMins === 0) return `${diffSecs}s`;
    return `${diffMins}m ${diffSecs}s`;
  } catch {
    return "-";
  }
}

export default function HistoryList() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = () => {
    setIsLoading(true);
    setError(null);
    getSessionHistory(PROTOTYPE_USER_ID)
      .then((data) => {
        setSessions(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch session history:", err);
        setError(err.message || "Failed to load session history.");
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  if (isLoading) {
    return (
      <PageWrapper id="history-list-wrapper">
        <div className="max-w-4xl mx-auto py-4">
          <h1 className="text-3xl font-extrabold text-white mb-8">Session History</h1>
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
            <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-4" />
            <h2 className="text-lg font-bold text-white mb-2">Loading History</h2>
            <p className="text-sm text-slate-400">Fetching your completed sessions...</p>
          </div>
        </div>
      </PageWrapper>
    );
  }

  if (error) {
    return (
      <PageWrapper id="history-list-wrapper">
        <div className="max-w-4xl mx-auto py-4">
          <h1 className="text-3xl font-extrabold text-white mb-8">Session History</h1>
          <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[40vh] text-center p-6 bg-slate-900 border border-slate-800 rounded-3xl">
            <span className="text-red-500 text-5xl mb-4" role="img" aria-label="Error">⚠️</span>
            <h2 className="text-xl font-bold text-white mb-2">Failed to Load History</h2>
            <p className="text-sm text-slate-400 mb-6">{error}</p>
            <button
              onClick={fetchHistory}
              className="px-5 py-3 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold rounded-xl text-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
            >
              Retry Loading
            </button>
          </div>
        </div>
      </PageWrapper>
    );
  }

  if (sessions.length === 0) {
    return (
      <PageWrapper id="history-list-wrapper">
        <div className="max-w-4xl mx-auto py-4">
          <h1 className="text-3xl font-extrabold text-white mb-8">Session History</h1>
          <div className="flex flex-col items-center justify-center min-h-[45vh] text-center p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
            <svg
              className="w-16 h-16 text-slate-600 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-xl font-bold text-white mb-2">No Completed Sessions</h2>
            <p className="text-sm text-slate-400 mb-6 max-w-sm">
              You haven&apos;t completed any assisted playback sessions yet. Go to the Video Library to get started!
            </p>
            <Link
              href="/video-library"
              className="px-5 py-3 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold rounded-xl text-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
            >
              Go to Video Library
            </Link>
          </div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper id="history-list-wrapper">
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
          {/* Tabular View for Desktop (md and up) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50">
                  <th className="p-4 md:p-5 text-xs font-bold text-slate-400 uppercase tracking-wider">Date & Time</th>
                  <th className="p-4 md:p-5 text-xs font-bold text-slate-400 uppercase tracking-wider">Workout Video</th>
                  <th className="p-4 md:p-5 text-xs font-bold text-slate-400 uppercase tracking-wider">Duration</th>
                  <th className="p-4 md:p-5 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Reps</th>
                  <th className="p-4 md:p-5 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Corrections</th>
                  <th className="p-4 md:p-5 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Events</th>
                  <th className="p-4 md:p-5 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sessions.map((s) => {
                  const shortVideoId = s.video_id ? s.video_id.substring(0, 8) : "Unknown";
                  return (
                    <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 md:p-5 text-sm font-semibold text-slate-300 whitespace-nowrap">
                        {formatDate(s.ended_at || s.started_at)}
                      </td>
                      <td className="p-4 md:p-5 text-sm font-bold text-white truncate max-w-[240px]" title={s.video_title || s.video_id}>
                        {s.video_title || `Video ${shortVideoId}`}
                      </td>
                      <td className="p-4 md:p-5 text-sm text-slate-400">
                        {formatDuration(s.started_at, s.ended_at)}
                      </td>
                      <td className="p-4 md:p-5 text-sm text-slate-350 text-center font-semibold">
                        {s.reps?.length || 0}
                      </td>
                      <td className="p-4 md:p-5 text-sm text-amber-400 text-center font-bold">
                        {s.form_errors?.length || 0}
                      </td>
                      <td className="p-4 md:p-5 text-sm text-slate-350 text-center">
                        {s.playback_events?.length || 0}
                      </td>
                      <td className="p-4 md:p-5 text-sm text-right whitespace-nowrap">
                        <Link
                          href={`/history/${s.id}`}
                          className="inline-flex items-center text-xs font-bold text-yellow-400 hover:text-yellow-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 rounded px-1.5 py-0.5"
                          aria-label={`View detailed report for session on ${formatDate(s.ended_at || s.started_at)}`}
                          id={`details-link-${s.id}`}
                        >
                          View Report
                          <svg className="w-3.5 h-3.5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cards View for Mobile (below md) */}
          <div className="md:hidden divide-y divide-slate-800 bg-slate-900" role="list">
            {sessions.map((s) => {
              const shortVideoId = s.video_id ? s.video_id.substring(0, 8) : "Unknown";
              const sessionDate = formatDate(s.ended_at || s.started_at);
              return (
                <div key={s.id} className="p-4 flex flex-col gap-3" role="listitem">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="text-xs text-slate-400 font-semibold">{sessionDate}</span>
                      <h2 className="text-sm font-bold text-white mt-0.5 leading-snug">{s.video_title || `Video ${shortVideoId}`}</h2>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-950 text-slate-400 border border-slate-800 whitespace-nowrap">
                      {formatDuration(s.started_at, s.ended_at)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-500 uppercase font-extrabold tracking-wider">Reps</span>
                      <span className="text-xs font-bold text-slate-350 mt-0.5">{s.reps?.length || 0}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-500 uppercase font-extrabold tracking-wider">Corrections</span>
                      <span className="text-xs font-bold text-amber-400 mt-0.5">{s.form_errors?.length || 0}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-500 uppercase font-extrabold tracking-wider">Events</span>
                      <span className="text-xs font-bold text-slate-350 mt-0.5">{s.playback_events?.length || 0}</span>
                    </div>
                  </div>

                  <div className="pt-1">
                    <Link
                      href={`/history/${s.id}`}
                      className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-200 font-bold rounded-xl text-xs border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
                      aria-label={`View detailed report for session on ${sessionDate}`}
                      id={`details-link-mobile-${s.id}`}
                    >
                      <span>View Report</span>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
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
