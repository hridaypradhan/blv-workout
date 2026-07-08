import React from "react";
import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CameraSetupPreview, CameraSetupPreviewProps } from "../CameraSetupPreview";

describe("CameraSetupPreview Component", () => {
  const defaultProps: CameraSetupPreviewProps = {
    status: "idle",
    statusLabel: "Camera is currently inactive.",
    errorMessage: null,
    stream: null,
    devices: [],
    selectedDeviceId: "",
    setSelectedDeviceId: vi.fn(),
    requestCamera: vi.fn(),
    stopCamera: vi.fn(),
  };

  test("renders idle state with offline placeholders", () => {
    render(<CameraSetupPreview {...defaultProps} />);

    expect(screen.getByText("Camera preview is currently offline.")).toBeDefined();
    expect(screen.getByText("Status: IDLE")).toBeDefined();
    expect(screen.getByRole("button", { name: /Start camera preview/i })).toBeDefined();
    expect(
      screen.getByText(
        /Note: Camera preview is used for setup. MediaPipe setup alignment runs locally when the camera is enabled. Live workout repetition counting and form checking use local MediaPipe tracking for supported exercises, falling back to prototype simulation automatically when unavailable./i
      )
    ).toBeDefined();
  });

  test("renders ready state with active stream video preview", () => {
    const mockStream = {};
    const onStartAlignmentMock = vi.fn();
    render(
      <CameraSetupPreview
        {...defaultProps}
        status="ready"
        statusLabel="Camera feed is active and running."
        stream={mockStream as MediaStream}
        onStartAlignment={onStartAlignmentMock}
      />
    );

    const videoElement = screen.getByLabelText("Camera preview feed");
    expect(videoElement).toBeDefined();
    expect(videoElement.tagName).toBe("VIDEO");
    expect(screen.getByText("Status: READY")).toBeDefined();
    expect(screen.getByRole("button", { name: /Stop camera preview/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Start hands-free camera alignment mode/i })).toBeDefined();
  });

  test("renders error message with role='alert'", () => {
    render(
      <CameraSetupPreview
        {...defaultProps}
        status="error"
        statusLabel="Camera error: Device conflict."
        errorMessage="Could not start video source due to hardware conflict."
      />
    );

    const alert = screen.getByRole("alert");
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain("Could not start video source due to hardware conflict.");
    expect(screen.getByText("Status: ERROR")).toBeDefined();
  });

  test("fires setSelectedDeviceId callback and requestCamera when selecting a device", () => {
    const mockSetSelectedDeviceId = vi.fn();
    const mockRequestCamera = vi.fn().mockResolvedValue(undefined);
    const mockDevices = [
      { kind: "videoinput", deviceId: "cam-1", label: "Front Camera" },
      { kind: "videoinput", deviceId: "cam-2", label: "Back Camera" },
    ] as unknown as MediaDeviceInfo[];

    render(
      <CameraSetupPreview
        {...defaultProps}
        status="ready"
        devices={mockDevices}
        selectedDeviceId="cam-1"
        setSelectedDeviceId={mockSetSelectedDeviceId}
        requestCamera={mockRequestCamera}
      />
    );

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select).toBeDefined();
    expect(select.value).toBe("cam-1");

    fireEvent.change(select, { target: { value: "cam-2" } });

    expect(mockSetSelectedDeviceId).toHaveBeenCalledWith("cam-2");
    expect(mockRequestCamera).toHaveBeenCalledWith("cam-2");
  });
});
