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
            let categoryStyle = "text-slate-400"; // default
            
            if (evt.event_type === "seek") {
              const from = evt.metadata?.from_seconds ? formatPlaybackTime(evt.metadata.from_seconds) : "0:00";
              const to = evt.metadata?.to_seconds ? formatPlaybackTime(evt.metadata.to_seconds) : "0:00";
              details = `Seeked from ${from} to ${to}`;
              categoryStyle = "text-slate-400";
            } else if (evt.event_type === "speed_change") {
              details = `Playback speed changed from ${evt.metadata?.from_rate || "1.0"}x to ${evt.metadata?.to_rate || "1.0"}x`;
              categoryStyle = "text-slate-400";
            } else if (evt.event_type === "play") {
              details = `Started video playback`;
              categoryStyle = "text-slate-400";
            } else if (evt.event_type === "pause") {
              details = `Paused video playback`;
              categoryStyle = "text-slate-400";
            } else if (evt.event_type === "ended") {
              details = `Video playback completed`;
              categoryStyle = "text-slate-400";
            } else if (evt.event_type === "assistant_cue_delivered") {
              details = `Delivered voice cue: "${evt.metadata?.text || ""}"`;
              categoryStyle = "text-emerald-400";
            } else if (evt.event_type === "assistant_correction_delivered") {
              const jointLabel = evt.metadata?.joint ? evt.metadata.joint.replace(/_/g, " ") : "form";
              details = `Correction delivered for ${jointLabel}: "${evt.metadata?.text || ""}"`;
              categoryStyle = "text-emerald-400 font-semibold";
            } else if (evt.event_type === "assistant_correction_requested") {
              const jointLabel = evt.metadata?.joint ? evt.metadata.joint.replace(/_/g, " ") : "joint";
              details = `Requested correction check for ${jointLabel} (observed: ${evt.metadata?.observed_angle?.toFixed(0)}°)`;
              categoryStyle = "text-emerald-500/80";
            } else if (evt.event_type === "assistant_answer_delivered") {
              details = `Answered: "${evt.metadata?.answer || ""}"`;
              categoryStyle = "text-emerald-400";
            } else if (evt.event_type === "assistant_answer_failed") {
              details = `Q&A failed: "${evt.metadata?.error || ""}"`;
              categoryStyle = "text-red-400 font-bold";
            } else if (evt.event_type === "trainer_instruction_repeated") {
              details = `Repeated trainer instruction: "${evt.metadata?.text || ""}"`;
              categoryStyle = "text-purple-400";
            } else if (evt.event_type === "section_skipped") {
              details = `Skipped directly to workout section: "${evt.metadata?.section_name || ""}"`;
              categoryStyle = "text-purple-400";
            } else if (evt.event_type === "haptic_cue_requested") {
              const sides = evt.metadata?.sleeve_sides?.join(", ") || "sleeves";
              details = `Requested pattern "${evt.metadata?.pattern_name || ""}" on ${sides} (${evt.metadata?.purpose || "cues"})`;
              categoryStyle = "text-sky-500/80";
            } else if (evt.event_type === "haptic_cue_triggered") {
              const sides = evt.metadata?.sleeve_sides?.join(", ") || "sleeves";
              details = `Triggered haptic pattern "${evt.metadata?.pattern_name || ""}" on ${sides} at ${evt.metadata?.intensity || 0.7} intensity`;
              categoryStyle = "text-sky-400 font-semibold";
            } else if (evt.event_type === "haptic_cue_failed") {
              details = `Haptic trigger failed: "${evt.metadata?.error || ""}"`;
              categoryStyle = "text-red-400 font-bold";
            } else if (evt.event_type === "haptic_test_requested") {
              details = `Fired haptic test pulse on sleeve side: "${evt.metadata?.sleeve_side || ""}"`;
              categoryStyle = "text-sky-400";
            } else if (evt.event_type === "user_question_submitted") {
              const exerciseLabel = evt.metadata?.active_exercise ? ` during ${evt.metadata.active_exercise}` : "";
              details = `Asked: "${evt.metadata?.question || ""}"${exerciseLabel}`;
              categoryStyle = "text-emerald-400 font-semibold";
            } else if (evt.event_type === "prototype_rep_detected") {
              details = `Tracked repetition #${evt.metadata?.rep_count || 1} completed (${evt.metadata?.exercise_name || "exercise"})`;
              categoryStyle = "text-yellow-400 font-bold";
            } else if (evt.event_type === "prototype_form_error_detected") {
              const jointLabel = evt.metadata?.joint ? evt.metadata.joint.replace(/_/g, " ") : "joint";
              details = `Warning on ${jointLabel} (${evt.metadata?.observed_angle?.toFixed(0)}°): "${evt.metadata?.message || ""}"`;
              categoryStyle = "text-amber-400 font-bold";
            } else {
              details = typeof evt.metadata === "object" ? JSON.stringify(evt.metadata) : evt.event_type;
              categoryStyle = "text-slate-400";
            }

            return (
              <div key={idx} className="flex items-start gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs">
                <span className="px-2 py-0.5 rounded bg-slate-900 text-yellow-400 font-bold border border-slate-800 shrink-0" aria-label={`Timestamp ${timeLabel}`}>
                  {timeLabel}
                </span>
                <div className="flex-1 text-slate-300">
                  <span className={`font-extrabold uppercase tracking-wide mr-2 ${categoryStyle}`}>
                    {evt.event_type.replace(/_/g, " ")}
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
