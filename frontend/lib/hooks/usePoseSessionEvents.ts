import { useState, useEffect, useRef } from "react";
import { generateCorrection } from "@/lib/api";
import { AssistantPersona, Exercise, User, FormError } from "@/types";
import { SESSION_EVENTS } from "@/lib/sessionEvents";
import { PoseRuntimeContract } from "@/lib/pose/poseRuntimeTypes";
import { PersonaTriggerDecision } from "@/lib/personaPolicy";

interface RepsBufferItem {
  exercise_id: string;
  rep_count: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface FormErrorsBufferItem {
  exercise_id: string;
  form_error: {
    joint: string;
    observed_angle: number;
    expected_range: [number, number];
    severity: string;
    message?: string | null;
    metadata?: Record<string, unknown>;
  };
  timestamp: string;
}

interface UsePoseSessionEventsProps {
  sessionId: string | null;
  currentTimeMs: number;
  currentExercise: Exercise | null;
  userProfile: User | null;
  announce: (msg: string) => void;
  updateLatestAutomaticCue: (text: string, source: string, startMs?: number, endMs?: number) => void;
  logSessionEvent: (eventType: string, timestampMs: number, metadata?: Record<string, unknown>) => void;
  triggerHapticEvent: (params: {
    cueType: string;
    vibrationId: string;
    intensity: number;
    limbs?: string[];
    text?: string;
    cueId?: string | null;
    currentTimeMs: number;
  }) => Promise<unknown>;
  activePoseRuntime: PoseRuntimeContract;
  canVoiceCorrection?: () => boolean;
  notePersonaFormError?: () => void;
  onPersonaRepCompleted?: (canSpeak: boolean) => PersonaTriggerDecision;
  onPersonaTrigger?: (decision: PersonaTriggerDecision, timestampMs: number) => void;
  canSpeakPersonaCue?: boolean;
}

export function usePoseSessionEvents({
  sessionId,
  currentTimeMs,
  currentExercise,
  userProfile,
  announce,
  updateLatestAutomaticCue,
  logSessionEvent,
  triggerHapticEvent,
  activePoseRuntime,
  canVoiceCorrection,
  notePersonaFormError,
  onPersonaRepCompleted,
  onPersonaTrigger,
  canSpeakPersonaCue = false,
}: UsePoseSessionEventsProps) {
  const repsBufferRef = useRef<RepsBufferItem[]>([]);
  const formErrorsBufferRef = useRef<FormErrorsBufferItem[]>([]);

  // Track the last handled rep count from the active provider to avoid duplicate triggers
  const lastHandledRepPerProviderRef = useRef<Record<string, number>>({});
  const [latestRepCount, setLatestRepCount] = useState<number>(0);

  const {
    currentAngles,
    latestRepEvent,
    latestFormError,
    trackingStatusLabel,
    isTracking,
    startTracking,
    stopTracking,
    providerSource,
  } = activePoseRuntime;

  // Track active exercise changes to reset buffer tracking parameters (if needed)
  const lastExerciseIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentId = currentExercise ? currentExercise.id : null;
    if (currentId !== lastExerciseIdRef.current) {
      lastExerciseIdRef.current = currentId;
      // We do NOT clear buffers, but we reset last handled rep tracking per provider
      lastHandledRepPerProviderRef.current = {};
      setLatestRepCount(0);
    }
  }, [currentExercise]);

  // Handle repetition events from the active pose runtime
  useEffect(() => {
    if (!sessionId) return;
    if (!latestRepEvent) return;

    const provider = providerSource === "camera_mediapipe" ? "camera_mediapipe" : "prototype_pose";
    const lastHandled = lastHandledRepPerProviderRef.current[provider] ?? -1;

    if (latestRepEvent.rep_count > lastHandled) {
      lastHandledRepPerProviderRef.current[provider] = latestRepEvent.rep_count;

      const nextRepCount = latestRepCount + 1;
      setLatestRepCount(nextRepCount);

      const exerciseId = currentExercise ? currentExercise.id : "00000000-0000-0000-0000-000000000000";
      const exerciseName = currentExercise ? currentExercise.name : "Workout";

      announce(`Repetition ${nextRepCount} completed.`);

      // Buffer rep completion event locally with provider metadata and optional fallback reason
      repsBufferRef.current.push({
        exercise_id: exerciseId,
        rep_count: nextRepCount,
        timestamp: new Date().toISOString(),
        metadata: {
          source: providerSource === "camera_mediapipe" ? "camera_mediapipe" : "prototype",
          provider,
          exercise_name: exerciseName,
          fallback_reason: providerSource === "prototype" 
            ? "MediaPipe tracking is offline, unavailable, unsupported, or has insufficient visibility."
            : undefined,
        },
      });

      // Log session event
      logSessionEvent(
        providerSource === "camera_mediapipe" ? SESSION_EVENTS.POSE_REP_DETECTED : SESSION_EVENTS.PROTOTYPE_REP_DETECTED,
        currentTimeMs,
        {
          rep_count: nextRepCount,
          exercise_name: exerciseName,
          provider,
        }
      );

      const vibrationId = userProfile?.haptic_preferences?.reps || "reps_high_01_v-09-16-1-43";
      const limbs = ["left_arm", "right_arm"];

      triggerHapticEvent({
        cueType: "reps",
        vibrationId,
        intensity: 0.6,
        limbs,
        text: `Repetition ${nextRepCount} completed.`,
        cueId: `rep-tick-${nextRepCount}`,
        currentTimeMs,
      }).catch((err) => {
        console.error("Failed to trigger rep haptic cue:", err);
      });

      const decision = onPersonaRepCompleted?.(canSpeakPersonaCue);
      if (decision?.trigger) {
        onPersonaTrigger?.(decision, currentTimeMs);
      }
    }
  }, [
    latestRepEvent,
    sessionId,
    currentExercise,
    currentTimeMs,
    userProfile,
    announce,
    logSessionEvent,
    triggerHapticEvent,
    providerSource,
    latestRepCount,
    onPersonaRepCompleted,
    onPersonaTrigger,
    canSpeakPersonaCue,
  ]);

  // Handle form error events from the active pose runtime
  const lastProcessedErrorRef = useRef<FormError | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    if (!latestFormError) return;

    // Deduplicate identical error object reference
    if (latestFormError === lastProcessedErrorRef.current) return;
    lastProcessedErrorRef.current = latestFormError;

    const provider = providerSource === "camera_mediapipe" ? "camera_mediapipe" : "prototype_pose";
    const exerciseId = currentExercise ? currentExercise.id : "00000000-0000-0000-0000-000000000000";
    const exerciseName = currentExercise ? currentExercise.name : "Workout";

    // Form evidence is recorded even when the persona's spoken correction cap
    // has been reached; it remains valid input for an evidence-based wrap cue.
    notePersonaFormError?.();

    announce(`Form warning: ${latestFormError.message}`);

    formErrorsBufferRef.current.push({
      exercise_id: exerciseId,
      form_error: {
        joint: latestFormError.joint,
        observed_angle: latestFormError.observed_angle,
        expected_range: latestFormError.expected_range,
        severity: latestFormError.severity,
        message: latestFormError.message,
        metadata: {
          source: providerSource === "camera_mediapipe" ? "camera_mediapipe" : "prototype",
          provider,
          fallback_reason: providerSource === "prototype"
            ? "MediaPipe tracking is offline, unavailable, unsupported, or has insufficient visibility."
            : undefined,
          ...latestFormError.metadata,
        },
      },
      timestamp: new Date().toISOString(),
    });

    // Log session event
    logSessionEvent(
      providerSource === "camera_mediapipe" ? SESSION_EVENTS.POSE_FORM_ERROR_DETECTED : SESSION_EVENTS.PROTOTYPE_FORM_ERROR_DETECTED,
      currentTimeMs,
      {
        joint: latestFormError.joint,
        observed_angle: latestFormError.observed_angle,
        expected_range: latestFormError.expected_range,
        severity: latestFormError.severity,
        message: latestFormError.message,
        provider,
        correction_kind: latestFormError.metadata?.correction_kind,
        offender_angle: latestFormError.metadata?.offender_angle,
        offender_joint: latestFormError.metadata?.offender_joint,
      }
    );

    // Fetch a spoken correction only while this persona still has correction
    // capacity for the active exercise. Form-warning haptics remain suppressed.
    if (canVoiceCorrection && !canVoiceCorrection()) {
      logSessionEvent(SESSION_EVENTS.ASSISTANT_CORRECTION_SUPPRESSED, currentTimeMs, {
        reason: "persona_correction_cap_reached",
        persona: userProfile?.assistant_persona || AssistantPersona.GUIDE,
        exercise_name: exerciseName,
      });
      return;
    }

    const correctionPayload = {
      exercise_id: exerciseId,
      exercise_name: exerciseName,
      joint: latestFormError.joint,
      angle: latestFormError.observed_angle,
      current_timestamp_ms: currentTimeMs,
      persona: userProfile?.assistant_persona || AssistantPersona.GUIDE,
      correction_kind: latestFormError.metadata?.correction_kind as string | undefined,
      offender_angle: latestFormError.metadata?.offender_angle as string | undefined,
      offender_joint: latestFormError.metadata?.offender_joint as string | undefined,
    };

    generateCorrection(correctionPayload)
      .then((response) => {
        updateLatestAutomaticCue(response.text, "correction");
        announce(`Assistant correction: ${response.text}`);

        logSessionEvent(SESSION_EVENTS.ASSISTANT_CORRECTION_DELIVERED, currentTimeMs, {
          text: response.text,
          joint: latestFormError.joint,
          modality: response.modality,
          priority: response.priority,
          persona: response.persona,
          source: response.metadata?.source,
          provider: response.metadata?.provider,
          correction_kind: response.metadata?.correction_kind || latestFormError.metadata?.correction_kind,
        });
      })
      .catch((err) => {
        console.error("Failed to generate correction cue:", err);
      });
  }, [
    latestFormError,
    sessionId,
    currentExercise,
    currentTimeMs,
    userProfile,
    announce,
    updateLatestAutomaticCue,
    logSessionEvent,
    triggerHapticEvent,
    providerSource,
    canVoiceCorrection,
    notePersonaFormError,
  ]);

  return {
    startPoseTracking: startTracking,
    stopPoseTracking: stopTracking,
    isPrototypeTracking: isTracking, // maps directly for backwards compatibility
    currentAngles,
    trackingStatusLabel,
    latestRepCount,
    repsBufferRef,
    formErrorsBufferRef,
  };
}
