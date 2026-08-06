import { describe, it, expect } from "vitest";
import { AssistantPersona } from "@/types";
import {
  normalizeAssistantPersona,
  DEFAULT_USER_PREFERENCES,
  mergeUserPreferences,
} from "../userPreferences";

describe("Frontend Assistant Persona Normalization and Migration", () => {
  it("normalizes legacy persona values to Maryam canonical personas", () => {
    expect(normalizeAssistantPersona("energetic")).toBe(AssistantPersona.CHEERLEADER);
    expect(normalizeAssistantPersona("supportive")).toBe(AssistantPersona.GUIDE);
    expect(normalizeAssistantPersona("calm")).toBe(AssistantPersona.GUIDE);
    expect(normalizeAssistantPersona("direct")).toBe(AssistantPersona.SERGEANT);
  });

  it("preserves canonical personas as-is", () => {
    expect(normalizeAssistantPersona("cheerleader")).toBe(AssistantPersona.CHEERLEADER);
    expect(normalizeAssistantPersona("guide")).toBe(AssistantPersona.GUIDE);
    expect(normalizeAssistantPersona("sergeant")).toBe(AssistantPersona.SERGEANT);
  });

  it("handles case-insensitivity and whitespace", () => {
    expect(normalizeAssistantPersona("  ENERGETIC  ")).toBe(AssistantPersona.CHEERLEADER);
    expect(normalizeAssistantPersona("  Direct ")).toBe(AssistantPersona.SERGEANT);
  });

  it("defaults missing, null, or invalid values to guide", () => {
    expect(normalizeAssistantPersona(undefined)).toBe(AssistantPersona.GUIDE);
    expect(normalizeAssistantPersona(null)).toBe(AssistantPersona.GUIDE);
    expect(normalizeAssistantPersona("")).toBe(AssistantPersona.GUIDE);
    expect(normalizeAssistantPersona("invalid_persona_name")).toBe(AssistantPersona.GUIDE);
  });

  it("sets guide as default persona in DEFAULT_USER_PREFERENCES", () => {
    expect(DEFAULT_USER_PREFERENCES.assistant_persona).toBe(AssistantPersona.GUIDE);
  });

  it("normalizes legacy assistant_persona during mergeUserPreferences", () => {
    const mergedLegacy = mergeUserPreferences({
      name: "Legacy User",
      assistant_persona: "supportive" as unknown as AssistantPersona,
    });
    expect(mergedLegacy.assistant_persona).toBe(AssistantPersona.GUIDE);

    const mergedEnergetic = mergeUserPreferences({
      name: "Energetic User",
      assistant_persona: "energetic" as unknown as AssistantPersona,
    });
    expect(mergedEnergetic.assistant_persona).toBe(AssistantPersona.CHEERLEADER);

    const mergedEmpty = mergeUserPreferences({
      name: "New User",
    });
    expect(mergedEmpty.assistant_persona).toBe(AssistantPersona.GUIDE);
  });
});
