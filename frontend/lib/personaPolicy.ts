import { AssistantPersona } from "@/types";

export interface PersonaPolicyConfig {
  name: string;
  repsPerMotivation: number;
  maxCorrectionsPerExercise: number;
  encourageEvery: number;
  wrapStyle: string;
  tone: string;
}

export const PERSONA_POLICIES: Record<AssistantPersona, PersonaPolicyConfig> = {
  [AssistantPersona.CHEERLEADER]: {
    name: "cheerleader",
    repsPerMotivation: 4,
    maxCorrectionsPerExercise: 1,
    encourageEvery: 1,
    wrapStyle: "pure celebration — cheer the finished exercise like a victory",
    tone: "exuberant cheerleader celebrating every effort",
  },
  [AssistantPersona.GUIDE]: {
    name: "guide",
    repsPerMotivation: 7,
    maxCorrectionsPerExercise: 2,
    encourageEvery: 2,
    wrapStyle: "warm, brief acknowledgement and steady confidence",
    tone: "steady, warm coach encouraging without overdoing it",
  },
  [AssistantPersona.SERGEANT]: {
    name: "sergeant",
    repsPerMotivation: 10,
    maxCorrectionsPerExercise: 3,
    encourageEvery: 3,
    wrapStyle: "brisk but genuinely encouraging with technical guidance",
    tone: "disciplined drill sergeant, terse, commanding, short punchy phrases",
  },
};

export const BEHIND_REPS = 2;
export const FINAL_FRAC = 0.8;
export const WRAP_FORM_DIRTY = 2;
export const TIME_MOTIVATION_BASE_S = 6.0;

export function getPersonaPolicy(persona: AssistantPersona): PersonaPolicyConfig {
  return PERSONA_POLICIES[persona] || PERSONA_POLICIES[AssistantPersona.GUIDE];
}

export type TriggerType = "milestone" | "behind" | "final" | "wrap_strong" | "wrap_hard" | "wrap_form";

export interface PersonaTriggerDecision {
  trigger: TriggerType | null;
  reason: string | null;
  text?: string;
}

export class FrontendPersonaRuntimeEngine {
  private persona: AssistantPersona;
  private timed: boolean;
  private policy: PersonaPolicyConfig;

  private reps: number = 0;
  private dirtyReps: number = 0;
  private maxBehind: number = 0;
  private behindFired: boolean = false;
  private finalFired: boolean = false;
  private correctionsVoiced: number = 0;

  private secondsPerMotivation: number;
  private nextTimedCueS: number;

  constructor(persona: AssistantPersona = AssistantPersona.GUIDE, timed: boolean = false) {
    this.persona = persona;
    this.timed = timed;
    this.policy = getPersonaPolicy(persona);

    this.secondsPerMotivation = TIME_MOTIVATION_BASE_S * (this.policy.repsPerMotivation / 4.0);
    this.nextTimedCueS = this.secondsPerMotivation;
  }

  public resetExercise(timed: boolean = false, persona?: AssistantPersona): void {
    if (persona) {
      this.persona = persona;
      this.policy = getPersonaPolicy(persona);
    }
    this.timed = timed;
    this.reps = 0;
    this.dirtyReps = 0;
    this.maxBehind = 0;
    this.behindFired = false;
    this.finalFired = false;
    this.correctionsVoiced = 0;

    this.secondsPerMotivation = TIME_MOTIVATION_BASE_S * (this.policy.repsPerMotivation / 4.0);
    this.nextTimedCueS = this.secondsPerMotivation;
  }

  public canVoiceCorrection(): boolean {
    if (this.correctionsVoiced < this.policy.maxCorrectionsPerExercise) {
      this.correctionsVoiced += 1;
      return true;
    }
    return false;
  }

  public get correctionsVoicedCount(): number {
    return this.correctionsVoiced;
  }

  public noteFormError(): void {
    this.dirtyReps += 1;
  }

  public onRepCompleted(clean: boolean, repsBehind?: number | null, canSpeak: boolean = true): PersonaTriggerDecision {
    this.reps += 1;
    if (!clean) {
      this.dirtyReps += 1;
    }
    if (typeof repsBehind === "number") {
      this.maxBehind = Math.max(this.maxBehind, repsBehind);
    }

    if (!canSpeak) {
      return { trigger: null, reason: "can_speak_false" };
    }

    if (!this.timed && !this.behindFired && typeof repsBehind === "number" && repsBehind >= BEHIND_REPS) {
      this.behindFired = true;
      const text = this.formatCueText("behind");
      return { trigger: "behind", reason: `behind_${repsBehind}_reps`, text };
    }

    if (!this.timed && this.reps % this.policy.repsPerMotivation === 0) {
      const text = this.formatCueText("milestone");
      return { trigger: "milestone", reason: `rep_${this.reps}_milestone`, text };
    }

    return { trigger: null, reason: null };
  }

