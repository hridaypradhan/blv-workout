"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayout } from "./LayoutContext";
import { useHapticDeviceStatus } from "@/lib/hooks/useHapticDeviceStatus";
import ScreenReaderStatus from "@/components/accessibility/ScreenReaderStatus";

interface SidebarProps {
  id?: string;
}

export default function Sidebar({ id = "main-sidebar" }: SidebarProps) {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen, sidebarCollapsed } = useLayout();

  const {
    status,
    statusText,
    announcement,
    isLoading,
    refresh,
    error,
  } = useHapticDeviceStatus();

  const isGreen = status === "connected" || status === "partially_connected";
  const isYellow = status === "initialized_no_devices" || isLoading;
  const statusColorClass = isGreen ? "bg-emerald-500" : isYellow ? "bg-yellow-500 animate-pulse" : "bg-red-500";

  let compactLabel = "Indicator mode";
  if (status === "connected" || status === "partially_connected") {
    compactLabel = "Connected";
  } else if (status === "initialized_no_devices" || status === "disabled") {
    compactLabel = "Indicator mode";
  } else if (status === "player_unavailable") {
    compactLabel = "Player offline";
  } else if (status === "sdk_unavailable" || status === "not_configured") {
    compactLabel = "SDK unavailable";
  } else if (status === "python_unsupported") {
    compactLabel = "Python unsupported";
  } else if (status === "error") {
    compactLabel = "Status unavailable";
  } else {
    compactLabel = "Status unavailable";
  }

  const navItems: Array<{
    name: string;
    href: string;
    icon: React.ReactNode;
    isPlaceholder?: boolean;
  }> = [
    {
      name: "Prepare Assistance",
      href: "/process",
      icon: (
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
            d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
          />
        </svg>
      ),
    },
    {
      name: "Video Library",
      href: "/video-library",
      icon: (
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
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      name: "History",
      href: "/history",
      icon: (
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
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      name: "Settings",
      href: "/settings",
      icon: (
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
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
    },
    {
      name: "API Lab",
      href: "/api-lab",
      icon: (
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
            d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
          />
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* Hidden announcer region for haptic status */}
      <ScreenReaderStatus content={announcement} />

      {/* Drawer Overlay for Mobile */}
      {sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/80 backdrop-blur-sm md:hidden w-full h-full text-left"
          aria-label="Close sidebar navigation menu"
          id="sidebar-overlay-btn"
        />
      )}

      <aside
        id={id}
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-slate-900 border-r border-slate-800 text-slate-100 transition-all duration-300 ease-in-out md:translate-x-0 w-64 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${
          sidebarCollapsed ? "md:w-16" : "md:w-64"
        }`}
        aria-label="Sidebar Navigation"
      >
        {/* Brand Section */}
        <div className={`flex items-center border-b border-slate-800 transition-all duration-300 ${
          sidebarCollapsed ? "justify-center h-16 px-0" : "justify-between h-16 px-6"
        }`}>
          <Link
            href="/process"
            onClick={() => {
              setSidebarOpen(false);
              if (pathname !== "/process") {
                window.dispatchEvent(new CustomEvent("navigation-start"));
              }
            }}
            className="flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 focus-visible:outline-offset-2 rounded"
            aria-label="FitA11y Prepare Assistance"
            title={sidebarCollapsed ? "FitA11y" : undefined}
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-tr from-yellow-400 to-amber-500 text-slate-900 font-bold text-lg shrink-0">
              FA
            </div>
            {!sidebarCollapsed && (
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-yellow-400 to-amber-200 bg-clip-text text-transparent">
                FitA11y
              </span>
            )}
          </Link>

          {/* Close Sidebar Button for Mobile Accessibility */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden flex items-center justify-center w-11 h-11 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 border border-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
            aria-label="Close sidebar"
            id="close-sidebar-btn"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation Links */}
        <nav className={`flex-1 py-6 space-y-2 overflow-y-auto ${
          sidebarCollapsed ? "px-2" : "px-4"
        }`}>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => {
                  setSidebarOpen(false);
                  if (!isActive) {
                    window.dispatchEvent(new CustomEvent("navigation-start"));
                  }
                }}
                title={sidebarCollapsed ? item.name : undefined}
                className={`flex items-center rounded-xl transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 focus-visible:outline-offset-1 ${
                  sidebarCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3"
                } ${
                  isActive
                    ? "bg-yellow-400 text-slate-950 shadow-lg shadow-yellow-400/10 font-bold"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                }`}
                aria-current={isActive ? "page" : undefined}
                aria-label={item.name}
              >
                <span className={isActive ? "text-slate-950" : "text-slate-400 group-hover:text-slate-100 shrink-0"}>
                  {item.icon}
                </span>
                <span className={sidebarCollapsed ? "sr-only" : "text-sm font-medium truncate"}>
                  {item.name}
                </span>
                {!sidebarCollapsed && item.isPlaceholder && (
                  <span className="ml-auto text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    Placeholder
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Quick Access / Haptic Sleeve Status Info (Useful for BLV Users) */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          {sidebarCollapsed ? (
            <button
              onClick={refresh}
              disabled={isLoading}
              className="flex items-center justify-center mx-auto w-8 h-8 rounded-lg border border-slate-800 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
              aria-label={`Haptic Sleeve Status: ${statusText}. Click to check status.`}
              title={`Haptic Sleeve: ${statusText}`}
            >
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusColorClass}`} />
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-800 bg-slate-900/60"
                title={`Haptic Sleeve: ${statusText}`}
                aria-label={`Haptic Sleeve Status: ${statusText}`}
              >
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusColorClass}`} aria-hidden="true" />
                <div className="flex-1 text-xs min-w-0">
                  <p className="font-semibold text-slate-200">Haptic Sleeve</p>
                  <p className="text-slate-300 font-medium">{compactLabel}</p>
                </div>
                <button
                  onClick={refresh}
                  disabled={isLoading}
                  className="text-xs font-bold text-yellow-400 hover:text-yellow-300 disabled:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 rounded px-1.5 py-0.5 shrink-0"
                  aria-label="Refresh haptic connection status"
                  id="sleeve-connect-btn"
                >
                  {isLoading ? "Checking..." : "Refresh"}
                </button>
              </div>
              {error && (
                <div className="px-1 text-[10px] text-amber-400 leading-normal" id="sidebar-haptic-error">
                  Unable to refresh haptic provider status. Indicator mode may still work once the backend is available.
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
