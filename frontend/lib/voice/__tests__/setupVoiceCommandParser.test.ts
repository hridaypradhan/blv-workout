import { describe, test, expect } from "vitest";
import { parseSetupVoiceCommand } from "../setupVoiceCommandParser";

describe("setupVoiceCommandParser", () => {
  test("parses camera commands correctly", () => {
    expect(parseSetupVoiceCommand("enable camera")?.type).toBe("enable_camera");
    expect(parseSetupVoiceCommand("start camera")?.type).toBe("enable_camera");
    expect(parseSetupVoiceCommand("stop camera")?.type).toBe("stop_camera");
  });

  test("parses alignment commands correctly", () => {
    expect(parseSetupVoiceCommand("start alignment")?.type).toBe("start_alignment");
    expect(parseSetupVoiceCommand("cancel alignment")?.type).toBe("cancel_alignment");
    expect(parseSetupVoiceCommand("return to setup")?.type).toBe("cancel_alignment");
    expect(parseSetupVoiceCommand("exit alignment")?.type).toBe("cancel_alignment");
  });

  test("parses repeat guidance and cancel countdown commands", () => {
    expect(parseSetupVoiceCommand("repeat guidance")?.type).toBe("repeat_guidance");
    expect(parseSetupVoiceCommand("repeat instruction")?.type).toBe("repeat_guidance");
    expect(parseSetupVoiceCommand("cancel countdown")?.type).toBe("cancel_countdown");
  });

  test("parses start workout command", () => {
    expect(parseSetupVoiceCommand("start workout")?.type).toBe("start_workout");
    expect(parseSetupVoiceCommand("start assisted playback")?.type).toBe("start_workout");
  });

  test("parses ask assistant questions correctly", () => {
    const askCmd = parseSetupVoiceCommand("ask assistant how do I stand");
    expect(askCmd?.type).toBe("ask_assistant");
    expect(askCmd?.payload).toBe("how do i stand");

    const questionCmd = parseSetupVoiceCommand("question how to position mat");
    expect(questionCmd?.type).toBe("ask_assistant");
    expect(questionCmd?.payload).toBe("how to position mat");
  });

  test("parses scroll and layout navigation commands correctly", () => {
    expect(parseSetupVoiceCommand("scroll down")?.type).toBe("scroll_down");
    expect(parseSetupVoiceCommand("scroll up")?.type).toBe("scroll_up");
    expect(parseSetupVoiceCommand("page down")?.type).toBe("page_down");
    expect(parseSetupVoiceCommand("page up")?.type).toBe("page_up");
    expect(parseSetupVoiceCommand("next section")?.type).toBe("next_section");
    expect(parseSetupVoiceCommand("previous section")?.type).toBe("previous_section");
    expect(parseSetupVoiceCommand("read current section")?.type).toBe("read_current_section");
  });

  test("returns null for unsupported commands", () => {
    expect(parseSetupVoiceCommand("hello computer")).toBeNull();
    expect(parseSetupVoiceCommand("pause video")).toBeNull();
  });
});
