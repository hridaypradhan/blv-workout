import React from "react";
import { Session } from "@/types";
import { formatSessionDate } from "@/lib/formatters/sessionFormatters";

interface MovementCorrectionLogProps {
  session: Session;
}

export default function MovementCorrectionLog({ session }: MovementCorrectionLogProps) {
  return (
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
                <div key={idx} className="flex justify-between items-center p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300">
                  <span>Rep Count: <strong className="text-white font-bold">{rep.rep_count}</strong></span>
                  <span className="text-slate-400">Recorded: {formatSessionDate(rep.timestamp)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-center text-sm text-slate-400">
              No repetition telemetry recorded.
            </div>
          )}
        </div>

        {/* Form Errors */}
        <div className="flex flex-col">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Form Corrections</h3>
          {/* Note: The FormError schema does not yet support timestamps. These can be added in future migrations. */}
          {session.form_errors && session.form_errors.length > 0 ? (
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {session.form_errors.map((err, idx) => (
                <div key={idx} className="flex flex-col gap-1.5 p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs">
                  <div className="flex justify-between items-center text-slate-200">
                    <span className="font-semibold text-red-400 capitalize">{err.joint} Drift</span>
                    <span className="px-1.5 py-0.5 rounded bg-red-950/40 text-xs text-red-400 font-bold uppercase border border-red-900/30">
                      {err.severity}
                    </span>
                  </div>
                  <p className="text-slate-300 italic">Observed: {err.observed_angle}° (Expected: {err.expected_range?.[0]}° - {err.expected_range?.[1]}°)</p>
                  {err.message && <p className="text-slate-400">{err.message}</p>}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-center text-sm text-slate-400">
              No form correction telemetry recorded.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
