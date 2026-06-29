import React from "react";
import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import VoiceControlPanel from "../VoiceControlPanel";

describe("VoiceControlPanel", () => {
  const baseProps = {
    voiceStatus: "idle" as const,
    startVoice: vi.fn(),
    stopVoice: vi.fn(),
    lastTranscript: "",
    voiceError: null as string | null,
  };

  // -- Idle state --
  test("idle state shows 'Voice Off' label", () => {
    render(<VoiceControlPanel {...baseProps} />);
    expect(screen.getByText("Voice Off")).toBeDefined();
  });

  // -- Listening state --
  test("listening state shows 'Listening' label", () => {
    render(<VoiceControlPanel {...baseProps} voiceStatus="listening" />);
    expect(screen.getByText("Listening")).toBeDefined();
  });

  // -- Unsupported state --
  test("unsupported state disables the mic button", () => {
    render(<VoiceControlPanel {...baseProps} voiceStatus="unsupported" />);
    const btn = screen.getByRole("button");
    expect(btn).toBeDefined();
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  // -- Error state: readable message --
  test("error state shows 'Service Unavailable' label, not raw code", () => {
    render(
      <VoiceControlPanel
        {...baseProps}
        voiceStatus="error"
        voiceError="Browser speech service is unavailable. Manual controls still work."
      />
    );
    // Label should be "Service Unavailable", not "Error"
    expect(screen.getByText("Service Unavailable")).toBeDefined();
    // The user-friendly message should appear, not the raw code "network"
    expect(
      screen.getByText(
        "Browser speech service is unavailable. Manual controls still work."
      )
    ).toBeDefined();
    // "network" should NOT appear as standalone text
    expect(screen.queryByText("network")).toBeNull();
  });

  // -- Error has role="alert" --
  test("error message has role='alert' for screen readers", () => {
    render(
      <VoiceControlPanel
        {...baseProps}
        voiceStatus="error"
        voiceError="No microphone was detected."
      />
    );
    const alert = screen.getByRole("alert");
    expect(alert).toBeDefined();
    expect(alert.textContent).toBe("No microphone was detected.");
  });

  // -- Error state allows retry --
  test("mic button is NOT disabled in error state", () => {
    render(
      <VoiceControlPanel
        {...baseProps}
        voiceStatus="error"
        voiceError="Browser speech service is unavailable. Manual controls still work."
      />
    );
    const btn = screen.getByRole("button");
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  test("clicking mic button in error state calls startVoice (retry)", () => {
    const startVoice = vi.fn();
    render(
      <VoiceControlPanel
        {...baseProps}
        voiceStatus="error"
        voiceError="Browser speech service is unavailable. Manual controls still work."
        startVoice={startVoice}
      />
    );
    fireEvent.click(screen.getByRole("button"));
    expect(startVoice).toHaveBeenCalledTimes(1);
  });

  // -- Error state aria-label --
  test("mic button has retry aria-label in error state", () => {
    render(
      <VoiceControlPanel
        {...baseProps}
        voiceStatus="error"
        voiceError="Some error"
      />
    );
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("aria-label")).toBe(
      "Voice control error. Click to retry."
    );
  });

  // -- Listening toggles to stop --
  test("clicking mic button while listening calls stopVoice", () => {
    const stopVoice = vi.fn();
    render(
      <VoiceControlPanel
        {...baseProps}
        voiceStatus="listening"
        stopVoice={stopVoice}
      />
    );
    fireEvent.click(screen.getByRole("button"));
    expect(stopVoice).toHaveBeenCalledTimes(1);
  });

  // -- Transcript display --
  test("shows last transcript when present", () => {
    render(
      <VoiceControlPanel {...baseProps} lastTranscript="pause" voiceStatus="listening" />
    );
    expect(screen.getByText(/pause/)).toBeDefined();
  });

  // -- Unsupported browser descriptive copy --
  test("unsupported state shows descriptive copy, not just 'unsupported'", () => {
    render(<VoiceControlPanel {...baseProps} voiceStatus="unsupported" />);
    expect(screen.getByText("Voice Unsupported")).toBeDefined();
    expect(
      screen.getByText("Your browser does not support voice control.")
    ).toBeDefined();
  });

  // -- Transcript display is passive (no command reprocessing) --
  test("transcript display does not render any interactive command elements", () => {
    const { container } = render(
      <VoiceControlPanel {...baseProps} lastTranscript="ask how is my form" voiceStatus="listening" />
    );
    // The transcript should appear as passive text, not as a button or link
    expect(screen.getByText(/ask how is my form/)).toBeDefined();
    // Ensure no additional buttons beyond the mic toggle
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(1); // Only the mic toggle button
  });

  // -- Error state shows service description --
  test("error state shows fallback guidance description", () => {
    render(
      <VoiceControlPanel
        {...baseProps}
        voiceStatus="error"
        voiceError="Browser speech service is unavailable. Manual controls still work."
      />
    );
    expect(
      screen.getByText("Voice recognition service failed. Manual controls still work.")
    ).toBeDefined();
  });
});
