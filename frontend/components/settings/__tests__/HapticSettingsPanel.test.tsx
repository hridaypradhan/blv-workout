/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import HapticSettingsPanel from "../HapticSettingsPanel";

const mockGetHapticEventMap = vi.fn();
const mockTriggerHapticPattern = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual("@/lib/api");
  return {
    ...actual,
    getHapticEventMap: (...args: any[]) => mockGetHapticEventMap(...args),
    triggerHapticPattern: (...args: any[]) => mockTriggerHapticPattern(...args),
  };
});

describe("HapticSettingsPanel Component", () => {
  const vibrations = [
    { id: "v1", cue_type: "start", label: "Start Vibration 1", source_wav: "wav1.wav", filename: "wav1.wav", duration_ms: 500, conversion_status: "converted" },
    { id: "v2", cue_type: "reps", label: "Reps Vibration 1", source_wav: "wav2.wav", filename: "wav2.wav", duration_ms: 200, conversion_status: "converted" },
  ];
  const hapticPreferences = {
    start: "v1",
    finish: "",
    reps: "v2",
    speed_up: "",
    slow_down: "",
  };
  const mockOnHapticPrefChange = vi.fn();
  const mockPreviewWav = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders event mapping definitions after fetch resolves", async () => {
    mockGetHapticEventMap.mockResolvedValue([
      { cue_type: "start", bhaptics_event_name: "assist_start", label: "Custom Start Label", description: "Custom start desc" },
    ]);

    render(
      <HapticSettingsPanel
        hapticPreferences={hapticPreferences}
        onHapticPrefChange={mockOnHapticPrefChange}
        vibrations={vibrations}
        previewWav={mockPreviewWav}
      />
    );

    expect(screen.getByText(/Loading event mapping definitions.../i)).toBeDefined();

    await waitFor(() => {
      expect(screen.queryByText(/Loading event mapping definitions.../i)).toBeNull();
    });

    expect(screen.getByText("Custom Start Label")).toBeDefined();
    expect(screen.getByText("Custom start desc")).toBeDefined();
    expect(screen.getByText("bHaptics Event: assist_start")).toBeDefined();
  });

  test("falls back to default event mapping if api request fails", async () => {
    mockGetHapticEventMap.mockRejectedValue(new Error("API offline"));

    render(
      <HapticSettingsPanel
        hapticPreferences={hapticPreferences}
        onHapticPrefChange={mockOnHapticPrefChange}
        vibrations={vibrations}
        previewWav={mockPreviewWav}
      />
    );

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).toBeNull();
    });

    expect(screen.getByText("Session Start Cue")).toBeDefined();
    expect(screen.getByText("Repetition Guidance Cue")).toBeDefined();
  });

  test("triggers test haptic event and displays diagnostics", async () => {
    mockGetHapticEventMap.mockResolvedValue([
      { cue_type: "start", bhaptics_event_name: "assist_start", label: "Session Start Cue", description: "Start desc" },
    ]);
    mockTriggerHapticPattern.mockResolvedValue({
      status: "triggered",
      delivery_mode: "hardware",
      bhaptics_event_name: "assist_start",
      hardware_available: true,
      player_available: true,
      provider: "bhaptics",
      status_message: "Device was pulsed",
    });

    render(
      <HapticSettingsPanel
        hapticPreferences={hapticPreferences}
        onHapticPrefChange={mockOnHapticPrefChange}
        vibrations={vibrations}
        previewWav={mockPreviewWav}
      />
    );

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).toBeNull();
    });

    const testBtn = screen.getByTitle("Trigger test for assist_start");
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(screen.getByText(/Fired on physical sleeves/i)).toBeDefined();
    });

    expect(screen.getAllByText(/Device was pulsed/i).length).toBeGreaterThan(0);
  });
});
