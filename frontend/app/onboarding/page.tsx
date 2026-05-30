"use client";

import React from "react";
import Link from "next/link";
import PageWrapper from "@/components/layout/PageWrapper";

export default function Onboarding() {
  const handleSubmitProfile = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Save user profile configuration
  };

  const handlePairSleeve = (slot: string) => {
    // TODO: Trigger Web Bluetooth pairing flow for the specific sleeve slot (e.g. Left Arm, Right Arm)
    console.log("Pairing haptic sleeve for slot:", slot);
  };

  return (
    <PageWrapper id="onboarding-page-wrapper">
      <div className="max-w-3xl mx-auto py-4">
        {/* Header */}
        <div className="mb-8 text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-2">
            Setup FitA11y
          </h1>
          <p className="text-slate-400">
            Follow these steps to tailor your assistive companion preferences and pair your haptic feedback sleeves.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {/* Step 1: Profile Form */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl" aria-labelledby="step1-heading">
            <div className="flex items-center gap-3 mb-6">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-400 text-slate-950 font-bold text-sm" aria-hidden="true">
                1
              </span>
              <h2 id="step1-heading" className="text-2xl font-bold text-white">
                Configure Profile & Audio Coexistence
              </h2>
            </div>

            <form onSubmit={handleSubmitProfile} className="space-y-6">
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
                      className="relative flex flex-col p-4 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl cursor-pointer select-none transition-all duration-200 focus-within:ring-2 focus-within:ring-yellow-400"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          id={level.id}
                          name="vision-loss"
                          value={level.id}
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
                  defaultValue="none"
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

              {/* Submit button */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full px-6 py-3.5 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold rounded-xl text-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 focus-visible:outline-offset-2"
                  id="save-profile-btn"
                >
                  Save Profile Settings
                </button>
              </div>
            </form>
          </section>

          {/* Step 2: Sleeve Pairing */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl" aria-labelledby="step2-heading">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-400 text-slate-950 font-bold text-sm" aria-hidden="true">
                2
              </span>
              <h2 id="step2-heading" className="text-2xl font-bold text-white">
                Pair Haptic Sleeves via Bluetooth
              </h2>
            </div>
            
            <p className="text-sm text-slate-400 mb-6">
              Connect sleeve sensors to enable localized feedback vibrations during workouts. Enable Bluetooth on your system before pairing.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: "left-arm", name: "Left Arm Sleeve" },
                { key: "right-arm", name: "Right Arm Sleeve" },
                { key: "left-leg", name: "Left Leg Band" },
                { key: "right-leg", name: "Right Leg Band" },
              ].map((slot) => (
                <div
                  key={slot.key}
                  className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl transition-all"
                  aria-label={`${slot.name} status details`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-200">{slot.name}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500" aria-hidden="true" />
                      <span className="text-xs text-slate-400 font-medium">Disconnected</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handlePairSleeve(slot.key)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 font-semibold rounded-xl text-xs border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
                    aria-label={`Pair Bluetooth device for ${slot.name}`}
                    id={`pair-btn-${slot.key}`}
                  >
                    Pair Slot
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Quick Dashboard Action */}
          <div className="flex justify-between items-center py-2">
            <Link
              href="/dashboard"
              className="w-full inline-flex items-center justify-center px-6 py-3.5 text-base font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 focus-visible:outline-offset-2"
              id="skip-onboarding-btn"
            >
              Skip Onboarding, Go to Dashboard
              <svg
                className="w-4 h-4 ml-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
