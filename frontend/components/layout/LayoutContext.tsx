"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

interface LayoutContextType {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const prevPathRef = useRef<string>("");
  const savedCollapsedStateRef = useRef<boolean>(false);

  useEffect(() => {
    if (!pathname) return;

    const parts = pathname.split("/").filter(Boolean);
    const isLive = parts.length === 2 && parts[0] === "session";

    const prevParts = prevPathRef.current.split("/").filter(Boolean);
    const wasLive = prevParts.length === 2 && prevParts[0] === "session";

    if (isLive && !wasLive) {
      savedCollapsedStateRef.current = sidebarCollapsed;
      setSidebarCollapsed(true);
    } else if (!isLive && wasLive) {
      setSidebarCollapsed(savedCollapsedStateRef.current);
    }

    prevPathRef.current = pathname;
  }, [pathname, sidebarCollapsed]);

  return (
    <LayoutContext.Provider
      value={{
        sidebarOpen,
        setSidebarOpen,
        sidebarCollapsed,
        setSidebarCollapsed,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error("useLayout must be used within a LayoutProvider");
  }
  return context;
}
