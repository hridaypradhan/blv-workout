"use client";

/**
 * Reusable layout scroll utility for voice commands.
 */
export function executeScrollCommand(type: "scroll_down" | "scroll_up" | "page_down" | "page_up") {
  if (typeof window === "undefined") return;
  const scrollAmount = type.startsWith("scroll")
    ? window.innerHeight * 0.3 // Scroll 30% of viewport height
    : window.innerHeight * 0.8; // Page scroll 80% of viewport height

  const direction = type.endsWith("down") ? 1 : -1;
  window.scrollBy({
    top: scrollAmount * direction,
    behavior: "smooth",
  });
}

export const SETUP_SECTION_IDS = [
  "audio-coexistence-section",
  "sleeve-status-section",
  "ask-assistant-section",
  "voice-control-section",
  "camera-setup-section",
];

/**
 * Traverses sections in pre-session setup using a center-relative distance metric.
 */
export function navigateSetupSection(direction: "next" | "prev") {
  if (typeof window === "undefined") return;
  const sections = SETUP_SECTION_IDS;
  const viewportCenter = window.innerHeight / 2;
  let closestIdx = 0;
  let minDiff = Infinity;

  sections.forEach((id, idx) => {
    const el = document.getElementById(id);
    if (el) {
      const rect = el.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const diff = Math.abs(center - viewportCenter);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    }
  });

  const nextIdx = direction === "next"
    ? Math.min(closestIdx + 1, sections.length - 1)
    : Math.max(closestIdx - 1, 0);

  const targetEl = document.getElementById(sections[nextIdx]);
  if (targetEl) {
    targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
    const heading = targetEl.querySelector("h2, h3");
    if (heading) {
      (heading as HTMLElement).focus();
    }
  }
}

/**
 * Reads aloud the summary/title description of the active setup section.
 */
export function readActiveSetupSection(speak: (text: string) => void) {
  if (typeof window === "undefined") return;
  const sections = [
    { id: "audio-coexistence-section", name: "Audio coexistence overrides. Choose silent, haptic only, brief speech, or full speech." },
    { id: "sleeve-status-section", name: "Haptic sleeve status. View and test connected physical sleeves." },
    { id: "ask-assistant-section", name: "Ask assistant. Submit text questions about the exercises." },
    { id: "voice-control-section", name: "Voice control settings. Enable hands-free voice command capture." },
    { id: "camera-setup-section", name: "Camera alignment preview. Setup your camera stance before starting the workout." },
  ];
  const viewportCenter = window.innerHeight / 2;
  let closestText = sections[0].name;
  let minDiff = Infinity;

  sections.forEach((s) => {
    const el = document.getElementById(s.id);
    if (el) {
      const rect = el.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const diff = Math.abs(center - viewportCenter);
      if (diff < minDiff) {
        minDiff = diff;
        closestText = s.name;
      }
    }
  });

  speak(closestText);
}
