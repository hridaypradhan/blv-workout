"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useLayout } from "./LayoutContext";
import { getActiveUserId, USER_UPDATED_EVENT } from "@/lib/prototypeUser";
import { getUserProfile } from "@/lib/api";
import { useAccessibilityPreferences } from "@/lib/hooks/useAccessibilityPreferences";
import ScreenReaderStatus from "@/components/accessibility/ScreenReaderStatus";

interface HeaderProps {
  id?: string;
}

export default function Header({ id = "main-header" }: HeaderProps) {
  const pathname = usePathname();
  const { setSidebarOpen } = useLayout();

  const [userName, setUserName] = useState<string>("Profile");
  const [avatarInitial, setAvatarInitial] = useState<string>("P");
  const [ariaLabel, setAriaLabel] = useState<string>("Profile options. Open settings.");

  const {
    voiceGuidance,
    highContrast,
    announcement,
    toggleVoiceGuidance,
    toggleHighContrast,
  } = useAccessibilityPreferences();

  useEffect(() => {
    const fetchProfile = () => {
      const activeUserId = getActiveUserId();
      if (!activeUserId) return;

      getUserProfile(activeUserId)
        .then((profile) => {
          if (profile && profile.name) {
            setUserName(profile.name);
            setAvatarInitial(profile.name.charAt(0).toUpperCase() || "P");
            setAriaLabel(`Profile for ${profile.name}. Open settings.`);
          } else {
            setUserName("Profile");
            setAvatarInitial("P");
            setAriaLabel("Profile options. Open settings.");
          }
        })
        .catch((err) => {
          console.warn("Failed to load user profile in header:", err);
          setUserName("Profile");
          setAvatarInitial("P");
          setAriaLabel("Profile options. Open settings.");
        });
    };

    fetchProfile();

    if (typeof window !== "undefined") {
      window.addEventListener(USER_UPDATED_EVENT, fetchProfile);
      return () => {
        window.removeEventListener(USER_UPDATED_EVENT, fetchProfile);
      };
    }
  }, []);

  const pageTitle =
    pathname === "/"
      ? "Home"
      : pathname === "/video-library"
      ? "Video Library"
      : pathname === "/process"
      ? "Prepare Assistance"
      : pathname.startsWith("/session")
      ? "Assisted Playback"
      : pathname.startsWith("/history")
      ? "History"
      : pathname === "/settings"
      ? "Settings"
      : pathname === "/api-lab"
      ? "API Lab"
      : pathname === "/onboarding"
      ? "Onboarding"
      : "FitA11y";

  return (
    <header
      id={id}
      className="sticky top-0 z-20 flex items-center justify-between h-16 px-4 sm:px-6 bg-slate-900/85 backdrop-blur-md border-b border-slate-800 text-slate-100"
      aria-label="Header Controls"
    >
      {/* Hidden announcer region for accessibility setting updates */}
      <ScreenReaderStatus content={announcement} />

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
          {pageTitle}
        </h1>
      </div>

      {/* Accessibility & Profile Quick Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Voice Feedback Control Button (Touch Target: 44px by 44px) */}
        <button
          onClick={toggleVoiceGuidance}
          className={`flex items-center justify-center w-11 h-11 border rounded-xl transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 ${
            voiceGuidance
              ? "text-yellow-400 border-yellow-400/50 bg-slate-800"
              : "text-slate-400 hover:text-slate-100 bg-slate-800/50 hover:bg-slate-800 border-slate-800"
          }`}
          title="Toggle Voice Guidance"
          aria-pressed={voiceGuidance}
          aria-label={`Voice guidance is ${voiceGuidance ? "on" : "off"}. Toggle voice guidance ${voiceGuidance ? "off" : "on"}.`}
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
          onClick={toggleHighContrast}
          className={`flex items-center justify-center w-11 h-11 border rounded-xl transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 ${
            highContrast
              ? "bg-yellow-400 text-slate-950 border-yellow-400"
              : "text-slate-400 hover:text-slate-100 bg-slate-800/50 hover:bg-slate-800 border-slate-800"
          }`}
          title="Toggle High Contrast Mode"
          aria-pressed={highContrast}
          aria-label={`High contrast mode is ${highContrast ? "on" : "off"}. Toggle high contrast mode ${highContrast ? "off" : "on"}.`}
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
        <Link
          href="/settings"
          className="flex items-center justify-center sm:justify-start gap-2 h-11 px-2.5 sm:pr-4 text-slate-300 hover:text-slate-100 bg-slate-800/50 hover:bg-slate-800 border border-slate-800 rounded-xl transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 shrink-0"
          aria-label={ariaLabel}
          id="user-profile-menu-btn"
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-yellow-400 to-amber-500 text-slate-900 font-bold flex items-center justify-center text-xs shrink-0 select-none">
            {avatarInitial}
          </div>
          <span className="text-xs font-bold hidden sm:inline truncate max-w-[100px]">{userName}</span>
        </Link>
      </div>
    </header>
  );
}
