import { describe, test, expect, beforeEach } from "vitest";
import { normalizeHapticPreferences, HAPTIC_CATEGORY_DEFAULT_IDS } from "../../../lib/userPreferences";

describe("Settings Haptic Preference Storage Normalization & Repair Tests", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("normalizes valid stored preferences and migrates legacy key aliases", () => {
    const legacyRaw = {
      per_rep_tick: "reps_high_01_v-09-16-1-43",
      cooldown: "finish_high_01_v-09-10-12-2",
      speed_up: "speed_up_high_01_v-09-10-3-52",
    };

    const normalized = normalizeHapticPreferences(legacyRaw);
    expect(normalized).toEqual({
      start: HAPTIC_CATEGORY_DEFAULT_IDS.start,
      finish: "finish_high_01_v-09-10-12-2",
      reps: "reps_high_01_v-09-16-1-43",
      speed_up: "speed_up_high_01_v-09-10-3-52",
      slow_down: HAPTIC_CATEGORY_DEFAULT_IDS.slow_down,
    });
  });

  test("replaces cross-category candidates with category defaults", () => {
    const crossCategoryRaw = {
      start: "reps_high_01_v-09-16-1-43",
      finish: "finish_high_01_v-09-10-12-2",
    };

    const normalized = normalizeHapticPreferences(crossCategoryRaw);
    expect(normalized.start).toBe(HAPTIC_CATEGORY_DEFAULT_IDS.start);
    expect(normalized.finish).toBe("finish_high_01_v-09-10-12-2");
  });

  test("replaces malformed localStorage JSON with canonical defaults", () => {
    localStorage.setItem("fita11y_haptic_preferences", "{ malformed json syntax ### ");

    const stored = localStorage.getItem("fita11y_haptic_preferences");
    let parsed = null;
    try {
      if (stored) parsed = JSON.parse(stored);
    } catch {
      // Malformed JSON caught
    }

    const normalizedDefaults = normalizeHapticPreferences(parsed || {});
    localStorage.setItem("fita11y_haptic_preferences", JSON.stringify(normalizedDefaults));

    const repaired = JSON.parse(localStorage.getItem("fita11y_haptic_preferences") || "{}");
    expect(repaired).toEqual(HAPTIC_CATEGORY_DEFAULT_IDS);
  });
});
