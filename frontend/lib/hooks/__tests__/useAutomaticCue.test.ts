import { describe, test, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAutomaticCue } from "../useAutomaticCue";

describe("useAutomaticCue Hook", () => {
  let currentTimeRef: React.MutableRefObject<number>;

  beforeEach(() => {
    currentTimeRef = { current: 0 };
  });

  // Basic recording

  test("starts with null cue and inactive", () => {
    const { result } = renderHook(() => useAutomaticCue(currentTimeRef, 0));
    expect(result.current.latestAutomaticCue).toBeNull();
    expect(result.current.isAutomaticCueActive).toBe(false);
  });

  test("records a cue with explicit time window", () => {
    currentTimeRef.current = 10;
    const { result } = renderHook(() => useAutomaticCue(currentTimeRef, 10));

    act(() => {
      result.current.updateLatestAutomaticCue("Keep your chest up", "cue_plan", 5000, 15000);
    });

    expect(result.current.latestAutomaticCue).not.toBeNull();
    expect(result.current.latestAutomaticCue!.text).toBe("Keep your chest up");
    expect(result.current.latestAutomaticCue!.type).toBe("cue_plan");
    expect(result.current.latestAutomaticCue!.startMs).toBe(5000);
    expect(result.current.latestAutomaticCue!.endMs).toBe(15000);
  });

  test("records a cue with default +/-3s window when no explicit window provided", () => {
    currentTimeRef.current = 10; // 10s = 10000ms
    const { result } = renderHook(() => useAutomaticCue(currentTimeRef, 10));

    act(() => {
      result.current.updateLatestAutomaticCue("Great form", "correction");
    });

    expect(result.current.latestAutomaticCue!.startMs).toBe(7000); // 10000 - 3000
    expect(result.current.latestAutomaticCue!.endMs).toBe(13000); // 10000 + 3000
  });

  // isAutomaticCueActive derivation

  test("cue within window is active", () => {
    currentTimeRef.current = 10;
    const { result, rerender } = renderHook(
      ({ ct }) => useAutomaticCue(currentTimeRef, ct),
      { initialProps: { ct: 10 } }
    );

    act(() => {
      result.current.updateLatestAutomaticCue("Keep your chest up", "cue_plan", 5000, 15000);
    });

    // currentTime=10s = 10000ms, within [5000, 15000]
    rerender({ ct: 10 });
    expect(result.current.isAutomaticCueActive).toBe(true);
  });

  test("forward seek past window makes cue inactive", () => {
    currentTimeRef.current = 10;
    const { result, rerender } = renderHook(
      ({ ct }) => useAutomaticCue(currentTimeRef, ct),
      { initialProps: { ct: 10 } }
    );

    act(() => {
      result.current.updateLatestAutomaticCue("Keep your chest up", "cue_plan", 5000, 15000);
    });

    // Simulate forward seek: currentTime jumps to 20s = 20000ms, outside [5000, 15000]
    currentTimeRef.current = 20;
    rerender({ ct: 20 });
    expect(result.current.isAutomaticCueActive).toBe(false);
  });

  test("rewind into window re-activates cue", () => {
    currentTimeRef.current = 10;
    const { result, rerender } = renderHook(
      ({ ct }) => useAutomaticCue(currentTimeRef, ct),
      { initialProps: { ct: 10 } }
    );

    act(() => {
      result.current.updateLatestAutomaticCue("Keep your chest up", "cue_plan", 5000, 15000);
    });

    // Forward past the window
    currentTimeRef.current = 20;
    rerender({ ct: 20 });
    expect(result.current.isAutomaticCueActive).toBe(false);

    // Rewind back into the window
    currentTimeRef.current = 12;
    rerender({ ct: 12 });
    expect(result.current.isAutomaticCueActive).toBe(true);
  });

  test("rewind before window makes cue inactive", () => {
    currentTimeRef.current = 10;
    const { result, rerender } = renderHook(
      ({ ct }) => useAutomaticCue(currentTimeRef, ct),
      { initialProps: { ct: 10 } }
    );

    act(() => {
      result.current.updateLatestAutomaticCue("Keep your chest up", "cue_plan", 5000, 15000);
    });

    // Rewind to before the window
    currentTimeRef.current = 3;
    rerender({ ct: 3 });
    expect(result.current.isAutomaticCueActive).toBe(false);
  });

  test("cue at exact window boundaries is active", () => {
    currentTimeRef.current = 5;
    const { result, rerender } = renderHook(
      ({ ct }) => useAutomaticCue(currentTimeRef, ct),
      { initialProps: { ct: 5 } }
    );

    act(() => {
      result.current.updateLatestAutomaticCue("Start", "cue_plan", 5000, 15000);
    });

    // At start boundary
    rerender({ ct: 5 });
    expect(result.current.isAutomaticCueActive).toBe(true);

    // At end boundary
    currentTimeRef.current = 15;
    rerender({ ct: 15 });
    expect(result.current.isAutomaticCueActive).toBe(true);
  });

  // 25-second deduplication

  test("25-second deduplication prevents duplicate cues", () => {
    currentTimeRef.current = 10;
    const { result } = renderHook(() => useAutomaticCue(currentTimeRef, 10));

    act(() => {
      result.current.updateLatestAutomaticCue("Keep your chest up", "cue_plan", 5000, 15000);
    });

    const firstTimestamp = result.current.latestAutomaticCue!.timestamp;

    // Try to set the same text again immediately
    act(() => {
      result.current.updateLatestAutomaticCue("Keep your chest up", "cue_plan", 20000, 30000);
    });

    // Should still have the first timestamp (dedup blocked the update)
    expect(result.current.latestAutomaticCue!.timestamp).toBe(firstTimestamp);
    expect(result.current.latestAutomaticCue!.startMs).toBe(5000); // original window
  });

  test("different cue text bypasses deduplication", () => {
    currentTimeRef.current = 10;
    const { result } = renderHook(() => useAutomaticCue(currentTimeRef, 10));

    act(() => {
      result.current.updateLatestAutomaticCue("Keep your chest up", "cue_plan", 5000, 15000);
    });

    act(() => {
      result.current.updateLatestAutomaticCue("Slow down the movement", "cue_plan", 20000, 30000);
    });

    expect(result.current.latestAutomaticCue!.text).toBe("Slow down the movement");
    expect(result.current.latestAutomaticCue!.startMs).toBe(20000);
  });

  // clearAutomaticCue

  test("clearAutomaticCue resets state to null", () => {
    currentTimeRef.current = 10;
    const { result } = renderHook(() => useAutomaticCue(currentTimeRef, 10));

    act(() => {
      result.current.updateLatestAutomaticCue("Keep your chest up", "cue_plan", 5000, 15000);
    });

    expect(result.current.latestAutomaticCue).not.toBeNull();

    act(() => {
      result.current.clearAutomaticCue();
    });

    expect(result.current.latestAutomaticCue).toBeNull();
    expect(result.current.isAutomaticCueActive).toBe(false);
  });

  // Edge cases

  test("new cue replaces old cue's window for active derivation", () => {
    currentTimeRef.current = 10;
    const { result, rerender } = renderHook(
      ({ ct }) => useAutomaticCue(currentTimeRef, ct),
      { initialProps: { ct: 10 } }
    );

    act(() => {
      result.current.updateLatestAutomaticCue("First cue", "cue_plan", 5000, 15000);
    });

    expect(result.current.isAutomaticCueActive).toBe(true);

    // New cue with a different window (but current time is still at 10s)
    act(() => {
      result.current.updateLatestAutomaticCue("Second cue", "cue_plan", 20000, 30000);
    });

    // Now at 10s, the new cue's window [20000, 30000] is not active
    expect(result.current.latestAutomaticCue!.text).toBe("Second cue");
    expect(result.current.isAutomaticCueActive).toBe(false);

    // Move into new cue's window
    currentTimeRef.current = 25;
    rerender({ ct: 25 });
    expect(result.current.isAutomaticCueActive).toBe(true);
  });

  test("legacy cue without explicit window uses default +/-3s and is active at delivery time", () => {
    currentTimeRef.current = 10;
    const { result, rerender } = renderHook(
      ({ ct }) => useAutomaticCue(currentTimeRef, ct),
      { initialProps: { ct: 10 } }
    );

    act(() => {
      // Legacy call: no startMs/endMs
      result.current.updateLatestAutomaticCue("Trainer says stretch", "legacy");
    });

    // At delivery time (10s = 10000ms), within [7000, 13000]
    expect(result.current.isAutomaticCueActive).toBe(true);

    // Move past the default window
    currentTimeRef.current = 14;
    rerender({ ct: 14 });
    expect(result.current.isAutomaticCueActive).toBe(false);

    // Rewind back into the window
    currentTimeRef.current = 11;
    rerender({ ct: 11 });
    expect(result.current.isAutomaticCueActive).toBe(true);
  });
});
