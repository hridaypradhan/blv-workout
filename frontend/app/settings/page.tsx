"use client";

import React, { useState, useEffect } from "react";
import PageWrapper from "@/components/layout/PageWrapper";
import { getActiveUserId, notifyActiveUserUpdated } from "@/lib/prototypeUser";
import { updateUserSettings, getHapticVibrations } from "@/lib/api";
import { mergeUserPreferences } from "@/lib/userPreferences";
import { AssistantPersona, InterruptionLevel, AssistantVerbosity, HapticVibrationCandidate, HapticPreferences } from "@/types";
import { useUserProfile } from "@/components/layout/UserProfileContext";
import HapticSettingsPanel from "@/components/settings/HapticSettingsPanel";

export default function Settings() {
  const { user, loading } = useUserProfile();
  const [activeUserId, setActiveUserId] = useState("");
  const [isVibrationsLoading, setIsVibrationsLoading] = useState(true);

  // Settings state variables
  const [name, setName] = useState("");
  const [visionLoss, setVisionLoss] = useState("vl-blind");
  const [screenReader, setScreenReader] = useState("none");
  const [assistantPersona, setAssistantPersona] = useState("supportive");
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [voiceSelect, setVoiceSelect] = useState("system");
  const [spatialAudio, setSpatialAudio] = useState(true);
  const [pauseBeforeSpeaking, setPauseBeforeSpeaking] = useState(true);
  const [interruptionLevel, setInterruptionLevel] = useState("brief_speech");
  const [hapticFirst, setHapticFirst] = useState(true);
  const [assistantVerbosity, setAssistantVerbosity] = useState("moderate");
  const [vibrations, setVibrations] = useState<HapticVibrationCandidate[]>([]);
  const [hapticPreferences, setHapticPreferences] = useState<HapticPreferences>({
    start: "start_001",
    countdown: "countdown_001",
    per_rep_tick: "per_rep_tick_001",
    speed_up: "speed_up_001",
    slow_down: "slow_down_001",
    form_warning_above: "form_warning_above_001",
    cooldown: "cooldown_001",
  });

  // Status feedback state
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadVibrations() {
      try {
        const vList = await getHapticVibrations();
        setVibrations(vList);
      } catch (err) {
        console.error("Failed to load haptic options:", err);
      } finally {
        setIsVibrationsLoading(false);
      }
    }
    loadVibrations();
  }, []);

  useEffect(() => {
    if (user) {
      setActiveUserId(user.id || getActiveUserId());
      const prefs = mergeUserPreferences(user);
      setName(prefs.name || "");
      if (prefs.assistant_persona) {
        setAssistantPersona(prefs.assistant_persona);
      }
      if (prefs.voice_settings) {
        const vs = prefs.voice_settings as Record<string, string | number | boolean>;
        if (typeof vs.tts_rate === "number") {
          setTtsSpeed(vs.tts_rate);
        }
        if (typeof vs.voice_id === "string") {
          setVoiceSelect(vs.voice_id);
        }
        if (typeof vs.spatial_audio === "boolean") {
          setSpatialAudio(vs.spatial_audio);
        }
        if (typeof vs.haptic_first === "boolean") {
          setHapticFirst(vs.haptic_first);
        }
        if (typeof vs.vision_loss === "string") {
          setVisionLoss(vs.vision_loss);
        }
        if (typeof vs.screen_reader === "string") {
          setScreenReader(vs.screen_reader);
        }
      }
      if (prefs.audio_coexistence) {
        setInterruptionLevel(prefs.audio_coexistence.interruption_level ?? "brief_speech");
        setAssistantVerbosity(prefs.audio_coexistence.assistant_verbosity ?? "moderate");
        setPauseBeforeSpeaking(prefs.audio_coexistence.pause_before_speaking !== false);
      }
      if (prefs.haptic_preferences) {
        setHapticPreferences(prefs.haptic_preferences);
      }
    }
  }, [user]);

  const isLoading = loading || isVibrationsLoading;

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);
    setIsError(false);

    try {
      const settingsPayload = {
        name: name,
        assistant_persona: assistantPersona as AssistantPersona,
        voice_settings: {
          tts_rate: ttsSpeed,
          voice_id: voiceSelect,
          spatial_audio: spatialAudio,
          haptic_first: hapticFirst,
          vision_loss: visionLoss,
          screen_reader: screenReader,
        },
        audio_coexistence: {
          interruption_level: interruptionLevel as InterruptionLevel,
          assistant_verbosity: assistantVerbosity as AssistantVerbosity,
          pause_before_speaking: pauseBeforeSpeaking,
          correction_frequency: "medium",
        },
        haptic_preferences: hapticPreferences,
      };

      await updateUserSettings(activeUserId, settingsPayload);

      // Persist in localStorage as well
      localStorage.setItem("fita11y_haptic_preferences", JSON.stringify(hapticPreferences));

      setIsError(false);
      setStatusMessage("Configuration settings saved successfully!");
      notifyActiveUserUpdated();
    } catch (err) {
      console.error("Failed to save settings:", err);
      setIsError(true);
      setStatusMessage(err instanceof Error ? err.message : "Failed to save settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleHapticPrefChange = (cueType: string, val: string) => {
    setHapticPreferences((prev) => ({
      ...prev,
      [cueType]: val,
    }));
  };

  const previewWav = (wavUrl: string) => {
    if (typeof window !== "undefined") {
      const audio = new Audio(wavUrl);
      audio.play().catch((err) => console.warn("Audio preview failed:", err));
    }
  };

  const handleTestVoice = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const text = `This is a test of the ${assistantPersona} assistant voice at rate ${ttsSpeed}.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = ttsSpeed;
      window.speechSynthesis.speak(utterance);
    }
  };

  if (isLoading) {
    return (
      <PageWrapper id="settings-loading-wrapper">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
          <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Loading Settings</h2>
          <p className="text-sm text-slate-400">Loading your accessibility preferences...</p>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper id="settings-page-wrapper">
      <div className="max-w-3xl mx-auto py-4">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-white">Accessibility & Preferences</h1>
          <p className="text-slate-400 text-sm mt-1">
            Customize assistant voices, audio coexistence, and supplementary cue frequencies.
          </p>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-8">
          {/* Section 0: Profile & Accessibility Basics */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl" aria-labelledby="profile-basics-heading">
            <h2 id="profile-basics-heading" className="text-xl font-bold text-white mb-2">
              Profile & Accessibility Basics
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              Update your name, degree of vision loss, and screen reader preferences.
            </p>

            <div className="space-y-6">
              {/* Name Input */}
              <div className="space-y-2">
                <label htmlFor="user-name" className="block text-sm font-semibold text-slate-200">
                  Full Name / Preferred Name
                </label>
                <input
                  type="text"
                  id="user-name"
                  required
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-yellow-400 rounded-xl text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400 transition-all"
                />
              </div>

              {/* Degree of Vision Loss */}
              <div className="space-y-3">
                <span className="block text-sm font-semibold text-slate-200" id="vision-loss-label">
                  Degree of Vision Loss
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-labelledby="vision-loss-label">
                  {[
                    { id: "vl-blind", label: "Totally Blind", desc: "Primarily relies on Speech & Haptic responses" },
                    { id: "vl-legal", label: "Legally Blind", desc: "High-contrast guides & Audio descriptions" },
                    { id: "vl-low", label: "Moderate Low Vision", desc: "Large fonts, scaling, & outline guidance" },
                    { id: "vl-mild", label: "Mild Low Vision", desc: "Slight text adjustments & voice cues" },
                  ].map((level) => (
                    <label
                      key={level.id}
                      htmlFor={level.id}
                      className={`relative flex flex-col p-4 rounded-xl cursor-pointer select-none transition-all duration-200 focus-within:ring-2 focus-within:ring-yellow-400 ${
                        visionLoss === level.id
                          ? "bg-slate-950 border-2 border-yellow-400"
                          : "bg-slate-950 border border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          id={level.id}
                          name="vision-loss"
                          value={level.id}
                          checked={visionLoss === level.id}
                          onChange={(e) => setVisionLoss(e.target.value)}
                          className="w-4 h-4 text-yellow-400 bg-slate-900 border-slate-800 focus:ring-yellow-400 focus:ring-offset-slate-950"
                        />
                        <span className="text-sm font-bold text-white">{level.label}</span>
                      </div>
                      <span className="text-xs text-slate-400 mt-1 pl-7">{level.desc}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Screen Reader Dropdown */}
              <div className="space-y-2">
                <label htmlFor="screen-reader-select" className="block text-sm font-semibold text-slate-200">
                  Primary Screen Reader Helper
                </label>
                <select
                  id="screen-reader-select"
                  value={screenReader}
                  onChange={(e) => setScreenReader(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-yellow-400 rounded-xl text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400 transition-all cursor-pointer"
                >
                  <option value="none">None / Standard Audio Synthesis Only</option>
                  <option value="voiceover">Apple VoiceOver</option>
                  <option value="nvda">NVDA (NonVisual Desktop Access)</option>
                  <option value="jaws">JAWS (Job Access With Speech)</option>
                  <option value="talkback">Android TalkBack</option>
                  <option value="other">Other Screen Reader</option>
                </select>
              </div>
            </div>
          </section>

          {/* Section 1: Assistant Persona */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl" aria-labelledby="persona-heading">
            <h2 id="persona-heading" className="text-xl font-bold text-white mb-2">
              Assistant Persona
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              Choose the vocal style of FitA11y&apos;s assistant. This does not affect the creator&apos;s YouTube trainer audio.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" role="radiogroup" aria-labelledby="persona-heading">
              {[
                { id: "supportive", label: "Supportive", desc: "Encouraging, reassuring, focuses on steady progress." },
                { id: "direct", label: "Direct", desc: "Concise corrections, anatomical landmarks, clear verbal cues." },
                { id: "energetic", label: "Energetic", desc: "High energy, enthusiastic, pushes pace targets." },
                { id: "calm", label: "Calm", desc: "Gentle tones, quiet cues, low-stimulation pacing." },
              ].map((p) => (
                <label
                  key={p.id}
                  htmlFor={p.id}
                  className="relative flex flex-col p-5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl cursor-pointer select-none transition-all focus-within:ring-2 focus-within:ring-yellow-400"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      id={p.id}
                      name="assistant-persona"
                      value={p.id}
                      checked={assistantPersona === p.id}
                      onChange={(e) => setAssistantPersona(e.target.value)}
                      className="w-4 h-4 text-yellow-400 bg-slate-900 border-slate-800 focus:ring-yellow-400 focus:ring-offset-slate-950"
                    />
                    <span className="text-sm font-bold text-white">{p.label}</span>
                  </div>
                  <span className="text-xs text-slate-400 mt-2">{p.desc}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Section 2: Voice & Coexistence Settings */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl" aria-labelledby="voice-heading">
            <h2 id="voice-heading" className="text-xl font-bold text-white mb-6">
              Voice & Coexistence
            </h2>

            <div className="space-y-6">
              {/* TTS Speed Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="tts-speed" className="text-sm font-semibold text-slate-200">
                    Text-To-Speech Speed (Rate)
                  </label>
                  <span className="text-xs font-bold text-yellow-400">{ttsSpeed.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  id="tts-speed"
                  min="0.5"
                  max="2.5"
                  step="0.1"
                  value={ttsSpeed}
                  onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
                  className="w-full accent-yellow-400 bg-slate-950 h-2 rounded-lg cursor-pointer"
                />
              </div>

              {/* Voice Selector */}
              <div className="space-y-2">
                <label htmlFor="voice-select" className="block text-sm font-semibold text-slate-200">
                  Speech Synthesizer Voice
                </label>
                <div className="flex gap-3">
                  <select
                    id="voice-select"
                    value={voiceSelect}
                    onChange={(e) => setVoiceSelect(e.target.value)}
                    className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-yellow-400 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400 transition-all cursor-pointer"
                  >
                    <option value="system">Default System Voice</option>
                    <option value="google-us">Google US English (Male)</option>
                    <option value="google-uk">Google UK English (Female)</option>
                    <option value="natural-premium">Premium AI Natural Voice</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleTestVoice}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 hover:text-white font-bold rounded-xl text-xs border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
                    id="test-voice-btn"
                  >
                    Test Voice
                  </button>
                </div>
              </div>

              {/* Spatial Audio Toggle */}
              <div className="flex items-center justify-between gap-4 p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                <div className="flex flex-col gap-0.5">
                  <label htmlFor="spatial-audio-toggle" className="text-sm font-bold text-slate-200 cursor-pointer">
                    Spatial Stereo Audio
                  </label>
                  <span className="text-xs text-slate-400">Pans audio correction to left/right speakers to match arm/leg positions.</span>
                </div>
                <input
                  type="checkbox"
                  id="spatial-audio-toggle"
                  checked={spatialAudio}
                  onChange={(e) => setSpatialAudio(e.target.checked)}
                  className="w-10 h-5 bg-slate-900 border-slate-800 text-yellow-400 focus:ring-yellow-400 rounded-full cursor-pointer accent-yellow-400"
                />
              </div>

              {/* Pause Before Speaking Toggle */}
              <div className="flex items-center justify-between gap-4 p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                <div className="flex flex-col gap-0.5">
                  <label htmlFor="pause-before-speaking" className="text-sm font-bold text-slate-200 cursor-pointer">
                    Pause Before Speaking
                  </label>
                  <span className="text-xs text-slate-400">Briefly pauses the YouTube video when the assistant speaks a correction.</span>
                </div>
                <input
                  type="checkbox"
                  id="pause-before-speaking"
                  checked={pauseBeforeSpeaking}
                  onChange={(e) => setPauseBeforeSpeaking(e.target.checked)}
                  className="w-10 h-5 bg-slate-900 border-slate-800 text-yellow-400 focus:ring-yellow-400 rounded-full cursor-pointer accent-yellow-400"
                />
              </div>
            </div>
          </section>

          {/* Section 3: Interruption Level & Correction Frequency */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl" aria-labelledby="frequency-heading">
            <h2 id="frequency-heading" className="text-xl font-bold text-white mb-2">
              Correction Frequency & Interruption Level
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              Configure how the assistant coexists with or interrupts the original trainer&apos;s audio.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {[
                { id: "int-silent", value: "silent", label: "Silent", desc: "No voice feedback. Playback is entirely uninterrupted." },
                { id: "int-haptic", value: "haptic_only", label: "Haptic Only", desc: "Vibration cues on sleeves. Speech is fully silenced." },
                { id: "int-brief", value: "brief_speech", label: "Brief Speech", desc: "Short correction words only during clear speech gaps." },
                { id: "int-full", value: "full_speech", label: "Full Speech", desc: "Ducks YouTube audio to deliver complete form guidance." },
              ].map((lvl) => (
                <label
                  key={lvl.id}
                  htmlFor={lvl.id}
                  className="relative flex flex-col p-4 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl cursor-pointer select-none transition-all focus-within:ring-2 focus-within:ring-yellow-400"
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
                  <span className="text-xs text-slate-400 mt-1.5">{lvl.desc}</span>
                </label>
              ))}
            </div>

            {/* Haptic-First Mode Toggle */}
            <div className="flex items-center justify-between gap-4 p-4 bg-slate-950 border border-slate-800 rounded-2xl">
              <div className="flex flex-col gap-0.5">
                <label htmlFor="haptic-first-toggle" className="text-sm font-bold text-slate-200 cursor-pointer">
                  Haptic-First Mode
                </label>
                <span className="text-xs text-slate-400">Deliver all posture adjustments via haptic sleeve ticks first, only speaking if you don&apos;t adjust.</span>
              </div>
              <input
                type="checkbox"
                id="haptic-first-toggle"
                checked={hapticFirst}
                onChange={(e) => setHapticFirst(e.target.checked)}
                className="w-10 h-5 bg-slate-900 border-slate-800 text-yellow-400 focus:ring-yellow-400 rounded-full cursor-pointer accent-yellow-400"
              />
            </div>
          </section>

          {/* Section 4: Assistant Verbosity Level */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl" aria-labelledby="verbosity-heading">
            <h2 id="verbosity-heading" className="text-xl font-bold text-white mb-2">
              Assistant Verbosity
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              Set how descriptive or brief the vocal cues are when spoken.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4" role="radiogroup" aria-labelledby="verbosity-heading">
              {[
                { id: "minimal", label: "Minimal", desc: "Short keywords: e.g., 'lower hip' or 'slow down'." },
                { id: "moderate", label: "Moderate", desc: "Default cue phrasing: e.g., 'Sink your hips lower' or 'Decrease your pacing speed'." },
                { id: "detailed", label: "Detailed", desc: "Full corrections referencing joints, risks, and movement suggestions." },
              ].map((verb) => (
                <label
                  key={verb.id}
                  htmlFor={verb.id}
                  className="relative flex flex-col p-4 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl cursor-pointer select-none transition-all focus-within:ring-2 focus-within:ring-yellow-400"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      id={verb.id}
                      name="assistant-verbosity"
                      value={verb.id}
                      checked={assistantVerbosity === verb.id}
                      onChange={(e) => setAssistantVerbosity(e.target.value)}
                      className="w-4 h-4 text-yellow-400 bg-slate-900 border-slate-800 focus:ring-yellow-400"
                    />
                    <span className="text-sm font-bold text-white">{verb.label}</span>
                  </div>
                  <span className="text-xs text-slate-400 mt-2">{verb.desc}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Section 5: bHaptics Mapping & Event Preview */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl" aria-labelledby="haptic-pref-heading">
            <h2 id="haptic-pref-heading" className="text-xl font-bold text-white mb-2">
              bHaptics Mapping & Settings Preview
            </h2>
            <div className="text-xs text-slate-400 mb-6 space-y-2">
              <p>
                Each assistive workout cue category maps to a neutral, product-independent bHaptics event name.
              </p>
              <p>
                If physical sleeves are connected to your bHaptics Player, they will receive the event triggers directly.
                Otherwise, the app will gracefully fall back to showing visual and spoken accessibility indicators in the session.
              </p>
              <p className="text-slate-500 font-medium">
                Note: Audio preview of source WAV plays in your browser as an optional/secondary preview of the original WAV candidate. It is not the physical sleeve delivery mechanism.
              </p>
            </div>

            <HapticSettingsPanel
              hapticPreferences={hapticPreferences}
              onHapticPrefChange={handleHapticPrefChange}
              vibrations={vibrations}
              previewWav={previewWav}
            />
          </section>

          {statusMessage && (
            <div
              className={`p-4 rounded-xl text-sm font-medium ${isError ? 'bg-red-500/10 border border-red-500/30 text-red-400' : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'}`}
              role="status"
              aria-live="polite"
            >
              {statusMessage}
            </div>
          )}

          {/* Save Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full px-6 py-4 bg-yellow-400 hover:bg-yellow-300 disabled:bg-yellow-800 disabled:text-slate-400 text-slate-950 font-bold rounded-xl text-base transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 focus-visible:outline-offset-2 shadow-lg shadow-yellow-400/10"
              id="save-settings-btn"
            >
              {isSaving ? "Saving..." : "Save Configuration Settings"}
            </button>
          </div>
        </form>
      </div>
    </PageWrapper>
  );
}
