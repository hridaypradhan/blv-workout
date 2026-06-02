import React from "react";
import { Session } from "@/types";
import { formatSessionDate, formatSessionDuration, shortVideoId } from "@/lib/formatters/sessionFormatters";

interface SessionSummaryHeaderProps {
  session: Session;
}

export default function SessionSummaryHeader({ session }: SessionSummaryHeaderProps) {
  const shortId = shortVideoId(session.video_id);
  const verboseDate = formatSessionDate(session.ended_at || session.started_at, true);
  const formattedDuration = formatSessionDuration(session.started_at, session.ended_at);

  return (
    <header className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl mb-6 relative">
      <span className="text-xs uppercase font-extrabold text-yellow-400 tracking-wider block mb-1">
        Session Report Card
      </span>
      <h1 className="text-2xl md:text-3xl font-extrabold text-white mb-4">
        {session.video_title || `Workout Video: ${shortId}`}
      </h1>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400">
        <span>Date & Time: <strong className="text-slate-200">{verboseDate}</strong></span>
        <span>Duration: <strong className="text-slate-200">{formattedDuration}</strong></span>
        <span>Session ID: <strong className="text-slate-200">{session.id}</strong></span>
      </div>
    </header>
  );
}
