import { User, AssistantPersona, FeedbackModality, InterruptionLevel, AssistantVerbosity, HapticPreferences } from "@/types";

export const CANONICAL_HAPTIC_CATEGORIES = ["start", "finish", "reps", "speed_up", "slow_down"] as const;
export type CanonicalHapticCategory = typeof CANONICAL_HAPTIC_CATEGORIES[number];

export const HAPTIC_CATEGORY_DEFAULT_IDS: Record<CanonicalHapticCategory, string> = {
  start: "start_high_01_v-09-11-4-3",
  finish: "finish_high_01_v-09-10-12-2",
  reps: "reps_high_01_v-09-16-1-43",
  speed_up: "speed_up_high_01_v-09-10-3-52",
  slow_down: "slow_down_high_01_v-09-11-3-54",
};

export const DEFAULT_USER_PREFERENCES = {
  assistant_persona: AssistantPersona.GUIDE,
  feedback_modalities: [FeedbackModality.AUDIO, FeedbackModality.HAPTIC],
  voice_settings: {
    vision_loss: "vl-blind",
    screen_reader: "none",
    tts_rate: 1.0,
    voice_id: "system",
    spatial_audio: true,
    haptic_first: true,
  },
  audio_coexistence: {
    interruption_level: InterruptionLevel.BRIEF_SPEECH,
    assistant_verbosity: AssistantVerbosity.MODERATE,
    pause_before_speaking: true,
    correction_frequency: "medium",
  },
  haptic_preferences: { ...HAPTIC_CATEGORY_DEFAULT_IDS },
};

/**
 * Normalizes an incoming raw cue type or string key to a canonical haptic category.
 * Translates per_rep / per_rep_tick -> reps and cooldown -> finish at migration boundaries.
 * Explicitly returns null for countdown, form_warning_above, or unknown/unclassifiable keys.
 */
export function normalizeHapticCategory(rawCategory?: string | null): CanonicalHapticCategory | null {
  if (!rawCategory) return null;
  const cat = rawCategory.trim().toLowerCase();

  if (cat === "start") return "start";
  if (cat === "finish") return "finish";
  if (cat === "reps") return "reps";
  if (cat === "speed_up") return "speed_up";
  if (cat === "slow_down") return "slow_down";

  // Migration translations
  if (cat === "per_rep" || cat === "per_rep_tick") return "reps";
  if (cat === "cooldown") return "finish";

  // Suppressed haptic categories or unknown inputs
  if (cat === "countdown" || cat === "form_warning_above") return null;

  return null;
}

/**
 * Safely infers a canonical haptic category from cue text or metadata.
 * Authoritative: When metadata cue type is present, normalizes and returns directly (including null for suppressed/unknown).
 * Text matching is used ONLY when no metadata cue type was supplied.
 */
export function inferHapticCategoryFromCue(text: string, metadata?: Record<string, unknown> | null): CanonicalHapticCategory | null {
  const metaCueType = (metadata?.cue_type ?? metadata?.haptic_cue_ref ?? metadata?.cueType) as string | undefined;
  if (typeof metaCueType === "string" && metaCueType.trim().length > 0) {
    return normalizeHapticCategory(metaCueType);
  }

  const t = text.toLowerCase();
  if (t.includes("countdown")) return null;
  if (t.includes("form warning") || t.includes("form alert") || t.includes("form reminder")) return null;

  if (t.includes("rep") || t.includes("count") || t.includes("tick")) return "reps";
  if (t.includes("speed up") || t.includes("faster") || t.includes("accelerate")) return "speed_up";
  if (t.includes("slow down") || t.includes("slower")) return "slow_down";
  if (t.includes("start") || t.includes("begin")) return "start";
  if (t.includes("finish") || t.includes("cool down") || t.includes("cooldown") || t.includes("done") || t.includes("complete")) return "finish";

  return null;
}

