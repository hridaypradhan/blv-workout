/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import ProcessVideo from "../page";
import { submitVideo } from "@/lib/api";
import { ProcessingStage } from "@/types";
import { LayoutProvider } from "@/components/layout/LayoutContext";
import { UserProfileProvider } from "@/components/layout/UserProfileContext";

// Mock API
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    submitVideo: vi.fn(),
    getSSEUrl: vi.fn((vid) => `http://localhost/api/sse/${vid}`),
  };
});

// Mock Router
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/process",
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock EventSource
class MockEventSource {
  url: string;
  listeners: Record<string, ((event: any) => void)[]> = {};
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(event: string, callback: (event: any) => void) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  emit(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((cb) => cb(data));
    }
  }

  emitError() {
    if (this.onerror) {
      this.onerror();
    }
  }

  close = vi.fn();

  static instances: MockEventSource[] = [];
  static clear() {
    MockEventSource.instances = [];
  }
}

const renderComponent = () => {
  return render(
    <UserProfileProvider>
      <LayoutProvider>
        <ProcessVideo />
      </LayoutProvider>
    </UserProfileProvider>
  );
};

describe("ProcessVideo page - Preprocessing Handoff & Redirection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockEventSource.clear();
    vi.stubGlobal("EventSource", MockEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("submitting a URL stores video_id and opens EventSource connection", async () => {
    vi.mocked(submitVideo).mockResolvedValue({ video_id: "test-vid-123" });

    renderComponent();

    const input = screen.getByLabelText(/YouTube URL/i);
    const submitBtn = screen.getByRole("button", { name: /Prepare Assistance/i }) as HTMLButtonElement;

    fireEvent.change(input, { target: { value: "https://www.youtube.com/watch?v=abcdef" } });
    fireEvent.click(submitBtn);

    expect(submitBtn.disabled).toBe(true);

    await waitFor(() => {
      expect(submitVideo).toHaveBeenCalledWith("https://www.youtube.com/watch?v=abcdef");
    });

    // An EventSource connection should be created
    expect(MockEventSource.instances.length).toBe(1);
    expect(MockEventSource.instances[0].url).toBe("http://localhost/api/sse/test-vid-123");
  });

  test("receiving SSE COMPLETED event dispatches navigation-start and redirects to setup page exactly once", async () => {
    vi.mocked(submitVideo).mockResolvedValue({ video_id: "test-vid-redirect" });
    const navStartSpy = vi.fn();
    window.addEventListener("navigation-start", navStartSpy);

    renderComponent();

    const input = screen.getByLabelText(/YouTube URL/i);
    const submitBtn = screen.getByRole("button", { name: /Prepare Assistance/i });

    fireEvent.change(input, { target: { value: "https://www.youtube.com/watch?v=redirect" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(MockEventSource.instances.length).toBe(1);
    });

    const mockEs = MockEventSource.instances[0];

    // Emit a processing update
    await act(async () => {
      mockEs.emit("status", {
        data: JSON.stringify({ stage: ProcessingStage.TRANSCRIBING }),
      });
    });

    expect(screen.getAllByText(/Transcribing/i).length).toBeGreaterThan(0);

    // Emit COMPLETED event
    await act(async () => {
      mockEs.emit("status", {
        data: JSON.stringify({ stage: ProcessingStage.COMPLETED }),
      });
    });

    expect(mockEs.close).toHaveBeenCalledTimes(1);
    expect(navStartSpy).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/session/test-vid-redirect/setup");
    expect(mockPush).toHaveBeenCalledTimes(1);

    // Emit duplicate COMPLETED event to ensure guard prevents duplicate redirect
    await act(async () => {
      mockEs.emit("status", {
        data: JSON.stringify({ stage: ProcessingStage.COMPLETED }),
      });
    });
    expect(mockPush).toHaveBeenCalledTimes(1);

    window.removeEventListener("navigation-start", navStartSpy);
  });

  test("receiving FAILED does not redirect and displays error state", async () => {
    vi.mocked(submitVideo).mockResolvedValue({ video_id: "test-vid-failed" });

    renderComponent();

    const input = screen.getByLabelText(/YouTube URL/i);
    const submitBtn = screen.getByRole("button", { name: /Prepare Assistance/i });

    fireEvent.change(input, { target: { value: "https://www.youtube.com/watch?v=fail" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(MockEventSource.instances.length).toBe(1);
    });

    const mockEs = MockEventSource.instances[0];

    await act(async () => {
      mockEs.emit("status", {
        data: JSON.stringify({ stage: ProcessingStage.FAILED, error: "AI manifest generation timed out" }),
      });
    });

    expect(mockEs.close).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByText("Preparation Failed")).toBeDefined();
    expect(screen.getByText("AI manifest generation timed out")).toBeDefined();
  });

  test("SSE connection interrupts show reconnect warning and do not block eventual redirect", async () => {
    vi.mocked(submitVideo).mockResolvedValue({ video_id: "test-vid-reconnect" });

    renderComponent();

    const input = screen.getByLabelText(/YouTube URL/i);
    const submitBtn = screen.getByRole("button", { name: /Prepare Assistance/i });

    fireEvent.change(input, { target: { value: "https://www.youtube.com/watch?v=reconnect" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(MockEventSource.instances.length).toBe(1);
    });

    const mockEs = MockEventSource.instances[0];

    // Trigger connection error
    await act(async () => {
      mockEs.emitError();
    });

    expect(screen.getByText("Connection to preparation updates was interrupted.")).toBeDefined();
    expect(mockEs.close).not.toHaveBeenCalled();

    // Now emit completed event (e.g. after connection stabilizes and emits)
    await act(async () => {
      mockEs.emit("status", {
        data: JSON.stringify({ stage: ProcessingStage.COMPLETED }),
      });
    });

    expect(mockEs.close).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/session/test-vid-reconnect/setup");
  });
});
