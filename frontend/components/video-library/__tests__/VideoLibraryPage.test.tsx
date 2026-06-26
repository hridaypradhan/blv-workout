import React from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, waitFor, act } from "@testing-library/react";
import VideoLibraryPage from "../VideoLibraryPage";
import { getJobs } from "@/lib/api";
import { ProcessingStage } from "@/types";
import { LayoutProvider } from "@/components/layout/LayoutContext";
import { UserProfileProvider } from "@/components/layout/UserProfileContext";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getJobs: vi.fn(),
    deleteVideo: vi.fn(),
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/video-library",
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe("VideoLibraryPage - Jobs Polling Behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default visibilityState is visible
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      writable: true,
      configurable: true,
    });
  });

  test("initial fetch happens once under normal render", async () => {
    vi.mocked(getJobs).mockResolvedValue([]);

    render(
      <UserProfileProvider>
        <LayoutProvider>
          <VideoLibraryPage />
        </LayoutProvider>
      </UserProfileProvider>
    );

    await waitFor(() => {
      expect(getJobs).toHaveBeenCalledTimes(1);
    });
  });

  test("active jobs trigger polling every 12 seconds", async () => {
    vi.useFakeTimers();
    // 1 active job (transcribing)
    const activeJobs = [
      {
        video_id: "vid-1",
        youtube_url: "https://youtube.com/watch?v=123",
        stage: ProcessingStage.TRANSCRIBING,
        title: "Active Workout",
      },
    ];

    vi.mocked(getJobs).mockResolvedValueOnce(activeJobs);

    render(
      <UserProfileProvider>
        <LayoutProvider>
          <VideoLibraryPage />
        </LayoutProvider>
      </UserProfileProvider>
    );

    // Resolve initial load using runOnlyPendingTimers
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(getJobs).toHaveBeenCalledTimes(1);

    vi.mocked(getJobs).mockResolvedValueOnce(activeJobs);

    // Advance timer by 12 seconds
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12000);
    });

    expect(apiCallCount(getJobs)).toBe(2);
    vi.useRealTimers();
  });

  test("completed/failed jobs do not keep polling", async () => {
    vi.useFakeTimers();
    // All terminal jobs (completed)
    const terminalJobs = [
      {
        video_id: "vid-2",
        youtube_url: "https://youtube.com/watch?v=456",
        stage: ProcessingStage.COMPLETED,
        title: "Finished Workout",
      },
    ];

    vi.mocked(getJobs).mockResolvedValueOnce(terminalJobs);

    render(
      <UserProfileProvider>
        <LayoutProvider>
          <VideoLibraryPage />
        </LayoutProvider>
      </UserProfileProvider>
    );

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(getJobs).toHaveBeenCalledTimes(1);

    // Advance timer by 12 seconds
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12000);
    });

    // Should still only be 1 (initial fetch), no polling interval started
    expect(getJobs).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  test("polling does not overlap if a request is still in flight", async () => {
    vi.useFakeTimers();
    const activeJobs = [
      {
        video_id: "vid-3",
        youtube_url: "https://youtube.com/watch?v=789",
        stage: ProcessingStage.TRANSCRIBING,
        title: "Active Workout 2",
      },
    ];

    // Initial fetch resolves immediately
    vi.mocked(getJobs).mockResolvedValueOnce(activeJobs);

    render(
      <UserProfileProvider>
        <LayoutProvider>
          <VideoLibraryPage />
        </LayoutProvider>
      </UserProfileProvider>
    );

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(getJobs).toHaveBeenCalledTimes(1);

    // We'll mock getJobs to return a promise that doesn't resolve immediately
    let resolvePollPromise: (value: unknown) => void = () => {};
    const pollPromise = new Promise((resolve) => {
      resolvePollPromise = resolve;
    });
    vi.mocked(getJobs).mockReturnValueOnce(pollPromise);

    // Advance 12 seconds to trigger the first poll request (now in-flight)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12000);
    });

    expect(getJobs).toHaveBeenCalledTimes(2);

    // Advance another 12 seconds while first poll is still in-flight
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12000);
    });

    // Expect to still have only 2 calls total because request is in flight
    expect(getJobs).toHaveBeenCalledTimes(2);

    // Resolve the promise
    await act(async () => {
      resolvePollPromise(activeJobs);
    });

    // Now that the request finished, advance 12 more seconds
    vi.mocked(getJobs).mockResolvedValueOnce(activeJobs);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12000);
    });

    // Expect the 3rd call to happen now
    expect(getJobs).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});

function apiCallCount(mockFn: { mock: { calls: unknown[] } }) {
  return mockFn.mock.calls.length;
}