/** Normalize raw/legacy haptic preferences object into 5 canonical keys with valid category-safe candidate IDs. */
export function normalizeHapticPreferences(
  raw: Record<string, unknown> | null | undefined,
  validManifestCandidateIds?: Set<string> | string[]
): HapticPreferences {
  const defaults = HAPTIC_CATEGORY_DEFAULT_IDS;
  if (!raw || typeof raw !== "object") {
    return { ...defaults };
  }

  const copy = { ...raw } as Record<string, string>;

  // Migrate legacy keys if new category key is missing
  if (!copy.reps && (copy.per_rep || copy.per_rep_tick)) {
    copy.reps = (copy.per_rep || copy.per_rep_tick) as string;
  }
  if (!copy.finish && copy.cooldown) {
    copy.finish = copy.cooldown as string;
  }

  const validSet = validManifestCandidateIds
    ? (validManifestCandidateIds instanceof Set ? validManifestCandidateIds : new Set(validManifestCandidateIds))
    : null;

  const isInvalidCandidateId = (category: CanonicalHapticCategory, id?: string) => {
    if (!id || typeof id !== "string") return true;
    if (id.includes("_00")) return true;
    if (id === "countdown_001" || id === "form_warning_above_001" || id === "per_rep_tick_001" || id === "cooldown_001") return true;
    // Enforce category prefix match
    if (!id.startsWith(`${category}_`)) return true;
    // Enforce manifest candidate set membership if available
    if (validSet && validSet.size > 0 && !validSet.has(id)) return true;
    return false;
  };

  return {
    start: isInvalidCandidateId("start", copy.start) ? defaults.start : copy.start,
    finish: isInvalidCandidateId("finish", copy.finish) ? defaults.finish : copy.finish,
    reps: isInvalidCandidateId("reps", copy.reps) ? defaults.reps : copy.reps,
    speed_up: isInvalidCandidateId("speed_up", copy.speed_up) ? defaults.speed_up : copy.speed_up,
    slow_down: isInvalidCandidateId("slow_down", copy.slow_down) ? defaults.slow_down : copy.slow_down,
  };
}

/**
 * Normalizes raw persona strings to canonical AssistantPersona values.
 * Mapping:
 * - energetic -> cheerleader
 * - supportive -> guide
 * - calm -> guide
 * - direct -> sergeant
 * - missing/unknown/invalid -> guide
 */
export function normalizeAssistantPersona(rawPersona?: string | null): AssistantPersona {
  if (!rawPersona || typeof rawPersona !== "string") {
    return AssistantPersona.GUIDE;
  }
  const p = rawPersona.trim().toLowerCase();
  if (p === "cheerleader") return AssistantPersona.CHEERLEADER;
  if (p === "guide") return AssistantPersona.GUIDE;
  if (p === "sergeant") return AssistantPersona.SERGEANT;

  if (p === "energetic") return AssistantPersona.CHEERLEADER;
  if (p === "supportive" || p === "calm") return AssistantPersona.GUIDE;
  if (p === "direct") return AssistantPersona.SERGEANT;

  return AssistantPersona.GUIDE;
}

/** Helper to merge a partial/fetched user profile with default preferences. */
export function mergeUserPreferences(user: Partial<User>): User {
  const email = user.email || `${(user.name || "user").toLowerCase().replace(/\s+/g, ".")}@fita11y.local`;
  
  const mergedVoiceSettings = {
    ...DEFAULT_USER_PREFERENCES.voice_settings,
    ...(user.voice_settings || {}),
  };

  const mergedAudioCoexistence = {
    ...DEFAULT_USER_PREFERENCES.audio_coexistence,
    ...(user.audio_coexistence || {}),
  };

  const mergedHapticPreferences = normalizeHapticPreferences(user.haptic_preferences as Record<string, unknown>);

  return {
    id: user.id || null,
    name: user.name || "",
    email: email,
    assistant_persona: normalizeAssistantPersona(user.assistant_persona),
    feedback_modalities: user.feedback_modalities || DEFAULT_USER_PREFERENCES.feedback_modalities,
    voice_settings: mergedVoiceSettings,
    audio_coexistence: mergedAudioCoexistence,
    haptic_preferences: mergedHapticPreferences,
    created_at: user.created_at || null,
  };
}
