import React from "react";
import Link from "next/link";

export default function HistoryEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[45vh] text-center p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
      <svg
        className="w-16 h-16 text-slate-600 mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <h2 className="text-xl font-bold text-white mb-2">No Completed Sessions</h2>
      <p className="text-sm text-slate-400 mb-6 max-w-sm">
        You haven&apos;t completed any assisted playback sessions yet. Go to the Video Library to get started!
      </p>
      <Link
        href="/video-library"
        className="px-5 py-3 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold rounded-xl text-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
      >
        Go to Video Library
      </Link>
    </div>
  );
}
