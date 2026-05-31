"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import PageWrapper from "@/components/layout/PageWrapper";
import { AssistanceJob, ProcessingStage } from "@/types";
import { getJobs } from "@/lib/api";
import ImportedVideoCard from "@/components/dashboard/ImportedVideoCard";
import SampleVideoCard from "@/components/dashboard/SampleVideoCard";

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
                <ImportedVideoCard
                  key={job.video_id}
                  job={job}
                  badge={badge}
                  gradient={gradient}
                  failedImage={!!failedImages[job.video_id]}
                  handleImageError={handleImageError}
                  formatDuration={formatDuration}
                  handleStartSession={handleStartSession}
                />
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
            <SampleVideoCard
              key={video.id}
              video={video}
              handleStartSession={handleStartSession}
            />
          ))}
        </div>
      </section>
    </PageWrapper>
  );
}
