import React from "react";
import { describe, test, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { CameraPositioningGate } from "../CameraPositioningGate";

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
});
