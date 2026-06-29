import React from "react";
import { SpeechRecognitionStatus } from "@/lib/hooks/useSpeechRecognition";

interface VoiceControlPanelProps {
  voiceStatus: SpeechRecognitionStatus;
  startVoice: () => void;
  stopVoice: () => void;
  lastTranscript: string;
  voiceError: string | null;
}

function getStatusConfig(status: SpeechRecognitionStatus) {
  switch (status) {
    case "unsupported":
      return {
        dotClass: "bg-slate-600",
        label: "Voice Unsupported",
        description: "Your browser does not support voice control.",
      };
    case "idle":
      return {
        dotClass: "bg-slate-500",
        label: "Voice Off",
        description: "Tap the microphone to start voice commands.",
      };
    case "listening":
      return {
        dotClass: "bg-emerald-400 animate-pulse",
        label: "Listening",
        description: "Mic is on — speak a command.",
      };
    case "error":
      return {
        dotClass: "bg-red-500",
        label: "Service Unavailable",
        description: "Voice recognition service failed. Manual controls still work.",
      };
  }
}

export default function VoiceControlPanel({
  voiceStatus,
  startVoice,
  stopVoice,
  lastTranscript,
  voiceError,
}: VoiceControlPanelProps) {
  const isListening = voiceStatus === "listening";
  const isUnsupported = voiceStatus === "unsupported";
  const isError = voiceStatus === "error";
  const config = getStatusConfig(voiceStatus);

  const handleToggle = () => {
    if (isListening) {
      stopVoice();
    } else {
      // Allow starting from idle or error state (retry)
      startVoice();
    }
  };

  return (
    <section
      className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl"
      aria-labelledby="voice-control-heading"
    >
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800/65">
        <h2
          id="voice-control-heading"
          className="text-sm font-bold text-slate-400 uppercase tracking-wider"
        >
          Voice Control
        </h2>
        <div className="flex items-center gap-2" aria-live="polite" aria-atomic="true">
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${config.dotClass}`}
            aria-hidden="true"
          />
          <span className="text-xs font-semibold text-slate-300">
            {config.label}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Mic toggle button */}
        <button
          type="button"
          onClick={handleToggle}
          disabled={isUnsupported}
          className={`flex items-center justify-center w-12 h-12 rounded-xl border transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 shrink-0 ${
            isListening
              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30"
              : isError
              ? "bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30"
              : isUnsupported
              ? "bg-slate-950 border-slate-800 text-slate-600 cursor-not-allowed"
              : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-slate-100"
          }`}
          id="voice-mic-btn"
          aria-label={
            isUnsupported
              ? "Voice control is not supported in this browser"
              : isListening
              ? "Microphone is on. Click to stop voice control."
              : isError
              ? "Voice control error. Click to retry."
              : "Click to start voice control"
          }
          aria-pressed={isListening}
        >
          {isListening ? (
            /* Mic-on icon */
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z"
              />
            </svg>
          ) : (
            /* Mic-off icon */
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z"
              />
              <line
                x1="3"
                y1="3"
                x2="21"
                y2="21"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400">{config.description}</p>

          {/* Last transcript */}
          {lastTranscript && voiceStatus !== "unsupported" && (
            <p
              className="text-xs text-slate-300 mt-1 truncate"
              title={lastTranscript}
            >
              <span className="text-slate-500 font-semibold">Heard: </span>
              &ldquo;{lastTranscript}&rdquo;
            </p>
          )}

          {/* Error display — voiceError is already a user-friendly mapped message */}
          {voiceError && (
            <p className="text-xs text-red-400 mt-1 font-semibold" role="alert">
              {voiceError}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
