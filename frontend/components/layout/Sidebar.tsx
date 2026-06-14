"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayout } from "./LayoutContext";
import { usePrototypeHapticConnection } from "@/lib/hooks/usePrototypeHapticConnection";
import ScreenReaderStatus from "@/components/accessibility/ScreenReaderStatus";

interface SidebarProps {
  id?: string;
}

export default function Sidebar({ id = "main-sidebar" }: SidebarProps) {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen, sidebarCollapsed } = useLayout();

  const {
    statusText,
    announcement,
    toggleConnection,
    isConnecting,
    isConnected,
  } = usePrototypeHapticConnection();

  const navItems: Array<{
    name: string;
    href: string;
    icon: React.ReactNode;
    isPlaceholder?: boolean;
  }> = [
    {
      name: "Home",
      href: "/",
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
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
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
            href="/"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 focus-visible:outline-offset-2 rounded"
            aria-label="FitA11y Home Page"
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
                onClick={() => setSidebarOpen(false)}
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
              onClick={toggleConnection}
              disabled={isConnecting}
              className="flex items-center justify-center mx-auto w-8 h-8 rounded-lg border border-slate-800 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
              aria-label={`Haptic Sleeve Status: ${statusText}. Click to toggle connection.`}
              title={`Haptic Sleeve: ${statusText}`}
            >
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                isConnected ? "bg-emerald-500" : isConnecting ? "bg-yellow-500 animate-pulse" : "bg-red-500 animate-pulse"
              }`} />
            </button>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-800 bg-slate-900/60">
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                isConnected ? "bg-emerald-500" : isConnecting ? "bg-yellow-500 animate-pulse" : "bg-red-500 animate-pulse"
              }`} aria-hidden="true" />
              <div className="flex-1 text-xs min-w-0">
                <p className="font-semibold text-slate-200">Haptic Sleeve</p>
                <p className="text-slate-300 font-medium truncate">{statusText}</p>
              </div>
              <button
                onClick={toggleConnection}
                disabled={isConnecting}
                className="text-xs font-bold text-yellow-400 hover:text-yellow-300 disabled:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 rounded px-1.5 py-0.5 shrink-0"
                aria-pressed={isConnected}
                aria-label={
                  isConnected
                    ? "Disconnect Haptic Sleeve (Prototype)"
                    : isConnecting
                    ? "Connecting Haptic Sleeve (Prototype)"
                    : "Connect Haptic Sleeve (Prototype)"
                }
                id="sleeve-connect-btn"
              >
                {isConnected ? "Disconnect" : isConnecting ? "Connecting..." : "Connect"}
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
