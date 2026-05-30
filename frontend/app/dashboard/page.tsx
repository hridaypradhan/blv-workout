"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import PageWrapper from "@/components/layout/PageWrapper";
import { AssistanceJob, ProcessingStage } from "@/types";
import { getJobs } from "@/lib/api";

/** Hardcoded demo videos shown when the backend has no imported videos yet. */
const DEMO_VIDEOS = [
  {
    id: "v-squat-1",
    title: "Beginner Bodyweight Squats & Alignment",
    channelName: "Bodyweight Coach",
    duration: "12 mins",
    lastSession: "2 days ago",
    thumbnailBg: "from-blue-600 to-indigo-800",
  },
  {
    id: "v-lunges-2",
    title: "Leg Strength: Reverse Lunges Tutorial",
    channelName: "Fit Foundations",
    duration: "15 mins",
    lastSession: "1 week ago",
    thumbnailBg: "from-amber-600 to-orange-800",
  },
  {
    id: "v-core-3",
    title: "Core Stability: Deadbug & Bird-dog Guide",
    channelName: "A11y Movement",
    duration: "10 mins",
    lastSession: "Never",
    thumbnailBg: "from-emerald-600 to-teal-800",
  },
];

/** Human-readable badge for a processing stage. */
function stageBadge(stage: ProcessingStage) {
  switch (stage) {
    case ProcessingStage.COMPLETED:
      return { text: "Ready", classes: "bg-emerald-600 text-white border-emerald-500 shadow-md font-bold" };
    case ProcessingStage.FAILED:
      return { text: "Failed", classes: "bg-red-600 text-white border-red-500 shadow-md font-bold" };
    case ProcessingStage.SUBMITTED:
    case ProcessingStage.FETCHING_METADATA:
    case ProcessingStage.TRANSCRIBING:
    case ProcessingStage.ANCHORING_TIMELINE:
    case ProcessingStage.CLASSIFYING_TRAINER_INSTRUCTIONS:
    case ProcessingStage.ANALYZING_MOVEMENT_WINDOWS:
    case ProcessingStage.GENERATING_SIDECAR_MANIFEST:
      return { text: "Preparing", classes: "bg-amber-500 text-slate-950 border-amber-400 shadow-md font-bold" };
    default:
      return { text: stage, classes: "bg-slate-800 text-slate-400 border-slate-700 font-bold" };
  }
}

/** Format a duration in seconds to a human-readable string. */
function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  return s > 0 ? `${m}m ${s}s` : `${m} mins`;
}

/** Gradient palette for imported video cards. */
const CARD_GRADIENTS = [
  "from-violet-600 to-purple-800",
  "from-cyan-600 to-blue-800",
  "from-rose-600 to-pink-800",
  "from-lime-600 to-green-800",
  "from-fuchsia-600 to-purple-900",
  "from-sky-500 to-indigo-800",
];

export default function Dashboard() {
  const [importedJobs, setImportedJobs] = useState<AssistanceJob[]>([]);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const handleImageError = (videoId: string) => {
    setFailedImages((prev) => ({ ...prev, [videoId]: true }));
  };

  useEffect(() => {
    let cancelled = false;
    getJobs()
      .then((jobs) => {
        if (!cancelled) {
          setImportedJobs(jobs);
        }
      })
      .catch(() => {
        // Backend may not be running — that's fine, show demo cards
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStartSession = (videoId: string) => {
    console.log("Starting session for video ID:", videoId);
  };

  return (
    <PageWrapper id="dashboard-page-wrapper">
      {/* Header section with "+ Prepare Assistance" button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Video Library</h1>
          <p className="text-slate-400 text-sm mt-1">
            Browse and start assisted playback for your YouTube workouts.
          </p>
        </div>

        <Link
          href="/process"
          className="inline-flex items-center justify-center px-5 py-3 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold rounded-xl text-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 focus-visible:outline-offset-2"
          id="prepare-assistance-btn"
        >
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
          </svg>
          Prepare Assistance
        </Link>
      </div>

      {/* Imported Videos from Backend */}
      {importedJobs.length > 0 && (
        <section className="mb-10" aria-labelledby="imported-heading">
          <h2 id="imported-heading" className="text-lg font-bold text-slate-300 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            Assistance-Ready Videos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {importedJobs.map((job, idx) => {
              const badge = stageBadge(job.stage as ProcessingStage);
              const gradient = CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
              return (
                <article
                  key={job.video_id}
                  className="flex flex-col bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl md:rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 group"
                  aria-labelledby={`title-import-${job.video_id}`}
                >
                  {/* Visual header (with thumbnail when available) */}
                  <div className="h-32 relative overflow-hidden flex items-center justify-center bg-slate-950">
                    {job.thumbnail_url && !failedImages[job.video_id] ? (
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
            })}
          </div>
        </section>
      )}

      {/* Demo / Placeholder Video Cards */}
      <section aria-labelledby="demo-heading">
        <h2 id="demo-heading" className="text-lg font-bold text-slate-300 mb-4">
          {importedJobs.length > 0 ? "Sample Videos" : "Sample Playback Companions"}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {DEMO_VIDEOS.map((video) => (
            <article
              key={video.id}
              className="flex flex-col bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl md:rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 group"
              aria-labelledby={`title-${video.id}`}
            >
              {/* Visual Thumbnail Placeholder */}
              <div className={`h-40 bg-gradient-to-tr ${video.thumbnailBg} flex items-center justify-center p-6 relative`}>
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-slate-950/65 backdrop-blur-sm text-xs font-semibold text-slate-200 border border-slate-800">
                  {video.duration}
                </div>
                <svg
                  className="w-12 h-12 text-white/80 group-hover:scale-110 transition-transform duration-300"
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
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>

              {/* Content Details */}
              <div className="flex-1 p-6 flex flex-col justify-between">
                <div>
                  <h2
                    id={`title-${video.id}`}
                    className="text-lg font-bold text-white mb-3 group-hover:text-yellow-400 transition-colors line-clamp-2"
                    title={video.title}
                  >
                    {video.title}
                  </h2>

                  <div className="grid grid-cols-2 gap-4 text-xs text-slate-400 mb-6" role="list">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-slate-500 uppercase tracking-wider">Trainer</span>
                      <span className="text-slate-300 text-sm font-semibold">{video.channelName}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-slate-500 uppercase tracking-wider">Last Playback</span>
                      <span className="text-slate-300 text-sm font-semibold">{video.lastSession}</span>
                    </div>
                  </div>
                </div>

                {/* Start Session Action Button */}
                <Link
                  href={`/session/${video.id}/setup`}
                  onClick={() => handleStartSession(video.id)}
                  className="w-full inline-flex items-center justify-center px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold rounded-xl text-sm border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 transition-all"
                  aria-label={`Start assisted playback setup for ${video.title}`}
                  id={`start-btn-${video.id}`}
                >
                  Start Assisted Playback
                  <svg
                    className="w-4 h-4 ml-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </PageWrapper>
  );
}
