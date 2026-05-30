"use client";

import React from "react";
import Link from "next/link";
import PageWrapper from "@/components/layout/PageWrapper";

export default function HistoryList() {
  const handleFilterChange = () => {
    // TODO: Update state filter for session history list
  };

  const sessions = [
    {
      id: "session-101",
      date: "May 18, 2026",
      title: "Beginner Bodyweight Squats & Alignment",
      repsCompleted: 45,
      accuracy: 92,
      duration: "12m",
    },
    {
      id: "session-102",
      date: "May 15, 2026",
      title: "Leg Strength: Reverse Lunges Tutorial",
      repsCompleted: 36,
      accuracy: 86,
      duration: "15m",
    },
    {
      id: "session-103",
      date: "May 10, 2026",
      title: "Core Stability: Deadbug & Bird-dog Guide",
      repsCompleted: 50,
      accuracy: 95,
      duration: "10m",
    },
  ];

  return (
    <PageWrapper id="history-list-wrapper">
      <div className="max-w-4xl mx-auto py-4">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-white">Session History</h1>
            <p className="text-slate-400 text-sm mt-1">
              Review your past assisted playback sessions and tracked performance stats.
            </p>
          </div>

          {/* Quick Filters */}
          <div className="flex gap-2">
            <button
              onClick={handleFilterChange}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-350 hover:text-white rounded-xl text-xs border border-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
              id="filter-all-btn"
            >
              All Sessions
            </button>
            <button
              onClick={handleFilterChange}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-350 hover:text-white rounded-xl text-xs border border-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
              id="filter-recent-btn"
            >
              This Week
            </button>
          </div>
        </div>

        {/* Sessions list */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl overflow-hidden shadow-xl" aria-label="Completed Sessions Log">
          {/* Tabular View for Desktop (md and up) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50">
                  <th className="p-4 md:p-5 text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="p-4 md:p-5 text-xs font-bold text-slate-400 uppercase tracking-wider">Workout Title</th>
                  <th className="p-4 md:p-5 text-xs font-bold text-slate-400 uppercase tracking-wider">Duration</th>
                  <th className="p-4 md:p-5 text-xs font-bold text-slate-400 uppercase tracking-wider">Tracked Reps</th>
                  <th className="p-4 md:p-5 text-xs font-bold text-slate-400 uppercase tracking-wider">Form Accuracy</th>
                  <th className="p-4 md:p-5 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sessions.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="p-4 md:p-5 text-sm font-semibold text-slate-300 whitespace-nowrap">{s.date}</td>
                    <td className="p-4 md:p-5 text-sm font-bold text-white max-w-[240px] truncate">{s.title}</td>
                    <td className="p-4 md:p-5 text-sm text-slate-400">{s.duration}</td>
                    <td className="p-4 md:p-5 text-sm text-slate-300 font-semibold">{s.repsCompleted}</td>
                    <td className="p-4 md:p-5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-extrabold ${s.accuracy >= 90 ? "text-emerald-400" : "text-amber-400"}`}>
                          {s.accuracy}%
                        </span>
                      </div>
                    </td>
                    <td className="p-4 md:p-5 text-sm text-right whitespace-nowrap">
                      <Link
                        href={`/history/${s.id}`}
                        className="inline-flex items-center text-xs font-bold text-yellow-400 hover:text-yellow-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 rounded px-1.5 py-0.5"
                        aria-label={`View detailed report for session on ${s.date}`}
                        id={`details-link-${s.id}`}
                      >
                        View Report
                        <svg
                          className="w-3.5 h-3.5 ml-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards View for Mobile (below md) */}
          <div className="md:hidden divide-y divide-slate-800 bg-slate-900" role="list">
            {sessions.map((s) => (
              <div key={s.id} className="p-4 flex flex-col gap-3" role="listitem">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="text-xs text-slate-400 font-semibold">{s.date}</span>
                    <h2 className="text-sm font-bold text-white mt-0.5 leading-snug">{s.title}</h2>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-950 text-slate-400 border border-slate-800 whitespace-nowrap">
                    {s.duration}
                  </span>
                </div>
                
                <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase font-extrabold tracking-wider">Tracked Reps</span>
                    <span className="text-xs font-bold text-slate-300 mt-0.5">{s.repsCompleted} reps</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-slate-500 uppercase font-extrabold tracking-wider text-right">Form Accuracy</span>
                    <span className={`text-xs font-extrabold mt-0.5 ${s.accuracy >= 90 ? "text-emerald-400" : "text-amber-400"}`}>
                      {s.accuracy}%
                    </span>
                  </div>
                </div>

                <div className="pt-1">
                  <Link
                    href={`/history/${s.id}`}
                    className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-200 font-bold rounded-xl text-xs border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
                    aria-label={`View detailed report for session on ${s.date}`}
                    id={`details-link-mobile-${s.id}`}
                  >
                    <span>View Report</span>
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PageWrapper>
  );
}
