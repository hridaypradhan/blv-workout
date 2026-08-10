import React from "react";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { CameraPositioningGate } from "../CameraPositioningGate";

vi.mock("../SetupPositioningGuidePanel", () => ({
  SetupPositioningGuidePanel: ({
    onReadyChange,
    onGuidanceChange,
    isCountdownActive,
  }: {
    onReadyChange?: (isReady: boolean) => void;
    onGuidanceChange?: (guidance: string, isReady: boolean) => void;
    isCountdownActive?: boolean;
  }) => (
    <div data-testid="guide-panel" data-countdown-active={String(isCountdownActive)}>
      <button onClick={() => { onGuidanceChange?.("Good position. Hold still.", true); onReadyChange?.(true); }}>
        Set Ready
      </button>
      <button onClick={() => { onGuidanceChange?.("Step back", false); onReadyChange?.(false); }}>
        Set Unready
      </button>
    </div>
  ),
}));

describe("CameraPositioningGate Component", () => {
  const mockOnClose = vi.fn();
  const mockOnComplete = vi.fn();
  const mockOnGuidanceChange = vi.fn();
  const mockOnRequestCamera = vi.fn().mockResolvedValue(undefined);
  const mockOnDisableGates = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    stream: null,
    requiredCameraOrientation: "landscape" as const,
    requiredBodyOrientation: "full_body" as const,
    onComplete: mockOnComplete,
    isActionPending: false,
    actionButtonLabel: "Skip Camera Alignment",
    title: "Camera Positioning Gate",
    subtitle: "Stance alignment required",
    currentGuidance: "Please step back",
    onGuidanceChange: mockOnGuidanceChange,
  };

  test("shows retry/change/disable controls when stream is null", () => {
    const devices = [
      { deviceId: "device-1", label: "FaceTime Camera", kind: "videoinput" as const, groupId: "grp-1", toJSON: () => {} },
      { deviceId: "device-2", label: "Logitech Webcam", kind: "videoinput" as const, groupId: "grp-2", toJSON: () => {} },
    ];

    const { getByText, getAllByText, getByLabelText } = render(
      <CameraPositioningGate
        {...defaultProps}
        stream={null}
        cameraStatus="permission_denied"
        cameraErrorMessage="Camera permission blocked."
        cameraDevices={devices}
        selectedCameraDeviceId="device-1"
        onRequestCamera={mockOnRequestCamera}
        onDisableCameraGatesForSession={mockOnDisableGates}
        preferredCameraLabel="Logitech Webcam"
      />
    );

    // Verify recovery title and status
    expect(getByText("Camera Connection Problem")).toBeDefined();
    expect(getAllByText("Camera permission blocked.").length).toBeGreaterThan(0);
    expect(getAllByText("Logitech Webcam").length).toBeGreaterThan(0);

    // Verify select dropdown and buttons
    const select = getByLabelText("Select Camera") as HTMLSelectElement;
    expect(select.value).toBe("device-1");

    const retryBtn = getByText("Retry Selected Camera");
    fireEvent.click(retryBtn);
    expect(mockOnRequestCamera).toHaveBeenCalledWith("device-1", true);

    const disableBtn = getByText("Disable Camera Checks for Session");
    fireEvent.click(disableBtn);
    expect(mockOnDisableGates).toHaveBeenCalled();
  });

  test("shows video viewfinder / normal preview when stream is ready", () => {
    // Mock a valid MediaStream
    const mockTrack = { stop: vi.fn() };
    const mockStream = {
      getTracks: () => [mockTrack],
      getVideoTracks: () => [mockTrack],
    } as unknown as MediaStream;

    const { queryByText, container } = render(
      <CameraPositioningGate
        {...defaultProps}
        stream={mockStream}
        cameraStatus="ready"
      />
    );

    // Recovery pane should NOT be present
    expect(queryByText("Camera Connection Problem")).toBeNull();

    // Viewfinder/video element should be present
    const video = container.querySelector("video");
    expect(video).toBeDefined();
    expect(video?.getAttribute("aria-label")).toBe("Camera alignment feed");
  });

  describe("Coordinated Alignment Speech & Countdown", () => {
    let mockCancel: ReturnType<typeof vi.fn>;
    let mockSpeak: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      vi.useFakeTimers();
      mockCancel = vi.fn();
      mockSpeak = vi.fn();

      Object.defineProperty(window, "speechSynthesis", {
        writable: true,
        value: {
          cancel: mockCancel,
          speak: mockSpeak,
        },
      });

      // Mock global SpeechSynthesisUtterance
      (global as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class {
        text: string;
        rate = 1.0;
        constructor(text: string) {
          this.text = text;
        }
      };
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test("starts countdown with single coordinated utterance and does not call cancel every second", () => {
      const mockTrack = { stop: vi.fn() };
      const mockStream = {
        getTracks: () => [mockTrack],
        getVideoTracks: () => [mockTrack],
      } as unknown as MediaStream;

      const { getByText } = render(
        <CameraPositioningGate
          {...defaultProps}
          stream={mockStream}
          cameraStatus="ready"
        />
      );

      // Trigger posture ready
      fireEvent.click(getByText("Set Ready"));

      // Single countdown utterance should be spoken once
      const spokenUtterances = mockSpeak.mock.calls.map((call) => (call[0] as { text: string }).text);
      expect(spokenUtterances).toContain("Position confirmed. Starting in 5, 4, 3, 2, 1.");
      expect(spokenUtterances).not.toContain("Good position. Hold still.");

      const initialCancelCount = mockCancel.mock.calls.length;

      // Advance timers by 3 seconds (3000ms)
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // Verify speechSynthesis.cancel was NOT called every second
      expect(mockCancel.mock.calls.length).toBe(initialCancelCount);
    });

    test("ready guidance is suppressed when countdown is active", () => {
      const mockTrack = { stop: vi.fn() };
      const mockStream = {
        getTracks: () => [mockTrack],
        getVideoTracks: () => [mockTrack],
      } as unknown as MediaStream;

      const { getByText, getByTestId } = render(
        <CameraPositioningGate
          {...defaultProps}
          stream={mockStream}
          cameraStatus="ready"
        />
      );

      fireEvent.click(getByText("Set Ready"));

      // Verify isCountdownActive prop passed to SetupPositioningGuidePanel is true
      const guidePanel = getByTestId("guide-panel");
      expect(guidePanel.getAttribute("data-countdown-active")).toBe("true");

      const spokenUtterances = mockSpeak.mock.calls.map((call) => (call[0] as { text: string }).text);
      expect(spokenUtterances).not.toContain("Good position. Hold still.");
    });

    test("cancelling countdown cancels speech once and speaks cancellation message once", () => {
      const mockTrack = { stop: vi.fn() };
      const mockStream = {
        getTracks: () => [mockTrack],
        getVideoTracks: () => [mockTrack],
      } as unknown as MediaStream;

      const { getByText } = render(
        <CameraPositioningGate
          {...defaultProps}
          stream={mockStream}
          cameraStatus="ready"
        />
      );

      fireEvent.click(getByText("Set Ready"));
      mockSpeak.mockClear();
      mockCancel.mockClear();

      // Click cancel countdown button
      fireEvent.click(getByText("Cancel Countdown"));

      expect(mockCancel).toHaveBeenCalledTimes(1);
      const spokenUtterances = mockSpeak.mock.calls.map((call) => (call[0] as { text: string }).text);
      expect(spokenUtterances).toEqual(["Countdown cancelled."]);
    });

    test("losing position cancels countdown speech once and announces position lost", () => {
      const mockTrack = { stop: vi.fn() };
      const mockStream = {
        getTracks: () => [mockTrack],
        getVideoTracks: () => [mockTrack],
      } as unknown as MediaStream;

      const { getByText } = render(
        <CameraPositioningGate
          {...defaultProps}
          stream={mockStream}
          cameraStatus="ready"
        />
      );

      fireEvent.click(getByText("Set Ready"));
      mockSpeak.mockClear();
      mockCancel.mockClear();

      // Set posture unready
      fireEvent.click(getByText("Set Unready"));

      expect(mockCancel).toHaveBeenCalledTimes(1);
      const spokenUtterances = mockSpeak.mock.calls.map((call) => (call[0] as { text: string }).text);
      expect(spokenUtterances).toEqual(["Position lost. Resuming setup."]);
    });
  });
});
