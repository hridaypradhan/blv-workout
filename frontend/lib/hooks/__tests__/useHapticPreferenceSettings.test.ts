import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { HAPTIC_CATEGORY_DEFAULT_IDS } from "@/lib/userPreferences";
import { useHapticPreferenceSettings } from "../useHapticPreferenceSettings";

const getHapticVibrationsMock = vi.fn();

vi.mock("@/lib/api/haptic", () => ({
  getHapticVibrations: (...args: unknown[]) => getHapticVibrationsMock(...args),
}));

const manifestCandidates = [
  ...Object.entries(HAPTIC_CATEGORY_DEFAULT_IDS).map(([cueType, id]) => ({
    id,
    cue_type: cueType,
    label: cueType,
    source_wav: `/haptics/${id}.wav`,
    filename: `${id}.wav`,
    duration_ms: 1000,
    conversion_status: "pending_bhaptics_authoring",
  })),
  {
    id: "start_low_01_v-09-16-1-56",
    cue_type: "start",
    label: "alternate start",
    source_wav: "/haptics/start_low_01_v-09-16-1-56.wav",
    filename: "start_low_01_v-09-16-1-56.wav",
    duration_ms: 1000,
    conversion_status: "pending_bhaptics_authoring",
  },
];

describe("useHapticPreferenceSettings", () => {
  beforeEach(() => {
    getHapticVibrationsMock.mockReset();
    getHapticVibrationsMock.mockResolvedValue(manifestCandidates);
    localStorage.clear();
  });

  test("applies an asynchronously loaded backend preference profile", async () => {
    let backendPreferences: Record<string, string> | null = null;
    const { result, rerender } = renderHook(() =>
      useHapticPreferenceSettings(backendPreferences)
    );

    await waitFor(() => {
      expect(result.current.isVibrationsLoading).toBe(false);
    });

    backendPreferences = {
      ...HAPTIC_CATEGORY_DEFAULT_IDS,
      start: "start_low_01_v-09-16-1-56",
    };
    await act(async () => {
      rerender();
    });

    expect(result.current.hapticPreferences.start).toBe(
      "start_low_01_v-09-16-1-56"
    );

    backendPreferences = {
      ...HAPTIC_CATEGORY_DEFAULT_IDS,
      finish: HAPTIC_CATEGORY_DEFAULT_IDS.finish,
    };
    await act(async () => {
      rerender();
    });
    expect(result.current.hapticPreferences).toEqual(backendPreferences);
  });

  test("does not overwrite an unsaved selection on an unrelated rerender", async () => {
    const backendPreferences = { ...HAPTIC_CATEGORY_DEFAULT_IDS };
    const { result, rerender } = renderHook(() =>
      useHapticPreferenceSettings(backendPreferences)
    );

    await waitFor(() => {
      expect(result.current.isVibrationsLoading).toBe(false);
    });

    act(() => {
      result.current.handleHapticPrefChange(
        "start",
        "start_low_01_v-09-16-1-56"
      );
    });
    rerender();

    expect(result.current.hapticPreferences.start).toBe(
      "start_low_01_v-09-16-1-56"
    );
  });
});
