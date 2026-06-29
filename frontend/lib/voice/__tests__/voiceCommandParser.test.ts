import { describe, test, expect } from "vitest";
import { parseVoiceCommand } from "../voiceCommandParser";

describe("parseVoiceCommand", () => {
  // --- Pause ---
  describe("pause commands", () => {
    test.each([
      "pause",
      "Pause",
      "PAUSE",
      "pause video",
      "stop playback",
      "pause playback",
    ])('"%s" → pause', (input) => {
      expect(parseVoiceCommand(input)).toEqual({ type: "pause" });
    });
  });

  // --- Resume ---
  describe("resume commands", () => {
    test.each([
      "resume",
      "play",
      "start video",
      "continue",
      "unpause",
      "resume playback",
      "resume video",
    ])('"%s" → resume', (input) => {
      expect(parseVoiceCommand(input)).toEqual({ type: "resume" });
    });
  });

  // --- Rewind ---
  describe("rewind commands", () => {
    test("default rewind is 10 seconds", () => {
      expect(parseVoiceCommand("rewind")).toEqual({ type: "rewind", seconds: 10 });
    });

    test("go back defaults to 10 seconds", () => {
      expect(parseVoiceCommand("go back")).toEqual({ type: "rewind", seconds: 10 });
    });

    test("back defaults to 10 seconds", () => {
      expect(parseVoiceCommand("back")).toEqual({ type: "rewind", seconds: 10 });
    });

    test("explicit seconds: 'back 30 seconds'", () => {
      expect(parseVoiceCommand("back 30 seconds")).toEqual({ type: "rewind", seconds: 30 });
    });

    test("explicit seconds: 'rewind 15 seconds'", () => {
      expect(parseVoiceCommand("rewind 15 seconds")).toEqual({ type: "rewind", seconds: 15 });
    });

    test("explicit seconds: 'go back 5'", () => {
      expect(parseVoiceCommand("go back 5")).toEqual({ type: "rewind", seconds: 5 });
    });

    test("explicit seconds with singular 'second': 'back 1 second'", () => {
      expect(parseVoiceCommand("back 1 second")).toEqual({ type: "rewind", seconds: 1 });
    });
  });

  // --- Forward ---
  describe("forward commands", () => {
    test("default forward is 10 seconds", () => {
      expect(parseVoiceCommand("forward")).toEqual({ type: "forward", seconds: 10 });
    });

    test("fast forward defaults to 10 seconds", () => {
      expect(parseVoiceCommand("fast forward")).toEqual({ type: "forward", seconds: 10 });
    });

    test("skip ahead defaults to 10 seconds", () => {
      expect(parseVoiceCommand("skip ahead")).toEqual({ type: "forward", seconds: 10 });
    });

    test("explicit seconds: 'forward 20 seconds'", () => {
      expect(parseVoiceCommand("forward 20 seconds")).toEqual({ type: "forward", seconds: 20 });
    });

    test("explicit seconds: 'skip ahead 15'", () => {
      expect(parseVoiceCommand("skip ahead 15")).toEqual({ type: "forward", seconds: 15 });
    });

    test("explicit seconds: 'fast forward 20 seconds'", () => {
      expect(parseVoiceCommand("fast forward 20 seconds")).toEqual({ type: "forward", seconds: 20 });
    });

    test("explicit seconds: 'fast forward 10'", () => {
      expect(parseVoiceCommand("fast forward 10")).toEqual({ type: "forward", seconds: 10 });
    });
  });

  // --- Speed ---
  describe("speed commands", () => {
    test.each(["slow down", "slower", "reduce speed"])('"%s" → slow_down', (input) => {
      expect(parseVoiceCommand(input)).toEqual({ type: "slow_down" });
    });

    test.each(["normal speed", "regular speed", "reset speed"])('"%s" → normal_speed', (input) => {
      expect(parseVoiceCommand(input)).toEqual({ type: "normal_speed" });
    });

    test.each(["speed up", "faster", "increase speed"])('"%s" → speed_up', (input) => {
      expect(parseVoiceCommand(input)).toEqual({ type: "speed_up" });
    });
  });

  // --- Next section ---
  describe("next section commands", () => {
    test.each([
      "next section",
      "skip section",
      "skip to next exercise",
      "next exercise",
      "skip to next section",
    ])('"%s" → next_section', (input) => {
      expect(parseVoiceCommand(input)).toEqual({ type: "next_section" });
    });
  });

  // --- Repeat instruction ---
  describe("repeat instruction commands", () => {
    test.each([
      "repeat instruction",
      "repeat trainer",
      "what did the trainer say",
      "say that again",
      "repeat last instruction",
      "repeat",
    ])('"%s" → repeat_instruction', (input) => {
      expect(parseVoiceCommand(input)).toEqual({ type: "repeat_instruction" });
    });
  });

  // --- Mute / Unmute ---
  describe("mute/unmute commands", () => {
    test.each(["mute assistant", "mute", "silence assistant"])('"%s" → mute_assistant', (input) => {
      expect(parseVoiceCommand(input)).toEqual({ type: "mute_assistant" });
    });

    test.each(["unmute assistant", "unmute"])('"%s" → unmute_assistant', (input) => {
      expect(parseVoiceCommand(input)).toEqual({ type: "unmute_assistant" });
    });
  });

  // --- End session ---
  describe("end session commands", () => {
    test.each([
      "end session",
      "stop workout",
      "finish workout",
      "end workout",
    ])('"%s" → end_session with confirmation needed', (input) => {
      expect(parseVoiceCommand(input)).toEqual({
        type: "end_session",
        confirmationNeeded: true,
      });
    });
  });

  // --- Ask question (Q&A prefix) ---
  describe("Q&A commands", () => {
    test("'ask how is my form' extracts question", () => {
      const result = parseVoiceCommand("ask how is my form");
      expect(result).toEqual({ type: "ask_question", question: "how is my form" });
    });

    test("'question about reps' extracts question", () => {
      const result = parseVoiceCommand("question about reps");
      expect(result).toEqual({ type: "ask_question", question: "about reps" });
    });

    test("'FitA11y what exercise is next' extracts question", () => {
      const result = parseVoiceCommand("FitA11y what exercise is next");
      expect(result).toEqual({ type: "ask_question", question: "what exercise is next" });
    });

    test("'fit a 11 y am I going fast enough' extracts question", () => {
      const result = parseVoiceCommand("fit a 11 y am I going fast enough");
      expect(result).toEqual({ type: "ask_question", question: "am i going fast enough" });
    });

    test("'fit ally how many reps left' extracts question", () => {
      const result = parseVoiceCommand("fit ally how many reps left");
      expect(result).toEqual({ type: "ask_question", question: "how many reps left" });
    });
  });

  // --- Rejected ---
  describe("rejected / invalid input", () => {
    test("empty string is rejected", () => {
      expect(parseVoiceCommand("")).toEqual({
        type: "rejected",
        reason: "empty",
        transcript: "",
      });
    });

    test("whitespace-only is rejected", () => {
      expect(parseVoiceCommand("   ")).toEqual({
        type: "rejected",
        reason: "empty",
        transcript: "",
      });
    });

    test("single character is rejected as too short", () => {
      expect(parseVoiceCommand("a")).toEqual({
        type: "rejected",
        reason: "too_short",
        transcript: "a",
      });
    });

    test("ambiguous / unrecognized phrase is rejected", () => {
      const result = parseVoiceCommand("the weather is nice today");
      expect(result.type).toBe("rejected");
      if (result.type === "rejected") {
        expect(result.reason).toBe("unrecognized");
        expect(result.transcript).toBe("the weather is nice today");
      }
    });

    test("partial match that doesn't fully match is rejected", () => {
      const result = parseVoiceCommand("pausing now for a break");
      expect(result.type).toBe("rejected");
    });
  });

  // --- Case insensitivity ---
  describe("case insensitivity", () => {
    test("PAUSE VIDEO in uppercase works", () => {
      expect(parseVoiceCommand("PAUSE VIDEO")).toEqual({ type: "pause" });
    });

    test("Slow Down in mixed case works", () => {
      expect(parseVoiceCommand("Slow Down")).toEqual({ type: "slow_down" });
    });

    test("ASK How Is My Form extracts question", () => {
      const result = parseVoiceCommand("ASK How Is My Form");
      expect(result).toEqual({ type: "ask_question", question: "how is my form" });
    });
  });
});
