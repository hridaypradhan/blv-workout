"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import PageWrapper from "@/components/layout/PageWrapper";
import { AssistanceJob, ProcessingStage } from "@/types";
import { getJobs, deleteVideo } from "@/lib/api";
import ImportedVideoCard from "@/components/video-library/ImportedVideoCard";
import SampleVideoCard from "@/components/video-library/SampleVideoCard";
import DeleteVideoDialog from "@/components/video-library/DeleteVideoDialog";
import { DEMO_VIDEOS } from "@/lib/demoVideos";
import { getPreprocessingStageBadge } from "@/lib/formatters/preprocessingFormatters";

/** Format a duration in seconds to a human-readable string. */
function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "-";
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

export default function VideoLibraryPage() {
  const [importedJobs, setImportedJobs] = useState<AssistanceJob[]>([]);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [selectedJobForDelete, setSelectedJobForDelete] = useState<AssistanceJob | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [jobsRefreshError, setJobsRefreshError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const inFlightRef = useRef(false);

  const handleImageError = (videoId: string) => {
    setFailedImages((prev) => ({ ...prev, [videoId]: true }));
  };

  const handleRequestDelete = (job: AssistanceJob) => {
    setSelectedJobForDelete(job);
    setDeleteError(null);
    setIsDeleting(false);
  };

  const handleCancelDelete = () => {
    if (isDeleting) return;
    setSelectedJobForDelete(null);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!selectedJobForDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteVideo(selectedJobForDelete.video_id);
      setImportedJobs((prev) => prev.filter((j) => j.video_id !== selectedJobForDelete.video_id));
      setSelectedJobForDelete(null);
    } catch (err) {
      console.error("Failed to delete video:", err);
      const message = err instanceof Error ? err.message : "Failed to delete the video. Please try again.";
      setDeleteError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setIsLoadingJobs(true);
    setJobsError(null);
    getJobs()
      .then((jobs) => {
        if (!cancelled) {
          setImportedJobs(jobs);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch initial video jobs:", err);
        if (!cancelled) {
          setJobsError(
            err instanceof Error
              ? err.message
              : "Failed to connect to the backend server. Please verify the API is running."
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingJobs(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasPreparing = importedJobs.some(
    (job) =>
      job.stage !== ProcessingStage.COMPLETED &&
      job.stage !== ProcessingStage.FAILED
  );

  // Poll active preparation jobs every 12 seconds to update progress
  useEffect(() => {
    let cancelled = false;

    if (!hasPreparing) return;

    const poll = async () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      if (inFlightRef.current) {
        return;
      }
      inFlightRef.current = true;
      try {
        const jobs = await getJobs();
        if (!cancelled) {
          setImportedJobs(jobs);
          setJobsRefreshError(null);
        }
      } catch (err) {
        console.warn("Failed to poll video jobs updates:", err);
        if (!cancelled) {
          setJobsRefreshError("Could not refresh preparation status. Showing last known progress. Updates will retry automatically.");
        }
      } finally {
        inFlightRef.current = false;
      }
    };

    const interval = setInterval(() => {
      poll();
    }, 12000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        poll();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [hasPreparing]);


  return (
    <PageWrapper id="video-library-page-wrapper">
      {/* Header section with "+ Prepare Assistance" button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-extrabold text-white focus:outline-none">Video Library</h1>
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
      {(isLoadingJobs || jobsError || importedJobs.length > 0) && (
        <section className="mb-10" aria-labelledby="imported-heading">
          <h2 id="imported-heading" className="text-lg font-bold text-slate-300 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            Assistance-Ready Videos
          </h2>

          {isLoadingJobs ? (
            <div
              className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center gap-3 text-slate-300"
              role="status"
              aria-live="polite"
            >
              <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              <span>Fetching assistance-ready videos...</span>
            </div>
          ) : jobsError ? (
            <div
              className="p-6 bg-slate-900/50 border border-red-500/20 rounded-2xl flex items-start gap-3 text-slate-300"
              role="alert"
            >
              <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-semibold text-red-400">Could not load prepared videos.</p>
                <p className="text-sm text-slate-400 mt-1">Sample videos are still available below. Please check if the backend is running.</p>
              </div>
            </div>
          ) : (
            <>
              {jobsRefreshError && (
                <div
                  className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium rounded-2xl flex items-center gap-3"
                  role="status"
                  aria-live="polite"
                >
                  <svg className="w-5 h-5 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.228 10H17M4 4h7M4 4v5h5" />
                  </svg>
                  <div>
                    <p className="font-semibold">Could not refresh preparation status. Showing last known progress.</p>
                    <p className="text-xs text-slate-400 mt-0.5">Updates will retry automatically.</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {importedJobs.map((job, idx) => {
                  const badge = getPreprocessingStageBadge(job.stage as ProcessingStage);
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
                      onRequestDelete={handleRequestDelete}
                    />
                  );
                })}
              </div>
            </>
          )}
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
            />
          ))}
        </div>
      </section>

      <DeleteVideoDialog
        job={selectedJobForDelete}
        isOpen={selectedJobForDelete !== null}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
        error={deleteError}
        focusFallbackRef={headingRef}
      />
    </PageWrapper>
  );
}
