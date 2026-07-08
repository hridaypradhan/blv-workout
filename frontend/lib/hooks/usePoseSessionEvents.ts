import { useState, useEffect, useRef } from "react";
import { generateCorrection } from "@/lib/api";
import { AssistantPersona, Exercise, User, FormError } from "@/types";
import { SESSION_EVENTS } from "@/lib/sessionEvents";
import { PoseRuntimeContract } from "@/lib/pose/poseRuntimeTypes";

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
}

/** Maps a tracked anatomical joint to logical limb targets for dry-run triggering. */
function getLimbsForJoint(joint?: string): string[] {
  const j = joint?.toLowerCase() || "";
  const limbs: string[] = [];

  const isLeft = j.includes("left");
  const isRight = j.includes("right");
  const isArm = j.includes("arm") || j.includes("shoulder") || j.includes("elbow") || j.includes("wrist");
  const isLeg = j.includes("leg") || j.includes("hip") || j.includes("knee") || j.includes("ankle");

  if (isLeft && isArm) limbs.push("left_arm");
  else if (isRight && isArm) limbs.push("right_arm");
  else if (isLeft && isLeg) limbs.push("left_leg");
  else if (isRight && isLeg) limbs.push("right_leg");
  else {
    if (isArm) limbs.push("left_arm", "right_arm");
    else if (isLeg) limbs.push("left_leg", "right_leg");
    else limbs.push("left_arm", "right_arm");
  }
  return limbs;
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

      const vibrationId = userProfile?.haptic_preferences?.per_rep_tick || "per_rep_tick_001";
      const limbs = ["left_arm", "right_arm"];

      triggerHapticEvent({
        cueType: "per_rep_tick",
        vibrationId,
        intensity: 0.6,
        limbs,
        text: `Repetition ${nextRepCount} completed.`,
        cueId: `rep-tick-${nextRepCount}`,
        currentTimeMs,
      }).catch((err) => {
        console.error("Failed to trigger rep haptic cue:", err);
      });
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
      }
    );

    // 1. Fetch form correction cue from assistant API
    const correctionPayload = {
      exercise_id: exerciseId,
      exercise_name: exerciseName,
      joint: latestFormError.joint,
      angle: latestFormError.observed_angle,
      current_timestamp_ms: currentTimeMs,
      persona: userProfile?.assistant_persona || AssistantPersona.SUPPORTIVE,
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
        });
      })
      .catch((err) => {
        console.error("Failed to generate correction cue:", err);
      });

    // 2. Trigger corrective haptic feedback on target limbs
    const limbs = getLimbsForJoint(latestFormError.joint);
    const vibrationId = userProfile?.haptic_preferences?.form_warning_above || "form_warning_above_001";

    triggerHapticEvent({
      cueType: "form_warning_above",
      vibrationId,
      intensity: 0.8,
      limbs,
      text: `Form warning: ${latestFormError.message}`,
      cueId: `form-error-${currentTimeMs}-${latestFormError.joint}`,
      currentTimeMs,
    }).catch((err) => {
      console.error("Failed to trigger corrective haptic cue:", err);
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
