import { describe, test, expect } from "vitest";
import { updateRepCounter, RepCounterState, RepMatcher } from "../repCounter";
import { SQUAT_PROFILE, BICEP_CURL_PROFILE } from "../exercisePoseProfiles";

describe("RepMatcher adaptive algorithm", () => {
  test("counts reps based on adaptive user ROM envelope", () => {
    const matcher = new RepMatcher({
      keyAngles: ["knee_left", "knee_right"],
      minRepIntervalS: 0.5,
      smoothTauS: 0, // Disable smoothing for deterministic test steps
      minRangeDeg: 15,
    });

    // Initial standing (170 deg)
    expect(matcher.update({ knee_left: 170, knee_right: 170 }, 1.0)).toBe(false);
    expect(matcher.calibratedRange("knee_left")).toBeNull(); // not yet calibrated

    // Squat down to 80 deg (envelope spans 90 deg -> calibrated!)
    expect(matcher.update({ knee_left: 80, knee_right: 80 }, 2.0)).toBe(false);
    expect(matcher.calibratedRange("knee_left")).toEqual([80, 161]);

    // Return to standing (170 deg) -> triggers full cycle!
    expect(matcher.update({ knee_left: 170, knee_right: 170 }, 3.0)).toBe(true);
    expect(matcher.repCount).toBe(1);

    // Second rep
    expect(matcher.update({ knee_left: 80, knee_right: 80 }, 4.0)).toBe(false);
    expect(matcher.update({ knee_left: 170, knee_right: 170 }, 5.0)).toBe(true);
    expect(matcher.repCount).toBe(2);
  });

  test("does not count reps when ROM is narrower than minRangeDeg", () => {
    const matcher = new RepMatcher({
      keyAngles: ["elbow_left"],
      minRangeDeg: 20.0,
      smoothTauS: 0,
    });

    // Small jitter/movement between 100 and 110 (span = 10 < 20)
    matcher.update({ elbow_left: 100 }, 1.0);
    matcher.update({ elbow_left: 110 }, 2.0);
    matcher.update({ elbow_left: 100 }, 3.0);
    matcher.update({ elbow_left: 110 }, 4.0);

    expect(matcher.isCalibrated("elbow_left")).toBe(false);
    expect(matcher.calibratedRange("elbow_left")).toBeNull();
    expect(matcher.repCount).toBe(0);
  });

  test("ignores stale/occluded joints after staleAfterS timeout", () => {
    const matcher = new RepMatcher({
      keyAngles: ["elbow_left", "elbow_right"],
      staleAfterS: 2.0,
      smoothTauS: 0,
    });

    // Calibrate both elbows
    matcher.update({ elbow_left: 180, elbow_right: 180 }, 1.0);
    matcher.update({ elbow_left: 45, elbow_right: 45 }, 2.0);

    // At t=5.0s, elbow_right hasn't been seen for 3.0s (> 2.0s stale threshold)
    // Only elbow_left is active
    matcher.update({ elbow_left: 45 }, 5.0);
    const fired = matcher.update({ elbow_left: 180 }, 6.0);

    expect(fired).toBe(true);
    expect(matcher.repCount).toBe(1);
  });

  test("resolves mirrored side angles fallback seamlessly", () => {
    const matcher = new RepMatcher({
      keyAngles: ["left_elbow"], // looking for left_elbow
      smoothTauS: 0,
    });

    // Feed right_elbow angles (user facing opposite side to camera)
    matcher.update({ right_elbow: 170 }, 1.0);
    matcher.update({ right_elbow: 45 }, 2.0);
    const fired = matcher.update({ right_elbow: 170 }, 3.0);

    expect(fired).toBe(true);
    expect(matcher.repCount).toBe(1);
  });

  test("enforces minRepIntervalS debounce between rapid reps", () => {
    const matcher = new RepMatcher({
      keyAngles: ["knee_left"],
      minRepIntervalS: 1.0, // 1 second debounce
      smoothTauS: 0,
    });

    // First rep completed at t=1.0s
    matcher.update({ knee_left: 170 }, 0.1);
    matcher.update({ knee_left: 80 }, 0.5);
    expect(matcher.update({ knee_left: 170 }, 1.0)).toBe(true);
    expect(matcher.repCount).toBe(1);

    // Attempt rapid second rep completed at t=1.3s (within 1.0s interval)
    matcher.update({ knee_left: 80 }, 1.2);
    expect(matcher.update({ knee_left: 170 }, 1.3)).toBe(false);
    expect(matcher.repCount).toBe(1); // suppressed by debounce

    // Third rep completed at t=2.5s (outside debounce window)
    matcher.update({ knee_left: 80 }, 2.0);
    expect(matcher.update({ knee_left: 170 }, 2.5)).toBe(true);
    expect(matcher.repCount).toBe(2);
  });
});

