"use client";

import { useLayout } from "./LayoutContext";

interface HeaderProps {
  id?: string;
}

export default function Header({ id = "main-header" }: HeaderProps) {
  const { setSidebarOpen } = useLayout();

  return (
    <header
      id={id}
      className="sticky top-0 z-20 flex items-center justify-between h-16 px-4 sm:px-6 bg-slate-900/85 backdrop-blur-md border-b border-slate-800 text-slate-100"
      aria-label="Header Controls"
    >
      {/* Context Title & Mobile Menu Trigger */}
      <div className="flex items-center gap-3">
        {/* Mobile Sidebar Hamburger Toggle */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden flex items-center justify-center w-11 h-11 rounded-xl text-slate-400 hover:text-slate-100 bg-slate-800/50 hover:bg-slate-800 border border-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
          aria-label="Open sidebar navigation menu"
          id="open-sidebar-btn"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-200 truncate max-w-[160px] sm:max-w-xs">
          Fitness Session
        </h1>
      </div>

      {/* Accessibility & Profile Quick Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Voice Feedback Control Button (Touch Target: 44px by 44px) */}
        <button
          onClick={() => {
            // TODO: Mute/unmute voice guidance
          }}
          className="flex items-center justify-center w-11 h-11 text-slate-400 hover:text-slate-100 bg-slate-800/50 hover:bg-slate-800 border border-slate-800 rounded-xl transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
          title="Toggle Voice Guidance"
          aria-label="Toggle Voice Guidance"
          id="toggle-voice-btn"
        >
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
              d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
            />
          </svg>
        </button>

        {/* Contrast Toggle Button (Touch Target: 44px by 44px) */}
        <button
          onClick={() => {
            // TODO: Toggle high-contrast theme (yellow/black)
          }}
          className="flex items-center justify-center w-11 h-11 text-slate-400 hover:text-slate-100 bg-slate-800/50 hover:bg-slate-800 border border-slate-800 rounded-xl transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
          title="Toggle High Contrast Mode"
          aria-label="Toggle High Contrast Mode"
          id="toggle-contrast-btn"
        >
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
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            />
          </svg>
        </button>

        {/* User Account / Profile Button */}
        <button
          onClick={() => {
            // TODO: Open user profile options
          }}
          className="flex items-center justify-center sm:justify-start gap-2 h-11 px-2.5 sm:pr-4 text-slate-350 hover:text-slate-100 bg-slate-800/50 hover:bg-slate-800 border border-slate-800 rounded-xl transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
          aria-label="User profile options"
          id="user-profile-menu-btn"
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-yellow-400 to-amber-500 text-slate-900 font-bold flex items-center justify-center text-xs">
            U
          </div>
          <span className="text-xs font-bold hidden sm:inline">Profile</span>
        </button>
      </div>
    </header>
  );
}
