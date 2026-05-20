"use client";

import React from "react";
import Link from "next/link";
import PageWrapper from "@/components/layout/PageWrapper";

interface HistoryDetailPageProps {
  params: {
    sessionId: string;
  };
}

export default function HistoryDetail({ params }: HistoryDetailPageProps) {
  const handlePlayVoiceSummary = () => {
    // TODO: Synthesize and play the AI coach summary aloud using speech synthesis
  };

  const exerciseBreakdown = [
    { name: "Bodyweight Squats", reps: 15, accuracy: 94, error: "Hips not back enough in early reps" },
    { name: "Reverse Lunges (Left)", reps: 15, accuracy: 88, error: "Front knee drifting forward past toe" },
    { name: "Reverse Lunges (Right)", reps: 15, accuracy: 90, error: "None" },
  ];

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
            Beginner Bodyweight Squats & Alignment
          </h1>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400">
            <span>Date: <strong className="text-slate-200">May 18, 2026</strong></span>
            <span>Duration: <strong className="text-slate-200">12 minutes</strong></span>
            <span>Session ID: <strong className="text-slate-200">{params.sessionId}</strong></span>
          </div>
        </header>

        {/* Core Stats Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6" aria-label="Key Performance Indicators">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center shadow-lg">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-1">Total Reps</span>
            <span className="text-4xl font-extrabold text-yellow-400">45 reps</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center shadow-lg">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-1">Form Accuracy</span>
            <span className="text-4xl font-extrabold text-emerald-400">92%</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center shadow-lg">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-1">Pace Score</span>
            <span className="text-4xl font-extrabold text-white">Optimal</span>
          </div>
        </section>

        {/* Per-exercise breakdown table */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl overflow-hidden shadow-xl mb-6" aria-labelledby="breakdown-heading">
          <h2 id="breakdown-heading" className="text-lg font-bold text-white px-4 sm:px-6 py-4 border-b border-slate-800 bg-slate-950/20">
            Movement Breakdown
          </h2>
          
          {/* Table for Desktop (md and up) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40">
                  <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Exercise Module</th>
                  <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Reps</th>
                  <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Accuracy</th>
                  <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Most Common Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {exerciseBreakdown.map((row, index) => (
                  <tr key={index} className="hover:bg-slate-800/10">
                    <td className="p-4 text-sm font-bold text-white">{row.name}</td>
                    <td className="p-4 text-sm text-slate-350">{row.reps}</td>
                    <td className="p-4 text-sm font-extrabold text-emerald-400">{row.accuracy}%</td>
                    <td className="p-4 text-sm text-slate-400 italic">{row.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards for Mobile (below md) */}
          <div className="md:hidden divide-y divide-slate-800 bg-slate-900" role="list">
            {exerciseBreakdown.map((row, index) => (
              <div key={index} className="p-4 flex flex-col gap-2" role="listitem">
                <h3 className="text-sm font-bold text-white">{row.name}</h3>
                <div className="flex justify-between items-center text-xs mt-1 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase font-extrabold tracking-wider">Reps</span>
                    <span className="text-xs font-semibold text-slate-300 mt-0.5">{row.reps} reps</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-slate-500 uppercase font-extrabold tracking-wider text-right">Accuracy</span>
                    <span className="text-xs font-extrabold text-emerald-400 mt-0.5">{row.accuracy}%</span>
                  </div>
                </div>
                {row.error !== "None" && (
                  <div className="text-xs text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-850/60 mt-1">
                    <span className="font-semibold text-slate-500 block uppercase text-[9px] tracking-wider mb-0.5">Most Common Error</span>
                    <span className="italic text-slate-350">{row.error}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* AI Coach Summary (With voice control) */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl" aria-labelledby="summary-heading">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h2 id="summary-heading" className="text-lg font-bold text-white">
              AI Coach Summary
            </h2>
            <button
              onClick={handlePlayVoiceSummary}
              className="inline-flex items-center justify-center px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold rounded-xl text-xs border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
              aria-label="Read AI Coach Summary Aloud"
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
              &ldquo;Great job today! Your squats were excellent during set 2, maintaining deep range while keeping your spine straight. In set 1 of lunges, we noticed some forward drift on the left knee which caused minor balance adjustments. Focus on driving through the heel of your front foot to stabilize. Overall, your tempo was consistent and haptic sleeves reported excellent timing compliance.&rdquo;
            </p>
          </div>
        </section>
      </div>
    </PageWrapper>
  );
}
