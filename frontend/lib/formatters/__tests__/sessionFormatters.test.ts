import { describe, test, expect } from "vitest";
import {
  getSessionEventLabel,
  formatSessionEventDetails,
  getSessionEventStyle,
} from "../sessionFormatters";
import { SESSION_EVENTS } from "../../sessionEvents";

describe("sessionFormatters", () => {
  test("getSessionEventLabel formats haptic events", () => {
    expect(getSessionEventLabel(SESSION_EVENTS.HAPTIC_CUE_REQUESTED)).toBe("Haptic Requested");
    expect(getSessionEventLabel(SESSION_EVENTS.HAPTIC_CUE_FAILED)).toBe("Haptic Failed");
    
    expect(
      getSessionEventLabel(SESSION_EVENTS.HAPTIC_CUE_TRIGGERED, { delivery_mode: "hardware" })
    ).toBe("Haptic Fired");
    
    expect(
      getSessionEventLabel(SESSION_EVENTS.HAPTIC_CUE_TRIGGERED, { delivery_mode: "indicator" })
    ).toBe("Haptic Indicator");
  });

  test("formatSessionEventDetails returns formatted strings", () => {
    const requestDetails = formatSessionEventDetails({
      event_type: SESSION_EVENTS.HAPTIC_CUE_REQUESTED,
      metadata: {
        bhaptics_event_name: "assist_start",
        cue_type: "start",
        selected_vibration_id: "v-start",
        target_positions: ["left_arm"],
      },
    });
    expect(requestDetails).toContain("Haptic request: Event assist_start");
    expect(requestDetails).toContain("Type: start");
    expect(requestDetails).toContain("ID: v-start");
    expect(requestDetails).toContain("[left_arm]");

    const triggerDetails = formatSessionEventDetails({
      event_type: SESSION_EVENTS.HAPTIC_CUE_TRIGGERED,
      metadata: {
        bhaptics_event_name: "assist_start",
        delivery_mode: "hardware",
        provider: "bhaptics",
        target_positions: ["left_arm", "right_arm"],
        request_id: "req-123",
        status_message: "Pulsed successfully",
      },
    });
    expect(triggerDetails).toContain("Haptic delivered (hardware): Event assist_start via bhaptics");
    expect(triggerDetails).toContain("on [left_arm, right_arm]");
    expect(triggerDetails).toContain("Req ID: req-123");
    expect(triggerDetails).toContain("Status: Pulsed successfully");

    const failureDetails = formatSessionEventDetails({
      event_type: SESSION_EVENTS.HAPTIC_CUE_FAILED,
      metadata: {
        bhaptics_event_name: "assist_start",
        provider: "bhaptics",
        request_id: "req-123",
        error: "Sleeve disconnected",
      },
    });
    expect(failureDetails).toContain("Haptic delivery failed: Event assist_start via bhaptics");
    expect(failureDetails).toContain("Req ID: req-123");
    expect(failureDetails).toContain("Error: Sleeve disconnected");
  });

  test("getSessionEventStyle returns appropriate style", () => {
    expect(getSessionEventStyle(SESSION_EVENTS.HAPTIC_CUE_REQUESTED)).toBe("text-sky-500/80");
    expect(
      getSessionEventStyle(SESSION_EVENTS.HAPTIC_CUE_TRIGGERED, { delivery_mode: "hardware" })
    ).toBe("text-sky-400 font-extrabold");
    expect(
      getSessionEventStyle(SESSION_EVENTS.HAPTIC_CUE_TRIGGERED, { delivery_mode: "indicator" })
    ).toBe("text-yellow-500/90 font-medium");
    expect(getSessionEventStyle(SESSION_EVENTS.HAPTIC_CUE_FAILED)).toBe("text-red-400 font-bold");
  });
});
