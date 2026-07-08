import React from "react";
import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LiveHapticStatusPanel from "../LiveHapticStatusPanel";
import { HapticEventLog } from "@/lib/hooks/useHapticEventDelivery";

describe("LiveHapticStatusPanel", () => {
  const defaultDevices = [
    { key: "left_arm", name: "Left Arm", status_text: "Disconnected", connected: false },
    { key: "right_arm", name: "Right Arm", status_text: "Connected", connected: true },
  ];

  const sampleEvents: HapticEventLog[] = [
    {
      timestamp: Date.now(),
      eventName: "bicep_left",
      deliveryMode: "hardware",
      targetLimbs: ["left_arm"],
      statusMessage: "Fired successfully",
    },
    {
      timestamp: Date.now() - 1000,
      eventName: "squat_down",
      deliveryMode: "indicator",
      targetLimbs: ["left_leg", "right_leg"],
      statusMessage: "Simulated",
    },
  ];

  test("maintains stable fixed height to prevent layout shifts", () => {
    const { container } = render(
      <LiveHapticStatusPanel
        deviceStatuses={defaultDevices}
        recentEvents={sampleEvents}
        hapticStatusText="Connected"
      />
    );

    const section = container.querySelector("#live-haptic-status-panel");
    expect(section).toBeTruthy();
    // Verify it contains class h-[220px] and min-h-[220px] to preserve layout constraints
    expect(section?.className).toContain("h-[220px]");
    expect(section?.className).toContain("min-h-[220px]");
  });

  test("shows sleeve statuses correctly", () => {
    render(
      <LiveHapticStatusPanel
        deviceStatuses={defaultDevices}
        recentEvents={sampleEvents}
        hapticStatusText="Connected"
      />
    );

    expect(screen.getByLabelText("Left Arm: Disconnected")).toBeDefined();
    expect(screen.getByLabelText("Right Arm: Connected")).toBeDefined();
  });

  test("hides visual feed by default when hardware is active, but permits manual toggling", () => {
    render(
      <LiveHapticStatusPanel
        deviceStatuses={defaultDevices}
        recentEvents={sampleEvents}
        hapticStatusText="Connected"
      />
    );

    // Hardware is active (Right Arm is connected), so the noisy feed is hidden by default
    expect(screen.getByText(/Visual log hidden by default/i)).toBeDefined();
    expect(screen.queryByText("bicep_left")).toBeNull();

    // Click Show Log
    const toggleBtn = screen.getByLabelText("Show visual haptic event log");
    fireEvent.click(toggleBtn);

    // Event log should be displayed now
    expect(screen.getByText("bicep_left")).toBeDefined();
    expect(screen.getByText("squat_down")).toBeDefined();
  });

  test("shows visual fallback status log automatically when no hardware is active", () => {
    const disconnectedDevices = defaultDevices.map((d) => ({ ...d, connected: false }));
    render(
      <LiveHapticStatusPanel
        deviceStatuses={disconnectedDevices}
        recentEvents={sampleEvents}
        hapticStatusText="Indicator Fallback"
      />
    );

    // Since no hardware is connected, it should immediately render the fallback/dry-run feed
    expect(screen.queryByText(/Visual log hidden by default/i)).toBeNull();
    expect(screen.getByText("bicep_left")).toBeDefined();
    expect(screen.getByText("squat_down")).toBeDefined();
  });

  test("does not trigger speech synthesis for haptic events", () => {
    const speakSpy = vi.fn();
    Object.defineProperty(window, "speechSynthesis", {
      value: { speak: speakSpy },
      writable: true,
      configurable: true,
    });

    render(
      <LiveHapticStatusPanel
        deviceStatuses={defaultDevices}
        recentEvents={sampleEvents}
        hapticStatusText="Connected"
      />
    );

    // Speech synthesis must NOT be called on panel mount or render
    expect(speakSpy).not.toHaveBeenCalled();
  });
});
