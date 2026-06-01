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
  onRequestDelete: (job: AssistanceJob) => void;
}

export default function ImportedVideoCard({
  job,
  badge,
  gradient,
  failedImage,
  handleImageError,
  formatDuration,
  handleStartSession,
  onRequestDelete,
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

        {/* Badges on the top-left */}
        <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
          {job.duration ? (
            <div className="px-2.5 py-1 rounded-md bg-slate-950/75 backdrop-blur-sm text-xs font-semibold text-slate-200 border border-slate-800">
              {formatDuration(job.duration)}
            </div>
          ) : (
            <div className="px-2.5 py-1 rounded-md bg-slate-950/75 backdrop-blur-sm text-xs font-semibold text-slate-400 border border-slate-800">
              Duration unavailable
            </div>
          )}
          <div className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${badge.classes}`}>
            {badge.text}
          </div>
        </div>

        {/* Delete button on the top-right */}
        <div className="absolute top-3 right-3 z-20">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRequestDelete(job);
            }}
            className="w-11 h-11 inline-flex items-center justify-center rounded-lg bg-slate-950/75 hover:bg-red-600/90 text-slate-400 hover:text-white border border-slate-800 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 focus-visible:outline-offset-2"
            aria-label={`Delete ${job.title || "video"}`}
          >
            <svg
              className="w-5 h-5"
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
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
            Preparing...
          </div>
        )}
      </div>
    </article>
  );
}
