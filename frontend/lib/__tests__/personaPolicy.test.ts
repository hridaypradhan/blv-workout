import { describe, it, expect } from "vitest";
import { AssistantPersona } from "@/types";
import {
  FrontendPersonaRuntimeEngine,
  PERSONA_POLICIES,
  BEHIND_REPS,
  FINAL_FRAC,
  WRAP_FORM_DIRTY,
  getPersonaPolicy,
} from "../personaPolicy";

describe("Frontend Persona Policy and Runtime Decision Engine", () => {
  it("defines exactly three canonical personas", () => {
    const keys = Object.keys(PERSONA_POLICIES);
    expect(keys.length).toBe(3);
    expect(PERSONA_POLICIES[AssistantPersona.CHEERLEADER]).toBeDefined();
    expect(PERSONA_POLICIES[AssistantPersona.GUIDE]).toBeDefined();
    expect(PERSONA_POLICIES[AssistantPersona.SERGEANT]).toBeDefined();
  });

  it("verifies policy parameters for each canonical persona", () => {
    expect(WRAP_FORM_DIRTY).toBe(2);
    const c = getPersonaPolicy(AssistantPersona.CHEERLEADER);
    expect(c.repsPerMotivation).toBe(4);
    expect(c.maxCorrectionsPerExercise).toBe(1);
    expect(c.encourageEvery).toBe(1);

    const g = getPersonaPolicy(AssistantPersona.GUIDE);
    expect(g.repsPerMotivation).toBe(7);
    expect(g.maxCorrectionsPerExercise).toBe(2);
    expect(g.encourageEvery).toBe(2);

    const s = getPersonaPolicy(AssistantPersona.SERGEANT);
    expect(s.repsPerMotivation).toBe(10);
    expect(s.maxCorrectionsPerExercise).toBe(3);
    expect(s.encourageEvery).toBe(3);
  });

  it("triggers rep milestones based on persona cadence", () => {
    const engineCheer = new FrontendPersonaRuntimeEngine(AssistantPersona.CHEERLEADER);
    for (let i = 1; i <= 3; i++) {
      expect(engineCheer.onRepCompleted(true, 0).trigger).toBeNull();
    }
    const d4 = engineCheer.onRepCompleted(true, 0);
    expect(d4.trigger).toBe("milestone");
    expect(d4.text).toContain("4 reps!");

    const engineGuide = new FrontendPersonaRuntimeEngine(AssistantPersona.GUIDE);
    for (let i = 1; i <= 6; i++) {
      expect(engineGuide.onRepCompleted(true, 0).trigger).toBeNull();
    }
    const d7 = engineGuide.onRepCompleted(true, 0);
    expect(d7.trigger).toBe("milestone");
    expect(d7.text).toContain("7 reps completed");
  });

  it("triggers behind cue when 2 or more reps behind instructor", () => {
    const engine = new FrontendPersonaRuntimeEngine(AssistantPersona.GUIDE);
    expect(engine.onRepCompleted(true, 1).trigger).toBeNull();

    const dBehind = engine.onRepCompleted(true, BEHIND_REPS);
    expect(dBehind.trigger).toBe("behind");
    expect(dBehind.reason).toBe("behind_2_reps");

    // Fires at most once per exercise
    expect(engine.onRepCompleted(true, 3).trigger).toBeNull();
  });

  it("triggers final push at >= 80% progress once exercise started", () => {
    const engine = new FrontendPersonaRuntimeEngine(AssistantPersona.GUIDE);
    expect(engine.onProgress(FINAL_FRAC).trigger).toBeNull();

    engine.onRepCompleted(true);
    const dFinal = engine.onProgress(FINAL_FRAC);
    expect(dFinal.trigger).toBe("final");
    expect(dFinal.reason).toBe("final_push_80pct");

    expect(engine.onProgress(0.95).trigger).toBeNull();
  });

  it("requires actual recorded form evidence (>= 2 dirty reps) for wrap_form", () => {
    const engine = new FrontendPersonaRuntimeEngine(AssistantPersona.CHEERLEADER);
    engine.onRepCompleted(true);
    // 0 dirty reps -> wrap_strong
    expect(engine.onExerciseCompleted(1).trigger).toBe("wrap_strong");

    engine.resetExercise();
    engine.onRepCompleted(false);
    // 1 dirty rep -> not wrap_form yet (requires >= 2)
    expect(engine.onExerciseCompleted(1).trigger).toBe("wrap_strong");

    engine.resetExercise();
    engine.onRepCompleted(false);
    engine.onRepCompleted(false);
    // 2 dirty reps -> wrap_form
    const dForm = engine.onExerciseCompleted(1);
    expect(dForm.trigger).toBe("wrap_form");
    expect(dForm.reason).toBe("wrap_form_2_dirty_reps");
  });

  it("respects encourage_every exercise spacing", () => {
    const engineGuide = new FrontendPersonaRuntimeEngine(AssistantPersona.GUIDE);
    engineGuide.onRepCompleted(true);
    // Guide encourageEvery = 2
    expect(engineGuide.onExerciseCompleted(1).trigger).toBeNull();
    expect(engineGuide.onExerciseCompleted(2).trigger).toBe("wrap_strong");

    const engineSergeant = new FrontendPersonaRuntimeEngine(AssistantPersona.SERGEANT);
    engineSergeant.onRepCompleted(true);
    // Sergeant encourageEvery = 3
    expect(engineSergeant.onExerciseCompleted(1).trigger).toBeNull();
    expect(engineSergeant.onExerciseCompleted(2).trigger).toBeNull();
    expect(engineSergeant.onExerciseCompleted(3).trigger).toBe("wrap_strong");
  });

  it("enforces correction caps and resets on exercise transition", () => {
    const engineCheer = new FrontendPersonaRuntimeEngine(AssistantPersona.CHEERLEADER);
    expect(engineCheer.canVoiceCorrection()).toBe(true);
    expect(engineCheer.canVoiceCorrection()).toBe(false);

    engineCheer.resetExercise();
    expect(engineCheer.canVoiceCorrection()).toBe(true);

    const engineSergeant = new FrontendPersonaRuntimeEngine(AssistantPersona.SERGEANT);
    expect(engineSergeant.canVoiceCorrection()).toBe(true);
    expect(engineSergeant.canVoiceCorrection()).toBe(true);
    expect(engineSergeant.canVoiceCorrection()).toBe(true);
    expect(engineSergeant.canVoiceCorrection()).toBe(false);
  });

  it("handles timed exercises and prevents late cue bursts after missed time", () => {
    const engine = new FrontendPersonaRuntimeEngine(AssistantPersona.CHEERLEADER, true);
    expect(engine.onProgress(0.1, 3.0).trigger).toBeNull();

    const d6 = engine.onProgress(0.2, 6.0);
    expect(d6.trigger).toBe("milestone");

    // Time jump (e.g. after long pause or speech)
    const dJump = engine.onProgress(0.5, 20.0);
    expect(dJump.trigger).toBe("milestone");

    // Immediately next second -> no backed-up burst
    expect(engine.onProgress(0.55, 21.0).trigger).toBeNull();
  });

  it("suppresses triggers when canSpeak is false (silent or haptic-only mode)", () => {
    const engine = new FrontendPersonaRuntimeEngine(AssistantPersona.CHEERLEADER);
    const dSuppressed = engine.onRepCompleted(true, 0, false);
    expect(dSuppressed.trigger).toBeNull();
    expect(dSuppressed.reason).toBe("can_speak_false");
  });
});
