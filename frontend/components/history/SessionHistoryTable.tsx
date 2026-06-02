import React from "react";
import Link from "next/link";
import { Session } from "@/types";
import { formatSessionDate, formatSessionDuration, shortVideoId } from "@/lib/formatters/sessionFormatters";

interface SessionHistoryTableProps {
  sessions: Session[];
}

export default function SessionHistoryTable({ sessions }: SessionHistoryTableProps) {
  return (
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
            const shortId = shortVideoId(s.video_id);
            const dateFormatted = formatSessionDate(s.ended_at || s.started_at);
            return (
              <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="p-4 md:p-5 text-sm font-semibold text-slate-300 whitespace-nowrap">
                  {dateFormatted}
                </td>
                <td className="p-4 md:p-5 text-sm font-bold text-white truncate max-w-[240px]" title={s.video_title || s.video_id}>
                  {s.video_title || `Video ${shortId}`}
                </td>
                <td className="p-4 md:p-5 text-sm text-slate-400">
                  {formatSessionDuration(s.started_at, s.ended_at)}
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
                    aria-label={`View detailed report for session on ${dateFormatted}`}
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
  );
}
