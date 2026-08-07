import { describe, test, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSessionTelemetry } from "../useSessionTelemetry";

describe("useSessionTelemetry", () => {
  test("preserves distinct voice command and pause coordinator events in the same 2-second bucket", async () => {
    const { result } = renderHook(() =>
      useSessionTelemetry({
        sessionId: "session-123",
        isReady: true,
        isPlaying: true,
        hasEnded: false,
        currentTime: 10,
        playbackRate: 1.0,
      })
    );

    // Log voice pause command
    await act(async () => {
      await result.current.logSessionEvent("voice_command_executed", 1000, {
        command: "pause",
        transcript: "pause",
        resultId: "res-1",
      });
    });

    // Log coordinator pause request
    await act(async () => {
      await result.current.logSessionEvent("pause_coordinator_request", 1100, {
        owner: "user_manual",
        reason: "Voice pause",
        activeOwners: ["user_manual"],
      });
    });

    // Log voice resume command (in same 2s bucket: 1500ms)
    await act(async () => {
      await result.current.logSessionEvent("voice_command_executed", 1500, {
        command: "resume",
        transcript: "resume",
        resultId: "res-2",
      });
    });

    // Log coordinator pause release (in same 2s bucket: 1600ms)
    await act(async () => {
      await result.current.logSessionEvent("pause_coordinator_release", 1600, {
        owner: "user_manual",
        reason: "Voice resume",
        activeOwners: [],
        willResume: true,
      });
    });

    const events = result.current.getBufferedEvents();
    expect(events).toHaveLength(4);
    expect(events[0].event_type).toBe("voice_command_executed");
    expect(events[0].metadata).toEqual(expect.objectContaining({ command: "pause" }));
    expect(events[1].event_type).toBe("pause_coordinator_request");
    expect(events[2].event_type).toBe("voice_command_executed");
    expect(events[2].metadata).toEqual(expect.objectContaining({ command: "resume" }));
    expect(events[3].event_type).toBe("pause_coordinator_release");
  });

  test("dedupes identical noisy events within the same time bucket", async () => {
    const { result } = renderHook(() =>
      useSessionTelemetry({
        sessionId: "session-123",
        isReady: true,
        isPlaying: true,
        hasEnded: false,
        currentTime: 10,
        playbackRate: 1.0,
      })
    );

    await act(async () => {
      await result.current.logSessionEvent("haptic_cue_triggered", 1000, {
        cue_id: "cue-squat-1",
      });
    });

    // Duplicate event inside same 5000ms bucket
    await act(async () => {
      await result.current.logSessionEvent("haptic_cue_triggered", 2000, {
        cue_id: "cue-squat-1",
      });
    });

    const events = result.current.getBufferedEvents();
    expect(events).toHaveLength(1);
  });
});
