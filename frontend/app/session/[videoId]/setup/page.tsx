"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageWrapper from "@/components/layout/PageWrapper";
import { startSession, getUserProfile, updateUserSettings } from "@/lib/api";
import { getActiveUserId, PROTOTYPE_USER_ID } from "@/lib/prototypeUser";
import { InterruptionLevel, AssistantVerbosity } from "@/types";

interface SetupPageProps {
  params: {
    videoId: string;
  };
}

export default function SessionSetup({ params }: SetupPageProps) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState(PROTOTYPE_USER_ID);
  const [coexistence, setCoexistence] = useState("coexist-duck");
  const [difficulty, setDifficulty] = useState("diff-norm");

  useEffect(() => {
    const activeId = getActiveUserId();
    setActiveUserId(activeId);

    async function fetchUserSettings() {
      try {
        const user = await getUserProfile(activeId);
        if (user.audio_coexistence) {
          const level = user.audio_coexistence.interruption_level;
          const pause = user.audio_coexistence.pause_before_speaking;
          if (level === "haptic_only") {
            setCoexistence("coexist-haptic");
          } else if (pause) {
            setCoexistence("coexist-pause");
          } else {
            setCoexistence("coexist-duck");
          }
        }
      } catch (err) {
        console.warn("Could not load user profile in setup, using default defaults:", err);
      }
    }
    fetchUserSettings();
  }, []);

  const handleAskQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Send query to LLM Assistant for vocal response about the exercises
  };

  const handleStartWorkout = async () => {
    setIsStarting(true);
    setError(null);
    try {
      // Map coexistence selection back to user settings schema
      let level = "brief_speech";
      let pause = false;
      if (coexistence === "coexist-haptic") {
        level = "haptic_only";
      } else if (coexistence === "coexist-pause") {
        pause = true;
        level = "brief_speech";
      }

      // Update settings in backend before starting session
      await updateUserSettings(activeUserId, {
        audio_coexistence: {
          interruption_level: level as InterruptionLevel,
          pause_before_speaking: pause,
          assistant_verbosity: AssistantVerbosity.MODERATE,
          correction_frequency: "medium",
        }
      });

      const session = await startSession(params.videoId, activeUserId);
      if (!session.id) {
        throw new Error("Backend response did not contain a valid session ID.");
      }
      router.push(`/session/${params.videoId}?sessionId=${session.id}`);
    } catch (err) {
      console.error("Failed to start session:", err);
      const message = err instanceof Error ? err.message : "Failed to start assisted playback session. Please check if the backend is running.";
      setError(message);
      setIsStarting(false);
    }
  };

  const sleeveStatus = [
    { key: "la", name: "Left Arm Sleeve", paired: false },
    { key: "ra", name: "Right Arm Sleeve", paired: false },
    { key: "ll", name: "Left Leg Band", paired: false },
    { key: "rl", name: "Right Leg Band", paired: false },
  ];

  return (
    <PageWrapper id="session-setup-wrapper">
      <div className="max-w-3xl mx-auto py-4">
        {/* Page Title */}
        <div className="mb-8">
          <span className="text-xs uppercase font-extrabold text-yellow-400 tracking-widest block mb-1">
            Pre-Session Setup
          </span>
          <h1 className="text-3xl font-extrabold text-white">Get Ready: Assisted Playback</h1>
          <p className="text-slate-400 text-sm mt-1">
            Verify companion audio settings, camera position, and hardware before starting playback.
          </p>
        </div>

        <div className="space-y-8">
          {/* Main Grid: Camera & Sleeve Checks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Camera Check */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col justify-between" aria-labelledby="camera-heading">
              <div>
                <h2 id="camera-heading" className="text-lg font-bold text-white mb-2">
                  Camera Check
                </h2>
                <p className="text-xs text-slate-400 mb-4">
                  Position your camera 5-8 feet away to capture your full body outline for form analysis.
                </p>
              </div>

              {/* Camera Preview Box Placeholder */}
              <div className="flex-1 min-h-[180px] bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center justify-center p-6 text-center">
                <svg
                  className="w-10 h-10 text-slate-600 mb-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-xs text-slate-400 font-bold mb-1">Camera Feed Disabled</p>
                <p className="text-[10px] text-slate-500">We do not store or transmit your video stream.</p>
              </div>
            </section>

            {/* Sleeve Status */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col justify-between" aria-labelledby="sleeve-heading">
              <div>
                <h2 id="sleeve-heading" className="text-lg font-bold text-white mb-2">
                  Sleeve Status
                </h2>
                <p className="text-xs text-slate-400 mb-4">
                  Verify bluetooth pairing status for all limbs.
                </p>
              </div>

              <div className="space-y-3">
                {sleeveStatus.map((sleeve) => (
                  <div key={sleeve.key} className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl">
                    <span className="text-xs font-semibold text-slate-300">{sleeve.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500" aria-hidden="true" />
                      <span className="text-[10px] uppercase font-bold text-slate-500">Disconnected</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Assistant Interruption & Tolerances Selector */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl" aria-labelledby="difficulty-heading">
            <h2 id="difficulty-heading" className="text-lg font-bold text-white mb-2">
              How are you feeling today?
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              The assistant adjusts its interruption level and haptic tolerances based on your current state.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" role="radiogroup" aria-labelledby="difficulty-heading">
              {[
                { id: "diff-fresh", label: "Fresh", desc: "Push for perfect posture tolerances." },
                { id: "diff-norm", label: "Normal", desc: "Standard tolerances & correction rates." },
                { id: "diff-tired", label: "Tired", desc: "Relaxed threshold, gentle voice encouragement." },
              ].map((diff) => (
                <label
                  key={diff.id}
                  htmlFor={diff.id}
                  className={`relative flex flex-col p-4 rounded-xl cursor-pointer select-none transition-all focus-within:ring-2 focus-within:ring-yellow-400 text-center ${
                    difficulty === diff.id
                      ? "bg-slate-950 border-2 border-yellow-400"
                      : "bg-slate-950 border border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    id={diff.id}
                    name="difficulty"
                    value={diff.id}
                    checked={difficulty === diff.id}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="sr-only"
                  />
                  <span className="text-sm font-bold text-white mb-1">{diff.label}</span>
                  <span className="text-[10px] text-slate-500 leading-normal">{diff.desc}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Audio Coexistence Preferences */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl" aria-labelledby="audio-coexistence-heading">
            <h2 id="audio-coexistence-heading" className="text-lg font-bold text-white mb-2">
              Audio Coexistence Preferences
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Control how the assistant&apos;s voice coexists with the trainer&apos;s YouTube audio.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { id: "coexist-haptic", label: "Haptic Only", desc: "No speech interruptions. Tactile cues only." },
                { id: "coexist-duck", label: "Duck & Speak", desc: "Lower YouTube volume when assistant speaks." },
                { id: "coexist-pause", label: "Pause & Speak", desc: "Briefly pause YouTube video when assistant speaks." },
              ].map((opt) => (
                <label
                  key={opt.id}
                  htmlFor={opt.id}
                  className={`relative flex flex-col p-4 rounded-xl cursor-pointer select-none transition-all focus-within:ring-2 focus-within:ring-yellow-400 text-center ${
                    coexistence === opt.id
                      ? "bg-slate-950 border-2 border-yellow-400"
                      : "bg-slate-950 border border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    id={opt.id}
                    name="coexistence"
                    value={opt.id}
                    checked={coexistence === opt.id}
                    onChange={(e) => setCoexistence(e.target.value)}
                    className="sr-only"
                  />
                  <span className="text-sm font-bold text-white mb-1">{opt.label}</span>
                  <span className="text-[10px] text-slate-500 leading-normal">{opt.desc}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Assistant pre-workout Q&A */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl" aria-labelledby="ask-heading">
            <h2 id="ask-heading" className="text-lg font-bold text-white mb-1">
              Ask Assistant
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Have questions about the moves? Ask the assistant for supplementary tips before starting.
            </p>

            <form onSubmit={handleAskQuestion} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Ask e.g. 'How do I align my feet for a squats setup?'"
                className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-yellow-400 rounded-xl text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400 transition-all"
                aria-label="Ask about today's exercises before starting"
                id="setup-ask-input"
              />
              <button
                type="submit"
                className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold rounded-xl text-sm border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
                id="setup-ask-btn"
              >
                Send
              </button>
            </form>
          </section>

          {/* Start Assisted Playback Button */}
          <div className="pt-2">
            {error && (
              <div
                className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400 font-medium flex items-center gap-2"
                role="alert"
              >
                <svg
                  className="w-5 h-5 flex-shrink-0"
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
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span>{error}</span>
              </div>
            )}
            <button
              onClick={handleStartWorkout}
              disabled={isStarting}
              className="w-full inline-flex items-center justify-center px-6 py-4 bg-yellow-400 hover:bg-yellow-300 disabled:bg-yellow-800 disabled:text-slate-400 text-slate-950 font-extrabold rounded-xl text-base transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 focus-visible:outline-offset-2 shadow-lg shadow-yellow-400/10 text-center"
              id="start-workout-btn"
            >
              {isStarting ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Starting session...</span>
                </div>
              ) : (
                "Start Assisted Playback"
              )}
            </button>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
