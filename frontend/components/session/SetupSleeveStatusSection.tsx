/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";

export interface SetupSleeveStatusSectionProps {
  refreshHaptic: () => void;
  isHapticLoading: boolean;
  hapticStatus: string;
  hapticError: any;
  hapticStatusText: string;
  sleeveStatus: any[];
  testingSleeves: Record<string, boolean>;
  sleeveResults: Record<string, string>;
  handleTestSleeve: (key: string, name: string) => void;
}

export function SetupSleeveStatusSection({
  refreshHaptic,
  isHapticLoading,
  hapticStatus,
  hapticError,
  hapticStatusText,
  sleeveStatus,
  testingSleeves,
  sleeveResults,
  handleTestSleeve,
}: SetupSleeveStatusSectionProps) {
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col justify-between" aria-labelledby="sleeve-heading" id="sleeve-status-section">
      <div>
        <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
          <h2 id="sleeve-heading" className="text-lg font-bold text-white">
            Haptic Sleeve Status
          </h2>
          <button
            type="button"
            onClick={refreshHaptic}
            disabled={isHapticLoading}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 disabled:bg-slate-900 text-slate-300 hover:text-white font-bold rounded-lg text-xs border border-slate-700 transition-all flex items-center gap-1.5"
            id="refresh-haptic-setup-btn"
          >
            {isHapticLoading ? (
              <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>Refresh Status</span>
            )}
          </button>
        </div>
        <p className="text-sm text-slate-300 mb-4">
          Verify sleeve readiness. If physical sleeves are connected to your bHaptics Player, they will receive test pulses.
        </p>

        {/* Warning Alert Banner for unavailable states or status errors */}
        {(hapticStatus === "player_unavailable" || hapticStatus === "not_configured" || hapticStatus === "sdk_unavailable" || hapticStatus === "python_unsupported" || hapticError) && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-xs mb-4">
            <strong className="block font-bold mb-0.5">
              {hapticError ? "Haptic Provider Unreachable" :
               hapticStatus === "player_unavailable" ? "bHaptics Player Offline" :
               hapticStatus === "not_configured" ? "bHaptics Credentials Missing" :
               hapticStatus === "sdk_unavailable" ? "bHaptics SDK Not Installed" :
               "Python Version Unsupported"}
            </strong>
            <span>
              {hapticError ? "Unable to refresh haptic provider status. Indicator mode may still work once the backend is available." :
               hapticStatus === "player_unavailable" ? "Please launch the bHaptics Player app on your machine and pair your sleeves there." :
               hapticStatus === "not_configured" ? "Please set your bHaptics APP_ID and API_KEY in settings to connect." :
               "The bHaptics software library could not be loaded on this environment."}
            </span>
            <span className="block mt-1 text-slate-400 font-medium">
              You can safely continue workout playback anyway; the session will fall back to using accessibility screen-reader and visual indicators.
            </span>
          </div>
        )}

        {/* Connection Status Text */}
        <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl mb-4 text-xs font-semibold text-slate-300">
          Provider status: <span className="text-slate-100 font-bold">{hapticStatusText}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sleeveStatus.map((sleeve) => {
          const isTesting = !!testingSleeves[sleeve.key];
          const testResult = sleeveResults[sleeve.key];
          return (
            <div
              key={sleeve.key}
              className="flex flex-col justify-between p-4 bg-slate-950 border border-slate-800 rounded-xl gap-3"
            >
              {/* Top: Sleeve Name */}
              <div>
                <span className="text-sm font-semibold text-slate-200 block">
                  {sleeve.name}
                </span>
              </div>

              {/* Middle: Connection Status */}
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${sleeve.colorClass}`}
                  aria-hidden="true"
                />
                <span className="text-sm font-semibold text-slate-300">
                  {sleeve.statusText}
                </span>
              </div>

              {/* Bottom/Action Row */}
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-900 mt-auto">
                <button
                  type="button"
                  onClick={() => handleTestSleeve(sleeve.key, sleeve.name)}
                  disabled={isTesting}
                  className="w-full px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-500 text-xs font-bold text-slate-200 border border-slate-700 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 transition-all text-center shrink-0"
                  aria-label={`Test ${sleeve.name} haptic cue`}
                >
                  {isTesting ? "Testing..." : "Test Pulse"}
                </button>
                {testResult && (
                  <span
                    className={`text-[10px] font-semibold font-mono px-2 py-0.5 rounded text-center block ${
                      testResult.includes("Hardware")
                        ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                        : testResult === "Failed"
                        ? "bg-red-500/10 border border-red-500/20 text-red-400"
                        : "bg-blue-500/10 border border-blue-500/20 text-blue-400"
                    }`}
                  >
                    {testResult}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
