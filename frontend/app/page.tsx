"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import PageWrapper from "@/components/layout/PageWrapper";

export default function Home() {
  const router = useRouter();

  const handleQuickConnect = () => {
    // TODO: Quick haptic sleeve connection trigger
  };

  const handleQuickSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = document.getElementById("quick-submit-input") as HTMLInputElement;
    if (input && input.value) {
      router.push(`/process?url=${encodeURIComponent(input.value)}`);
    }
  };

  return (
    <PageWrapper id="dashboard-wrapper">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 md:p-12 mb-6 md:mb-8 shadow-2xl">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-400/5 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="relative max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-xs font-semibold uppercase tracking-wider mb-6">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            Next Generation A11y
          </div>
          
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mb-6">
            Welcome to <span className="bg-gradient-to-r from-yellow-400 to-amber-300 bg-clip-text text-transparent">FitA11y</span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-300 font-medium mb-8 leading-relaxed">
            An assistive playback companion for blind and low vision users. Pair your favorite YouTube trainers with supplementary audio assistance, form correction cues, and spatial haptic feedback.
          </p>

          <div className="flex flex-wrap gap-4">
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center px-6 py-3.5 text-base font-bold bg-yellow-400 text-slate-950 hover:bg-yellow-300 rounded-xl transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 focus-visible:outline-offset-2 shadow-lg shadow-yellow-400/10"
              id="get-started-btn"
            >
              Get Started
              <svg
                className="w-5 h-5 ml-2"
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
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </Link>

            <button
              onClick={handleQuickConnect}
              className="inline-flex items-center justify-center px-6 py-3.5 text-base font-semibold bg-slate-800 text-slate-100 hover:bg-slate-700 hover:text-white border border-slate-700 rounded-xl transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 focus-visible:outline-offset-2"
              aria-label="Quick Connect Haptic Device"
              id="hero-quick-connect-btn"
            >
              Pair Haptic Sleeve
            </button>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8" aria-label="Key Features">
        {/* Feature 1 */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all duration-200">
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-yellow-400 mb-4 border border-slate-700">
            <svg
              className="w-5 h-5"
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
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Assistive Audio Companion</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Brief, contextual voice notifications that call out pacing adaptations, form risks, and motivation without talking over the YouTube trainer.
          </p>
        </div>

        {/* Feature 2 */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all duration-200">
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-yellow-400 mb-4 border border-slate-700">
            <svg
              className="w-5 h-5"
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
                d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Haptic Spatial Feedback</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Pairs with Bluetooth-enabled haptic sleeves to send vibration pulses guiding you on speed, extensions, and movement corrections.
          </p>
        </div>

        {/* Feature 3 */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all duration-200">
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-yellow-400 mb-4 border border-slate-700">
            <svg
              className="w-5 h-5"
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
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 00-2 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Smart Progress Tracking</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Maintains structured session records, tracking progress trends, session durations, and accuracy levels for screen readers.
          </p>
        </div>
      </section>

      {/* Quick Search/Actions Panel */}
      <section className="p-6 rounded-2xl bg-slate-900 border border-slate-800" aria-labelledby="quick-submit-heading">
        <h2 id="quick-submit-heading" className="text-xl font-bold text-white mb-3">
          Prepare Assistance for a YouTube Workout
        </h2>
        <p className="text-sm text-slate-400 mb-4">
          Submit any YouTube workout video link to fetch metadata, analyze movement windows, and generate an assistance sidecar manifest.
        </p>

        <form onSubmit={handleQuickSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <input
            type="url"
            placeholder="Paste YouTube video URL (e.g. https://www.youtube.com/...)"
            required
            className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-yellow-400 rounded-xl text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400 transition-all"
            aria-label="YouTube Video URL to process"
            id="quick-submit-input"
          />
          <button
            type="submit"
            className="px-6 py-3 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold rounded-xl text-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
            id="quick-submit-btn"
          >
            Prepare Assistance
          </button>
        </form>
      </section>
    </PageWrapper>
  );
}
