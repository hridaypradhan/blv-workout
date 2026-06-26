"use client";

import React, { useState, useEffect } from "react";
import { getHapticEventMap, triggerHapticPattern, DEFAULT_HAPTIC_EVENT_MAP } from "@/lib/api";
import { HapticVibrationCandidate, HapticPreferences, HapticEventMappingItem } from "@/types";

interface HapticSettingsPanelProps {
  hapticPreferences: HapticPreferences;
  onHapticPrefChange: (cueType: string, val: string) => void;
  vibrations: HapticVibrationCandidate[];
  previewWav: (wavUrl: string) => void;
}

export default function HapticSettingsPanel({
  hapticPreferences,
  onHapticPrefChange,
  vibrations,
  previewWav,
}: HapticSettingsPanelProps) {
  const [eventMap, setEventMap] = useState<HapticEventMappingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<Record<string, {
    mode: string;
    msg: string;
    bhaptics_event_name?: string | null;
    provider?: string | null;
    hardware_available?: boolean;
    player_available?: boolean;
    status_message?: string | null;
  }>>({});

  useEffect(() => {
    async function loadMap() {
      try {
        const map = await getHapticEventMap();
        setEventMap(map);
        setIsUsingFallback(false);
        setLoadError(null);
      } catch (err) {
        console.error("Failed to load haptic event map, using local fallback:", err);
        setLoadError(err instanceof Error ? err.message : String(err));
        setIsUsingFallback(true);
      } finally {
        setIsLoading(false);
      }
    }
    loadMap();
  }, []);

  const handleTestHapticEvent = async (cueType: string, selectedId: string, eventName: string) => {
    try {
      setTestStatus((prev) => ({
        ...prev,
        [cueType]: { mode: "loading", msg: "Testing haptic event..." }
      }));

      const res = await triggerHapticPattern(
        null,
        null,
        1.0, // test intensity
        cueType,
        selectedId,
        ["left_arm", "right_arm"],
        eventName
      );

      const mode = res.delivery_mode || "dry_run";
      const message = res.status_message || `Mapped to event ${res.bhaptics_event_name}`;

      let displayModeText = "Indicator mode";
      if (mode === "hardware") {
        displayModeText = "Fired on physical sleeves";
      } else if (mode === "indicator") {
        displayModeText = "Shown as accessible indicator";
      }

      setTestStatus((prev) => ({
        ...prev,
        [cueType]: {
          mode,
          msg: `Test complete. Result: ${displayModeText}. (${message})`,
          bhaptics_event_name: res.bhaptics_event_name ?? null,
          provider: res.provider ?? null,
          hardware_available: res.hardware_available ?? undefined,
          player_available: res.player_available ?? undefined,
          status_message: res.status_message ?? null,
        }
      }));
    } catch (err) {
      console.error("Failed to test haptic event:", err);
      setTestStatus((prev) => ({
        ...prev,
        [cueType]: {
          mode: "failed",
          msg: `Test failed: ${err instanceof Error ? err.message : String(err)}`,
          status_message: err instanceof Error ? err.message : String(err)
        }
      }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mr-3" />
        <span className="text-slate-400 text-sm">Loading event mapping definitions...</span>
      </div>
    );
  }

  const activeMap = eventMap.length > 0 ? eventMap : DEFAULT_HAPTIC_EVENT_MAP;

  return (
    <div className="space-y-6">
      {isUsingFallback && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-xl flex flex-col gap-1" id="settings-fallback-warning">
          <span className="font-semibold">Using built-in fallback haptic mapping because the backend event map could not be loaded.</span>
          {loadError && <span className="text-[10px] text-slate-500 font-mono">Details: {loadError}</span>}
        </div>
      )}
      {activeMap.map((item) => {
        const key = item.cue_type;
        const label = item.label;
        const description = item.description || "Tactile response for this session moment.";
        const candidates = vibrations.filter((v) => v.cue_type === key);
        const selectedId = hapticPreferences[key as keyof HapticPreferences] || "";
        const selectedCandidate = candidates.find((c) => c.id === selectedId);
        const selectedWav = selectedCandidate?.source_wav;
        const resolvedEventName = item.bhaptics_event_name;

        return (
          <div key={key} className="flex flex-col gap-4 p-4 bg-slate-950 border border-slate-800 rounded-2xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1 min-w-[200px]">
                <label htmlFor={`haptic-select-${key}`} className="block text-sm font-bold text-slate-200 mb-1">
                  {label}
                </label>
                <span className="text-xs text-slate-400 block mb-2">{description}</span>
                <span className="inline-block px-2 py-0.5 bg-slate-900 border border-slate-800 text-[10px] font-mono text-yellow-400 rounded">
                  bHaptics Event: {resolvedEventName}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <select
                  id={`haptic-select-${key}`}
                  value={selectedId}
                  onChange={(e) => onHapticPrefChange(key, e.target.value)}
                  className="flex-1 md:w-64 px-4 py-3 bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-yellow-400 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400 transition-all cursor-pointer"
                >
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} {c.duration_ms ? `(${Math.round(c.duration_ms)}ms)` : ""}
                    </option>
                  ))}
                  {candidates.length === 0 && (
                    <option value="">No vibrations found</option>
                  )}
                </select>
                <button
                  type="button"
                  disabled={!selectedWav}
                  onClick={() => selectedWav && previewWav(selectedWav)}
                  className="px-3 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 hover:text-white font-bold rounded-xl text-xs border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
                  title="Audio preview of the selected source WAV file in the browser"
                >
                  Audio Preview
                </button>
                <button
                  type="button"
                  onClick={() => handleTestHapticEvent(key, selectedId, resolvedEventName)}
                  className="px-4 py-3 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold rounded-xl text-xs transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
                  title={`Trigger test for ${resolvedEventName}`}
                >
                  Test Haptic Event
                </button>
              </div>
            </div>

            {/* Test status result display */}
            {testStatus[key] && (
              <div
                id={`test-status-${key}`}
                className={`text-xs p-4 rounded-xl border transition-all duration-200 space-y-2 ${
                  testStatus[key].mode === "loading"
                    ? "bg-slate-900 border-slate-800 text-slate-400 animate-pulse"
                    : testStatus[key].mode === "hardware"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : testStatus[key].mode === "failed"
                    ? "bg-red-500/10 border-red-500/30 text-red-400"
                    : "bg-blue-500/10 border-blue-500/30 text-blue-400"
                }`}
                role="status"
                aria-live="polite"
              >
                <div className="font-bold text-sm mb-1">{testStatus[key].msg}</div>
                {testStatus[key].mode !== "loading" && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-800/50 font-mono text-[10px]">
                    <div>
                      <span className="text-slate-500">Event Name:</span>{" "}
                      <span className="text-yellow-400">{testStatus[key].bhaptics_event_name || resolvedEventName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Delivery Mode:</span>{" "}
                      <span className="capitalize">{testStatus[key].mode}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Provider:</span>{" "}
                      <span>{testStatus[key].provider || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Hardware Conn:</span>{" "}
                      <span>{testStatus[key].hardware_available ? "Connected" : "Disconnected"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Player App:</span>{" "}
                      <span>{testStatus[key].player_available ? "Running" : "Not Found"}</span>
                    </div>
                    <div className="col-span-2 sm:col-span-3">
                      <span className="text-slate-500">Diagnostics:</span>{" "}
                      <span>{testStatus[key].status_message || "No status details."}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
