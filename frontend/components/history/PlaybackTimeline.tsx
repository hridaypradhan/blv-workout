import React from "react";
import { Session } from "@/types";
import { formatPlaybackTime } from "@/lib/formatters/sessionFormatters";

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
            
            let details = "";
            if (evt.event_type === "seek") {
              const from = evt.metadata?.from_seconds ? formatPlaybackTime(evt.metadata.from_seconds) : "0:00";
              const to = evt.metadata?.to_seconds ? formatPlaybackTime(evt.metadata.to_seconds) : "0:00";
              details = `Seeked from ${from} to ${to}`;
            } else if (evt.event_type === "speed_change") {
              details = `Speed rate changed from ${evt.metadata?.from_rate || "1.0"}x to ${evt.metadata?.to_rate || "1.0"}x`;
            } else if (evt.event_type === "play") {
              details = `Started video playback`;
            } else if (evt.event_type === "pause") {
              details = `Paused video playback`;
            } else if (evt.event_type === "ended") {
              details = `Video playback completed`;
            } else if (evt.event_type === "assistant_cue_delivered") {
              details = `Delivered assistant voice cue: "${evt.metadata?.text || ""}"`;
            } else if (evt.event_type === "trainer_instruction_repeated") {
              details = `Repeated trainer instruction: "${evt.metadata?.text || ""}"`;
            } else if (evt.event_type === "section_skipped") {
              details = `Skipped directly to workout section: "${evt.metadata?.section_name || ""}"`;
            } else if (evt.event_type === "haptic_cue_requested") {
              details = `Delivered haptic sleeve cue: "${evt.metadata?.text || ""}"`;
            } else if (evt.event_type === "user_question_submitted") {
              details = `User asked assistant: "${evt.metadata?.question || ""}"`;
            } else {
              details = evt.event_type;
            }

            return (
              <div key={idx} className="flex items-start gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs">
                <span className="px-2 py-0.5 rounded bg-slate-900 text-yellow-400 font-bold border border-slate-800 shrink-0">
                  {timeLabel}
                </span>
                <div className="flex-1 text-slate-300">
                  <span className="font-semibold text-white capitalize mr-2">
                    {evt.event_type.replace(/_/g, " ")}
                  </span>
                  <span>{details}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-center text-xs text-slate-500">

          No playback interactions were recorded during this session.
        </div>
      )}
    </section>
  );
}
