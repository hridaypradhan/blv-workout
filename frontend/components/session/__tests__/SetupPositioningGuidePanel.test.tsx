import React from "react";
import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SetupPositioningGuidePanel } from "../SetupPositioningGuidePanel";

// Mock the pose landmarker hook
vi.mock("@/lib/hooks/useMediaPipePoseLandmarker", () => ({
  useMediaPipePoseLandmarker: vi.fn(),
}));

import { useMediaPipePoseLandmarker } from "@/lib/hooks/useMediaPipePoseLandmarker";

describe("SetupPositioningGuidePanel Component", () => {
  const mockUseMediaPipePoseLandmarker = vi.mocked(useMediaPipePoseLandmarker);

  test("renders nothing when stream is null", () => {
    mockUseMediaPipePoseLandmarker.mockReturnValue({
      isLoading: false,
      error: null,
      poseResult: null,
      isModelLoaded: false,
    });

    const { container } = render(
      <SetupPositioningGuidePanel
        stream={null}
        requiredCameraOrientation="front"
        requiredBodyOrientation="standing"
      />
    );

    expect(container.firstChild).toBeNull();
  });

  test("renders model loading overlay", () => {
    mockUseMediaPipePoseLandmarker.mockReturnValue({
      isLoading: true,
      error: null,
      poseResult: null,
      isModelLoaded: false,
    });

    const mockStream = {};
    render(
      <SetupPositioningGuidePanel
        stream={mockStream as MediaStream}
        requiredCameraOrientation="front"
        requiredBodyOrientation="standing"
      />
    );

    expect(screen.getByText(/Loading posture engine/i)).toBeDefined();
  });

  test("renders error message with role='alert'", () => {
    mockUseMediaPipePoseLandmarker.mockReturnValue({
      isLoading: false,
      error: "GPU delegate not supported",
      poseResult: null,
      isModelLoaded: false,
    });

    const mockStream = {};
    render(
      <SetupPositioningGuidePanel
        stream={mockStream as MediaStream}
        requiredCameraOrientation="front"
        requiredBodyOrientation="standing"
      />
    );

    const alert = screen.getByRole("alert");
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain("GPU delegate not supported");
  });

  test("renders positioning instructions when model is loaded", () => {
    mockUseMediaPipePoseLandmarker.mockReturnValue({
      isLoading: false,
      error: null,
      poseResult: null,
      isModelLoaded: true,
    });

    const mockStream = {};
    render(
      <SetupPositioningGuidePanel
        stream={mockStream as MediaStream}
        requiredCameraOrientation="front"
        requiredBodyOrientation="standing"
      />
    );

    expect(screen.getByText("Alignment Guide")).toBeDefined();
    expect(
      screen.getByText(
        /This alignment check runs locally in your browser. It does not send any data to a server./i
      )
    ).toBeDefined();
  });
});
