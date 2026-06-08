"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageWrapper from "@/components/layout/PageWrapper";
import { startSession, getUserProfile, triggerHapticTest, recordPlaybackEvent } from "@/lib/api";
import { getActiveUserId, PROTOTYPE_USER_ID } from "@/lib/prototypeUser";
import { mergeUserPreferences } from "@/lib/userPreferences";
import { usePrototypeHapticConnection, getPrototypeSleeveStatuses } from "@/lib/hooks/usePrototypeHapticConnection";
import ScreenReaderStatus from "@/components/accessibility/ScreenReaderStatus";
import { SleeveSide } from "@/types";

interface SetupPageProps {
  params: {
    videoId: string;
  };
}

export default function SessionSetup({ params }: SetupPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState(PROTOTYPE_USER_ID);
  const [interruptionLevel, setInterruptionLevel] = useState("brief_speech");
  const [pauseBeforeSpeaking, setPauseBeforeSpeaking] = useState(true);
  const [difficulty, setDifficulty] = useState("diff-norm");

  // Ask Assistant states
  const [askInput, setAskInput] = useState("");
  const [assistantResponse, setAssistantResponse] = useState<string | null>(null);
  const [askAnnouncement, setAskAnnouncement] = useState("");

  // Haptic test states
  const [testingSleeves, setTestingSleeves] = useState<Record<string, boolean>>({});
  const [sleeveResults, setSleeveResults] = useState<Record<string, string>>({});
  const [sleeveAnnouncement, setSleeveAnnouncement] = useState("");

  const { hapticState } = usePrototypeHapticConnection();

  useEffect(() => {
    const activeId = getActiveUserId();
    setActiveUserId(activeId);

    async function fetchUserSettings() {
      try {
        const user = await getUserProfile(activeId);
        const prefs = mergeUserPreferences(user);
        if (prefs.audio_coexistence) {
          if (prefs.audio_coexistence.interruption_level) {
            setInterruptionLevel(prefs.audio_coexistence.interruption_level);
          }
          if (prefs.audio_coexistence.pause_before_speaking !== undefined) {
            setPauseBeforeSpeaking(prefs.audio_coexistence.pause_before_speaking);
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
    const query = askInput.trim();
    if (!query) return;

    const response = `Prototype assistant noted your question: "${query}". Live guidance will be available during assisted playback.`;
    setAssistantResponse(response);
    setAskAnnouncement(response);
    setAskInput("");
  };

  const handleTestSleeve = async (sleeveKey: string, name: string) => {
    const side = (sleeveKey === "la" || sleeveKey === "ll") ? "left" : "right";
    setTestingSleeves((prev) => ({ ...prev, [sleeveKey]: true }));
    setSleeveResults((prev) => ({ ...prev, [sleeveKey]: "" }));
    setSleeveAnnouncement(`Testing ${name} haptic cue...`);

    if (sessionId) {
      recordPlaybackEvent(sessionId, "haptic_test_requested", null, {
        sleeve_side: side,
        sleeve_key: sleeveKey,
        sleeve_name: name
      }).catch((err) => console.warn("Failed to log haptic_test_requested event:", err));
    }

    try {
      const response = await triggerHapticTest(side as SleeveSide);
      setSleeveResults((prev) => ({ ...prev, [sleeveKey]: "Pulse Fired" }));
      setSleeveAnnouncement(`${name} test pulse success: ${response.message}`);
    } catch (err) {
      console.error(`Failed to test haptic sleeve ${sleeveKey}:`, err);
      const errMsg = err instanceof Error ? err.message : "Failed";
      setSleeveResults((prev) => ({ ...prev, [sleeveKey]: "Failed" }));
      setSleeveAnnouncement(`${name} test pulse failed: ${errMsg}`);
    } finally {
      setTestingSleeves((prev) => ({ ...prev, [sleeveKey]: false }));
    }
  };

  const handleStartWorkout = async () => {
    setIsStarting(true);
    setError(null);
    try {
      const session = await startSession(params.videoId, activeUserId);
      if (!session.id) {
        throw new Error("Backend response did not contain a valid session ID.");
      }

      // Do NOT patch user settings from pre-session setup. Pass overrides via query params instead.
      const queryParams = new URLSearchParams();
      queryParams.set("sessionId", session.id);
      queryParams.set("overrideLevel", interruptionLevel);
      queryParams.set("overridePause", String(pauseBeforeSpeaking));
      queryParams.set("overrideDifficulty", difficulty);

      router.push(`/session/${params.videoId}?${queryParams.toString()}`);
    } catch (err) {
      console.error("Failed to start session:", err);
      const message = err instanceof Error ? err.message : "Failed to start assisted playback session. Please check if the backend is running.";
      setError(message);
      setIsStarting(false);
    }
  };

  const sleeveStatus = getPrototypeSleeveStatuses(hapticState);

  return (
    <PageWrapper id="session-setup-wrapper">
      {/* Hidden announcer region for Ask Assistant */}
      <ScreenReaderStatus content={askAnnouncement} />
      <ScreenReaderStatus content={sleeveAnnouncement} />

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
                  Prototype Pose Tracking (Camera-Free)
                </h2>
                <p className="text-sm text-slate-300 mb-4">
                  In this prototype, joint angles are simulated mathematically based on playback timestamps. No camera permission or video stream processing is requested.
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
                <p className="text-sm text-slate-200 font-bold mb-1">Camera Feed Disabled in Prototype</p>
                <p className="text-sm text-slate-400">Workout tracking is mathematically simulated. Camera access is not requested.</p>
              </div>
            </section>

            {/* Sleeve Status */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col justify-between" aria-labelledby="sleeve-heading">
              <div>
                <h2 id="sleeve-heading" className="text-lg font-bold text-white mb-2">
                  Prototype Sleeve Status
                </h2>
                <p className="text-sm text-slate-300 mb-4">
                  Verify prototype haptic readiness (mathematically simulated). No physical sleeve hardware is required in this prototype.
                </p>
              </div>

              <div className="space-y-3">
                {sleeveStatus.map((sleeve) => {
                  const isTesting = !!testingSleeves[sleeve.key];
                  const testResult = sleeveResults[sleeve.key];
                  return (
                    <div key={sleeve.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl">
                      <div className="flex items-center justify-between sm:justify-start gap-4 flex-1">
                        <span className="text-sm font-semibold text-slate-200">{sleeve.name}</span>
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${sleeve.colorClass}`} aria-hidden="true" />
                          <span className="text-sm font-semibold text-slate-300">{sleeve.statusText}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 self-end sm:self-auto">
                        {testResult && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${testResult === "Pulse Fired" ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
                            {testResult}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleTestSleeve(sleeve.key, sleeve.name)}
                          disabled={isTesting}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-500 text-xs font-bold text-slate-200 border border-slate-700 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 transition-all"
                          aria-label={`Test ${sleeve.name} haptic cue`}
                        >
                          {isTesting ? "Testing..." : "Test"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Assistant Interruption & Tolerances Selector */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl" aria-labelledby="difficulty-heading">
            <h2 id="difficulty-heading" className="text-lg font-bold text-white mb-2">
              How are you feeling today?
            </h2>
            <p className="text-sm text-slate-300 mb-4">
              The assistant adjusts its interruption level and haptic tolerances based on your current state (applicable for this session only).
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
                  <span className="text-sm text-slate-300 leading-normal">{diff.desc}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Audio Coexistence Preferences */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl" aria-labelledby="audio-coexistence-heading">
            <h2 id="audio-coexistence-heading" className="text-lg font-bold text-white mb-2">
              Audio Coexistence (Session Overrides)
            </h2>
            <p className="text-sm text-slate-300 mb-4">
              Configure how the assistant coexists with the trainer&apos;s audio. (These selections will override your saved defaults for this session only).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6" role="radiogroup" aria-labelledby="audio-coexistence-heading">
              {[
                { id: "setup-int-silent", value: "silent", label: "Silent", desc: "No voice feedback. Playback is entirely uninterrupted." },
                { id: "setup-int-haptic", value: "haptic_only", label: "Haptic Only", desc: "Vibration cues on sleeves. Speech is fully silenced." },
                { id: "setup-int-brief", value: "brief_speech", label: "Brief Speech", desc: "Short correction words only during clear speech gaps." },
                { id: "setup-int-full", value: "full_speech", label: "Full Speech", desc: "Ducks YouTube audio to deliver complete form guidance." },
              ].map((lvl) => (
                <label
                  key={lvl.id}
                  htmlFor={lvl.id}
                  className={`relative flex flex-col p-4 rounded-xl cursor-pointer select-none transition-all focus-within:ring-2 focus-within:ring-yellow-400 ${
                    interruptionLevel === lvl.value
                      ? "bg-slate-950 border-2 border-yellow-400"
                      : "bg-slate-950 border border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      id={lvl.id}
                      name="interruption-level"
                      value={lvl.value}
                      checked={interruptionLevel === lvl.value}
                      onChange={(e) => setInterruptionLevel(e.target.value)}
                      className="w-4 h-4 text-yellow-400 bg-slate-900 border-slate-800 focus:ring-yellow-400"
                    />
                    <span className="text-sm font-bold text-white">{lvl.label}</span>
                  </div>
                  <span className="text-sm text-slate-300 mt-1.5">{lvl.desc}</span>
                </label>
              ))}
            </div>

            {/* Pause Before Speaking Toggle */}
            <div className="flex items-center justify-between gap-4 p-4 bg-slate-950 border border-slate-800 rounded-2xl">
              <div className="flex flex-col gap-0.5">
                <label htmlFor="pause-before-speaking" className="text-sm font-bold text-slate-200 cursor-pointer">
                  Pause Before Speaking
                </label>
                <span className="text-sm text-slate-300">Briefly pauses the YouTube video when the assistant speaks a correction.</span>
              </div>
              <input
                type="checkbox"
                id="pause-before-speaking"
                checked={pauseBeforeSpeaking}
                onChange={(e) => setPauseBeforeSpeaking(e.target.checked)}
                className="w-10 h-5 bg-slate-900 border-slate-800 text-yellow-400 focus:ring-yellow-400 rounded-full cursor-pointer accent-yellow-400"
              />
            </div>
          </section>

          {/* Assistant pre-workout Q&A */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl" aria-labelledby="ask-heading">
            <h2 id="ask-heading" className="text-lg font-bold text-white mb-1">
              Ask Assistant
            </h2>
            <p className="text-sm text-slate-300 mb-4">
              Have questions about the moves? Ask the assistant for supplementary tips before starting.
            </p>

            <form onSubmit={handleAskQuestion} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Ask e.g. 'How do I align my feet for a squats setup?'"
                value={askInput}
                onChange={(e) => setAskInput(e.target.value)}
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

            {assistantResponse && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200">
                <span className="font-bold text-yellow-400 block mb-1">Assistant Response (Prototype):</span>
                <p>{assistantResponse}</p>
              </div>
            )}
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