describe("repCounter state machine transitions", () => {
  test("counts a full squat repetition correctly through phases", () => {
    let state: RepCounterState = {
      state: "extended",
      repCount: 0,
      lastRepTimeMs: 0,
    };

    // Starting at standing (170 degrees)
    state = updateRepCounter(state, 170, SQUAT_PROFILE, 1000);
    expect(state.state).toBe("extended");
    expect(state.repCount).toBe(0);

    // Going down to bottom of squat (80 degrees)
    state = updateRepCounter(state, 80, SQUAT_PROFILE, 2000);
    expect(state.state).toBe("contracted");
    expect(state.repCount).toBe(0);

    // Moving back up to mid range (140 degrees)
    state = updateRepCounter(state, 140, SQUAT_PROFILE, 3000);
    expect(state.state).toBe("returning");
    expect(state.repCount).toBe(0);

    // Standing back up completely (170 degrees)
    state = updateRepCounter(state, 170, SQUAT_PROFILE, 4000);
    expect(state.state).toBe("extended");
    expect(state.repCount).toBe(1);
    expect(state.lastRepTimeMs).toBe(4000);
  });

  test("counts a full bicep curl repetition correctly through phases", () => {
    let state: RepCounterState = {
      state: "extended",
      repCount: 0,
      lastRepTimeMs: 0,
    };

    // Starting arm straight (165 degrees)
    state = updateRepCounter(state, 165, BICEP_CURL_PROFILE, 1000);
    expect(state.state).toBe("extended");
    expect(state.repCount).toBe(0);

    // Flexed fully at top (45 degrees)
    state = updateRepCounter(state, 45, BICEP_CURL_PROFILE, 2000);
    expect(state.state).toBe("contracted");
    expect(state.repCount).toBe(0);

    // Extending arm down to midpoint (110 degrees)
    state = updateRepCounter(state, 110, BICEP_CURL_PROFILE, 3000);
    expect(state.state).toBe("returning");
    expect(state.repCount).toBe(0);

    // Arm fully straight again (165 degrees)
    state = updateRepCounter(state, 165, BICEP_CURL_PROFILE, 4000);
    expect(state.state).toBe("extended");
    expect(state.repCount).toBe(1);
    expect(state.lastRepTimeMs).toBe(4000);
  });

  test("prevents duplicate repetitions during debounce/cooldown period", () => {
    let state: RepCounterState = {
      state: "extended",
      repCount: 0,
      lastRepTimeMs: 0,
    };

    // First rep completed at 1000ms
    state = updateRepCounter(state, 50, BICEP_CURL_PROFILE, 500);
    state = updateRepCounter(state, 160, BICEP_CURL_PROFILE, 1000);
    expect(state.repCount).toBe(1);
    expect(state.lastRepTimeMs).toBe(1000);

    // Second rep attempted immediately at 1500ms (within 1500ms cooldown)
    state = updateRepCounter(state, 50, BICEP_CURL_PROFILE, 1200);
    state = updateRepCounter(state, 160, BICEP_CURL_PROFILE, 1500);
    // State goes back to extended but repCount should remain 1 due to cooldown
    expect(state.state).toBe("extended");
    expect(state.repCount).toBe(1);
    expect(state.lastRepTimeMs).toBe(1000); // timestamp not updated

    // Third rep completed outside cooldown at 3000ms
    state = updateRepCounter(state, 50, BICEP_CURL_PROFILE, 2500);
    state = updateRepCounter(state, 160, BICEP_CURL_PROFILE, 3000);
    expect(state.repCount).toBe(2);
    expect(state.lastRepTimeMs).toBe(3000);
  });

  test("handles double-bounce/jitter without double counting reps", () => {
    let state: RepCounterState = {
      state: "extended",
      repCount: 0,
      lastRepTimeMs: 0,
    };

    // Move to contracted
    state = updateRepCounter(state, 80, SQUAT_PROFILE, 1000);
    expect(state.state).toBe("contracted");

    // Start returning, but then dip back down to contracted (double bounce)
    state = updateRepCounter(state, 140, SQUAT_PROFILE, 1500);
    expect(state.state).toBe("returning");

    state = updateRepCounter(state, 85, SQUAT_PROFILE, 1800);
    expect(state.state).toBe("contracted"); // should go back to contracted

    // Stand back up fully
    state = updateRepCounter(state, 145, SQUAT_PROFILE, 2500);
    state = updateRepCounter(state, 170, SQUAT_PROFILE, 3000);
    expect(state.repCount).toBe(1);
  });
});
