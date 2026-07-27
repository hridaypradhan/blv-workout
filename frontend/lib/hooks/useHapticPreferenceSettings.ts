import { useState, useEffect, useRef, useCallback } from "react";
import { HapticVibrationCandidate, HapticPreferences } from "@/types";
import { getHapticVibrations } from "@/lib/api/haptic";
import { normalizeHapticPreferences } from "@/lib/userPreferences";

export interface UseHapticPreferenceSettingsReturn {
  hapticPreferences: HapticPreferences;
  vibrations: HapticVibrationCandidate[];
  isVibrationsLoading: boolean;
  handleHapticPrefChange: (categoryKey: string, candidateId: string) => void;
}

/**
 * Sole owner of haptic preference initialization and manifest-backed normalization.
 *
 * Lifecycle:
 * 1. Load vibration manifest once.
 * 2. Normalize backend preferences against manifest IDs after candidates are available.
 * 3. Repair malformed localStorage once after manifest loads.
 * 4. Expose a change handler for Settings UI selectors.
 * 5. localStorage is NOT written on every selector change — only on Save.
 */
export function useHapticPreferenceSettings(
  initialPrefs?: HapticPreferences | Record<string, unknown> | null
): UseHapticPreferenceSettingsReturn {
  const [hapticPreferences, setHapticPreferences] = useState<HapticPreferences>(() => {
    return normalizeHapticPreferences(initialPrefs as Record<string, unknown> | null);
  });
  const [vibrations, setVibrations] = useState<HapticVibrationCandidate[]>([]);
  const [isVibrationsLoading, setIsVibrationsLoading] = useState(true);
  const hasNormalizedRef = useRef(false);
  const hasLoadedManifestRef = useRef(false);
  const lastAppliedProfileKeyRef = useRef<string | null>(null);

  // Fetch vibrations from manifest API exactly once
  useEffect(() => {
    if (hasLoadedManifestRef.current) return;
    hasLoadedManifestRef.current = true;

    async function loadVibrations() {
      try {
        setIsVibrationsLoading(true);
        const data = await getHapticVibrations();
        setVibrations(data);
      } catch (err) {
        console.error("Failed to load haptic options:", err);
      } finally {
        setIsVibrationsLoading(false);
      }
    }
    loadVibrations();
  }, []);

  // User profiles load asynchronously. Apply each distinct backend preference
  // snapshot once, and revalidate it after the manifest becomes available.
  useEffect(() => {
    if (!initialPrefs) return;

    const validIds = vibrations.length > 0 ? vibrations.map((v) => v.id) : undefined;
    const profileKey = JSON.stringify({
      preferences: initialPrefs,
      manifestIds: validIds ?? null,
    });
    if (profileKey === lastAppliedProfileKeyRef.current) return;

    lastAppliedProfileKeyRef.current = profileKey;
    setHapticPreferences(
      normalizeHapticPreferences(initialPrefs as Record<string, unknown>, validIds)
    );
  }, [initialPrefs, vibrations]);

  // Once vibrations load: normalize prefs against manifest, repair localStorage once
  useEffect(() => {
    if (isVibrationsLoading || vibrations.length === 0) return;
    if (hasNormalizedRef.current) return;
    hasNormalizedRef.current = true;

    const validIds = vibrations.map((v) => v.id);

    // If there is no backend profile yet, normalize the current defaults against
    // the manifest. A later profile load is handled by the effect above.
    if (!initialPrefs) {
      setHapticPreferences((prev) =>
        normalizeHapticPreferences(prev as Record<string, unknown>, validIds)
      );
    }

    // Repair stale/malformed localStorage once
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("fita11y_haptic_preferences");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const normalized = normalizeHapticPreferences(parsed, validIds);
          localStorage.setItem("fita11y_haptic_preferences", JSON.stringify(normalized));
        } catch {
          const normalizedDefaults = normalizeHapticPreferences({}, validIds);
          localStorage.setItem("fita11y_haptic_preferences", JSON.stringify(normalizedDefaults));
        }
      }
    }
  }, [initialPrefs, isVibrationsLoading, vibrations]);

  // Update local state when selector changes — does NOT write to localStorage
  const handleHapticPrefChange = useCallback((categoryKey: string, candidateId: string) => {
    setHapticPreferences((prev) => ({
      ...prev,
      [categoryKey]: candidateId,
    }));
  }, []);

  return {
    hapticPreferences,
    vibrations,
    isVibrationsLoading,
    handleHapticPrefChange,
  };
}
