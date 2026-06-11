import { User, AssistantPersona, FeedbackModality, InterruptionLevel, AssistantVerbosity } from "@/types";

export const DEFAULT_USER_PREFERENCES = {
  assistant_persona: AssistantPersona.SUPPORTIVE,
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
  haptic_preferences: {
    start: "start_001",
    countdown: "countdown_001",
    per_rep_tick: "per_rep_tick_001",
    speed_up: "speed_up_001",
    slow_down: "slow_down_001",
    form_warning_above: "form_warning_above_001",
    cooldown: "cooldown_001",
  },
};

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

  const mergedHapticPreferences = {
    ...DEFAULT_USER_PREFERENCES.haptic_preferences,
    ...(user.haptic_preferences || {}),
  };

  return {
    id: user.id || null,
    name: user.name || "",
    email: email,
    assistant_persona: user.assistant_persona || DEFAULT_USER_PREFERENCES.assistant_persona,
    feedback_modalities: user.feedback_modalities || DEFAULT_USER_PREFERENCES.feedback_modalities,
    voice_settings: mergedVoiceSettings,
    audio_coexistence: mergedAudioCoexistence,
    haptic_preferences: mergedHapticPreferences,
    created_at: user.created_at || null,
  };
}
