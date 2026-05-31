import React from "react";
import Link from "next/link";

interface SampleVideoCardProps {
  video: {
    id: string;
    title: string;
    channelName: string;
    duration: string;
    lastSession: string;
    thumbnailBg: string;
  };
  handleStartSession: (videoId: string) => void;
}

export default function SampleVideoCard({ video, handleStartSession }: SampleVideoCardProps) {
  return (
    <article
      className="flex flex-col bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl md:rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 group"
      aria-labelledby={`title-${video.id}`}
    >
      {/* Visual Thumbnail Placeholder */}
      <div className={`h-40 bg-gradient-to-tr ${video.thumbnailBg} flex items-center justify-center p-6 relative`}>
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-slate-950/65 backdrop-blur-sm text-xs font-semibold text-slate-200 border border-slate-800">
          {video.duration}
        </div>
        <svg
          className="w-12 h-12 text-white/80 group-hover:scale-110 transition-transform duration-300"
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
            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      {/* Content Details */}
      <div className="flex-1 p-6 flex flex-col justify-between">
        <div>
          <h2
            id={`title-${video.id}`}
            className="text-lg font-bold text-white mb-3 group-hover:text-yellow-400 transition-colors line-clamp-2"
            title={video.title}
          >
            {video.title}
          </h2>

          <div className="grid grid-cols-2 gap-4 text-xs text-slate-400 mb-6" role="list">
            <div className="flex flex-col gap-0.5" role="listitem">
              <span className="font-semibold text-slate-500 uppercase tracking-wider">Trainer</span>
              <span className="text-slate-300 text-sm font-semibold">{video.channelName}</span>
            </div>
            <div className="flex flex-col gap-0.5" role="listitem">
              <span className="font-semibold text-slate-500 uppercase tracking-wider">Last Playback</span>
              <span className="text-slate-300 text-sm font-semibold">{video.lastSession}</span>
            </div>
          </div>
        </div>

        {/* Start Session Action Button */}
        <Link
          href={`/session/${video.id}/setup`}
          onClick={() => handleStartSession(video.id)}
          className="w-full inline-flex items-center justify-center px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold rounded-xl text-sm border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 transition-all"
          aria-label={`Start assisted playback setup for ${video.title}`}
          id={`start-btn-${video.id}`}
        >
          Start Assisted Playback
          <svg
            className="w-4 h-4 ml-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </article>
  );
}
