"use client";

import { useState, useEffect } from "react";

export const VOICE_STORAGE_KEY = "fita11y_voice_guidance";
export const VOICE_EVENT_NAME = "fita11y:voice-guidance-updated";
export const CONTRAST_STORAGE_KEY = "fita11y_high_contrast";

export function useAccessibilityPreferences() {
  const [voiceGuidance, setVoiceGuidance] = useState<boolean>(true);
  const [highContrast, setHighContrast] = useState<boolean>(false);
  const [announcement, setAnnouncement] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedVoice = localStorage.getItem(VOICE_STORAGE_KEY);
      const isVoiceOn = storedVoice !== null ? storedVoice === "true" : true;
      setVoiceGuidance(isVoiceOn);

      const storedContrast = localStorage.getItem(CONTRAST_STORAGE_KEY);
      const isContrastOn = storedContrast === "true";
      setHighContrast(isContrastOn);
      if (isContrastOn) {
        document.documentElement.classList.add("high-contrast");
      } else {
        document.documentElement.classList.remove("high-contrast");
      }
    }
  }, []);

  const toggleVoiceGuidance = () => {
    const newVal = !voiceGuidance;
    setVoiceGuidance(newVal);
    localStorage.setItem(VOICE_STORAGE_KEY, String(newVal));
    setAnnouncement(`Voice guidance is now ${newVal ? "enabled" : "disabled"}.`);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(VOICE_EVENT_NAME, { detail: newVal }));
    }
  };

  const toggleHighContrast = () => {
    const newVal = !highContrast;
    setHighContrast(newVal);
    localStorage.setItem(CONTRAST_STORAGE_KEY, String(newVal));
    if (newVal) {
      document.documentElement.classList.add("high-contrast");
    } else {
      document.documentElement.classList.remove("high-contrast");
    }
    setAnnouncement(`High contrast mode is now ${newVal ? "enabled" : "disabled"}.`);
  };

  return {
    voiceGuidance,
    highContrast,
    announcement,
    toggleVoiceGuidance,
    toggleHighContrast,
  };
}
