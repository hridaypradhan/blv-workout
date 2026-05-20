"use client";

import React from "react";
import Link from "next/link";
import PageWrapper from "@/components/layout/PageWrapper";

interface LiveSessionProps {
  params: {
    videoId: string;
  };
}

export default function LiveSession({ params }: LiveSessionProps) {
  const handlePause = () => {
    // TODO: Pause exercise timer and AI recognition pipeline
    console.log("Pausing session for video ID:", params.videoId);
  };

  const handleSkip = () => {
    // TODO: Advance to the next exercise module in the schedule
  };

  const handleEndSession = () => {
    // TODO: Stop tracking and route to the post-session summary report
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Send input to AI coach for immediate audio-described speech response
  };

  const sleeveStatus = [
    { label: "LA", color: "bg-red-500", name: "Left Arm" },
    { label: "RA", color: "bg-red-500", name: "Right Arm" },
    { label: "LL", color: "bg-red-500", name: "Left Leg" },
    { label: "RL", color: "bg-red-500", name: "Right Leg" },
  ];

  const chatPlaceholder = [
    { sender: "coach", text: "Welcome! Stand 6 feet back. Let's start with Bodyweight Squats. Keep your chest up." },
    { sender: "user", text: "Am I deep enough?" },
    { sender: "coach", text: "A bit lower, sink your hips back. You will feel a double haptic pulse on both thigh bands when you reach parallel." },
  ];

  return (
    <PageWrapper id="live-session-wrapper">
      {/* Top Bar: Sleeve Status Strip */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl mb-6 shadow-md" aria-label="Device Status Bar">
        <span className="text-xs font-semibold text-slate-300">Live Device Calibration:</span>
        <div className="flex flex-wrap gap-3 sm:gap-4">
          {sleeveStatus.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5" title={`${s.name}: Disconnected`}>
              <span className={`w-2.5 h-2.5 rounded-full ${s.color}`} aria-hidden="true" />
              <span className="text-[10px] uppercase font-bold text-slate-400">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Camera Placeholder (4 cols) - Pushed lower on mobile using order-3 */}
        <section className="order-3 lg:order-1 lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col justify-between" aria-label="Pose Tracker Cam">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Pose Feed</h2>
          
          <div className="flex-1 min-h-[160px] md:min-h-[300px] bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center p-4 sm:p-6" aria-label="Camera feed placeholder">
            <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center text-slate-700 mb-3 animate-pulse">
              <svg
                className="w-8 h-8"
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
            </div>
            <p className="text-xs text-slate-400 font-bold mb-1">Camera Feed Active</p>
            <p className="text-[10px] text-slate-600">Local outline parsing algorithm tracking joint markers</p>
          </div>
        </section>

        {/* Center Column: Exercise Details & Rep Counter (4 cols) - Prioritized first on mobile using order-1 */}
        <section className="order-1 lg:order-2 lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col justify-between text-center" aria-label="Workout Progress Dashboard">
          <div>
            <span className="text-xs uppercase font-extrabold text-yellow-400 tracking-wider block mb-1">
              Active Exercise
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">Bodyweight Squats</h2>
          </div>
 
          {/* Large Rep Display */}
          <div className="my-4 py-6 md:my-8 md:py-8 px-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col justify-center">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">
              Reps Completed
            </span>
            <span className="text-6xl sm:text-7xl font-extrabold text-yellow-400 tracking-tight block">
              12
            </span>
            <span className="text-xs text-slate-400 mt-4 block">
              Target: 15 reps
            </span>
          </div>

          <div>
            <div className="flex justify-between items-center text-xs text-slate-400 px-2 mb-2">
              <span>Set Progress</span>
              <span>Set 2 of 3</span>
            </div>
            <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
              <div className="bg-yellow-400 h-full rounded-full w-2/3" />
            </div>
          </div>
        </section>

        {/* Right Column: AI Coach Feed (4 cols) - Positioned second on mobile using order-2 */}
        <section className="order-2 lg:order-3 lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col justify-between" aria-labelledby="chat-heading">
          <h2 id="chat-heading" className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
            AI Coach Audio Feed
          </h2>
 
          {/* Message List */}
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1 max-h-[200px] md:max-h-[280px]">
            {chatPlaceholder.map((msg, index) => (
              <div
                key={index}
                className={`p-3 rounded-2xl text-xs leading-relaxed max-w-[90%] ${
                  msg.sender === "coach"
                    ? "bg-slate-950 border border-slate-800 text-slate-350 self-start"
                    : "bg-yellow-400 text-slate-950 font-medium ml-auto"
                }`}
              >
                <p className="font-bold text-[10px] mb-1 opacity-70">
                  {msg.sender === "coach" ? "AI COACH" : "YOU"}
                </p>
                <p>{msg.text}</p>
              </div>
            ))}
          </div>

          {/* Question submission Form */}
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              placeholder="Ask the coach or say 'Pause'..."
              className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-yellow-400 rounded-xl text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400 transition-all"
              aria-label="Text or speech coach instruction input"
              id="live-chat-input"
            />
            <button
              type="submit"
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold rounded-xl text-xs border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
              id="live-chat-btn"
            >
              Send
            </button>
          </form>
        </section>
      </div>

      {/* Bottom Bar: Action buttons */}
      <section className="flex flex-wrap items-center justify-center gap-3 mt-8 pt-6 border-t border-slate-900" aria-label="Workout Controls">
        <button
          onClick={handlePause}
          className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold rounded-xl text-sm border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
          id="pause-btn"
        >
          Pause Session
        </button>
        
        <button
          onClick={handleSkip}
          className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold rounded-xl text-sm border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
          id="skip-btn"
        >
          Skip Exercise
        </button>
 
        <Link
          href={`/session/post`} // In reality redirecting to post route
          onClick={handleEndSession}
          className="px-5 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
          id="end-session-btn"
        >
          End Session & Save
        </Link>
      </section>
    </PageWrapper>
  );
}
