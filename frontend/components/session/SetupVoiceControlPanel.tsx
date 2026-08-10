"use client";

import React from "react";
import { SpeechRecognitionStatus } from "@/lib/hooks/useSpeechRecognition";

export interface SetupVoiceControlPanelProps {
  status: SpeechRecognitionStatus;
  announcement: string | null;
  errorMessage: string | null;
  startListening: () => void;
  stopListening: () => void;
}

export function SetupVoiceControlPanel({
  status,
  announcement,
  errorMessage,
  startListening,
  stopListening,
}: SetupVoiceControlPanelProps) {
  const getStatusColor = () => {
    switch (status) {
      case "listening":
        return "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
      case "retrying":
        return "bg-amber-500/10 border-amber-500/30 text-amber-400";
      case "blocked":
        return "bg-red-500/10 border-red-500/30 text-red-400";
      case "error":
        return "bg-red-500/10 border-red-500/30 text-red-400";
      case "unsupported":
        return "bg-slate-950 border-slate-800 text-slate-500";
      default:
        return "bg-slate-950 border-slate-800 text-slate-300";
    }
  };

  const getStatusLabelText = () => {
    switch (status) {
      case "listening":
        return "Listening for setup commands...";
      case "retrying":
        return "Re-connecting voice control...";
      case "blocked":
        return "Voice permission is blocked in browser.";
      case "error":
        return "Voice error. Try clicking the button again.";
      case "unsupported":
        return "Browser Speech Recognition unsupported.";
      default:
        return "Voice controls offline.";
    }
  };

  return (
    <section
      className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4"
      aria-labelledby="setup-voice-heading"
    >
      <div>
        <h2 id="setup-voice-heading" className="text-lg font-bold text-white mb-1">
          Hands-Free Setup Voice Controls
        </h2>
        <p className="text-xs text-slate-400 leading-normal">
          Enhance your setup experience with voice commands. Note: Browser-based speech recognition
          can be browser-dependent and may not work in all environments. Manual buttons and keyboard
          focus remain the fully supported fallback.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Toggle Button */}
        <div className="flex gap-2">
          {status === "listening" ? (
            <button
              type="button"
              onClick={stopListening}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold rounded-xl text-sm border border-slate-700 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
              aria-label="Stop setup voice controls"
            >
              Stop Voice Control
            </button>
          ) : (
            <button
              type="button"
              onClick={startListening}
              disabled={status === "unsupported"}
              className="px-4 py-2.5 bg-yellow-500 hover:bg-yellow-450 disabled:bg-slate-900 disabled:text-slate-500 text-slate-950 font-bold rounded-xl text-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
              aria-label="Start setup voice controls"
            >
              Enable Setup Voice Control
            </button>
          )}
        </div>

        {/* Status Indicator */}
        <div className={`px-4 py-2.5 rounded-xl border text-xs font-semibold ${getStatusColor()}`}>
          {getStatusLabelText()}
        </div>
      </div>

      {/* Voice Announcement Area */}
      {announcement && (
        <div
          aria-live="polite"
          className="p-3 bg-slate-950 border border-slate-850 rounded-xl text-xs font-mono text-slate-400"
        >
          <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">
            Voice Command Log
          </span>
          {announcement}
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div
          role="alert"
          className="p-3 bg-red-950/40 border border-red-500/20 rounded-xl text-xs text-red-400"
        >
          {errorMessage}
        </div>
      )}

      {/* Command Reference Guide for Screen Readers & Users */}
      <div className="text-[11px] text-slate-500 space-y-1">
        <span className="font-bold text-slate-400 block">Supported Commands:</span>
        <p>
          Camera: <code className="text-slate-400">&quot;Enable camera&quot;</code>,{" "}
          <code className="text-slate-400">&quot;Stop camera&quot;</code>
        </p>
        <p>
          Alignment: <code className="text-slate-400">&quot;Start alignment&quot;</code>,{" "}
          <code className="text-slate-400">&quot;Cancel alignment&quot; / &quot;Return to setup&quot;</code>,{" "}
          <code className="text-slate-400">&quot;Repeat guidance&quot;</code>
        </p>
        <p>
          Countdown: <code className="text-slate-400">&quot;Cancel countdown&quot;</code>
        </p>
        <p>
          Workout: <code className="text-slate-400">&quot;Start workout&quot;</code>
        </p>
      </div>
    </section>
  );
}
