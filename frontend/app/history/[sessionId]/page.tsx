"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import PageWrapper from "@/components/layout/PageWrapper";
import { getSession } from "@/lib/api";
import { Session } from "@/types";

interface HistoryDetailPageProps {
  params: {
    sessionId: string;
  };
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
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

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
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
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
            <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-4" />
            <h2 className="text-lg font-bold text-white mb-2">Loading Report</h2>
            <p className="text-sm text-slate-400">Fetching session performance telemetry...</p>
          </div>
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
          <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[40vh] text-center p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
            <span className="text-red-500 text-5xl mb-4" role="img" aria-label="Error">⚠️</span>
            <h2 className="text-xl font-bold text-white mb-2">Report Load Failed</h2>
            <p className="text-sm text-slate-400 mb-6">{error || "Session details could not be found."}</p>
            <button
              onClick={fetchSessionData}
              className="px-5 py-3 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold rounded-xl text-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
            >
              Retry Loading
            </button>
          </div>
        </div>
      </PageWrapper>
    );
  }

  const shortVideoId = session.video_id ? session.video_id.substring(0, 8) : "Unknown";

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
        <header className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl mb-6 relative">
          <span className="text-xs uppercase font-extrabold text-yellow-400 tracking-wider block mb-1">
            Session Report Card
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white mb-4">
            {session.video_title || `Workout Video: ${shortVideoId}`}
          </h1>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400">
            <span>Date & Time: <strong className="text-slate-200">{formatDate(session.ended_at || session.started_at)}</strong></span>
            <span>Duration: <strong className="text-slate-200">{formatDuration(session.started_at, session.ended_at)}</strong></span>
            <span>Session ID: <strong className="text-slate-200">{session.id}</strong></span>
          </div>
        </header>

        {/* Core Stats Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6" aria-label="Key Performance Indicators">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center shadow-lg">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-1">Tracked Reps</span>
            <span className="text-4xl font-extrabold text-yellow-400">{session.reps?.length || 0} reps</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center shadow-lg">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-1">Form Corrections</span>
            <span className="text-4xl font-extrabold text-amber-400">{session.form_errors?.length || 0}</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center shadow-lg">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-1">Telemetry Events</span>
            <span className="text-4xl font-extrabold text-white">{session.playback_events?.length || 0}</span>
          </div>
        </section>

        {/* Movement Breakdown & Corrections */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl mb-6" aria-labelledby="breakdown-heading">
          <h2 id="breakdown-heading" className="text-lg font-bold text-white mb-4">
            Movement & Correction Log
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Rep Events */}
            <div className="flex flex-col">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Tracked Repetitions</h3>
              {session.reps && session.reps.length > 0 ? (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {session.reps.map((rep, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-slate-950 border border-slate-850 rounded-xl text-xs text-slate-300">
                      <span>Rep Count: <strong className="text-white font-bold">{rep.rep_count}</strong></span>
                      <span className="text-slate-500">Recorded: {formatDate(rep.timestamp)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl text-center text-xs text-slate-500">
                  No repetition telemetry recorded.
                </div>
              )}
            </div>

            {/* Form Errors */}
            <div className="flex flex-col">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Form Corrections</h3>
              {session.form_errors && session.form_errors.length > 0 ? (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {session.form_errors.map((err, idx) => (
                    <div key={idx} className="flex flex-col gap-1.5 p-3 bg-slate-950 border border-slate-850 rounded-xl text-xs">
                      <div className="flex justify-between items-center text-slate-350">
                        <span className="font-semibold text-red-400 capitalize">{err.joint} Drift</span>
                        <span className="px-1.5 py-0.5 rounded bg-red-950/40 text-[10px] text-red-400 font-bold uppercase border border-red-900/30">
                          {err.severity}
                        </span>
                      </div>
                      <p className="text-slate-300 italic">Observed: {err.observed_angle}° (Expected: {err.expected_range?.[0]}° - {err.expected_range?.[1]}°)</p>
                      {err.message && <p className="text-slate-400">{err.message}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl text-center text-xs text-slate-500">
                  No form correction telemetry recorded.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Playback Events Timeline */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl mb-6" aria-labelledby="timeline-heading">
          <h2 id="timeline-heading" className="text-lg font-bold text-white mb-4">
            Playback Telemetry Timeline
          </h2>
          {session.playback_events && session.playback_events.length > 0 ? (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {session.playback_events.map((evt, idx) => {
                const timeLabel = evt.timestamp_ms !== null && evt.timestamp_ms !== undefined
                  ? formatTime(evt.timestamp_ms / 1000)
                  : "-";
                
                let details = "";
                if (evt.event_type === "seek") {
                  const from = evt.metadata?.from_seconds ? formatTime(evt.metadata.from_seconds) : "0:00";
                  const to = evt.metadata?.to_seconds ? formatTime(evt.metadata.to_seconds) : "0:00";
                  details = `Seeked from ${from} to ${to}`;
                } else if (evt.event_type === "speed_change") {
                  details = `Speed rate changed from ${evt.metadata?.from_rate || "1.0"}x to ${evt.metadata?.to_rate || "1.0"}x`;
                } else if (evt.event_type === "play") {
                  details = `Started video playback`;
                } else if (evt.event_type === "pause") {
                  details = `Paused video playback`;
                } else if (evt.event_type === "ended") {
                  details = `Video playback completed`;
                } else {
                  details = evt.event_type;
                }

                return (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-slate-950 border border-slate-850 rounded-xl text-xs">
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-yellow-400 font-bold border border-slate-800 shrink-0">
                      {timeLabel}
                    </span>
                    <div className="flex-1 text-slate-300">
                      <span className="font-semibold text-white capitalize mr-2">{evt.event_type}</span>
                      <span>{details}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl text-center text-xs text-slate-500">
              No playback interactions were recorded during this session.
            </div>
          )}
        </section>

        {/* Assistant Summary (With voice control) */}
        {session.summary && (
          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl" aria-labelledby="summary-heading">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <h2 id="summary-heading" className="text-lg font-bold text-white">
                Assistant Summary
              </h2>
              <button
                onClick={handlePlayVoiceSummary}
                className="inline-flex items-center justify-center px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold rounded-xl text-xs border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
                aria-label="Read Assistant Summary Aloud"
                id="speak-summary-btn"
              >
                <svg
                  className="w-4 h-4 mr-2 text-yellow-400"
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
                    d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                  />
                </svg>
                Read Aloud
              </button>
            </div>
   
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
              <p className="text-sm text-slate-300 leading-relaxed">
                {session.summary}
              </p>
            </div>
          </section>
        )}
      </div>
    </PageWrapper>
  );
}
