import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CurrentAutomaticCuePanel from "../CurrentAutomaticCuePanel";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

const baseCue = {
  text: "Keep your chest up",
  type: "cue_plan",
  timestamp: new Date("2026-01-01T12:00:00"),
  videoTime: 10,
};

const baseProps = {
  formatTime,
  isLoadingCuePlan: false,
  cuePlanError: null,
  isLoadingManifest: false,
  manifestError: null,
};

describe("CurrentAutomaticCuePanel", () => {
  test("shows empty state when no cue has been received", () => {
    render(
      <CurrentAutomaticCuePanel
        latestAutomaticCue={null}
        isAutomaticCueActive={false}
        {...baseProps}
      />
    );

    expect(screen.getByText(/no automatic cues received yet/i)).toBeTruthy();
    expect(screen.queryByTestId("cue-content-active")).toBeNull();
    expect(screen.queryByTestId("cue-active-dot")).toBeNull();
  });

  test("renders cue text when active", () => {
    render(
      <CurrentAutomaticCuePanel
        latestAutomaticCue={baseCue}
        isAutomaticCueActive={true}
        {...baseProps}
      />
    );

    const activeContent = screen.getByTestId("cue-content-active");
    expect(activeContent).toBeTruthy();
    expect(activeContent.textContent).toContain("Keep your chest up");
    expect(screen.getByTestId("cue-active-dot")).toBeTruthy();
  });

  test("does not render stale cue text when inactive", () => {
    render(
      <CurrentAutomaticCuePanel
        latestAutomaticCue={baseCue}
        isAutomaticCueActive={false}
        {...baseProps}
      />
    );

    // Stale cue text must not appear anywhere in the panel
    expect(screen.queryByText(/Keep your chest up/)).toBeNull();
    expect(screen.queryByTestId("cue-content-active")).toBeNull();
    expect(screen.queryByTestId("cue-active-dot")).toBeNull();
  });

  test("shows neutral empty message when cue exists but is inactive", () => {
    render(
      <CurrentAutomaticCuePanel
        latestAutomaticCue={baseCue}
        isAutomaticCueActive={false}
        {...baseProps}
      />
    );

    expect(screen.getByText(/no cue active at this playback position/i)).toBeTruthy();
  });

  test("does not show 'Last cue' or 'Was at' when inactive", () => {
    render(
      <CurrentAutomaticCuePanel
        latestAutomaticCue={baseCue}
        isAutomaticCueActive={false}
        {...baseProps}
      />
    );

    expect(screen.queryByText(/last cue/i)).toBeNull();
    expect(screen.queryByText(/was at/i)).toBeNull();
  });

  test("aria-label reflects active state", () => {
    const { container, rerender } = render(
      <CurrentAutomaticCuePanel
        latestAutomaticCue={baseCue}
        isAutomaticCueActive={true}
        {...baseProps}
      />
    );

    const section = container.querySelector("section");
    expect(section?.getAttribute("aria-label")).toContain("active");

    rerender(
      <CurrentAutomaticCuePanel
        latestAutomaticCue={baseCue}
        isAutomaticCueActive={false}
        {...baseProps}
      />
    );

    expect(section?.getAttribute("aria-label")).toBe("Current Assistant Cue");
  });
});
