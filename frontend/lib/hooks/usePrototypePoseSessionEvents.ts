import { useState, useEffect, useRef } from "react";
import { useMediaPipe } from "@/lib/hooks/useMediaPipe";
import { triggerHapticPattern, generateCorrection } from "@/lib/api";
import { AssistantPersona, Exercise, User } from "@/types";
import { SESSION_EVENTS } from "@/lib/sessionEvents";

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
  };
  timestamp: string;
}

interface UsePrototypePoseSessionEventsProps {
  sessionId: string | null;
  currentTimeMs: number;
  currentExercise: Exercise | null;
  isPlaying: boolean;
  userProfile: User | null;
  announce: (msg: string) => void;
  updateLatestAutomaticCue: (text: string, source: string) => void;
  logSessionEvent: (eventType: string, timestampMs: number, metadata?: Record<string, unknown>) => void;
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

export function usePrototypePoseSessionEvents({
  sessionId,
  currentTimeMs,
  currentExercise,
  isPlaying,
  userProfile,
  announce,
  updateLatestAutomaticCue,
  logSessionEvent,
}: UsePrototypePoseSessionEventsProps) {
  const repsBufferRef = useRef<RepsBufferItem[]>([]);
  const formErrorsBufferRef = useRef<FormErrorsBufferItem[]>([]);

  const lastHandledRepRef = useRef<number>(-1);
  const [latestRepCount, setLatestRepCount] = useState<number>(-1);

  // Setup the prototype pose runtime hook
  const {
    startCamera: startPoseTracking,
    stopCamera: stopPoseTracking,
    isPrototypeTracking,
    currentAngles,
    latestRepEvent,
    latestFormError,
    trackingStatusLabel,
  } = useMediaPipe({
    currentTimeMs,
    activeAnchor: currentExercise,
    isPlaying,
  });

  // Automatically start prototype pose tracking simulation
  useEffect(() => {
    if (sessionId && !isPrototypeTracking) {
      startPoseTracking();
    }
  }, [sessionId, isPrototypeTracking, startPoseTracking]);

  // Handle prototype repetition events
  useEffect(() => {
    if (latestRepEvent && latestRepEvent.rep_count > lastHandledRepRef.current) {
      const repCount = latestRepEvent.rep_count;
      lastHandledRepRef.current = repCount;
      setLatestRepCount(repCount);

      const exerciseId = currentExercise ? currentExercise.id : "00000000-0000-0000-0000-000000000000";
      const exerciseName = currentExercise ? currentExercise.name : "Workout";

      announce(`Repetition ${repCount} completed.`);

      // Buffer rep completion event locally
      repsBufferRef.current.push({
        exercise_id: exerciseId,
        rep_count: repCount,
        timestamp: new Date().toISOString(),
        metadata: {
          source: "prototype",
          provider: "prototype_pose",
          replace_with: "mediapipe_service",
          exercise_name: exerciseName,
        },
      });

      const vibrationId = userProfile?.haptic_preferences?.per_rep_tick || "per_rep_tick_001";
      const limbs = ["left_arm", "right_arm"];

      triggerHapticPattern(null, null, 0.6, "per_rep_tick", vibrationId, limbs)
        .then((res) => {
          announce(`Haptic cue would trigger: ${res.pattern_name} (dry-run).`);
          logSessionEvent(SESSION_EVENTS.HAPTIC_CUE_TRIGGERED, currentTimeMs, {
            cue_type: "per_rep_tick",
            selected_vibration_id: vibrationId,
            selected_wav: res.selected_wav,
            target_limbs: res.target_limbs,
            provider: res.provider,
            status: res.status,
            intensity: 0.6,
          });
        })
        .catch((err) => {
          console.error("Failed to trigger rep haptic cue:", err);
          logSessionEvent(SESSION_EVENTS.HAPTIC_CUE_FAILED, currentTimeMs, {
            cue_type: "per_rep_tick",
            selected_vibration_id: vibrationId,
            intensity: 0.6,
            error: err instanceof Error ? err.message : String(err),
          });
        });
    }
  }, [latestRepEvent, sessionId, currentExercise, currentTimeMs, userProfile, announce, logSessionEvent]);

  // Handle prototype form error events
  const lastHandledErrorRepRef = useRef<number>(-1);
  const lastLoggedFormErrors = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (latestFormError) {
      const repCount = Math.floor(currentTimeMs / 4000);
      if (repCount <= lastHandledErrorRepRef.current) return;

      const joint = latestFormError.joint || "unknown";
      const now = Date.now();
      const lastLogged = lastLoggedFormErrors.current.get(joint) || 0;
      if (now - lastLogged < 10000) return; // 10 second deduplication throttle

      lastHandledErrorRepRef.current = repCount;
      lastLoggedFormErrors.current.set(joint, now);

      const exerciseId = currentExercise ? currentExercise.id : "00000000-0000-0000-0000-000000000000";
      const exerciseName = currentExercise ? currentExercise.name : "Workout";

      announce(`Form warning: ${latestFormError.message}`);

      // Buffer form error event locally
      formErrorsBufferRef.current.push({
        exercise_id: exerciseId,
        form_error: {
          joint: latestFormError.joint,
          observed_angle: latestFormError.observed_angle,
          expected_range: latestFormError.expected_range,
          severity: latestFormError.severity,
          message: latestFormError.message,
        },
        timestamp: new Date().toISOString(),
      });

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

      triggerHapticPattern(null, null, 0.8, "form_warning_above", vibrationId, limbs)
        .then((res) => {
          announce(`Haptic cue would trigger on limbs ${limbs.join(", ")} (dry-run).`);
          logSessionEvent(SESSION_EVENTS.HAPTIC_CUE_TRIGGERED, currentTimeMs, {
            cue_type: "form_warning_above",
            selected_vibration_id: vibrationId,
            selected_wav: res.selected_wav,
            target_limbs: res.target_limbs,
            provider: res.provider,
            status: res.status,
            intensity: 0.8,
          });
        })
        .catch((err) => {
          console.error("Failed to trigger corrective haptic cue:", err);
          logSessionEvent(SESSION_EVENTS.HAPTIC_CUE_FAILED, currentTimeMs, {
            cue_type: "form_warning_above",
            selected_vibration_id: vibrationId,
            intensity: 0.8,
            error: err instanceof Error ? err.message : String(err),
          });
        });
    }
  }, [
    latestFormError,
    sessionId,
    currentExercise,
    currentTimeMs,
    userProfile,
    announce,
    updateLatestAutomaticCue,
    logSessionEvent,
  ]);

  return {
    startPoseTracking,
    stopPoseTracking,
    isPrototypeTracking,
    currentAngles,
    trackingStatusLabel,
    latestRepCount,
    repsBufferRef,
    formErrorsBufferRef,
  };
}
