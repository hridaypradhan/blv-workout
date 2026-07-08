"use client";

import React, { useState } from "react";
import { HapticEventLog } from "@/lib/hooks/useHapticEventDelivery";

interface LiveHapticStatusPanelProps {
  deviceStatuses: Array<{
    key: string;
    name: string;
    status_text: string;
    connected: boolean;
  }>;
  recentEvents: HapticEventLog[];
  hapticStatusText: string;
}

export default function LiveHapticStatusPanel({
  deviceStatuses,
  recentEvents,
  hapticStatusText,
}: LiveHapticStatusPanelProps) {
  const isHardwareActive = deviceStatuses.some((d) => d.connected);
  const [showHardwareLog, setShowHardwareLog] = useState(false);

  // If hardware is active, avoid showing the noisy visual list by default
  const shouldShowVisualFeed = !isHardwareActive || showHardwareLog;

  return (
    <section
      className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3 min-h-[220px] h-[220px] select-none"
      aria-labelledby="haptic-panel-heading"
      id="live-haptic-status-panel"
    >
      <div className="flex items-center justify-between">
        <h3 id="haptic-panel-heading" className="text-xs uppercase font-extrabold text-yellow-400 tracking-wider">
          Haptics Status
        </h3>
        <span className="text-[10px] bg-slate-950 border border-slate-800 px-2 py-0.5 rounded font-extrabold text-slate-400">
          {hapticStatusText}
        </span>
      </div>

      {/* Sleeve status dots */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        {deviceStatuses.map((s) => {
          const dotColor = s.connected ? "bg-emerald-500" : "bg-red-500";
          return (
            <div
              key={s.key}
              className="flex items-center gap-1.5 p-1.5 bg-slate-950 border border-slate-850 rounded-lg min-w-0"
              aria-label={`${s.name}: ${s.status_text}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} aria-hidden="true" />
              <span className="text-slate-300 font-bold truncate">{s.name}</span>
            </div>
          );
        })}
      </div>

      {/* Haptic Event Feed (Fixed height scrollable container to prevent layout shift) */}
      <div className="flex-1 flex flex-col min-h-0 border-t border-slate-850/80 pt-2 gap-1.5">
        {isHardwareActive && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-emerald-400 font-bold">
              [Active] Hardware sleeves active
            </span>
            <button
              type="button"
              onClick={() => setShowHardwareLog((prev) => !prev)}
              className="text-[10px] text-yellow-400 hover:text-yellow-300 font-extrabold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
              aria-label={showHardwareLog ? "Hide visual haptic event log" : "Show visual haptic event log"}
            >
              {showHardwareLog ? "Hide Log" : "Show Log"}
            </button>
          </div>
        )}

        <div
          className="flex-1 overflow-y-auto pr-1 space-y-1.5 min-h-0"
          aria-live="off"
          aria-atomic="true"
        >
          {shouldShowVisualFeed ? (
            recentEvents.length > 0 ? (
              recentEvents.map((evt, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-1.5 bg-slate-950 border border-slate-850 rounded-lg text-[10px] font-medium"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`px-1 py-0.5 rounded text-[8px] font-extrabold uppercase shrink-0 ${
                        evt.deliveryMode === "hardware"
                          ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                          : "bg-blue-500/10 border border-blue-500/20 text-blue-400"
                      }`}
                    >
                      {evt.deliveryMode}
                    </span>
                    <span className="text-slate-200 font-bold truncate">{evt.eventName}</span>
                    <span className="text-slate-500 truncate">on {evt.targetLimbs.join(",")}</span>
                  </div>
                  <span className="text-slate-400 italic shrink-0 text-right ml-1 truncate">
                    {evt.statusMessage}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-[10px] text-slate-500 text-center py-4">No haptic events recorded.</p>
            )
          ) : (
            <p className="text-[10px] text-slate-400 text-center py-4 font-semibold">
              Vibration delivered to sleeves. Visual log hidden by default.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
