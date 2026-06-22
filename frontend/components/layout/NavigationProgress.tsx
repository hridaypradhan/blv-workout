"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function NavigationProgress() {
  const [isPending, setIsPending] = useState(false);
  const [isDelayed, setIsDelayed] = useState(false);
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Handle navigation start event explicitly dispatched from sidebar or setup
  useEffect(() => {
    const handleNavigationStart = () => {
      setIsPending(true);
      setLoadingStartTime(Date.now());
    };

    window.addEventListener("navigation-start", handleNavigationStart);
    return () => {
      window.removeEventListener("navigation-start", handleNavigationStart);
    };
  }, []);

  // Clear pending state on path or search change, ensuring min duration of 400ms
  useEffect(() => {
    if (!isPending || !loadingStartTime) return;
    const elapsed = Date.now() - loadingStartTime;
    const minDuration = 400; // ms
    const remainingTime = Math.max(0, minDuration - elapsed);

    const timer = setTimeout(() => {
      setIsPending(false);
      setLoadingStartTime(null);
      setIsDelayed(false);
    }, remainingTime);

    return () => clearTimeout(timer);
  }, [pathname, searchParams, isPending, loadingStartTime]);

  // Timers for safety/delay feedback
  useEffect(() => {
    if (!isPending) {
      setIsDelayed(false);
      return;
    }

    const delayTimer = setTimeout(() => {
      setIsDelayed(true);
    }, 3000);

    const safetyTimer = setTimeout(() => {
      setIsPending(false);
      setLoadingStartTime(null);
    }, 10000);

    return () => {
      clearTimeout(delayTimer);
      clearTimeout(safetyTimer);
    };
  }, [isPending]);

  if (!isPending) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none" role="status" aria-live="polite">
      {/* Visual top progress bar */}
      <div className="fixed top-0 left-0 h-1 w-full bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-300 animate-pulse pointer-events-none" />

      {/* Visual loading spinner pill - positioned top-center near the header area and fully click-through safe */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900/90 border border-slate-800 text-slate-100 px-4 py-2.5 rounded-full shadow-2xl backdrop-blur-md transition-all duration-350 pointer-events-none">
        <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-bold tracking-tight">
          {isDelayed ? "Still Loading..." : "Loading Page..."}
        </span>
      </div>

      {/* Screen reader only status text */}
      <span className="sr-only">
        {isDelayed ? "Still loading, please wait..." : "Loading next screen..."}
      </span>
    </div>
  );
}
