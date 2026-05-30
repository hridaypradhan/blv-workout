"use client";

import React, { useState } from "react";
import PageWrapper from "@/components/layout/PageWrapper";

export default function Settings() {
  const [interruptionLevel, setInterruptionLevel] = useState("brief_speech");

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Persist configuration parameters to local storage / API backend
  };

  const handleTestVoice = () => {
    // TODO: Speak a short test sentence using browser SpeechSynthesis
  };

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
                { id: "p-supportive", label: "Supportive", desc: "Encouraging, reassuring, focuses on steady progress." },
                { id: "p-direct", label: "Direct", desc: "Concise corrections, anatomical landmarks, clear verbal cues." },
                { id: "p-energetic", label: "Energetic", desc: "High energy, enthusiastic, pushes pace targets." },
                { id: "p-calm", label: "Calm", desc: "Gentle tones, quiet cues, low-stimulation pacing." },
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
                      defaultChecked={p.id === "p-supportive"}
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
                  <span className="text-xs font-bold text-yellow-400">1.0x (Normal)</span>
                </div>
                <input
                  type="range"
                  id="tts-speed"
                  min="0.5"
                  max="2.5"
                  step="0.1"
                  defaultValue="1.0"
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
                    defaultValue="system"
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
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-350 font-bold rounded-xl text-xs border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
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
                  defaultChecked
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
                defaultChecked
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
                { id: "v-minimal", label: "Minimal", desc: "Short keywords: e.g., 'lower hip' or 'slow down'." },
                { id: "v-moderate", label: "Moderate", desc: "Default cue phrasing: e.g., 'Sink your hips lower' or 'Decrease your pacing speed'." },
                { id: "v-detailed", label: "Detailed", desc: "Full corrections referencing joints, risks, and movement suggestions." },
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
                      defaultChecked={verb.id === "v-moderate"}
                      className="w-4 h-4 text-yellow-400 bg-slate-900 border-slate-800 focus:ring-yellow-400"
                    />
                    <span className="text-sm font-bold text-white">{verb.label}</span>
                  </div>
                  <span className="text-xs text-slate-400 mt-2">{verb.desc}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Save Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full px-6 py-4 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold rounded-xl text-base transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 focus-visible:outline-offset-2 shadow-lg shadow-yellow-400/10"
              id="save-settings-btn"
            >
              Save Configuration Settings
            </button>
          </div>
        </form>
      </div>
    </PageWrapper>
  );
}
