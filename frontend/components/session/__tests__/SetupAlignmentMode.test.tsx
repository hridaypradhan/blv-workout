import React from "react";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { SetupAlignmentMode } from "../SetupAlignmentMode";

interface MockPanelProps {
  onReadyChange: (isReady: boolean) => void;
  onGuidanceChange: (guidance: string, isReady: boolean) => void;
}

// Global mapping for triggering callbacks during testing
interface GlobalTestCallbacks {
  triggerReadyChange?: (isReady: boolean) => void;
  triggerGuidanceChange?: (guidance: string, isReady: boolean) => void;
}

// Mock the positioning guide panel to control ready/guidance state changes
vi.mock("../SetupPositioningGuidePanel", () => ({
  SetupPositioningGuidePanel: ({ onReadyChange, onGuidanceChange }: MockPanelProps) => {
    const globalContext = global as unknown as GlobalTestCallbacks;
    globalContext.triggerReadyChange = onReadyChange;
    globalContext.triggerGuidanceChange = onGuidanceChange;
    return <div data-testid="guide-panel" />;
  },
}));

describe("SetupAlignmentMode Component", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    stream: {} as MediaStream,
    requiredCameraOrientation: "front" as const,
    requiredBodyOrientation: "standing" as const,
    onStartWorkout: vi.fn(),
    isStarting: false,
    onReadyChange: vi.fn(),
    onGuidanceChange: vi.fn(),
    currentGuidance: "Position yourself in front of the camera.",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock HTMLMediaElement prototype functions to suppress jsdom warnings
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = vi.fn();
    HTMLMediaElement.prototype.load = vi.fn();

    // Mock SpeechSynthesis
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        speak: vi.fn(),
        cancel: vi.fn(),
      },
      writable: true,
    });
    
    const windowContext = window as unknown as Record<string, unknown>;
    windowContext.SpeechSynthesisUtterance = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("does not render when isOpen is false", () => {
    const { container } = render(<SetupAlignmentMode {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  test("renders all core UI elements in focused view", () => {
    render(<SetupAlignmentMode {...defaultProps} />);

    expect(screen.getByText("Hands-Free Camera Alignment")).toBeDefined();
    expect(screen.getByRole("button", { name: /Exit alignment mode/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Repeat current alignment instruction aloud/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Skip camera alignment and continue workout/i })).toBeDefined();
  });

  test("auto-starts countdown when stance becomes ready, then triggers start on 0", () => {
    const onStartWorkoutMock = vi.fn();
    render(<SetupAlignmentMode {...defaultProps} onStartWorkout={onStartWorkoutMock} />);

    // Simulate posture becomes ready
    const globalContext = global as unknown as GlobalTestCallbacks;
    act(() => {
      globalContext.triggerReadyChange?.(true);
    });

    // Verify visual countdown is active
    expect(screen.getByText("Hold still...")).toBeDefined();

    // Advance 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onStartWorkoutMock).toHaveBeenCalled();
  });

  test("stops countdown and returns to normal state if stance is lost", () => {
    const onStartWorkoutMock = vi.fn();
    render(<SetupAlignmentMode {...defaultProps} onStartWorkout={onStartWorkoutMock} />);

    // Simulate posture becomes ready
    const globalContext = global as unknown as GlobalTestCallbacks;
    act(() => {
      globalContext.triggerReadyChange?.(true);
    });

    expect(screen.getByText("Hold still...")).toBeDefined();

    // Simulate posture is lost (not ready)
    act(() => {
      globalContext.triggerReadyChange?.(false);
    });

    // Visual countdown overlay should be removed
    expect(screen.queryByText("Hold still...")).toBeNull();
    expect(onStartWorkoutMock).not.toHaveBeenCalled();
  });

  test("canceling countdown returns to alignment monitoring", () => {
    render(<SetupAlignmentMode {...defaultProps} />);

    const globalContext = global as unknown as GlobalTestCallbacks;
    act(() => {
      globalContext.triggerReadyChange?.(true);
    });

    const cancelCountdownBtn = screen.getByRole("button", { name: /Cancel countdown and continue adjusting position/i });
    expect(cancelCountdownBtn).toBeDefined();

    // Click cancel
    fireEvent.click(cancelCountdownBtn);

    expect(screen.queryByText("Hold still...")).toBeNull();
  });

  test("clicking cancel return button invokes onClose callback", () => {
    const onCloseMock = vi.fn();
    render(<SetupAlignmentMode {...defaultProps} onClose={onCloseMock} />);

    const cancelReturnBtn = screen.getByRole("button", { name: /Exit alignment mode and return to setup/i });
    fireEvent.click(cancelReturnBtn);

    expect(onCloseMock).toHaveBeenCalled();
  });

  test("traps focus and handles Escape to close", () => {
    const onCloseMock = vi.fn();
    render(<SetupAlignmentMode {...defaultProps} onClose={onCloseMock} />);

    // Escape closes when countdown is not active
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCloseMock).toHaveBeenCalled();
  });

  test("prevents page body scroll while modal is open", () => {
    const { unmount } = render(<SetupAlignmentMode {...defaultProps} />);
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  test("triggers countdown active and distinct ready changes, and handles parent cancellation trigger", () => {
    const onReadyChangeMock = vi.fn();
    const onCountdownActiveChangeMock = vi.fn();
    const { rerender } = render(
      <SetupAlignmentMode
        {...defaultProps}
        onReadyChange={onReadyChangeMock}
        onCountdownActiveChange={onCountdownActiveChangeMock}
        cancelCountdownTrigger={0}
      />
    );

    // Stance becomes ready
    const globalContext = global as unknown as { triggerReadyChange?: (ready: boolean) => void };
    act(() => {
      globalContext.triggerReadyChange?.(true);
    });

    expect(onReadyChangeMock).toHaveBeenCalledWith(true);
    expect(onCountdownActiveChangeMock).toHaveBeenCalledWith(true);

    // Parent increments cancel countdown trigger
    act(() => {
      rerender(
        <SetupAlignmentMode
          {...defaultProps}
          onReadyChange={onReadyChangeMock}
          onCountdownActiveChange={onCountdownActiveChangeMock}
          cancelCountdownTrigger={1}
        />
      );
    });

    expect(screen.queryByText("Starting workout...")).toBeNull();
    expect(onCountdownActiveChangeMock).toHaveBeenCalledWith(false);
  });
});
