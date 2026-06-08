export const SESSION_EVENTS = {
  PLAY: "play",
  PAUSE: "pause",
  ENDED: "ended",
  SEEK: "seek",
  SPEED_CHANGE: "speed_change",
  USER_QUESTION_SUBMITTED: "user_question_submitted",
  ASSISTANT_ANSWER_DELIVERED: "assistant_answer_delivered",
  ASSISTANT_ANSWER_FAILED: "assistant_answer_failed",
  ASSISTANT_CUE_DELIVERED: "assistant_cue_delivered",
  ASSISTANT_CORRECTION_REQUESTED: "assistant_correction_requested",
  ASSISTANT_CORRECTION_DELIVERED: "assistant_correction_delivered",
  HAPTIC_CUE_REQUESTED: "haptic_cue_requested",
  HAPTIC_CUE_TRIGGERED: "haptic_cue_triggered",
  HAPTIC_CUE_FAILED: "haptic_cue_failed",
  HAPTIC_TEST_REQUESTED: "haptic_test_requested",
  TRAINER_INSTRUCTION_REPEATED: "trainer_instruction_repeated",
  SECTION_SKIPPED: "section_skipped",
  PROTOTYPE_REP_DETECTED: "prototype_rep_detected",
  PROTOTYPE_FORM_ERROR_DETECTED: "prototype_form_error_detected",
} as const;

export type SessionEventType = typeof SESSION_EVENTS[keyof typeof SESSION_EVENTS];
