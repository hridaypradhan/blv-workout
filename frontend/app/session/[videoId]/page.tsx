"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import PageWrapper from "@/components/layout/PageWrapper";
import { useYouTubePlayer } from "@/lib/hooks/useYouTubePlayer";
import { usePreparedVideo } from "@/lib/hooks/usePreparedVideo";
import { ProcessingStage } from "@/types";
import YouTubePlayerPanel from "@/components/session/YouTubePlayerPanel";
import SessionControls from "@/components/session/SessionControls";
import { useSessionTelemetry } from "@/lib/hooks/useSessionTelemetry";
import { endSession, getUserProfile, recordPlaybackEvent } from "@/lib/api";
import { getActiveUserId } from "@/lib/prototypeUser";
import { useSidecarManifest } from "@/lib/hooks/useSidecarManifest";
import { useAssistantCueQueue } from "@/lib/hooks/useAssistantCueQueue";
import { usePrototypeHapticConnection, getPrototypeSleeveStatuses } from "@/lib/hooks/usePrototypeHapticConnection";
import { InterruptionLevel, AssistantVerbosity, AudioCoexistenceSettings, User } from "@/types";

interface LiveSessionProps {
  params: {
    videoId: string;
  };
}

/** Helper to format time readouts */
function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function LiveSessionContent({ params }: LiveSessionProps) {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const router = useRouter();

  const { isLoading: isLoadingJob, error: jobError, youtubeId, metadata, stage: jobStage } = usePreparedVideo(params.videoId);

  const [assistantMuted, setAssistantMuted] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [isEnding, setIsEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);

  const { hapticState } = usePrototypeHapticConnection();

  useEffect(() => {
    const userId = getActiveUserId();
    getUserProfile(userId)
      .then((profile) => {
        setUserProfile(profile);
      })
      .catch((err) => {
        console.warn("Failed to fetch user settings for live session:", err);
      });
  }, []);

  const announce = (msg: string) => {
    setAnnouncement(msg);
  };

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
  const prevIsPlayingAnnouncement = useRef(false);
  useEffect(() => {
    if (playerError) {
      announce(`Trainer player error: ${playerError}`);
    } else if (hasEnded) {
      announce("Trainer video playback ended.");
    } else if (isBuffering) {
      announce("Trainer video is buffering.");
    } else if (isPlaying) {
      announce("Trainer video playback started.");
    } else if (!isPlaying && prevIsPlayingAnnouncement.current) {
      announce("Trainer video playback paused.");
    } else if (isReady) {
      announce("Trainer video player is ready.");
    } else if (!isReady && youtubeId) {
      announce("Loading trainer video player.");
    }
    prevIsPlayingAnnouncement.current = isPlaying;
  }, [isReady, isPlaying, isBuffering, hasEnded, playerError, youtubeId]);

  // Session playback interaction telemetry hook
  useSessionTelemetry({
    sessionId,
    isReady,
    isPlaying,
    hasEnded,
    currentTime,
    playbackRate,
  });

  // Load assistance sidecar manifest
  const { manifest, isLoading: isLoadingManifest, error: manifestError } = useSidecarManifest(
    params.videoId,
    jobStage === ProcessingStage.COMPLETED
  );

  // Monitor manifest loading updates
  const prevIsLoadingManifest = useRef(false);
  const prevManifestError = useRef<string | null>(null);
  useEffect(() => {
    if (isLoadingManifest && !prevIsLoadingManifest.current) {
      announce("Assisted playback manifest is loading.");
    }
    if (!isLoadingManifest && prevIsLoadingManifest.current && manifest) {
      announce("Assisted playback manifest loaded successfully.");
    }
    if (manifestError && manifestError !== prevManifestError.current) {
      announce(`Failed to load assisted playback manifest: ${manifestError}`);
    }
    prevIsLoadingManifest.current = isLoadingManifest;
    prevManifestError.current = manifestError;
  }, [isLoadingManifest, manifest, manifestError]);

  const searchLevel = searchParams.get("overrideLevel");
  const searchPause = searchParams.get("overridePause");

  const coexistenceSettings: AudioCoexistenceSettings = {
    interruption_level: assistantMuted
      ? InterruptionLevel.HAPTIC_ONLY
      : ((searchLevel as InterruptionLevel) || userProfile?.audio_coexistence?.interruption_level || InterruptionLevel.BRIEF_SPEECH),
    assistant_verbosity: userProfile?.audio_coexistence?.assistant_verbosity || AssistantVerbosity.MODERATE,
    pause_before_speaking: searchPause !== null
      ? searchPause === "true"
      : (userProfile?.audio_coexistence?.pause_before_speaking !== undefined
        ? userProfile.audio_coexistence.pause_before_speaking
        : true),
    correction_frequency: userProfile?.audio_coexistence?.correction_frequency || "medium",
  };

  // Wire up the assistant cue queue
  const currentTimeMs = currentTime * 1000;
  const { activeCue } = useAssistantCueQueue(
    manifest,
    currentTimeMs,
    coexistenceSettings
  );

  const [chatMessages, setChatMessages] = useState<Array<{ sender: "assistant" | "user"; text: string }>>([
    { sender: "assistant", text: "Welcome! Stand 6 feet back. We are preparing to assist with your YouTube workout." }
  ]);
  const [chatInput, setChatInput] = useState("");

  // Append new cues to the message feed as they trigger
  const lastRecordedCueKey = useRef<string | null>(null);
  useEffect(() => {
    if (activeCue) {
      const cueKey = `${activeCue.timestamp_ms}-${activeCue.text}`;
      if (lastRecordedCueKey.current === cueKey) return;
      lastRecordedCueKey.current = cueKey;

      setChatMessages((prev) => [
        ...prev,
        { sender: "assistant", text: activeCue.text }
      ]);
      
      // Expose as announcement for screen readers
      if (activeCue.modality === "audio") {
        announce(`Assistant cue: ${activeCue.text}`);
      } else if (activeCue.modality === "haptic") {
        announce(`Haptic cue requested: ${activeCue.text}`);
      }

      if (sessionId) {
        const isHaptic = activeCue.modality === "haptic";
        const eventType = isHaptic ? "haptic_cue_requested" : "assistant_cue_delivered";
        recordPlaybackEvent(sessionId, eventType, activeCue.timestamp_ms, {
          text: activeCue.text,
          modality: activeCue.modality,
          priority: activeCue.priority,
          persona: activeCue.persona
        }).catch((err) => console.warn(`Failed to log ${eventType} event:`, err));
      }
    }
  }, [activeCue, sessionId]);

  const handleRepeatTrainerInstruction = () => {
    if (!manifest || !manifest.trainer_instruction_events) return;
    const priorEvents = manifest.trainer_instruction_events.filter(
      (evt) => evt.start_ms !== null && evt.start_ms !== undefined && evt.start_ms <= currentTimeMs
    );
    if (priorEvents.length > 0) {
      priorEvents.sort((a, b) => (b.start_ms ?? 0) - (a.start_ms ?? 0));
      const latestEvent = priorEvents[0];
      if (latestEvent.start_ms !== null && latestEvent.start_ms !== undefined) {
        seek(latestEvent.start_ms / 1000);
        announce(`Repeating trainer instruction: "${latestEvent.text}"`);
        if (sessionId) {
          recordPlaybackEvent(sessionId, "trainer_instruction_repeated", currentTimeMs, {
            text: latestEvent.text,
            timestamp_ms: latestEvent.start_ms
          }).catch((err) => console.warn("Failed to log trainer instruction repeated event:", err));
        }
      }
    } else {
      announce("No prior trainer instructions found in this workout session.");
    }
  };

  const handleSkipSection = () => {
    if (!manifest || !manifest.exercise_timeline_anchors) return;
    const nextAnchor = manifest.exercise_timeline_anchors.find(
      (anchor) => anchor.start_time_seconds > currentTime + 1.0
    );
    if (nextAnchor) {
      seek(nextAnchor.start_time_seconds);
      announce(`Skipped to section: ${nextAnchor.name}`);
      if (sessionId) {
        recordPlaybackEvent(sessionId, "section_skipped", currentTimeMs, {
          section_name: nextAnchor.name,
          start_time_seconds: nextAnchor.start_time_seconds
        }).catch((err) => console.warn("Failed to log section skipped event:", err));
      }
    } else {
      announce("No more exercise sections found in this workout.");
    }
  };

  const handleEndSession = async () => {
    if (!sessionId) {
      router.push(`/session/${params.videoId}/setup`);
      return;
    }
    setIsEnding(true);
    setEndError(null);
    try {
      await endSession(sessionId);
      router.push("/history");
    } catch (err) {
      console.error("Failed to end session:", err);
      const message = err instanceof Error ? err.message : "Failed to end session. Please try again.";
      setEndError(message);
      setIsEnding(false);
      announce(`Failed to end session: ${message}`);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const query = chatInput.trim();
    if (!query) return;

    setChatMessages((prev) => [
      ...prev,
      { sender: "user", text: query }
    ]);
    setChatInput("");
    announce(`User question submitted: "${query}"`);

    if (sessionId) {
      recordPlaybackEvent(sessionId, "user_question_submitted", currentTimeMs, {
        question: query
      }).catch((err) => console.warn("Failed to log user question event:", err));
    }
  };

  const handleToggleMute = (muted: boolean) => {
    setAssistantMuted(muted);
    announce(muted ? "Assistant voice muted." : "Assistant voice unmuted.");
  };

  const sleeveStatus = getPrototypeSleeveStatuses(hapticState);

  const currentExercise = manifest?.exercise_timeline_anchors.find(
    (anchor) => currentTime >= anchor.start_time_seconds && currentTime <= anchor.end_time_seconds
  ) || null;

  if (!sessionId) {
    return (
      <PageWrapper id="live-session-no-id-wrapper">
        <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-slate-900 border border-slate-800 rounded-3xl mt-10">
          <span className="text-yellow-400 text-5xl mb-4" role="img" aria-label="Warning">⚠️</span>
          <h2 className="text-xl font-bold text-white mb-2">Session ID Missing</h2>
          <p className="text-sm text-slate-400 mb-6">
            An active session is required to record your workout and view telemetry. Please configure your session first.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
            <Link
              href={`/session/${params.videoId}/setup`}
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
          <p className="text-sm text-slate-400 mb-2">
            Workout assistance preparation is not complete yet.
          </p>
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

  return (
    <PageWrapper id="live-session-wrapper">
      {/* Screen-reader status announcement live region */}
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {announcement}
      </div>

      {/* Top Bar: Sleeve Calibration & Device Strip */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl mb-6 shadow-md" aria-label="Device Status Bar">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${hapticState === "connected" ? "bg-emerald-500 animate-ping" : hapticState === "connecting" ? "bg-yellow-500 animate-pulse" : "bg-red-500"}`} />
          <span className="text-sm font-semibold text-slate-300">
            {hapticState === "connected" 
              ? "Live Device Tracking Connected (Prototype)" 
              : hapticState === "connecting" 
              ? "Live Device Tracking Connecting..." 
              : "Live Device Tracking Disconnected (Use Setup to Connect)"}
          </span>
        </div>
        <div className="flex flex-wrap gap-3 sm:gap-4" aria-label="Individual Limb Calibration Statuses">
          {sleeveStatus.map((s) => {
            const limbStatusText = s.styleState === "connected" 
              ? "Calibrating" 
              : s.styleState === "connecting" 
              ? "Connecting..." 
              : "Offline";
            const dotColor = s.styleState === "connected" 
              ? "bg-yellow-400 animate-pulse" 
              : s.styleState === "connecting" 
              ? "bg-yellow-500 animate-pulse" 
              : "bg-red-500";
            return (
              <div key={s.label} className="flex items-center gap-1.5" aria-label={`${s.name}: ${limbStatusText}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} aria-hidden="true" />
                <span className="text-sm font-bold text-slate-300">
                  <span className="sr-only">{s.name} </span>
                  <span>{s.label}</span> ({limbStatusText})
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left/Center Column: YouTube Embedded Player & Playback Controls */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <YouTubePlayerPanel
            containerRef={containerRef}
            isReady={isReady}
            playerError={playerError}
            metadata={metadata}
            currentTime={currentTime}
            duration={duration}
            playbackRate={playbackRate}
            formatTime={formatTime}
          >
            <SessionControls
              currentTime={currentTime}
              playbackRate={playbackRate}
              assistantMuted={assistantMuted}
              seek={seek}
              setPlaybackRate={setPlaybackRate}
              setAssistantMuted={handleToggleMute}
              handleRepeatTrainerInstruction={handleRepeatTrainerInstruction}
            />
          </YouTubePlayerPanel>

          {/* Bottom Pose Feed Panel */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex items-center justify-between" aria-label="Pose Tracker Cam">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Live Pose Tracker Active</h3>
                <p className="text-sm text-slate-300">Camera feed tracks body joint angles to trigger supplementary haptics.</p>
              </div>
            </div>
            <div className="text-sm text-emerald-400 font-semibold px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 whitespace-nowrap shrink-0">
              Tracking Body
            </div>
          </section>
        </div>

        {/* Right Column: Tracked Performance & Assistant Cue Feed */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col justify-between text-center" aria-label="Tracked Performance Summary">
            <div>
              <span className="text-xs uppercase font-extrabold text-yellow-400 tracking-wider block mb-1">
                Active Exercise Section
              </span>
              <h2 className="text-xl font-bold text-white mb-2">
                {currentExercise ? currentExercise.name : "Break / Transition"}
              </h2>
            </div>
            <div className="my-4 py-4 px-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col justify-center">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-1">
                {currentExercise ? "Supplementary Target Cues" : "Your Tracked Performance"}
              </span>
              <span className={`font-extrabold text-yellow-400 tracking-tight block ${currentExercise ? "text-sm" : "text-5xl"}`}>
                {currentExercise ? (
                  currentExercise.description_accessible || "Follow YouTube instructions"
                ) : (
                  "Ready"
                )}
              </span>
              {currentExercise && (
                <span className="text-sm text-slate-400 mt-2 block">
                  Joint: <strong className="text-slate-200 capitalize">{currentExercise.counting_joint || "any"}</strong> | Target: 15 reps
                </span>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center text-sm text-slate-400 px-1 mb-1.5">
                <span>Section Progress</span>
                <span>
                  {currentExercise
                    ? `${formatTime(currentTime - currentExercise.start_time_seconds)} / ${formatTime(currentExercise.end_time_seconds - currentExercise.start_time_seconds)}`
                    : "No active exercise"}
                </span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-yellow-400 h-full rounded-full transition-all"
                  style={{
                    width: currentExercise
                      ? `${((currentTime - currentExercise.start_time_seconds) / (currentExercise.end_time_seconds - currentExercise.start_time_seconds)) * 100}%`
                      : "0%"
                  }}
                />
              </div>
            </div>
          </section>

          {/* Assistant Cue Feed panel */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl flex-1 flex flex-col justify-between min-h-[300px]" aria-labelledby="assistant-feed-heading">
            <div>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800/65">
                <h2 id="assistant-feed-heading" className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                  Assistant Cue Feed
                </h2>
                {isLoadingManifest && (
                  <span className="text-sm text-yellow-400 animate-pulse flex items-center gap-1.5" id="manifest-loading-indicator">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                    Loading Manifest
                  </span>
                )}
                {manifestError && (
                  <span className="text-sm text-red-400 font-semibold flex items-center gap-1" id="manifest-error-indicator" title={manifestError}>
                    ⚠️ Load Error
                  </span>
                )}
              </div>
    
              <div 
                className="space-y-4 mb-4 pr-1 max-h-[220px] lg:max-h-[320px] overflow-y-auto"
                role="log"
                aria-live="polite"
                aria-relevant="additions text"
              >
                {manifestError && (
                  <div className="p-3 bg-red-950/40 border border-red-500/20 text-red-200 rounded-2xl text-sm flex flex-col gap-1 mb-2" role="alert" id="manifest-error-alert">
                    <span className="font-bold text-sm text-red-400 uppercase tracking-wider">⚠️ Manifest Loading Error</span>
                    <p>Failed to load the sidecar assistance manifest. Voice cues and timeline anchors will be unavailable.</p>
                    <p className="text-sm opacity-75">{manifestError}</p>
                  </div>
                )}
                {chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-2xl text-sm leading-relaxed max-w-[90%] ${
                      msg.sender === "assistant"
                        ? "bg-slate-950 border border-slate-800 text-slate-300 self-start"
                        : "bg-yellow-400 text-slate-950 font-medium ml-auto"
                    }`}
                  >
                    <p className="font-bold text-xs mb-1 opacity-70">
                      {msg.sender === "assistant" ? "ASSISTANT" : "YOU"}
                    </p>
                    <p>{msg.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleSendMessage} className="w-full flex items-center gap-2 border-t border-slate-800/80 pt-4">
              <input
                type="text"
                placeholder="Ask assistant about movement setup..."
                className="flex-1 min-w-0 px-3.5 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-yellow-400 rounded-xl text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400 transition-all"
                aria-label="Ask assistant for verbal clarification"
                id="live-chat-input"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold rounded-xl text-sm border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 shrink-0"
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
 
        <div className="flex flex-col items-center gap-1.5">
          {endError && (
            <span className="text-sm text-red-400 font-semibold animate-pulse" role="alert">
              {endError}
            </span>
          )}
          <button
            onClick={handleEndSession}
            disabled={isEnding}
            className="px-5 py-3 bg-red-600 hover:bg-red-500 disabled:bg-red-800 disabled:text-slate-300 text-white font-bold rounded-xl text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
            id="end-session-btn"
            aria-label="End this assisted workout session and view progress history"
          >
            {isEnding ? "Ending..." : "End & Save Session"}
          </button>
        </div>
      </section>
    </PageWrapper>
  );
}

export default function LiveSession({ params }: LiveSessionProps) {
  return (
    <Suspense fallback={
      <PageWrapper id="live-session-suspense-wrapper">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
          <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Loading Player Page</h2>
        </div>
      </PageWrapper>
    }>
      <LiveSessionContent params={params} />
    </Suspense>
  );
}