  public onProgress(fracDone: number, elapsedS?: number | null, canSpeak: boolean = true): PersonaTriggerDecision {
    if (!canSpeak) {
      return { trigger: null, reason: "can_speak_false" };
    }

    const started = this.reps > 0 || this.timed;
    if (!this.finalFired && fracDone >= FINAL_FRAC && started) {
      this.finalFired = true;
      const text = this.formatCueText("final");
      return { trigger: "final", reason: `final_push_${Math.floor(fracDone * 100)}pct`, text };
    }

    if (this.timed && typeof elapsedS === "number" && elapsedS >= this.nextTimedCueS) {
      while (this.nextTimedCueS <= elapsedS) {
        this.nextTimedCueS += this.secondsPerMotivation;
      }
      const text = this.formatCueText("milestone");
      return { trigger: "milestone", reason: `timed_milestone_${elapsedS.toFixed(1)}s`, text };
    }

    return { trigger: null, reason: null };
  }

  public onExerciseCompleted(completedCount: number): PersonaTriggerDecision {
    if (this.policy.encourageEvery <= 0 || completedCount % this.policy.encourageEvery !== 0) {
      return { trigger: null, reason: `encourage_every_${this.policy.encourageEvery}_skip` };
    }

    if (this.dirtyReps >= WRAP_FORM_DIRTY) {
      const text = this.formatCueText("wrap_form");
      return { trigger: "wrap_form", reason: `wrap_form_${this.dirtyReps}_dirty_reps`, text };
    }

    if (this.timed) {
      const text = this.formatCueText("wrap_strong");
      return { trigger: "wrap_strong", reason: "wrap_strong_timed_completed", text };
    }

    if (this.maxBehind >= BEHIND_REPS || this.reps === 0) {
      const text = this.formatCueText("wrap_hard");
      return { trigger: "wrap_hard", reason: `wrap_hard_behind_${this.maxBehind}_or_zero_reps`, text };
    }

    const text = this.formatCueText("wrap_strong");
    return { trigger: "wrap_strong", reason: "wrap_strong_clean_pace", text };
  }

  private formatCueText(trigger: TriggerType): string {
    switch (this.persona) {
      case AssistantPersona.CHEERLEADER:
        switch (trigger) {
          case "milestone": return `${this.reps} reps! Sensational effort, keep that energy burning!`;
          case "behind": return "Catch up! You have all the power inside to match the trainer!";
          case "final": return "Final push! Finish this set like a total champion!";
          case "wrap_strong": return "Victory on that exercise! Outstanding work!";
          case "wrap_hard": return "Tough set, but your determination is unbeatable!";
          case "wrap_form": return "Way to power through! Focus on locked-in form for the next move!";
        }
        break;
      case AssistantPersona.SERGEANT:
        switch (trigger) {
          case "milestone": return `${this.reps} reps completed. Maintain strict posture.`;
          case "behind": return "Pace dropping. Lock in and increase rep tempo now.";
          case "final": return "Final stretch. Hold tension to the last second.";
          case "wrap_strong": return "Exercise complete. Good execution. Next exercise.";
          case "wrap_hard": return "Challenging set. Reset stance and execute with control next time.";
          case "wrap_form": return "Exercise done. Form slipped on multiple reps. Reset alignment next set.";
        }
        break;
      case AssistantPersona.GUIDE:
      default:
        switch (trigger) {
          case "milestone": return `${this.reps} reps completed. Keep up that steady, smooth rhythm.`;
          case "behind": return "Slightly behind pace — pick up the count when you feel ready.";
          case "final": return "Eighty percent done. Finish this movement with control.";
          case "wrap_strong": return "Solid exercise complete. Take a breath heading into the next move.";
          case "wrap_hard": return "Challenging set finished. Scaling your pace is completely okay.";
          case "wrap_form": return "Exercise complete. Be mindful of body alignment on the next set.";
        }
        break;
    }
    return "Great work, stay focused.";
  }
}
