export type SetupCommandType =
  | "enable_camera"
  | "stop_camera"
  | "start_alignment"
  | "cancel_alignment"
  | "repeat_guidance"
  | "cancel_countdown"
  | "start_workout"
  | "choose_fresh"
  | "choose_normal"
  | "choose_tired"
  | "ask_assistant"
  | "scroll_down"
  | "scroll_up"
  | "page_down"
  | "page_up"
  | "next_section"
  | "previous_section"
  | "read_current_section";

export interface ParsedSetupCommand {
  type: SetupCommandType;
  rawText: string;
  payload?: string;
}

export function parseSetupVoiceCommand(text: string): ParsedSetupCommand | null {
  const clean = text.toLowerCase().trim();

  // Difficulty Settings
  if (clean.includes("choose fresh") || clean === "fresh") {
    return { type: "choose_fresh", rawText: text };
  }
  if (clean.includes("choose normal") || clean === "normal") {
    return { type: "choose_normal", rawText: text };
  }
  if (clean.includes("choose tired") || clean === "tired") {
    return { type: "choose_tired", rawText: text };
  }

  // Camera Settings
  if (clean.includes("enable camera") || clean.includes("start camera") || clean === "enable camera" || clean === "start camera") {
    return { type: "enable_camera", rawText: text };
  }
  if (clean.includes("stop camera") || clean === "stop camera") {
    return { type: "stop_camera", rawText: text };
  }

  // Stance Alignment triggers
  if (clean.includes("start alignment") || clean === "start alignment") {
    return { type: "start_alignment", rawText: text };
  }
  if (
    clean.includes("cancel alignment") ||
    clean.includes("return to setup") ||
    clean.includes("exit alignment") ||
    clean === "cancel alignment" ||
    clean === "return to setup"
  ) {
    return { type: "cancel_alignment", rawText: text };
  }

  // Timer cancel command
  if (clean.includes("cancel countdown") || clean === "cancel countdown") {
    return { type: "cancel_countdown", rawText: text };
  }

  // Instructions repetition
  if (
    clean.includes("repeat guidance") ||
    clean.includes("repeat instruction") ||
    clean === "repeat guidance" ||
    clean === "repeat instruction"
  ) {
    return { type: "repeat_guidance", rawText: text };
  }

  // Manual Trigger playback
  if (
    clean.includes("start workout") ||
    clean.includes("start assisted playback") ||
    clean === "start workout"
  ) {
    return { type: "start_workout", rawText: text };
  }

  // Navigation / Scroll
  if (clean === "scroll down" || clean.includes("scroll down")) {
    return { type: "scroll_down", rawText: text };
  }
  if (clean === "scroll up" || clean.includes("scroll up")) {
    return { type: "scroll_up", rawText: text };
  }
  if (clean === "page down" || clean.includes("page down")) {
    return { type: "page_down", rawText: text };
  }
  if (clean === "page up" || clean.includes("page up")) {
    return { type: "page_up", rawText: text };
  }
  if (
    clean === "next section" ||
    clean.includes("next section") ||
    clean.includes("skip section") ||
    clean.includes("next card")
  ) {
    return { type: "next_section", rawText: text };
  }
  if (
    clean === "previous section" ||
    clean.includes("previous section") ||
    clean.includes("previous card")
  ) {
    return { type: "previous_section", rawText: text };
  }
  if (
    clean === "read current section" ||
    clean === "read section" ||
    clean.includes("read current section") ||
    clean.includes("read section")
  ) {
    return { type: "read_current_section", rawText: text };
  }

  // Optional Q&A command checks
  const askKeywords = ["ask assistant", "ask", "question"];
  for (const kw of askKeywords) {
    if (clean.startsWith(kw + " ")) {
      const query = clean.substring(kw.length).trim();
      if (query) {
        return { type: "ask_assistant", rawText: text, payload: query };
      }
    }
  }

  return null;
}
