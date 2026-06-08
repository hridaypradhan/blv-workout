import React from "react";
import { Session } from "@/types";
import {
  formatPlaybackTime,
  formatSessionEventDetails,
  getSessionEventStyle,
  getSessionEventLabel,
} from "@/lib/formatters/sessionFormatters";

interface PlaybackTimelineProps {
  session: Session;
}

export default function PlaybackTimeline({ session }: PlaybackTimelineProps) {
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl mb-6" aria-labelledby="timeline-heading">
      <h2 id="timeline-heading" className="text-lg font-bold text-white mb-4">
        Playback Telemetry Timeline
      </h2>
      {session.playback_events && session.playback_events.length > 0 ? (
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
          {session.playback_events.map((evt, idx) => {
            const timeLabel = evt.timestamp_ms !== null && evt.timestamp_ms !== undefined
              ? formatPlaybackTime(evt.timestamp_ms / 1000)
              : "-";
            
            const details = formatSessionEventDetails(evt);
            const categoryStyle = getSessionEventStyle(evt.event_type);
            const eventLabel = getSessionEventLabel(evt.event_type);

            return (
              <div key={idx} className="flex items-start gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs">
                <span className="px-2 py-0.5 rounded bg-slate-900 text-yellow-400 font-bold border border-slate-800 shrink-0" aria-label={`Timestamp ${timeLabel}`}>
                  {timeLabel}
                </span>
                <div className="flex-1 text-slate-300">
                  <span className={`font-extrabold uppercase tracking-wide mr-2 ${categoryStyle}`}>
                    {eventLabel}
                  </span>
                  <span>{details}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-center text-sm text-slate-400">
          No playback interactions were recorded during this session.
        </div>
      )}
    </section>
  );
}
