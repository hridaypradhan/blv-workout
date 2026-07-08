import { describe, test, expect } from "vitest";
import { updateRepCounter, RepCounterState } from "../repCounter";
import { SQUAT_PROFILE, BICEP_CURL_PROFILE } from "../exercisePoseProfiles";

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
