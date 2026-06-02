import React from "react";
import { Session } from "@/types";

interface SessionStatsGridProps {
  session: Session;
}

export default function SessionStatsGrid({ session }: SessionStatsGridProps) {
  return (
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
  );
}
