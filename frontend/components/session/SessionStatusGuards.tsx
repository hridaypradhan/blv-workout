"use client";

import React from "react";
import Link from "next/link";
import PageWrapper from "@/components/layout/PageWrapper";
import { ProcessingStage } from "@/types";

interface SessionStatusGuardsProps {
  sessionId: string | null;
  videoId: string;
  isLoadingArtifacts: boolean;
  artifactsError: string | null;
  jobStage: ProcessingStage | null;
}

export default function SessionStatusGuards({
  sessionId,
  videoId,
  isLoadingArtifacts,
  artifactsError,
  jobStage,
}: SessionStatusGuardsProps): React.ReactElement | null {
  if (!sessionId) {
    return (
      <PageWrapper id="live-session-no-id-wrapper">
        <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-slate-900 border border-slate-800 rounded-3xl mt-10">
          <svg className="w-12 h-12 text-yellow-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-bold text-white mb-2">Session ID Missing</h2>
          <p className="text-sm text-slate-400 mb-6">
            An active session is required to record your workout and view telemetry. Please configure your session first.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
            <Link
              href={`/session/${videoId}/setup`}
              className="px-5 py-3 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold rounded-xl text-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
            >
              Go to Session Setup
            </Link>
            <Link
              href="/video-library"
              className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm border border-slate-700 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
            >
              Back to Video Library
            </Link>
          </div>
        </div>
      </PageWrapper>
    );
  }

  if (isLoadingArtifacts) {
    return (
      <PageWrapper id="live-session-loading-wrapper">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
          <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Loading Assisted Playback Session</h2>
          <p className="text-sm text-slate-400">Fetching workout metadata and preparation details...</p>
        </div>
      </PageWrapper>
    );
  }

  if (artifactsError) {
    return (
      <PageWrapper id="live-session-error-wrapper">
        <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-slate-900 border border-slate-800 rounded-3xl mt-10">
          <svg className="w-12 h-12 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-bold text-white mb-2">Failed to Load Session</h2>
          <p className="text-sm text-slate-400 mb-6">{artifactsError}</p>
          <Link
            href="/video-library"
            className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm border border-slate-700 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
          >
            Back to Video Library
          </Link>
        </div>
      </PageWrapper>
    );
  }

  if (jobStage !== ProcessingStage.COMPLETED) {
    return (
      <PageWrapper id="live-session-pending-wrapper">
        <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-slate-900 border border-slate-800 rounded-3xl mt-10">
          <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Preparation in Progress</h2>
          <p className="text-sm text-slate-400 mb-2">Workout assistance preparation is not complete yet.</p>
          <p className="text-sm text-yellow-400 font-semibold bg-yellow-400/10 border border-yellow-400/20 px-3 py-1.5 rounded-full mb-6">
            Current Stage: {jobStage ? jobStage.replace(/_/g, " ") : "unknown"}
          </p>
          <Link
            href="/video-library"
            className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm border border-slate-700 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
          >
            Back to Video Library
          </Link>
        </div>
      </PageWrapper>
    );
  }

  return null;
}
