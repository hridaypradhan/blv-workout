"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import PageWrapper from "@/components/layout/PageWrapper";
import { startSession, triggerHapticTest, askAssistant, updateUserSettings } from "@/lib/api";
import { getActiveUserId, notifyActiveUserUpdated, PROTOTYPE_USER_ID } from "@/lib/prototypeUser";
import { mergeUserPreferences } from "@/lib/userPreferences";
import { useHapticDeviceStatus } from "@/lib/hooks/useHapticDeviceStatus";
import ScreenReaderStatus from "@/components/accessibility/ScreenReaderStatus";
import { SleeveSide, AssistantPersona, QARequest, AudioCoexistenceSettings, AssistantVerbosity } from "@/types";
import { useUserProfile } from "@/components/layout/UserProfileContext";
import { useSessionArtifacts } from "@/lib/hooks/useSessionArtifacts";
import { buildFrontendQnAContext } from "@/lib/qnaContextBuilder";
import { useCameraStream, useCameraLifecycleCleanup } from "@/lib/hooks/useCameraStream";
import { saveCameraPreference } from "@/lib/camera/cameraPreference";
import { getPoseRequirementForAnchor } from "@/lib/pose/positioningGuide";
import { SetupAlignmentMode } from "@/components/session/SetupAlignmentMode";
import { useSetupVoiceCommands } from "@/lib/hooks/useSetupVoiceCommands";
import { initSpeechRegistryMonkeyPatch } from "@/lib/voice/speechRegistry";
import { SetupAudioCoexistenceSection } from "@/components/session/SetupAudioCoexistenceSection";
import { SetupSleeveStatusSection } from "@/components/session/SetupSleeveStatusSection";
import { SetupAskAssistantSection } from "@/components/session/SetupAskAssistantSection";
import { SetupVoiceSection } from "@/components/session/SetupVoiceSection";
import { CameraAlignmentSection } from "@/components/session/CameraAlignmentSection";
import HapticSettingsPanel from "@/components/settings/HapticSettingsPanel";
import { useHapticPreferenceSettings } from "@/lib/hooks/useHapticPreferenceSettings";

interface SetupPageProps {
  params: {
    videoId: string;
  };
}

