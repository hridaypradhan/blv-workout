"use client";

import React, { useState } from "react";
import Link from "next/link";
import PageWrapper from "@/components/layout/PageWrapper";

interface LiveSessionProps {
  params: {
    videoId: string;
  };
}

export default function LiveSession({ params }: LiveSessionProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [assistantMuted, setAssistantMuted] = useState(false);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
    console.log("Toggling playback for video ID:", params.videoId);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    console.log("Setting playback speed to:", speed);
  };

  const handleRewind = () => {
    console.log("Rewinding playback by 10 seconds");
  };

  const handleRepeatTrainerInstruction = () => {
    console.log("Seeking to latest trainer_instruction_event");
  };

  const handleSkipSection = () => {
    console.log("Skipping to next exercise timeline anchor");
  };

  const handleEndSession = () => {
    console.log("Ending session and saving summary");
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Send query to assistant for playback-aware Q&A response
  };

  const sleeveStatus = [
    { label: "LA", color: "bg-red-500", name: "Left Arm" },
    { label: "RA", color: "bg-red-500", name: "Right Arm" },
    { label: "LL", color: "bg-red-500", name: "Left Leg" },
    { label: "RL", color: "bg-red-500", name: "Right Leg" },
  ];

  const chatPlaceholder = [
    { sender: "assistant", text: "Welcome! Stand 6 feet back. We are starting with Bodyweight Squats from the YouTube trainer." },
    { sender: "user", text: "Am I deep enough?" },
    { sender: "assistant", text: "A bit lower, sink your hips back. You will feel a double haptic pulse on both thigh bands when you reach parallel." },
  ];

  return (
    <PageWrapper id="live-session-wrapper">
      {/* Top Bar: Sleeve Calibration & Device Strip */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl mb-6 shadow-md" aria-label="Device Status Bar">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-xs font-semibold text-slate-300">Live Device Calibration & Tracking Connected</span>
        </div>
        <div className="flex flex-wrap gap-3 sm:gap-4">
          {sleeveStatus.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5" title={`${s.name}: Calibrating`}>
              <span className={`w-2 h-2 rounded-full bg-yellow-400`} aria-hidden="true" />
              <span className="text-[10px] uppercase font-bold text-slate-400">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left/Center Column: YouTube Embedded Player & Playback Controls (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col justify-between" aria-label="Embedded Trainer Video Player">
            <div className="flex justify-between items-center mb-4">
              <div>
                <span className="text-xs uppercase font-extrabold text-red-500 tracking-wider block mb-0.5">
                  Original YouTube Trainer Playback
                </span>
                <h2 className="text-lg font-bold text-white">Beginner Squats & Lunges Alignment</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Speed: {playbackSpeed}x</span>
              </div>
            </div>

            {/* YouTube IFrame Placeholder Panel */}
            <div className="relative aspect-video bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center p-6 mb-6 overflow-hidden">
              {/* Fake video screen */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60 z-10" />
              
              {/* Playback Status Overlay */}
              <div className="z-20 flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-slate-900/80 backdrop-blur border border-slate-800 flex items-center justify-center text-yellow-400 hover:text-yellow-300 hover:scale-105 transition-all cursor-pointer shadow-2xl" onClick={handlePlayPause}>
                  {isPlaying ? (
                    <svg className="w-10 h-10 fill-current" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                    </svg>
                  ) : (
                    <svg className="w-10 h-10 fill-current translate-x-0.5" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">YouTube IFrame Video Placeholder</p>
                  <p className="text-xs text-slate-400 mt-1">Playing original workout video by creator</p>
                </div>
              </div>

              {/* Fake Progress Bar */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800 z-20">
                <div className="h-full bg-red-600 transition-all duration-1000" style={{ width: isPlaying ? "35%" : "35%" }} />
              </div>
            </div>

            {/* In-App Playback Adjustments (v2 specific controls) */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-800/60 pt-4" aria-label="Playback Options">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRewind}
                  className="px-3.5 py-2 bg-slate-850 hover:bg-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-800 transition-all flex items-center gap-1.5"
                  title="Rewind 10 seconds"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z"/>
                  </svg>
                  Rewind 10s
                </button>

                <button
                  onClick={() => handleSpeedChange(playbackSpeed === 1.0 ? 0.75 : 1.0)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    playbackSpeed === 0.75
                      ? "bg-yellow-400 text-slate-950 border-yellow-400"
                      : "bg-slate-850 hover:bg-slate-800 text-slate-200 hover:text-white border-slate-800"
                  }`}
                >
                  {playbackSpeed === 0.75 ? "Normal Speed (1.0x)" : "Slow Down (0.75x)"}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRepeatTrainerInstruction}
                  className="px-3.5 py-2 bg-slate-850 hover:bg-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-800 transition-all flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                  Repeat Last Trainer Instruction
                </button>

                <button
                  onClick={() => setAssistantMuted(!assistantMuted)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    assistantMuted
                      ? "bg-red-500/10 text-red-400 border-red-500/30"
                      : "bg-slate-850 hover:bg-slate-800 text-slate-200 hover:text-white border-slate-800"
                  }`}
                >
                  {assistantMuted ? "Unmute Assistant" : "Mute Assistant"}
                </button>
              </div>
            </div>
          </section>

          {/* Bottom Pose Feed Panel */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex items-center justify-between" aria-label="Pose Tracker Cam">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">Live Pose Tracker Active</h3>
                <p className="text-[10px] text-slate-500">Camera feed tracks body joint angles to trigger supplementary haptics.</p>
              </div>
            </div>
            <div className="text-xs text-emerald-400 font-semibold px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
              Tracking Body
            </div>
          </section>
        </div>

        {/* Right Column: Tracked Performance & Assistant Cue Feed (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Active Exercise & Performance display */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col justify-between text-center" aria-label="Tracked Performance Dashboard">
            <div>
              <span className="text-xs uppercase font-extrabold text-yellow-400 tracking-wider block mb-1">
                Active Exercise Section
              </span>
              <h2 className="text-xl font-bold text-white mb-2">Bodyweight Squats</h2>
            </div>
   
            {/* Large Rep Display */}
            <div className="my-4 py-4 px-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col justify-center">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-1">
                Your Tracked Performance
              </span>
              <span className="text-5xl font-extrabold text-yellow-400 tracking-tight block">
                12
              </span>
              <span className="text-xs text-slate-400 mt-2 block">
                Assistant Tracking Target: 15 reps
              </span>
            </div>

            <div>
              <div className="flex justify-between items-center text-xs text-slate-400 px-1 mb-1.5">
                <span>Section Progress</span>
                <span>Set 2 of 3</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                <div className="bg-yellow-400 h-full rounded-full w-2/3" />
              </div>
            </div>
          </section>

          {/* Assistant Cue Feed panel */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl flex-1 flex flex-col justify-between min-h-[300px]" aria-labelledby="assistant-feed-heading">
            <div>
              <h2 id="assistant-feed-heading" className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
                Assistant Cue Feed
              </h2>
    
              {/* Message List */}
              <div className="space-y-4 mb-4 pr-1 max-h-[220px] lg:max-h-[320px] overflow-y-auto">
                {chatPlaceholder.map((msg, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-2xl text-xs leading-relaxed max-w-[90%] ${
                      msg.sender === "assistant"
                        ? "bg-slate-950 border border-slate-800 text-slate-300 self-start"
                        : "bg-yellow-400 text-slate-950 font-medium ml-auto"
                    }`}
                  >
                    <p className="font-bold text-[10px] mb-1 opacity-70">
                      {msg.sender === "assistant" ? "ASSISTANT" : "YOU"}
                    </p>
                    <p>{msg.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Question submission Form */}
            <form onSubmit={handleSendMessage} className="flex gap-2 border-t border-slate-800/80 pt-4">
              <input
                type="text"
                placeholder="Ask assistant about movement setup..."
                className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-yellow-400 rounded-xl text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400 transition-all"
                aria-label="Ask assistant for verbal clarification"
                id="live-chat-input"
              />
              <button
                type="submit"
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold rounded-xl text-xs border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
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
          onClick={handlePlayPause}
          className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold rounded-xl text-sm border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
          id="pause-btn"
        >
          {isPlaying ? "Pause Playback" : "Resume Playback"}
        </button>
        
        <button
          onClick={handleSkipSection}
          className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold rounded-xl text-sm border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
          id="skip-btn"
        >
          Skip to Next Section
        </button>
 
        <Link
          href={`/history`}
          onClick={handleEndSession}
          className="px-5 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
          id="end-session-btn"
        >
          End & Save Session
        </Link>
      </section>
    </PageWrapper>
  );
}
