import React from "react";
import Link from "next/link";
import { AssistanceJob, ProcessingStage } from "@/types";

interface ImportedVideoCardProps {
  job: AssistanceJob;
  badge: { text: string; classes: string };
  gradient: string;
  failedImage: boolean;
  handleImageError: (videoId: string) => void;
  formatDuration: (seconds: number | null | undefined) => string;
  handleStartSession: (videoId: string) => void;
}

export default function ImportedVideoCard({
  job,
  badge,
  gradient,
  failedImage,
  handleImageError,
  formatDuration,
  handleStartSession,
}: ImportedVideoCardProps) {
  return (
    <article
      className="flex flex-col bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl md:rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 group"
      aria-labelledby={`title-import-${job.video_id}`}
    >
      {/* Visual header (with thumbnail when available) */}
      <div className="h-32 relative overflow-hidden flex items-center justify-center bg-slate-950">
        {job.thumbnail_url && !failedImage ? (
          <img
            src={job.thumbnail_url}
            alt={`Thumbnail for ${job.title || "video"}`}
            onError={() => handleImageError(job.video_id)}
            className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-tr ${gradient}`} />
        )}

        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/10 transition-colors duration-300" />

        <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-md text-xs font-semibold border z-10 ${badge.classes}`}>
          {badge.text}
        </div>

        {job.duration ? (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-slate-950/75 backdrop-blur-sm text-xs font-semibold text-slate-200 border border-slate-800 z-10">
            {formatDuration(job.duration)}
          </div>
        ) : (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-slate-950/75 backdrop-blur-sm text-xs font-semibold text-slate-400 border border-slate-800 z-10">
            Duration unavailable
          </div>
        )}

        <svg
          className="absolute w-10 h-10 text-white/90 group-hover:scale-110 transition-transform duration-300 drop-shadow-md z-10"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      {/* Content */}
      <div className="flex-1 p-5 flex flex-col justify-between">
        <div>
          <h3
            id={`title-import-${job.video_id}`}
            className="text-base font-bold text-white mb-2 group-hover:text-yellow-400 transition-colors line-clamp-2"
            title={job.title || "Untitled Video"}
          >
            {job.title || "Untitled Video"}
          </h3>
          {job.channel_name && (
            <p className="text-xs text-slate-400 mb-3 font-medium">
              Trainer: {job.channel_name}
            </p>
          )}
          {job.error && (
            <p className="text-xs text-red-400 mb-3 font-medium">Error: {job.error}</p>
          )}
        </div>

        {job.stage === ProcessingStage.COMPLETED ? (
          <Link
            href={`/session/${job.video_id}/setup`}
            onClick={() => handleStartSession(job.video_id)}
            className="w-full inline-flex items-center justify-center px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold rounded-xl text-sm border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 transition-all"
            aria-label={`Start assisted playback for ${job.title || "imported video"}`}
          >
            Start Assisted Playback
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ) : job.stage === ProcessingStage.FAILED ? (
          <Link
            href="/process"
            className="w-full inline-flex items-center justify-center px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold rounded-xl text-sm border border-red-500/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400 transition-all"
          >
            Retry Preparation
          </Link>
        ) : (
          <div className="w-full flex items-center justify-center px-4 py-2.5 bg-slate-800/50 text-slate-500 font-semibold rounded-xl text-sm border border-slate-800">
            Preparing…
          </div>
        )}
      </div>
    </article>
  );
}
