"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import PageWrapper from "@/components/layout/PageWrapper";
import { useYouTubePlayer } from "@/lib/hooks/useYouTubePlayer";
import { getProcessingStatus } from "@/lib/api";
import { ProcessingStage } from "@/types";

interface LiveSessionProps {
  params: {
    videoId: string;
  };
}

/** Fallback mapping for demo/sample cards to test-drive real video playback */
const DEMO_YOUTUBE_IDS: Record<string, { youtube_id: string; title: string; channel_name: string; duration: number }> = {
  "v-squat-1": {
    youtube_id: "aclHkVaku9U",
    title: "Beginner Bodyweight Squats & Alignment",
    channel_name: "Bodyweight Coach",
    duration: 720,
  },
  "v-lunges-2": {
    youtube_id: "qyvP6M3VeqY",
    title: "Leg Strength: Reverse Lunges Tutorial",
    channel_name: "Fit Foundations",
    duration: 900,
  },
  "v-core-3": {
    youtube_id: "dJlFm3UxM5A",
    title: "Core Stability: Deadbug & Bird-dog Guide",
    channel_name: "A11y Movement",
    duration: 600,
  },
};

/** Helper to format time readouts */
function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export default function LiveSession({ params }: LiveSessionProps) {
  const [isLoadingJob, setIsLoadingJob] = useState(true);
  const [jobError, setJobError] = useState<string | null>(null);
  const [youtubeId, setYoutubeId] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<{ title?: string; channel_name?: string; duration?: number } | null>(null);
  const [jobStage, setJobStage] = useState<ProcessingStage | null>(null);

  const [assistantMuted, setAssistantMuted] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  // Load preparation status on mount
  useEffect(() => {
    if (params.videoId in DEMO_YOUTUBE_IDS) {
      const demo = DEMO_YOUTUBE_IDS[params.videoId];
      setYoutubeId(demo.youtube_id);
      setMetadata({
        title: demo.title,
        channel_name: demo.channel_name,
        duration: demo.duration,
      });
      setJobStage(ProcessingStage.COMPLETED);
      setIsLoadingJob(false);
      return;
    }

    let active = true;
    const fetchStatus = async () => {
      try {
        const job = await getProcessingStatus(params.videoId);
        if (!active) return;

        setJobStage(job.stage);
        if (job.stage === ProcessingStage.COMPLETED) {
          if (job.youtube_id) {
            setYoutubeId(job.youtube_id);
            setMetadata({
              title: job.title || undefined,
              channel_name: job.channel_name || undefined,
              duration: job.duration || undefined,
            });
          } else {
            setJobError("YouTube video ID unavailable for this prepared workout.");
          }
        } else if (job.stage === ProcessingStage.FAILED) {
          setJobError(job.error || "Workout assistance preparation failed.");
        }
      } catch {
        if (!active) return;
        setJobError(
          "Workout details could not be loaded. Please ensure the backend is running and that the video was imported."
        );
      } finally {
        if (active) {
          setIsLoadingJob(false);
        }
      }
    };

    fetchStatus();

    return () => {
      active = false;
    };
  }, [params.videoId]);

  // Hook into the YouTube IFrame player
  const {
    containerRef,
    isReady,
    isPlaying,
    isBuffering,
    hasEnded,
    currentTime,
    duration,
    playbackRate,
    error: playerError,
    play,
    pause,
    seek,
    setPlaybackRate,
  } = useYouTubePlayer(youtubeId);

  // Monitor playback states to populate the screen-reader announcement live region
  const prevIsPlaying = useRef(false);
  useEffect(() => {
    if (playerError) {
      setAnnouncement(`Trainer player error: ${playerError}`);
    } else if (hasEnded) {
      setAnnouncement("Trainer video playback ended.");
    } else if (isBuffering) {
      setAnnouncement("Trainer video is buffering.");
    } else if (isPlaying) {
      setAnnouncement("Trainer video playback started.");
    } else if (!isPlaying && prevIsPlaying.current) {
      setAnnouncement("Trainer video playback paused.");
    } else if (isReady) {
      setAnnouncement((prev) => prev.includes("ready") ? prev : "Trainer video player is ready.");
    } else if (!isReady && youtubeId) {
      setAnnouncement("Loading trainer video player.");
    }
    prevIsPlaying.current = isPlaying;
  }, [isReady, isPlaying, isBuffering, hasEnded, playerError, youtubeId]);

  const handleRepeatTrainerInstruction = () => {
    console.log("Seeking to latest trainer_instruction_event");
  };

  const handleSkipSection = () => {
    console.log("Skipping to next exercise timeline anchor");
  };

  const handleEndSession = () => {
    console.log("Ending session and saving summary");
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const sleeveStatus = [
    { label: "LA", color: "bg-red-500", name: "Left Arm" },
    { label: "RA", color: "bg-red-500", name: "Right Arm" },
    { label: "LL", color: "bg-red-500", name: "Left Leg" },
    { label: "RL", color: "bg-red-500", name: "Right Leg" },
  ];

  const chatPlaceholder = [
    { sender: "assistant", text: "Welcome! Stand 6 feet back. We are starting with Bodyweight Squats from the YouTube trainer." },
    { sender: "user", text: "Am I deep enough?" },
    { sender: "assistant", text: "A bit lower, sink your hips back. You will feel a double haptic pulse on both thigh bands when you reach parallel." },
  ];

  // Conditional screens for preprocessing job states
  if (isLoadingJob) {
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

  if (jobError) {
    return (
      <PageWrapper id="live-session-error-wrapper">
        <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-slate-900 border border-slate-800 rounded-3xl mt-10">
          <span className="text-red-500 text-5xl mb-4" role="img" aria-label="Error">⚠️</span>
          <h2 className="text-xl font-bold text-white mb-2">Failed to Load Session</h2>
          <p className="text-sm text-slate-400 mb-6">{jobError}</p>
          <Link
            href="/dashboard"
            className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm border border-slate-700 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
          >
            Back to Dashboard
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
          <p className="text-sm text-slate-400 mb-2">
            Workout assistance preparation is not complete yet.
          </p>
          <p className="text-xs text-yellow-400 font-semibold bg-yellow-400/10 border border-yellow-400/20 px-3 py-1 rounded-full mb-6">
            Current Stage: {jobStage ? jobStage.replace(/_/g, " ") : "unknown"}
          </p>
          <Link
            href="/dashboard"
            className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm border border-slate-700 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
          >
            Back to Dashboard
          </Link>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper id="live-session-wrapper">
      {/* Screen-reader status announcement live region */}
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {announcement}
      </div>

      {/* Top Bar: Sleeve Calibration & Device Strip */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl mb-6 shadow-md" aria-label="Device Status Bar">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-xs font-semibold text-slate-300">Live Device Calibration & Tracking Connected</span>
        </div>
        <div className="flex flex-wrap gap-3 sm:gap-4">
          {sleeveStatus.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5" title={`${s.name}: Calibrating`}>
              <span className="w-2 h-2 rounded-full bg-yellow-400" aria-hidden="true" />
              <span className="text-[10px] uppercase font-bold text-slate-400">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left/Center Column: YouTube Embedded Player & Playback Controls */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col justify-between" aria-label="Embedded Trainer Video Player">
            <div className="flex justify-between items-start sm:items-center gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <span className="text-xs uppercase font-extrabold text-red-500 tracking-wider block mb-0.5">
                  Original YouTube Trainer Playback
                </span>
                <h2 className="text-lg font-bold text-white leading-snug">{metadata?.title || "Workout Assistance Companion"}</h2>
              </div>
              <div className="flex items-center gap-3 sm:gap-4 text-xs text-slate-400 shrink-0 whitespace-nowrap pt-1 sm:pt-0">
                <span>Speed: {playbackRate}x</span>
                <span className="tabular-nums bg-slate-950 px-2 py-1 rounded-md border border-slate-800/80">
                  {formatTime(currentTime)}&nbsp;/&nbsp;{formatTime(duration)}
                </span>
              </div>
            </div>

            {/* Real YouTube Player Mount Frame */}
            <div className="relative aspect-video bg-slate-950 border border-slate-800 rounded-2xl mb-6 overflow-hidden flex items-center justify-center">
              <div ref={containerRef} className="w-full h-full absolute inset-0" />
              
              {!isReady && !playerError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-20">
                  <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-2" />
                  <p className="text-xs text-slate-400">Loading trainer video player...</p>
                </div>
              )}

              {playerError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 p-6 z-20 text-center">
                  <span className="text-red-500 text-3xl mb-2" role="img" aria-label="Warning">⚠️</span>
                  <p className="text-sm font-bold text-white mb-1">Player Error</p>
                  <p className="text-xs text-slate-400">{playerError}</p>
                </div>
              )}
            </div>

            {/* In-App Playback Adjustments */}
            <div className="flex flex-col gap-4 border-t border-slate-800/60 pt-4" aria-label="Playback Options">
              {/* Custom FitA11y Progress Bar placed here (completely clear of iframe to prevent controls clipping) */}
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-850" aria-hidden="true">
                <div
                  className="bg-red-600 h-full rounded-full transition-all"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => seek(Math.max(currentTime - 10, 0))}
                  className="px-3.5 py-2 bg-slate-850 hover:bg-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-800 transition-all flex items-center gap-1.5"
                  title="Rewind 10 seconds"
                  aria-label="Rewind trainer video by 10 seconds"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z"/>
                  </svg>
                  Rewind 10s
                </button>

                <button
                  onClick={() => setPlaybackRate(playbackRate === 1.0 ? 0.75 : 1.0)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    playbackRate === 0.75
                      ? "bg-yellow-400 text-slate-950 border-yellow-400"
                      : "bg-slate-850 hover:bg-slate-800 text-slate-200 hover:text-white border-slate-800"
                  }`}
                  aria-label={playbackRate === 0.75 ? "Set video speed to normal" : "Slow down video speed to 0.75x"}
                >
                  {playbackRate === 0.75 ? "Normal Speed (1.0x)" : "Slow Down (0.75x)"}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRepeatTrainerInstruction}
                  className="px-3.5 py-2 bg-slate-850 hover:bg-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-800 transition-all flex items-center gap-1.5"
                  aria-label="Repeat last trainer instruction cue"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                  Repeat Last Trainer Instruction
                </button>

                <button
                  onClick={() => setAssistantMuted(!assistantMuted)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    assistantMuted
                      ? "bg-red-500/10 text-red-400 border-red-500/30"
                      : "bg-slate-850 hover:bg-slate-800 text-slate-200 hover:text-white border-slate-800"
                  }`}
                  aria-label={assistantMuted ? "Unmute assistant voice" : "Mute assistant voice"}
                >
                  {assistantMuted ? "Unmute Assistant" : "Mute Assistant"}
                </button>
              </div>
            </div>
          </div>
          </section>

          {/* Bottom Pose Feed Panel */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex items-center justify-between" aria-label="Pose Tracker Cam">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">Live Pose Tracker Active</h3>
                <p className="text-[10px] text-slate-500">Camera feed tracks body joint angles to trigger supplementary haptics.</p>
              </div>
            </div>
            <div className="text-xs text-emerald-400 font-semibold px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
              Tracking Body
            </div>
          </section>
        </div>

        {/* Right Column: Tracked Performance & Assistant Cue Feed */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col justify-between text-center" aria-label="Tracked Performance Dashboard">
            <div>
              <span className="text-xs uppercase font-extrabold text-yellow-400 tracking-wider block mb-1">
                Active Exercise Section
              </span>
              <h2 className="text-xl font-bold text-white mb-2">Bodyweight Squats</h2>
            </div>
   
            <div className="my-4 py-4 px-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col justify-center">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-1">
                Your Tracked Performance
              </span>
              <span className="text-5xl font-extrabold text-yellow-400 tracking-tight block">
                12
              </span>
              <span className="text-xs text-slate-400 mt-2 block">
                Assistant Tracking Target: 15 reps
              </span>
            </div>

            <div>
              <div className="flex justify-between items-center text-xs text-slate-400 px-1 mb-1.5">
                <span>Section Progress</span>
                <span>Set 2 of 3</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                <div className="bg-yellow-400 h-full rounded-full w-2/3" />
              </div>
            </div>
          </section>

          {/* Assistant Cue Feed panel */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl flex-1 flex flex-col justify-between min-h-[300px]" aria-labelledby="assistant-feed-heading">
            <div>
              <h2 id="assistant-feed-heading" className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
                Assistant Cue Feed
              </h2>
    
              <div className="space-y-4 mb-4 pr-1 max-h-[220px] lg:max-h-[320px] overflow-y-auto">
                {chatPlaceholder.map((msg, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-2xl text-xs leading-relaxed max-w-[90%] ${
                      msg.sender === "assistant"
                        ? "bg-slate-950 border border-slate-800 text-slate-300 self-start"
                        : "bg-yellow-400 text-slate-950 font-medium ml-auto"
                    }`}
                  >
                    <p className="font-bold text-[10px] mb-1 opacity-70">
                      {msg.sender === "assistant" ? "ASSISTANT" : "YOU"}
                    </p>
                    <p>{msg.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-2 border-t border-slate-800/80 pt-4">
              <input
                type="text"
                placeholder="Ask assistant about movement setup..."
                className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-yellow-400 rounded-xl text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400 transition-all"
                aria-label="Ask assistant for verbal clarification"
                id="live-chat-input"
              />
              <button
                type="submit"
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold rounded-xl text-xs border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
                id="live-chat-btn"
              >
                Send
              </button>
            </form>
          </section>
        </div>
      </div>

      {/* Bottom Bar: Action buttons */}
      <section className="flex flex-wrap items-center justify-center gap-3 mt-8 pt-6 border-t border-slate-900" aria-label="Playback and Session Controls">
        <button
          onClick={isPlaying ? pause : play}
          className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold rounded-xl text-sm border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
          id="pause-btn"
          aria-label={isPlaying ? "Pause trainer video playback" : "Resume trainer video playback"}
        >
          {isPlaying ? "Pause Playback" : "Resume Playback"}
        </button>
        
        <button
          onClick={handleSkipSection}
          className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold rounded-xl text-sm border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
          id="skip-btn"
          aria-label="Skip to next workout exercise section"
        >
          Skip to Next Section
        </button>
 
        <Link
          href={`/history`}
          onClick={handleEndSession}
          className="px-5 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
          id="end-session-btn"
          aria-label="End this assisted workout session and view progress history"
        >
          End & Save Session
        </Link>
      </section>
    </PageWrapper>
  );
}
