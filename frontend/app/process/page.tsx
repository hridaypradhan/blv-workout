"use client";

import React from "react";
import PageWrapper from "@/components/layout/PageWrapper";

export default function ProcessVideo() {
  const handleProcessVideo = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Send YouTube URL to FastAPI backend to start processing
  };

  const steps = [
    { name: "Downloading", desc: "Retrieving video files and descriptive metadata from YouTube." },
    { name: "Segmenting Exercises", desc: "Splitting the stream into individual exercise movements." },
    { name: "Extracting Reps", desc: "Analyzing body pose angles and tracking counts." },
    { name: "Generating Haptic Profiles", desc: "Converting joint adjustments into haptic vibration codes." },
    { name: "Ready", desc: "Workout is compiled and ready in your library." },
  ];

  return (
    <PageWrapper id="process-video-wrapper">
      <div className="max-w-3xl mx-auto py-4">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-white">Process New Workout</h1>
          <p className="text-slate-400 text-sm mt-1">
            Convert any video guide into an interactive session with spatial audio cues and haptic guidance.
          </p>
        </div>

        {/* URL Input Form */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl mb-6 md:mb-8" aria-labelledby="url-form-heading">
          <h2 id="url-form-heading" className="text-xl font-bold text-white mb-4">
            Video Details
          </h2>
          
          <form onSubmit={handleProcessVideo} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="youtube-url" className="block text-sm font-semibold text-slate-200">
                YouTube URL
              </label>
              <input
                type="url"
                id="youtube-url"
                required
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-yellow-400 rounded-xl text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400 transition-all"
              />
            </div>
            
            <button
              type="submit"
              className="w-full px-6 py-3.5 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold rounded-xl text-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 focus-visible:outline-offset-2"
              id="submit-process-btn"
            >
              Process Video
            </button>
          </form>
        </section>

        {/* Processing Stages Indicator (Greyed out by default) */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl" aria-labelledby="status-heading">
          <div className="flex items-center justify-between mb-6">
            <h2 id="status-heading" className="text-xl font-bold text-white">
              Processing Progress
            </h2>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-800 text-slate-400 border border-slate-700 uppercase tracking-wider">
              Idle
            </span>
          </div>

          {/* List of steps */}
          <div className="relative border-l-2 border-slate-800 ml-3.5 pl-6 space-y-8" role="feed" aria-busy="false">
            {steps.map((step, idx) => (
              <div key={step.name} className="relative group" aria-label={`Stage ${idx + 1}: ${step.name}`}>
                {/* Step dot */}
                <span
                  className="absolute -left-[33px] top-0 flex items-center justify-center w-5 h-5 rounded-full bg-slate-950 border-2 border-slate-800 text-slate-600 font-bold text-[10px]"
                  aria-hidden="true"
                >
                  {idx + 1}
                </span>
                
                {/* Text description */}
                <div>
                  <h3 className="text-sm font-bold text-slate-500 group-hover:text-slate-400 transition-colors">
                    {step.name}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PageWrapper>
  );
}