export default function SessionSetup({ params }: SetupPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const { user, refreshProfile } = useUserProfile();

  const {
    job,
    manifest,
    cuePlan,
    transcript,
    isLoading: isLoadingArtifacts,
    error: artifactsError,
  } = useSessionArtifacts(params.videoId);

  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState(PROTOTYPE_USER_ID);
  const [pauseBeforeSpeaking, setPauseBeforeSpeaking] = useState(true);
  const [assistantVerbosity, setAssistantVerbosity] = useState("moderate");
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [voiceSelect, setVoiceSelect] = useState("system");

  // Initialize speech registry monkey-patch to prevent app speech feedback interference
  useEffect(() => {
    initSpeechRegistryMonkeyPatch();
  }, []);

  // Camera stream & Positioning state
  useCameraLifecycleCleanup();
  const cameraStream = useCameraStream();
  const [isCameraPositionedReady, setIsCameraPositionedReady] = useState(false);
  const [isAlignmentOpen, setIsAlignmentOpen] = useState(false);
  const [currentGuidance, setCurrentGuidance] = useState("Position yourself in front of the camera.");
  const [isSetupCountdownActive, setIsSetupCountdownActive] = useState(false);
  const [cancelCountdownTrigger, setCancelCountdownTrigger] = useState(0);

  // Ask Assistant states
  const [askInput, setAskInput] = useState("");
  const [assistantResponse, setAssistantResponse] = useState<string | null>(null);
  const [askAnnouncement, setAskAnnouncement] = useState("");
  const [persona, setPersona] = useState<AssistantPersona | undefined>(undefined);
  const [isPending, setIsPending] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);

  // Haptic test states
  const [testingSleeves, setTestingSleeves] = useState<Record<string, boolean>>({});
  const [sleeveResults, setSleeveResults] = useState<Record<string, string>>({});
  const [sleeveAnnouncement, setSleeveAnnouncement] = useState("");

  const {
    hapticPreferences,
    vibrations,
    isVibrationsLoading,
    handleHapticPrefChange,
  } = useHapticPreferenceSettings(user?.haptic_preferences);

  const {
    status: hapticStatus,
    statusText: hapticStatusText,
    deviceStatuses,
    refresh: refreshHaptic,
    isLoading: isHapticLoading,
    error: hapticError,
  } = useHapticDeviceStatus();

  useEffect(() => {
    if (user) {
      setActiveUserId(user.id || getActiveUserId());
      const prefs = mergeUserPreferences(user);
      setPersona(prefs.assistant_persona);
      const voiceSettings = prefs.voice_settings as Record<string, unknown>;
      if (typeof voiceSettings.tts_rate === "number") {
        setTtsSpeed(voiceSettings.tts_rate);
      }
      if (typeof voiceSettings.voice_id === "string") {
        setVoiceSelect(voiceSettings.voice_id);
      }
      if (prefs.audio_coexistence) {
        if (prefs.audio_coexistence.pause_before_speaking !== undefined) {
          setPauseBeforeSpeaking(prefs.audio_coexistence.pause_before_speaking);
        }
        if (prefs.audio_coexistence.assistant_verbosity) {
          setAssistantVerbosity(prefs.audio_coexistence.assistant_verbosity);
        }
      }
    }
  }, [user]);

  const previewWav = (wavUrl: string) => {
    const audio = new Audio(wavUrl);
    audio.play().catch((previewError) => console.warn("Audio preview failed:", previewError));
  };

  const saveSetupPreferences = async () => {
    const savedUser = await updateUserSettings(activeUserId, {
      assistant_persona: persona || AssistantPersona.GUIDE,
      voice_settings: {
        tts_rate: ttsSpeed,
        voice_id: voiceSelect,
      },
      audio_coexistence: {
        assistant_verbosity: assistantVerbosity as AssistantVerbosity,
        pause_before_speaking: pauseBeforeSpeaking,
      },
      haptic_preferences: hapticPreferences,
    });

    localStorage.setItem("fita11y_haptic_preferences", JSON.stringify(hapticPreferences));
    notifyActiveUserUpdated();
    await refreshProfile();
    return savedUser;
  };

  const executeAskQuestion = async (query: string) => {
    if (!query || isPending) return;

    setIsPending(true);
    setQaError(null);
    setAssistantResponse(null);
    setAskAnnouncement("Assistant is responding.");

    try {
      const coexistenceSettings: AudioCoexistenceSettings = {
        assistant_verbosity: assistantVerbosity as AssistantVerbosity,
        pause_before_speaking: pauseBeforeSpeaking,
      };

      let groundedSessionContext: Record<string, unknown>;
      if (manifest && cuePlan && transcript) {
        groundedSessionContext = buildFrontendQnAContext({
          videoTitle: job?.title || null,
          currentTimeMs: 0,
          manifest,
          cuePlan,
          transcript,
          audioCoexistence: coexistenceSettings,
          assistantVoiceMuted: false,
        });
      } else {
        groundedSessionContext = {
          is_grounded: false,
          audio_coexistence: coexistenceSettings,
          assistant_voice_muted: false,
          youtube_metadata: job ? { title: job.title } : null,
        };
      }

      const fullContext: Record<string, unknown> = {
        ...groundedSessionContext,
        phase: "pre_session_setup",
        sessionId: sessionId || undefined,
        videoId: params.videoId,
        currentTimeSeconds: 0,
        currentTimeMs: 0,
        setup_options: {
          assistant_verbosity: assistantVerbosity,
          pause_before_speaking: pauseBeforeSpeaking,
        },
        note: "No live playback has started yet",
      };

      const payload: QARequest = {
        question: query,
        video_id: params.videoId,
        session_id: sessionId || undefined,
        current_timestamp_ms: 0,
        persona: persona || undefined,
        runtime_observation_context: {
          pose_available: false,
          pose_confidence: null,
          observation_capability: "not_available",
          latest_form_error: null,
          latest_rep_event: null,
          notes: "Pre-session setup-only MediaPipe positioning guide may be available locally, but the assistant does not receive camera frames or live form telemetry, and live workout form observation is still unavailable."
        },
        session_context: fullContext
      };

      const response = await askAssistant(payload);
      setAssistantResponse(response.answer_text);
      setAskAnnouncement(`Assistant response received: ${response.answer_text}`);
      setAskInput("");
    } catch (err) {
      console.error("Assistant Q&A failed in setup:", err);
      const errMsg = err instanceof Error ? err.message : "Failed to get response from assistant.";
      setQaError(errMsg);
      setAskAnnouncement(`Assistant response failed: ${errMsg}`);
    } finally {
      setIsPending(false);
    }
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeAskQuestion(askInput);
  };

  const handleTestSleeve = async (sleeveKey: string, name: string) => {
    const side: SleeveSide = sleeveKey.startsWith("left") ? "left" : "right";
    setTestingSleeves((prev) => ({ ...prev, [sleeveKey]: true }));
    setSleeveResults((prev) => ({ ...prev, [sleeveKey]: "" }));
    setSleeveAnnouncement(`Testing ${name} haptic cue...`);

    // Note: Setup haptic tests are intentionally non-persistent. They trigger local UI/hardware feedback only
    // and do not write telemetry to the backend events history database to avoid cluttering workout reports.

    try {
      const response = await triggerHapticTest(side);
      const isHardware = response.source === "hardware";
      const resultText = isHardware ? "Pulse Fired (Hardware)" : "Pulse Simulated (Non-Physical)";
      setSleeveResults((prev) => ({ ...prev, [sleeveKey]: resultText }));
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
      await saveSetupPreferences();
      setAskAnnouncement("Settings saved as your defaults.");
      const session = await startSession(params.videoId, activeUserId);
      if (!session.id) {
        throw new Error("Backend response did not contain a valid session ID.");
      }

      // Save camera preference on starting workout if a device is selected
      if (cameraStream.selectedDeviceId) {
        const dev = cameraStream.devices.find((d: MediaDeviceInfo) => d.deviceId === cameraStream.selectedDeviceId);
        saveCameraPreference(cameraStream.selectedDeviceId, dev?.label || "");
      }

      const isVoiceListening = setupVoiceStatusRef.current === "listening" || setupVoiceStatusRef.current === "retrying";
      const queryParams = new URLSearchParams();
      queryParams.set("sessionId", session.id);
      if (isVoiceListening) {
        queryParams.set("voiceIntent", "true");
        if (typeof window !== "undefined") {
          sessionStorage.setItem("fitA11y_voiceIntent", "true");
        }
      } else {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("fitA11y_voiceIntent");
        }
      }

      window.dispatchEvent(new Event("navigation-start"));
      router.push(`/session/${params.videoId}?${queryParams.toString()}`);
    } catch (err) {
      console.error("Failed to start session:", err);
      const message = err instanceof Error ? err.message : "Failed to start assisted playback session. Please check if the backend is running.";
      setError(message);
      setIsStarting(false);
    }
  };

  // Setup Voice Commands Hook
  const setupVoice = useSetupVoiceCommands({
    requestCamera: () => cameraStream.requestCamera(),
    stopCamera: () => cameraStream.stopCamera(),
    onStartAlignment: () => setIsAlignmentOpen(true),
    onCancelAlignment: () => setIsAlignmentOpen(false),
    onRepeatGuidance: () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(currentGuidance);
        window.speechSynthesis.speak(utterance);
      }
    },
    onCancelCountdown: () => {
      setCancelCountdownTrigger((prev) => prev + 1);
    },
    onStartWorkout: () => handleStartWorkout(),
    onAskAssistant: (query) => executeAskQuestion(query),
    isAlignmentOpen,
    isCountdownActive: isSetupCountdownActive,
    isCameraStreamReady: cameraStream.status === "ready" && cameraStream.stream !== null,
    isStarting,
  });

  const setupVoiceStatusRef = useRef(setupVoice.status);
  useEffect(() => {
    setupVoiceStatusRef.current = setupVoice.status;
  }, [setupVoice.status]);

  if (isLoadingArtifacts) {
    return (
      <PageWrapper id="session-setup-loading">
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6">
          <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Loading workout settings...</h1>
          <p className="text-slate-400 text-sm">Preloading manifest, cue plan, and transcript for camera-free playback.</p>
        </div>
      </PageWrapper>
    );
  }

  if (artifactsError) {
    return (
      <PageWrapper id="session-setup-error">
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 max-w-md mx-auto">
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-full mb-4 text-red-400">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Failed to load session settings</h1>
          <p className="text-slate-400 text-sm mb-6">{artifactsError}</p>
          <Link href="/process" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sm font-bold text-white rounded-lg border border-slate-700">
            Back to Prepare Assistance
          </Link>
        </div>
      </PageWrapper>
    );
  }

  const sleeveStatus = (deviceStatuses.length > 0 ? deviceStatuses : [
    { key: "left_arm", name: "Left Arm", status_text: "Disconnected", connected: false },
    { key: "right_arm", name: "Right Arm", status_text: "Disconnected", connected: false }
  ]).map(dev => ({
    key: dev.key,
    name: dev.name,
    statusText: dev.status_text,
    colorClass: dev.connected ? "bg-emerald-500" : "bg-red-500",
  }));

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
          <SetupAudioCoexistenceSection
            pauseBeforeSpeaking={pauseBeforeSpeaking}
            setPauseBeforeSpeaking={setPauseBeforeSpeaking}
            assistantVerbosity={assistantVerbosity}
            setAssistantVerbosity={setAssistantVerbosity}
          />

          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl" aria-labelledby="setup-preferences-heading">
            <h2 id="setup-preferences-heading" className="text-lg font-bold text-white mb-2">Assistant & Voice Defaults</h2>
            <p className="text-sm text-slate-300 mb-4">These changes are saved as your defaults when you start the workout.</p>
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Assistant persona">
                {[
                  { value: "cheerleader", label: "Cheerleader" },
                  { value: "guide", label: "Guide" },
                  { value: "sergeant", label: "Sergeant" },
                ].map(({ value, label }) => (
                  <label key={value} className={`p-3 rounded-xl border cursor-pointer ${persona === value ? "border-yellow-400 bg-slate-950" : "border-slate-800"}`}>
                    <input className="mr-2" type="radio" name="setup-persona" value={value} checked={persona === value} onChange={() => setPersona(value as AssistantPersona)} />
                    {label}
                  </label>
                ))}
              </div>
              <div className="space-y-2">
                <label htmlFor="setup-tts-speed" className="text-sm font-semibold text-slate-200">Text-To-Speech Speed: {ttsSpeed.toFixed(1)}x</label>
                <input id="setup-tts-speed" className="w-full accent-yellow-400" type="range" min="0.5" max="2.5" step="0.1" value={ttsSpeed} onChange={(event) => setTtsSpeed(Number(event.target.value))} />
              </div>
              <div className="space-y-2">
                <label htmlFor="setup-voice-select" className="text-sm font-semibold text-slate-200">Speech Synthesizer Voice</label>
                <select id="setup-voice-select" value={voiceSelect} onChange={(event) => setVoiceSelect(event.target.value)} className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200">
                  <option value="system">Default System Voice</option>
                  <option value="google-us">Google US English (Male)</option>
                  <option value="google-uk">Google UK English (Female)</option>
                  <option value="natural-premium">Premium AI Natural Voice</option>
                </select>
              </div>
            </div>
          </section>

          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl" aria-labelledby="setup-haptic-preferences-heading">
            <h2 id="setup-haptic-preferences-heading" className="text-lg font-bold text-white mb-2">Haptic Defaults</h2>
            <p className="text-sm text-slate-300 mb-4">Choose the arm-sleeve cues to save as your defaults.</p>
            {isVibrationsLoading ? <p className="text-sm text-slate-400">Loading haptic choices...</p> : <HapticSettingsPanel hapticPreferences={hapticPreferences} onHapticPrefChange={handleHapticPrefChange} vibrations={vibrations} previewWav={previewWav} />}
          </section>

          <SetupSleeveStatusSection
            refreshHaptic={refreshHaptic}
            isHapticLoading={isHapticLoading}
            hapticStatus={hapticStatus}
            hapticError={hapticError}
            hapticStatusText={hapticStatusText}
            sleeveStatus={sleeveStatus}
            testingSleeves={testingSleeves}
            sleeveResults={sleeveResults}
            handleTestSleeve={handleTestSleeve}
          />

          <SetupAskAssistantSection
            handleAskQuestion={handleAskQuestion}
            askInput={askInput}
            setAskInput={setAskInput}
            isPending={isPending}
            qaError={qaError}
            assistantResponse={assistantResponse}
          />

          <SetupVoiceSection setupVoice={setupVoice} />

          <CameraAlignmentSection
            cameraStream={cameraStream}
            setIsAlignmentOpen={setIsAlignmentOpen}
          />

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
            {isCameraPositionedReady && (
              <p className="text-xs font-semibold text-emerald-400 mb-2" id="camera-positioned-msg">
                Stance is ready and confirmed.
              </p>
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

      {isAlignmentOpen && (() => {
        const firstExerciseName = manifest?.exercise_timeline_anchors?.[0]?.name || "standing";
        const poseReq = getPoseRequirementForAnchor(firstExerciseName);
        return (
          <SetupAlignmentMode
            isOpen={isAlignmentOpen}
            onClose={() => setIsAlignmentOpen(false)}
            stream={cameraStream.stream}
            requiredCameraOrientation={poseReq.cameraOrientation}
            requiredBodyOrientation={poseReq.bodyOrientation}
            onStartWorkout={handleStartWorkout}
            isStarting={isStarting}
            onReadyChange={setIsCameraPositionedReady}
            currentGuidance={currentGuidance}
            onGuidanceChange={setCurrentGuidance}
            onCountdownActiveChange={setIsSetupCountdownActive}
            cancelCountdownTrigger={cancelCountdownTrigger}
          />
        );
      })()}
    </PageWrapper>
  );
}
