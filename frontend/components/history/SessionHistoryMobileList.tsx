import React from "react";
import Link from "next/link";
import { Session } from "@/types";
import { formatSessionDate, formatSessionDuration, shortVideoId, getSessionMetrics } from "@/lib/formatters/sessionFormatters";

interface SessionHistoryMobileListProps {
  sessions: Session[];
}

export default function SessionHistoryMobileList({ sessions }: SessionHistoryMobileListProps) {
  return (
    <div className="md:hidden divide-y divide-slate-800 bg-slate-900" role="list">
      {sessions.map((s) => {
        const shortId = shortVideoId(s.video_id);
        const sessionDate = formatSessionDate(s.ended_at || s.started_at);
        const metrics = getSessionMetrics(s);
        return (
          <div key={s.id} className="p-4 flex flex-col gap-3" role="listitem">
            <div className="flex justify-between items-start gap-2">
              <div>
                <span className="text-xs text-slate-400 font-semibold">{sessionDate}</span>
                <h2 className="text-sm font-bold text-white mt-0.5 leading-snug">{s.video_title || `Video ${shortId}`}</h2>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-950 text-slate-400 border border-slate-800 whitespace-nowrap">
                {formatSessionDuration(s.started_at, s.ended_at)}
              </span>
            </div>

            {s.summary && (
              <p className="text-xs text-slate-400 bg-slate-950/40 p-3 rounded-xl border border-slate-850/50 leading-relaxed">
                {s.summary}
              </p>
            )}

            <div className="grid grid-cols-5 gap-1 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase font-extrabold tracking-wider">Reps</span>
                <span className="text-xs font-bold text-slate-200 mt-0.5">{metrics.reps}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase font-extrabold tracking-wider">Warns</span>
                <span className="text-xs font-bold text-amber-400 mt-0.5">{metrics.formErrors}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase font-extrabold tracking-wider">Assist</span>
                <span className="text-xs font-bold text-slate-200 mt-0.5">{metrics.assistantInteractions}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase font-extrabold tracking-wider">Haptic</span>
                <span className="text-xs font-bold text-slate-200 mt-0.5">{metrics.hapticCues}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase font-extrabold tracking-wider">Plays</span>
                <span className="text-xs font-bold text-slate-200 mt-0.5">{metrics.playbackInteractions}</span>
              </div>
            </div>

            <div className="pt-1">
              <Link
                href={`/history/${s.id}`}
                className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-200 font-bold rounded-xl text-sm border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
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
  );
}
