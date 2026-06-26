"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageWrapper from "@/components/layout/PageWrapper";
import { registerUser } from "@/lib/api";
import { getActiveUserId, setActiveUserId } from "@/lib/prototypeUser";
import { mergeUserPreferences, DEFAULT_USER_PREFERENCES } from "@/lib/userPreferences";
import { useUserProfile } from "@/components/layout/UserProfileContext";
import { useHapticDeviceStatus } from "@/lib/hooks/useHapticDeviceStatus";
import { HapticDeviceStatus } from "@/types";

export default function Onboarding() {
  const router = useRouter();
  const { user } = useUserProfile();
  const {
    status: hapticStatus,
    statusText: hapticStatusText,
    deviceStatuses,
    refresh: refreshHaptic,
    isLoading: isHapticLoading,
    error: hapticError,
  } = useHapticDeviceStatus();

  const [name, setName] = useState("");
  const [visionLoss, setVisionLoss] = useState("vl-blind");
  const [screenReader, setScreenReader] = useState("none");
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      const prefs = mergeUserPreferences(user);
      if (prefs.voice_settings) {
        const vs = prefs.voice_settings as Record<string, string | number | boolean>;
        if (typeof vs.vision_loss === "string") {
          setVisionLoss(vs.vision_loss);
        }
        if (typeof vs.screen_reader === "string") {
          setScreenReader(vs.screen_reader);
        }
      }
    } else {
      setVisionLoss(DEFAULT_USER_PREFERENCES.voice_settings.vision_loss);
      setScreenReader(DEFAULT_USER_PREFERENCES.voice_settings.screen_reader);
    }
  }, [user]);

  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);
    setIsError(false);

    try {
      const activeId = getActiveUserId();
      const email = `${name.toLowerCase().replace(/\s+/g, ".")}@fita11y.local`;

      const payload = {
        id: activeId,
        name: name,
        email: email,
        assistant_persona: DEFAULT_USER_PREFERENCES.assistant_persona,
        feedback_modalities: DEFAULT_USER_PREFERENCES.feedback_modalities,
        voice_settings: {
          ...DEFAULT_USER_PREFERENCES.voice_settings,
          vision_loss: visionLoss,
          screen_reader: screenReader,
        },
        audio_coexistence: {
          ...DEFAULT_USER_PREFERENCES.audio_coexistence,
        },
      };

      const registered = await registerUser(payload);
      if (registered.id) {
        setActiveUserId(registered.id);
      }
      setIsError(false);
      setStatusMessage("Profile settings saved successfully! Redirecting...");

      setTimeout(() => {
        window.dispatchEvent(new Event("navigation-start"));
        router.push("/process");
      }, 800);
    } catch (err) {
      console.error("Failed to save profile:", err);
      setIsError(true);
      setStatusMessage(err instanceof Error ? err.message : "Failed to save profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };



  const handleSaveWithoutLeaving = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setIsError(true);
      setStatusMessage("Please enter your name before saving.");
      return;
    }
    setIsSaving(true);
    setStatusMessage(null);
    setIsError(false);

    try {
      const activeId = getActiveUserId();
      const email = `${name.toLowerCase().replace(/\s+/g, ".")}@fita11y.local`;

      const payload = {
        id: activeId,
        name: name,
        email: email,
        assistant_persona: DEFAULT_USER_PREFERENCES.assistant_persona,
        feedback_modalities: DEFAULT_USER_PREFERENCES.feedback_modalities,
        voice_settings: {
          ...DEFAULT_USER_PREFERENCES.voice_settings,
          vision_loss: visionLoss,
          screen_reader: screenReader,
        },
        audio_coexistence: {
          ...DEFAULT_USER_PREFERENCES.audio_coexistence,
        },
      };

      const registered = await registerUser(payload);
      if (registered.id) {
        setActiveUserId(registered.id);
      }
      setIsError(false);
      setStatusMessage("Profile settings saved successfully (staying on page).");
    } catch (err) {
      console.error("Failed to save profile:", err);
      setIsError(true);
      setStatusMessage(err instanceof Error ? err.message : "Failed to save profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageWrapper id="onboarding-page-wrapper">
      <div className="max-w-3xl mx-auto py-4">
        {/* Header */}
        <div className="mb-8 text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-2">
            Setup FitA11y
          </h1>
          <p className="text-slate-400">
            Follow these steps to tailor your assistive companion preferences and pair your haptic feedback sleeves.
          </p>
        </div>

        <form onSubmit={handleSubmitProfile} className="space-y-8">
          {/* Step 1: Profile & Coexistence */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl" aria-labelledby="step1-heading">
            <div className="flex items-center gap-3 mb-6">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-400 text-slate-950 font-bold text-sm" aria-hidden="true">
                1
              </span>
              <h2 id="step1-heading" className="text-2xl font-bold text-white">
                Configure Profile & Audio Coexistence
              </h2>
            </div>

            <div className="space-y-6">
              {/* Name Input */}
              <div className="space-y-2">
                <label htmlFor="user-name" className="block text-sm font-semibold text-slate-200">
                  Full Name / Preferred Name
                </label>
                <input
                  type="text"
                  id="user-name"
                  required
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-yellow-400 rounded-xl text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400 transition-all"
                />
              </div>

              {/* Degree of Vision Loss */}
              <div className="space-y-3">
                <span className="block text-sm font-semibold text-slate-200" id="vision-loss-label">
                  Degree of Vision Loss
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-labelledby="vision-loss-label">
                  {[
                    { id: "vl-blind", label: "Totally Blind", desc: "Primarily relies on Speech & Haptic responses" },
                    { id: "vl-legal", label: "Legally Blind", desc: "High-contrast guides & Audio descriptions" },
                    { id: "vl-low", label: "Moderate Low Vision", desc: "Large fonts, scaling, & outline guidance" },
                    { id: "vl-mild", label: "Mild Low Vision", desc: "Slight text adjustments & voice cues" },
                  ].map((level) => (
                    <label
                      key={level.id}
                      htmlFor={level.id}
                      className={`relative flex flex-col p-4 rounded-xl cursor-pointer select-none transition-all duration-200 focus-within:ring-2 focus-within:ring-yellow-400 ${
                        visionLoss === level.id
                          ? "bg-slate-950 border-2 border-yellow-400"
                          : "bg-slate-950 border border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          id={level.id}
                          name="vision-loss"
                          value={level.id}
                          checked={visionLoss === level.id}
                          onChange={(e) => setVisionLoss(e.target.value)}
                          className="w-4 h-4 text-yellow-400 bg-slate-900 border-slate-800 focus:ring-yellow-400 focus:ring-offset-slate-950"
                        />
                        <span className="text-sm font-bold text-white">{level.label}</span>
                      </div>
                      <span className="text-xs text-slate-400 mt-1 pl-7">{level.desc}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Screen Reader Dropdown */}
              <div className="space-y-2">
                <label htmlFor="screen-reader-select" className="block text-sm font-semibold text-slate-200">
                  Primary Screen Reader Helper
                </label>
                <select
                  id="screen-reader-select"
                  value={screenReader}
                  onChange={(e) => setScreenReader(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-yellow-400 rounded-xl text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400 transition-all cursor-pointer"
                >
                  <option value="none">None / Standard Audio Synthesis Only</option>
                  <option value="voiceover">Apple VoiceOver</option>
                  <option value="nvda">NVDA (NonVisual Desktop Access)</option>
                  <option value="jaws">JAWS (Job Access With Speech)</option>
                  <option value="talkback">Android TalkBack</option>
                  <option value="other">Other Screen Reader</option>
                </select>
              </div>
            </div>
          </section>

          {/* Step 2: Sleeve Pairing */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl" aria-labelledby="step2-heading">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-400 text-slate-950 font-bold text-sm" aria-hidden="true">
                  2
                </span>
                <h2 id="step2-heading" className="text-2xl font-bold text-white">
                  bHaptics Device Status
                </h2>
              </div>
              <button
                type="button"
                onClick={refreshHaptic}
                disabled={isHapticLoading}
                className="px-4 py-2 bg-slate-850 hover:bg-slate-800 disabled:bg-slate-900 text-slate-200 hover:text-white font-bold rounded-xl text-xs border border-slate-800 transition-all flex items-center gap-1.5"
                id="refresh-haptic-status-btn"
              >
                {isHapticLoading ? (
                  <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>Refresh bHaptics Status</span>
                )}
              </button>
            </div>
            
            <div className="text-sm text-slate-400 mb-6 space-y-2">
              <p>
                Pair your haptic sleeves using the <strong>bHaptics Player</strong> app on your computer.
                FitA11y reads connection status directly from the bHaptics Player software.
              </p>
              <p>
                Hardware is optional. If you do not have physical sleeves or bHaptics Player running, you can safely
                <strong> continue without sleeves</strong>. The workout events will still be delivered as high-contrast
                visual cues and spoken screen-reader announcements (indicator mode).
              </p>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-400 block mb-1">Provider Connection State</span>
                  <span className="text-sm font-semibold text-slate-200">{hapticStatusText}</span>
                </div>
                {hapticStatus === "player_unavailable" && (
                  <span className="inline-block px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold rounded-lg animate-pulse">
                    Player Offline
                  </span>
                )}
              </div>
            </div>
            {hapticError && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-xl mb-6" id="onboarding-haptic-error">
                Unable to refresh haptic provider status. Indicator mode may still work once the backend is available.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(deviceStatuses.length > 0 ? (deviceStatuses as HapticDeviceStatus[]) : [
                { key: "left_arm", name: "Left Arm", position: 1, connected: false, paired: false, battery: null, status_text: "Disconnected", source: "bhaptics" },
                { key: "right_arm", name: "Right Arm", position: 2, connected: false, paired: false, battery: null, status_text: "Disconnected", source: "bhaptics" },
                { key: "left_leg", name: "Left Leg", position: 3, connected: false, paired: false, battery: null, status_text: "Disconnected", source: "bhaptics" },
                { key: "right_leg", name: "Right Leg", position: 4, connected: false, paired: false, battery: null, status_text: "Disconnected", source: "bhaptics" }
              ]).map((device) => {
                const isConn = device.connected;
                return (
                  <div
                    key={device.key}
                    className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl transition-all"
                    aria-label={`${device.name} status details`}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-200">{device.name}</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`w-2.5 h-2.5 rounded-full ${isConn ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} aria-hidden="true" />
                        <span className="text-xs text-slate-300 font-semibold">
                          {isConn ? `${device.status_text || 'Connected'}${device.battery ? ` (${device.battery}%)` : ''}` : "Disconnected"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {statusMessage && (
            <div
              className={`p-4 rounded-xl text-sm font-medium ${isError ? 'bg-red-500/10 border border-red-500/30 text-red-400' : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'}`}
              role="status"
              aria-live="polite"
            >
              {statusMessage}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-6 py-4 bg-yellow-400 hover:bg-yellow-300 disabled:bg-yellow-800 disabled:text-slate-400 text-slate-950 font-bold rounded-xl text-base transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 focus-visible:outline-offset-2 shadow-lg shadow-yellow-400/10 text-center"
              id="save-continue-btn"
            >
              {isSaving ? "Saving..." : "Save & Continue to Prepare Assistance"}
            </button>

            <button
              type="button"
              onClick={handleSaveWithoutLeaving}
              disabled={isSaving}
              className="px-6 py-4 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-500 text-slate-200 font-semibold rounded-xl text-sm border border-slate-700 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
              id="save-profile-btn"
            >
              Save Profile Settings
            </button>

            <Link
              href="/process"
              className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold rounded-xl text-sm border border-slate-700 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 text-center flex items-center justify-center"
              id="skip-onboarding-btn"
            >
              Skip Onboarding
            </Link>
          </div>
        </form>
      </div>
    </PageWrapper>
  );
}
