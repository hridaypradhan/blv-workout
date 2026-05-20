"use client";

import React from "react";
import PageWrapper from "@/components/layout/PageWrapper";

export default function Settings() {
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
            Customize voice parameters, haptic feedback density, and coach personalities.
          </p>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-8">
          {/* Section 1: Coach Persona */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl" aria-labelledby="persona-heading">
            <h2 id="persona-heading" className="text-xl font-bold text-white mb-2">
              Coach Persona
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              Choose the tone of voice guidance and encouragement during exercise.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4" role="radiogroup" aria-labelledby="persona-heading">
              {[
                { id: "p-hype", label: "Hype", desc: "High energy, enthusiastic, pushes thresholds." },
                { id: "p-tech", label: "Technical", desc: "Detailed corrections, precise angles, calm cues." },
                { id: "p-support", label: "Supportive", desc: "Encouraging, gentle pacing, focuses on comfort." },
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
                      name="coach-persona"
                      value={p.id}
                      className="w-4 h-4 text-yellow-400 bg-slate-900 border-slate-800 focus:ring-yellow-400 focus:ring-offset-slate-950"
                    />
                    <span className="text-sm font-bold text-white">{p.label}</span>
                  </div>
                  <span className="text-xs text-slate-400 mt-2">{p.desc}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Section 2: Voice Settings */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl" aria-labelledby="voice-heading">
            <h2 id="voice-heading" className="text-xl font-bold text-white mb-6">
              Voice Settings
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
                  className="w-10 h-5 bg-slate-900 border-slate-800 text-yellow-400 focus:ring-yellow-400 rounded-full cursor-pointer accent-yellow-400"
                />
              </div>
            </div>
          </section>

          {/* Section 3: Feedback Frequency */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl" aria-labelledby="frequency-heading">
            <h2 id="frequency-heading" className="text-xl font-bold text-white mb-2">
              Feedback Frequency
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              Control how frequently the AI interrupts you with haptic ticks or speech updates.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4" role="radiogroup" aria-labelledby="frequency-heading">
              {[
                { id: "f-high", label: "High Frequency", desc: "Ticks every rep, speaks posture tips continuously." },
                { id: "f-med", label: "Medium Frequency", desc: "Default. Speaks only on error corrections." },
                { id: "f-low", label: "Low Frequency", desc: "Alerts only for severe safety posture failures." },
              ].map((freq) => (
                <label
                  key={freq.id}
                  htmlFor={freq.id}
                  className="relative flex flex-col p-5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl cursor-pointer select-none transition-all focus-within:ring-2 focus-within:ring-yellow-400"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      id={freq.id}
                      name="feedback-frequency"
                      value={freq.id}
                      className="w-4 h-4 text-yellow-400 bg-slate-900 border-slate-800 focus:ring-yellow-400 focus:ring-offset-slate-950"
                    />
                    <span className="text-sm font-bold text-white">{freq.label}</span>
                  </div>
                  <span className="text-xs text-slate-400 mt-2">{freq.desc}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Section 4: Description Detail */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl" aria-labelledby="detail-heading">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <h2 id="detail-heading" className="text-xl font-bold text-white">
                  Description Detail
                </h2>
                <span className="text-xs text-slate-400">
                  Switch between short summaries and full verbal breakdowns of movement errors.
                </span>
              </div>
              <input
                type="checkbox"
                id="desc-detail-toggle"
                className="w-10 h-5 bg-slate-900 border-slate-800 text-yellow-400 focus:ring-yellow-400 rounded-full cursor-pointer accent-yellow-400"
              />
            </div>
          </section>

          {/* Save Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full px-6 py-4 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold rounded-xl text-base transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 focus-visible:outline-offset-2"
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
