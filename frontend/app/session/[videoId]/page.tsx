"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import PageWrapper from "@/components/layout/PageWrapper";
import { useYouTubePlayer } from "@/lib/hooks/useYouTubePlayer";
import { usePreparedVideo } from "@/lib/hooks/usePreparedVideo";
import { ProcessingStage } from "@/types";
import YouTubePlayerPanel from "@/components/session/YouTubePlayerPanel";
import SessionControls from "@/components/session/SessionControls";
import { useSessionTelemetry } from "@/lib/hooks/useSessionTelemetry";
import {
  endSession,
  getUserProfile,
  recordPlaybackEvent,
  askAssistant,
  triggerHapticPattern,
  recordRepCompletion,
  recordFormError,
  generateCorrection,
  getCuePlan,
  selectCueCandidate,
} from "@/lib/api";
import { getActiveUserId } from "@/lib/prototypeUser";
import { useSidecarManifest } from "@/lib/hooks/useSidecarManifest";
import { useAssistantCueQueue } from "@/lib/hooks/useAssistantCueQueue";
import { usePrototypeHapticConnection, getPrototypeSleeveStatuses } from "@/lib/hooks/usePrototypeHapticConnection";
import { InterruptionLevel, AssistantVerbosity, AudioCoexistenceSettings, User, AssistantPersona, CuePlan } from "@/types";
import { useMediaPipe } from "@/lib/hooks/useMediaPipe";
import { SESSION_EVENTS } from "@/lib/sessionEvents";

interface LiveSessionProps {
  params: {
    videoId: string;
  };
}

/** Helper to format time readouts */
function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
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

/** Inferred mapping of cue description text to haptic vibration category types. */
function getCueTypeFromCue(text: string, metadata?: Record<string, unknown> | null): string {
  if (metadata?.cue_type && typeof metadata.cue_type === "string") return metadata.cue_type;
  const t = text.toLowerCase();
  if (t.includes("countdown")) return "countdown";
  if (t.includes("start")) return "start";
  if (t.includes("cooldown") || t.includes("cool down") || t.includes("finish") || t.includes("done")) return "cooldown";
  if (t.includes("speed up") || t.includes("faster") || t.includes("accelerate")) return "speed_up";
  if (t.includes("slow down") || t.includes("slower") || t.includes("pace")) {
    if (t.includes("slow")) return "slow_down";
    if (t.includes("speed")) return "speed_up";
  }
  if (t.includes("rep") || t.includes("tick")) return "per_rep_tick";
  return "form_warning_above";
}

function LiveSessionContent({ params }: LiveSessionProps) {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const router = useRouter();

  const { isLoading: isLoadingJob, error: jobError, youtubeId, metadata, stage: jobStage } = usePreparedVideo(params.videoId);

  const [assistantMuted, setAssistantMuted] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [isEnding, setIsEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [cuePlan, setCuePlan] = useState<CuePlan | null>(null);
  const [isLoadingCuePlan, setIsLoadingCuePlan] = useState(true);
  const [cuePlanError, setCuePlanError] = useState<string | null>(null);
  const [recentlyDeliveredCueIds, setRecentlyDeliveredCueIds] = useState<string[]>([]);


  const { hapticState } = usePrototypeHapticConnection();

  useEffect(() => {
    const userId = getActiveUserId();
    getUserProfile(userId)
      .then((profile) => {
        setUserProfile(profile);
      })
      .catch((err) => {
        console.warn("Failed to fetch user settings for live session:", err);
      });
  }, []);

  useEffect(() => {
    if (jobStage === ProcessingStage.COMPLETED) {
      setIsLoadingCuePlan(true);
      getCuePlan(params.videoId)
        .then((plan) => {
          setCuePlan(plan);
          setCuePlanError(null);
          setIsLoadingCuePlan(false);
          console.log("Successfully loaded assistance cue plan for video:", params.videoId);
        })
        .catch((err) => {
          console.warn("Failed to load cue plan, will fallback to legacy timeline cue delivery:", err);
          setCuePlanError(err instanceof Error ? err.message : String(err));
          setIsLoadingCuePlan(false);
        });
    }
  }, [params.videoId, jobStage]);




  const announce = React.useCallback((msg: string) => {
    setAnnouncement(msg);
  }, []);

  // Hook into the YouTube IFrame player
  const {
    containerRef,
    isReady,
    isPlaying,
    isBuffering,
    hasEnded,
    currentTime,
    duration,
    playbackRate,
    error: playerError,
    play,
    pause,
    seek,
    setPlaybackRate,
  } = useYouTubePlayer(youtubeId);

  // Monitor playback states to populate the screen-reader announcement live region
  const prevIsPlayingAnnouncement = useRef(false);
  useEffect(() => {
    if (playerError) {
      announce(`Trainer player error: ${playerError}`);
    } else if (hasEnded) {
      announce("Trainer video playback ended.");
    } else if (isBuffering) {
      announce("Trainer video is buffering.");
    } else if (isPlaying) {
      announce("Trainer video playback started.");
    } else if (!isPlaying && prevIsPlayingAnnouncement.current) {
      announce("Trainer video playback paused.");
    } else if (isReady) {
      announce("Trainer video player is ready.");
    } else if (!isReady && youtubeId) {
      announce("Loading trainer video player.");
    }
    prevIsPlayingAnnouncement.current = isPlaying;
  }, [isReady, isPlaying, isBuffering, hasEnded, playerError, youtubeId, announce]);

  // Session playback interaction telemetry hook
  useSessionTelemetry({
    sessionId,
    isReady,
    isPlaying,
    hasEnded,
    currentTime,
    playbackRate,
  });

  // Load assistance sidecar manifest
  const { manifest, isLoading: isLoadingManifest, error: manifestError } = useSidecarManifest(
    params.videoId,
    jobStage === ProcessingStage.COMPLETED
  );

  const currentExercise = manifest?.exercise_timeline_anchors.find(
    (anchor) => currentTime >= anchor.start_time_seconds && currentTime <= anchor.end_time_seconds
  ) || null;

  const currentTimeMs = currentTime * 1000;

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
  const lastHandledRepRef = useRef<number>(-1);
  useEffect(() => {
    if (latestRepEvent && latestRepEvent.rep_count > lastHandledRepRef.current) {
      const repCount = latestRepEvent.rep_count;
      lastHandledRepRef.current = repCount;

      const exerciseId = currentExercise ? currentExercise.id : "00000000-0000-0000-0000-000000000000";
      const exerciseName = currentExercise ? currentExercise.name : "Workout";

      announce(`Repetition ${repCount} completed.`);

      if (sessionId) {
        recordRepCompletion(sessionId, exerciseId, repCount, {
          source: "prototype",
          provider: "prototype_pose",
          replace_with: "mediapipe_service",
          exercise_name: exerciseName,
        }).catch((err) => console.warn("Failed to log rep completion telemetry:", err));

        recordPlaybackEvent(sessionId, SESSION_EVENTS.PROTOTYPE_REP_DETECTED, currentTimeMs, {
          rep_count: repCount,
          exercise_name: exerciseName,
        }).catch((err) => console.warn("Failed to log rep event to timeline:", err));
      }

      const vibrationId = userProfile?.haptic_preferences?.per_rep_tick || "per_rep_tick_001";
      const limbs = ["left_arm", "right_arm"];

      if (sessionId) {
        recordPlaybackEvent(sessionId, SESSION_EVENTS.HAPTIC_CUE_REQUESTED, currentTimeMs, {
          cue_type: "per_rep_tick",
          selected_vibration_id: vibrationId,
          target_limbs: limbs,
          intensity: 0.6,
          purpose: "Rep completion feedback",
        }).catch((err) => console.warn("Failed to log haptic cue requested:", err));
      }

      triggerHapticPattern(null, null, 0.6, "per_rep_tick", vibrationId, limbs)
        .then((res) => {
          announce(`Haptic cue would trigger: ${res.pattern_name} (dry-run).`);
          if (sessionId) {
            recordPlaybackEvent(sessionId, SESSION_EVENTS.HAPTIC_CUE_TRIGGERED, currentTimeMs, {
              cue_type: "per_rep_tick",
              selected_vibration_id: vibrationId,
              selected_wav: res.selected_wav,
              target_limbs: res.target_limbs,
              provider: res.provider,
              status: res.status,
              intensity: 0.6,
            }).catch((err) => console.warn("Failed to log haptic cue triggered:", err));
          }
        })
        .catch((err) => {
          console.error("Failed to trigger rep haptic cue:", err);
          if (sessionId) {
            recordPlaybackEvent(sessionId, SESSION_EVENTS.HAPTIC_CUE_FAILED, currentTimeMs, {
              cue_type: "per_rep_tick",
              selected_vibration_id: vibrationId,
              intensity: 0.6,
              error: err instanceof Error ? err.message : String(err),
            }).catch((err) => console.warn("Failed to log haptic cue failed:", err));
          }
        });
    }
  }, [latestRepEvent, sessionId, currentExercise, currentTimeMs, userProfile, announce]);

  // Handle prototype form error events
  const lastHandledErrorRepRef = useRef<number>(-1);
  useEffect(() => {
    if (latestFormError) {
      const repCount = Math.floor(currentTimeMs / 4000);
      if (repCount <= lastHandledErrorRepRef.current) return;
      lastHandledErrorRepRef.current = repCount;

      const exerciseId = currentExercise ? currentExercise.id : "00000000-0000-0000-0000-000000000000";
      const exerciseName = currentExercise ? currentExercise.name : "Workout";

      announce(`Form warning: ${latestFormError.message}`);

      if (sessionId) {
        recordFormError(sessionId, exerciseId, {
          joint: latestFormError.joint,
          observed_angle: latestFormError.observed_angle,
          expected_range: latestFormError.expected_range,
          severity: latestFormError.severity,
          message: latestFormError.message,
        }).catch((err) => console.warn("Failed to log form error telemetry:", err));

        recordPlaybackEvent(sessionId, SESSION_EVENTS.PROTOTYPE_FORM_ERROR_DETECTED, currentTimeMs, {
          joint: latestFormError.joint,
          observed_angle: latestFormError.observed_angle,
          expected_range: latestFormError.expected_range,
          severity: latestFormError.severity,
          message: latestFormError.message,
        }).catch((err) => console.warn("Failed to log form error event to timeline:", err));
      }

      // 1. Fetch form correction cue from assistant API
      const correctionPayload = {
        exercise_id: exerciseId,
        exercise_name: exerciseName,
        joint: latestFormError.joint,
        angle: latestFormError.observed_angle,
        current_timestamp_ms: currentTimeMs,
        persona: userProfile?.assistant_persona || AssistantPersona.SUPPORTIVE,
      };

      if (sessionId) {
        recordPlaybackEvent(sessionId, SESSION_EVENTS.ASSISTANT_CORRECTION_REQUESTED, currentTimeMs, {
          joint: latestFormError.joint,
          observed_angle: latestFormError.observed_angle,
        }).catch((err) => console.warn("Failed to log correction request telemetry:", err));
      }

      generateCorrection(correctionPayload)
        .then((response) => {
          setChatMessages((prev) => [
            ...prev,
            { sender: "assistant", text: response.text },
          ]);
          announce(`Assistant correction: ${response.text}`);

          if (sessionId) {
            recordPlaybackEvent(sessionId, SESSION_EVENTS.ASSISTANT_CORRECTION_DELIVERED, currentTimeMs, {
              text: response.text,
              joint: latestFormError.joint,
              modality: response.modality,
              priority: response.priority,
              persona: response.persona,
              source: response.metadata?.source,
              provider: response.metadata?.provider,
            }).catch((err) => console.warn("Failed to log correction cue delivered telemetry:", err));
          }
        })
        .catch((err) => {
          console.error("Failed to generate correction cue:", err);
        });

      // 2. Trigger corrective haptic feedback on target limbs
      const limbs = getLimbsForJoint(latestFormError.joint);
      const vibrationId = userProfile?.haptic_preferences?.form_warning_above || "form_warning_above_001";

      if (sessionId) {
        recordPlaybackEvent(sessionId, SESSION_EVENTS.HAPTIC_CUE_REQUESTED, currentTimeMs, {
          cue_type: "form_warning_above",
          selected_vibration_id: vibrationId,
          target_limbs: limbs,
          intensity: 0.8,
          purpose: "Form correction warning",
        }).catch((err) => console.warn("Failed to log haptic cue requested:", err));
      }

      triggerHapticPattern(null, null, 0.8, "form_warning_above", vibrationId, limbs)
        .then((res) => {
          announce(`Haptic cue would trigger on limbs ${limbs.join(", ")} (dry-run).`);
          if (sessionId) {
            recordPlaybackEvent(sessionId, SESSION_EVENTS.HAPTIC_CUE_TRIGGERED, currentTimeMs, {
              cue_type: "form_warning_above",
              selected_vibration_id: vibrationId,
              selected_wav: res.selected_wav,
              target_limbs: res.target_limbs,
              provider: res.provider,
              status: res.status,
              intensity: 0.8,
            }).catch((err) => console.warn("Failed to log haptic cue triggered:", err));
          }
        })
        .catch((err) => {
          console.error("Failed to trigger corrective haptic cue:", err);
          if (sessionId) {
            recordPlaybackEvent(sessionId, SESSION_EVENTS.HAPTIC_CUE_FAILED, currentTimeMs, {
              cue_type: "form_warning_above",
              selected_vibration_id: vibrationId,
              intensity: 0.8,
              error: err instanceof Error ? err.message : String(err),
            }).catch((err) => console.warn("Failed to log haptic cue failed:", err));
          }
        });
    }
  }, [latestFormError, sessionId, currentExercise, currentTimeMs, userProfile, announce]);

  // Monitor manifest loading updates
  const prevIsLoadingManifest = useRef(false);
  const prevManifestError = useRef<string | null>(null);
  useEffect(() => {
    if (isLoadingManifest && !prevIsLoadingManifest.current) {
      announce("Assisted playback manifest is loading.");
    }
    if (!isLoadingManifest && prevIsLoadingManifest.current && manifest) {
      announce("Assisted playback manifest loaded successfully.");
    }
    if (manifestError && manifestError !== prevManifestError.current) {
      announce(`Failed to load assisted playback manifest: ${manifestError}`);
    }
    prevIsLoadingManifest.current = isLoadingManifest;
    prevManifestError.current = manifestError;
  }, [isLoadingManifest, manifest, manifestError, announce]);

  const searchLevel = searchParams.get("overrideLevel");
  const searchPause = searchParams.get("overridePause");

  const coexistenceSettings = React.useMemo<AudioCoexistenceSettings>(() => {
    return {
      interruption_level: assistantMuted
        ? InterruptionLevel.HAPTIC_ONLY
        : ((searchLevel as InterruptionLevel) || userProfile?.audio_coexistence?.interruption_level || InterruptionLevel.BRIEF_SPEECH),
      assistant_verbosity: userProfile?.audio_coexistence?.assistant_verbosity || AssistantVerbosity.MODERATE,
      pause_before_speaking: searchPause !== null
        ? searchPause === "true"
        : (userProfile?.audio_coexistence?.pause_before_speaking !== undefined
          ? userProfile.audio_coexistence.pause_before_speaking
          : true),
      correction_frequency: userProfile?.audio_coexistence?.correction_frequency || "medium",
    };
  }, [assistantMuted, searchLevel, userProfile, searchPause]);

  const prevTimeRef = useRef<number>(0);
  useEffect(() => {
    if (currentTime < prevTimeRef.current - 1.5) {
      setRecentlyDeliveredCueIds([]);
      lastCheckedSecond.current = -1;
    }
    prevTimeRef.current = currentTime;
  }, [currentTime]);

  const lastCheckedSecond = useRef<number>(-1);

  useEffect(() => {
    if (!cuePlan || !isPlaying) return;

    const currentSecond = Math.floor(currentTime);
    if (currentSecond === lastCheckedSecond.current) return;
    lastCheckedSecond.current = currentSecond;

    const payload = {
      video_id: params.videoId,
      current_time_ms: currentTime * 1000,
      coexistence_settings: coexistenceSettings,
      assistant_muted: assistantMuted,
      recently_delivered_cue_ids: recentlyDeliveredCueIds,
    };

    selectCueCandidate(payload)
      .then((res) => {
        if (res.should_deliver && res.cue_id) {
          setRecentlyDeliveredCueIds((prev) => [...prev, res.cue_id!]);

          const text = res.text || "";

          if (text) {
            setChatMessages((prev) => [
              ...prev,
              { sender: "assistant", text: text },
            ]);
          }

          if (res.modality === "audio" && text) {
            announce(`Assistant cue: ${text}`);
          } else if (res.modality === "haptic") {
            if (text) {
              announce(`Haptic cue requested: ${text}`);
            }

            const cueType = res.haptic_cue_ref || (text ? getCueTypeFromCue(text) : "per_rep_tick");
            const vibrationId = (userProfile?.haptic_preferences as Record<string, string | null | undefined>)?.[cueType] || `${cueType}_001`;
            const limbs = ["left_arm", "right_arm"];

            triggerHapticPattern(null, null, 0.7, cueType, vibrationId, limbs)
              .then((hapticRes) => {
                announce(`Haptic cue would trigger: ${hapticRes.pattern_name} (dry-run).`);
                if (sessionId) {
                  recordPlaybackEvent(sessionId, SESSION_EVENTS.HAPTIC_CUE_TRIGGERED, currentTime * 1000, {
                    cue_type: cueType,
                    selected_vibration_id: vibrationId,
                    selected_wav: hapticRes.selected_wav,
                    target_limbs: hapticRes.target_limbs,
                    provider: hapticRes.provider,
                    status: hapticRes.status,
                    intensity: 0.7,
                    text: text,
                    cue_id: res.cue_id,
                  }).catch((err) => console.warn("Failed to log haptic cue triggered telemetry:", err));
                }
              })
              .catch((err) => {
                console.error("Failed to trigger haptic cue:", err);
              });
          }

          if (sessionId) {
            recordPlaybackEvent(sessionId, res.modality === "haptic" ? SESSION_EVENTS.HAPTIC_CUE_REQUESTED : SESSION_EVENTS.ASSISTANT_CUE_DELIVERED, currentTime * 1000, {
              text: text,
              modality: res.modality,
              priority: "normal",
              cue_id: res.cue_id,
              reason: res.reason,
            }).catch((err) => console.warn("Failed to log cue delivery telemetry:", err));
          }

          if (res.recommended_playback_action === "pause_before_speaking") {
            pause();
            announce("Pausing workout playback for assistant instruction.");
          } else if (res.recommended_playback_action === "duck_audio") {
            announce("[Assistant ducks background music]");
          }
        }
      })
      .catch((err) => {
        console.warn("Failed to select cue candidate:", err);
      });
  }, [
    currentTime,
    isPlaying,
    cuePlan,
    coexistenceSettings,
    assistantMuted,
    recentlyDeliveredCueIds,
    params.videoId,
    userProfile,
    sessionId,
    pause,
    announce
  ]);

  // Wire up the assistant cue queue (legacy fallback)
  const { activeCue } = useAssistantCueQueue(
    cuePlan ? null : manifest,
    currentTimeMs,
    coexistenceSettings
  );

  const [chatMessages, setChatMessages] = useState<Array<{ sender: "assistant" | "user"; text: string }>>([
    { sender: "assistant", text: "Welcome! Stand 6 feet back. We are preparing to assist with your YouTube workout." }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);

  // Append new cues to the message feed as they trigger
  const lastRecordedCueKey = useRef<string | null>(null);
  useEffect(() => {
    if (activeCue) {
      const cueKey = `${activeCue.timestamp_ms}-${activeCue.text}`;
      if (lastRecordedCueKey.current === cueKey) return;
      lastRecordedCueKey.current = cueKey;

      setChatMessages((prev) => [
        ...prev,
        { sender: "assistant", text: activeCue.text }
      ]);

      // Expose as announcement for screen readers
      if (activeCue.modality === "audio") {
        announce(`Assistant cue: ${activeCue.text}`);
      } else if (activeCue.modality === "haptic") {
        announce(`Haptic cue requested: ${activeCue.text}`);
      }

      const isHaptic = activeCue.modality === "haptic";

      if (sessionId) {
        const eventType = isHaptic ? SESSION_EVENTS.HAPTIC_CUE_REQUESTED : SESSION_EVENTS.ASSISTANT_CUE_DELIVERED;
        recordPlaybackEvent(sessionId, eventType, activeCue.timestamp_ms, {
          text: activeCue.text,
          modality: activeCue.modality,
          priority: activeCue.priority,
          persona: activeCue.persona
        }).catch((err) => console.warn(`Failed to log ${eventType} event:`, err));
      }

      if (isHaptic) {
        const cueType = getCueTypeFromCue(activeCue.text, activeCue.metadata);
        const vibrationId = (userProfile?.haptic_preferences as Record<string, string | null | undefined>)?.[cueType] || `${cueType}_001`;
        const intensity = typeof activeCue.metadata?.intensity === "number" ? activeCue.metadata.intensity : 0.7;

        const limbs: string[] = [];
        const requestSleeves = (activeCue.metadata?.sleeve_sides || activeCue.metadata?.sleeves || ["both"]) as string[];
        requestSleeves.forEach(s => {
          if (s === "left") limbs.push("left_arm");
          else if (s === "right") limbs.push("right_arm");
          else if (s === "both") limbs.push("left_arm", "right_arm");
        });
        if (limbs.length === 0) {
          limbs.push("left_arm", "right_arm");
        }

        triggerHapticPattern(null, null, intensity, cueType, vibrationId, limbs)
          .then((res) => {
            announce(`Haptic cue would trigger: ${res.pattern_name} (dry-run).`);
            if (sessionId) {
              recordPlaybackEvent(sessionId, SESSION_EVENTS.HAPTIC_CUE_TRIGGERED, activeCue.timestamp_ms, {
                cue_type: cueType,
                selected_vibration_id: vibrationId,
                selected_wav: res.selected_wav,
                target_limbs: res.target_limbs,
                provider: res.provider,
                status: res.status,
                intensity: intensity,
                text: activeCue.text,
                cue_timestamp_ms: activeCue.timestamp_ms,
                current_timestamp: currentTime
              }).catch((err) => console.warn("Failed to log haptic_cue_triggered event:", err));
            }
          })
          .catch((err) => {
            console.error("Failed to trigger prototype haptic cue:", err);
            const errMsg = err instanceof Error ? err.message : "Unknown error";
            announce(`Prototype haptic cue failed: ${errMsg}`);
            if (sessionId) {
              recordPlaybackEvent(sessionId, SESSION_EVENTS.HAPTIC_CUE_FAILED, activeCue.timestamp_ms, {
                cue_type: cueType,
                selected_vibration_id: vibrationId,
                intensity: intensity,
                text: activeCue.text,
                error: errMsg,
                current_timestamp: currentTime
              }).catch((err) => console.warn("Failed to log haptic_cue_failed event:", err));
            }
          });
      }
    }
  }, [activeCue, sessionId, currentTime, userProfile, announce]);

  const handleRepeatTrainerInstruction = () => {
    if (!manifest || !manifest.trainer_instruction_events) return;
    const priorEvents = manifest.trainer_instruction_events.filter(
      (evt) => evt.start_ms !== null && evt.start_ms !== undefined && evt.start_ms <= currentTimeMs
    );
    if (priorEvents.length > 0) {
      priorEvents.sort((a, b) => (b.start_ms ?? 0) - (a.start_ms ?? 0));
      const latestEvent = priorEvents[0];
      if (latestEvent.start_ms !== null && latestEvent.start_ms !== undefined) {
        seek(latestEvent.start_ms / 1000);
        announce(`Repeating trainer instruction: "${latestEvent.text}"`);
        if (sessionId) {
          recordPlaybackEvent(sessionId, SESSION_EVENTS.TRAINER_INSTRUCTION_REPEATED, currentTimeMs, {
            text: latestEvent.text,
            timestamp_ms: latestEvent.start_ms
          }).catch((err) => console.warn("Failed to log trainer instruction repeated event:", err));
        }
      }
    } else {
      announce("No prior trainer instructions found in this workout session.");
    }
  };

  const handleSkipSection = () => {
    if (!manifest || !manifest.exercise_timeline_anchors) return;
    const nextAnchor = manifest.exercise_timeline_anchors.find(
      (anchor) => anchor.start_time_seconds > currentTime + 1.0
    );
    if (nextAnchor) {
      seek(nextAnchor.start_time_seconds);
      announce(`Skipped to section: ${nextAnchor.name}`);
      if (sessionId) {
        recordPlaybackEvent(sessionId, SESSION_EVENTS.SECTION_SKIPPED, currentTimeMs, {
          section_name: nextAnchor.name,
          start_time_seconds: nextAnchor.start_time_seconds
        }).catch((err) => console.warn("Failed to log section skipped event:", err));
      }
    } else {
      announce("No more exercise sections found in this workout.");
    }
  };

  const handleEndSession = async () => {
    if (!sessionId) {
      router.push(`/session/${params.videoId}/setup`);
      return;
    }
    setIsEnding(true);
    setEndError(null);
    try {
      announce("Workout session ended. Saving report and opening history...");
      await endSession(sessionId);
      router.push("/history");
    } catch (err) {
      console.error("Failed to end session:", err);
      const message = err instanceof Error ? err.message : "Failed to end session. Please try again.";
      setEndError(message);
      setIsEnding(false);
      announce(`Failed to end session: ${message}`);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = chatInput.trim();
    if (!query || isPending) return;

    setIsPending(true);
    setQaError(null);
    setChatInput("");

    // Append user message immediately
    setChatMessages((prev) => [
      ...prev,
      { sender: "user", text: query }
    ]);
    announce(`User question submitted: "${query}"`);

    const activeExerciseName = currentExercise ? currentExercise.name : null;
    let latestInstructionText = null;
    if (manifest && manifest.trainer_instruction_events) {
      const priorEvents = manifest.trainer_instruction_events.filter(
        (evt) => evt.start_ms !== null && evt.start_ms !== undefined && evt.start_ms <= currentTimeMs
      );
      if (priorEvents.length > 0) {
        priorEvents.sort((a, b) => (b.start_ms ?? 0) - (a.start_ms ?? 0));
        latestInstructionText = priorEvents[0].text;
      }
    }

    if (sessionId) {
      recordPlaybackEvent(sessionId, SESSION_EVENTS.USER_QUESTION_SUBMITTED, currentTimeMs, {
        question: query,
        active_exercise: activeExerciseName,
        latest_trainer_instruction: latestInstructionText
      }).catch((err) => console.warn("Failed to log user_question_submitted event:", err));
    }

    try {
      announce("Assistant is responding.");

      const response = await askAssistant({
        question: query,
        session_context: {
          sessionId,
          videoId: params.videoId,
          currentTimeSeconds: currentTime,
          currentTimeMs,
          active_exercise: activeExerciseName,
          latest_trainer_instruction: latestInstructionText,
          audio_coexistence: coexistenceSettings,
          assistant_voice_muted: assistantMuted,
          youtube_metadata: metadata ? { title: metadata.title } : null
        },
        current_timestamp_ms: currentTimeMs,
        persona: userProfile?.assistant_persona || undefined
      });

      setChatMessages((prev) => [
        ...prev,
        { sender: "assistant", text: response.text }
      ]);
      announce(`Assistant response received: "${response.text}"`);

      if (sessionId) {
        recordPlaybackEvent(sessionId, SESSION_EVENTS.ASSISTANT_ANSWER_DELIVERED, currentTimeMs, {
          question: query,
          answer: response.text,
          current_timestamp_ms: currentTimeMs,
          active_exercise: activeExerciseName,
          latest_trainer_instruction: latestInstructionText,
          source: response.metadata?.source || "prototype",
          provider: response.metadata?.provider || "prototype_assistant"
        }).catch((err) => console.warn("Failed to log assistant_answer_delivered event:", err));
      }
    } catch (err) {
      console.error("Assistant Q&A failed:", err);
      const errMsg = err instanceof Error ? err.message : "Failed to get response from assistant.";
      setQaError(errMsg);

      setChatMessages((prev) => [
        ...prev,
        { sender: "assistant", text: `Error: ${errMsg}` }
      ]);
      announce(`Assistant response failed: ${errMsg}`);

      if (sessionId) {
        recordPlaybackEvent(sessionId, SESSION_EVENTS.ASSISTANT_ANSWER_FAILED, currentTimeMs, {
          question: query,
          error: errMsg,
          current_timestamp_ms: currentTimeMs,
          active_exercise: activeExerciseName,
          latest_trainer_instruction: latestInstructionText
        }).catch((err) => console.warn("Failed to log assistant_answer_failed event:", err));
      }
    } finally {
      setIsPending(false);
    }
  };

  const handleToggleMute = (muted: boolean) => {
    setAssistantMuted(muted);
    announce(muted ? "Assistant voice muted." : "Assistant voice unmuted.");
  };

  const sleeveStatus = getPrototypeSleeveStatuses(hapticState);

  if (!sessionId) {
    return (
      <PageWrapper id="live-session-no-id-wrapper">
        <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-slate-900 border border-slate-800 rounded-3xl mt-10">
          <span className="text-yellow-400 text-5xl mb-4" role="img" aria-label="Warning">⚠️</span>
          <h2 className="text-xl font-bold text-white mb-2">Session ID Missing</h2>
          <p className="text-sm text-slate-400 mb-6">
            An active session is required to record your workout and view telemetry. Please configure your session first.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
            <Link
              href={`/session/${params.videoId}/setup`}
              className="px-5 py-3 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold rounded-xl text-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
            >
              Go to Session Setup
            </Link>
            <Link
              href="/video-library"
              className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm border border-slate-700 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
            >
              Back to Video Library
            </Link>
          </div>
        </div>
      </PageWrapper>
    );
  }

  if (isLoadingJob) {
    return (
      <PageWrapper id="live-session-loading-wrapper">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
          <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Loading Assisted Playback Session</h2>
          <p className="text-sm text-slate-400">Fetching workout metadata and preparation details...</p>
        </div>
      </PageWrapper>
    );
  }

  if (jobError) {
    return (
      <PageWrapper id="live-session-error-wrapper">
        <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-slate-900 border border-slate-800 rounded-3xl mt-10">
          <span className="text-red-500 text-5xl mb-4" role="img" aria-label="Error">⚠️</span>
          <h2 className="text-xl font-bold text-white mb-2">Failed to Load Session</h2>
          <p className="text-sm text-slate-400 mb-6">{jobError}</p>
          <Link
            href="/video-library"
            className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm border border-slate-700 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
          >
            Back to Video Library
          </Link>
        </div>
      </PageWrapper>
    );
  }

  if (jobStage !== ProcessingStage.COMPLETED) {
    return (
      <PageWrapper id="live-session-pending-wrapper">
        <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-slate-900 border border-slate-800 rounded-3xl mt-10">
          <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Preparation in Progress</h2>
          <p className="text-sm text-slate-400 mb-2">
            Workout assistance preparation is not complete yet.
          </p>
          <p className="text-sm text-yellow-400 font-semibold bg-yellow-400/10 border border-yellow-400/20 px-3 py-1.5 rounded-full mb-6">
            Current Stage: {jobStage ? jobStage.replace(/_/g, " ") : "unknown"}
          </p>
          <Link
            href="/video-library"
            className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm border border-slate-700 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
          >
            Back to Video Library
          </Link>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper id="live-session-wrapper">
      {/* Screen-reader status announcement live region */}
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {announcement}
      </div>

      {/* Top Bar: Sleeve Calibration & Device Strip */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl mb-6 shadow-md" aria-label="Device Status Bar">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${hapticState === "connected" ? "bg-emerald-500 animate-ping" : hapticState === "connecting" ? "bg-yellow-500 animate-pulse" : "bg-red-500"}`} />
          <span className="text-sm font-semibold text-slate-300">
            {hapticState === "connected"
              ? "Prototype Sleeve Calibration Mode (Simulated)"
              : hapticState === "connecting"
                ? "Prototype Sleeve Connecting..."
                : "Prototype Sleeves Disconnected (Simulated)"}
          </span>
        </div>
        <div className="flex flex-wrap gap-3 sm:gap-4" aria-label="Individual Limb Calibration Statuses">
          {sleeveStatus.map((s) => {
            const limbStatusText = s.styleState === "connected"
              ? "Prototype Cue Ready"
              : s.styleState === "connecting"
                ? "Prototype Connecting..."
                : "Offline (Simulated)";
            const dotColor = s.styleState === "connected"
              ? "bg-yellow-400 animate-pulse"
              : s.styleState === "connecting"
                ? "bg-yellow-500 animate-pulse"
                : "bg-red-500";
            return (
              <div key={s.label} className="flex items-center gap-1.5" aria-label={`${s.name}: ${limbStatusText}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} aria-hidden="true" />
                <span className="text-sm font-bold text-slate-300">
                  <span className="sr-only">{s.name} </span>
                  <span>{s.label}</span> ({limbStatusText})
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left/Center Column: YouTube Embedded Player & Playback Controls */}
        <div className="lg:col-span-8 flex flex-col gap-6 order-2 lg:order-1">
          <YouTubePlayerPanel
            containerRef={containerRef}
            isReady={isReady}
            playerError={playerError}
            metadata={metadata}
            currentTime={currentTime}
            duration={duration}
            playbackRate={playbackRate}
            formatTime={formatTime}
          >
            <SessionControls
              currentTime={currentTime}
              playbackRate={playbackRate}
              assistantMuted={assistantMuted}
              seek={seek}
              setPlaybackRate={setPlaybackRate}
              setAssistantMuted={handleToggleMute}
              handleRepeatTrainerInstruction={handleRepeatTrainerInstruction}
            />
          </YouTubePlayerPanel>

          {/* Bottom Pose Feed Panel */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4" aria-label="Pose Tracker Cam">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all ${isPrototypeTracking ? "bg-emerald-950/40 border-emerald-500/20 text-emerald-400" : "bg-slate-950 border-slate-800 text-slate-600"}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{trackingStatusLabel}</h3>
                <p className="text-xs text-slate-400">
                  {isPrototypeTracking
                    ? "Simulating time-varying joint angles from manifest coordinates."
                    : "Mock tracking coordinates are currently offline."}
                </p>
                {isPrototypeTracking && Object.keys(currentAngles).length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-2 text-xs font-bold text-slate-300">
                    {Object.entries(currentAngles).map(([joint, val]) => (
                      <span key={joint} className="bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                        {joint.replace("_", " ")}: {val.toFixed(0)}°
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={isPrototypeTracking ? stopPoseTracking : startPoseTracking}
                className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 ${isPrototypeTracking
                    ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                    : "bg-yellow-400 hover:bg-yellow-300 text-slate-950 border-yellow-400"
                  }`}
                aria-label={isPrototypeTracking ? "Stop prototype pose tracking" : "Start prototype pose tracking"}
              >
                {isPrototypeTracking ? "Stop Simulating" : "Start Simulating"}
              </button>
            </div>
          </section>
        </div>

        {/* Right Column: Tracked Performance & Assistant Cue Feed */}
        <div className="lg:col-span-4 flex flex-col gap-6 order-1 lg:order-2">
          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col justify-between text-center" aria-label="Tracked Performance Summary">
            <div>
              <span className="text-xs uppercase font-extrabold text-yellow-400 tracking-wider block mb-1">
                Active Exercise Section
              </span>
              <h2 className="text-xl font-bold text-white mb-2">
                {currentExercise ? currentExercise.name : "Break / Transition"}
              </h2>
            </div>
            <div className="my-4 py-4 px-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col justify-center">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-1">
                {currentExercise ? "Supplementary Target Cues" : "Your Tracked Performance"}
              </span>
              <span className={`font-extrabold text-yellow-400 tracking-tight block ${currentExercise ? "text-xl font-bold leading-relaxed" : "text-5xl"}`}>
                {currentExercise ? (
                  currentExercise.description_accessible || "Follow YouTube instructions"
                ) : (
                  "Ready"
                )}
              </span>
              {currentExercise && (
                <span className="text-sm text-slate-400 mt-2 block">
                  Joint: <strong className="text-slate-200 capitalize">{currentExercise.counting_joint || "any"}</strong> | Target: Follow trainer
                  {lastHandledRepRef.current >= 0 && (
                    <span className="block text-yellow-400 font-bold mt-1 text-sm" id="rep-completion-telemetry-badge">
                      Completed: {lastHandledRepRef.current} reps
                    </span>
                  )}
                </span>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center text-sm text-slate-400 px-1 mb-1.5">
                <span>Section Progress</span>
                <span>
                  {currentExercise
                    ? `${formatTime(currentTime - currentExercise.start_time_seconds)} / ${formatTime(currentExercise.end_time_seconds - currentExercise.start_time_seconds)}`
                    : "No active exercise"}
                </span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-yellow-400 h-full rounded-full transition-all"
                  style={{
                    width: currentExercise
                      ? `${((currentTime - currentExercise.start_time_seconds) / (currentExercise.end_time_seconds - currentExercise.start_time_seconds)) * 100}%`
                      : "0%"
                  }}
                />
              </div>
            </div>
          </section>

          {/* Assistant Cue Feed panel */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl flex-1 flex flex-col justify-between min-h-[300px]" aria-labelledby="assistant-feed-heading">
            <div>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800/65">
                <h2 id="assistant-feed-heading" className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                  Assistant Cue Feed
                </h2>
                {isLoadingCuePlan && (
                  <span className="text-xs text-yellow-400/80 animate-pulse flex items-center gap-1" id="cueplan-loading-indicator">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400/80" />
                    Loading assistance cues...
                  </span>
                )}
                {!isLoadingCuePlan && cuePlanError && (
                  <span className="text-xs text-slate-400 font-medium flex items-center gap-1" id="cueplan-error-indicator" title="Using basic timeline fallback">
                    Using basic assistance cues
                  </span>
                )}
                {isLoadingManifest && !isLoadingCuePlan && (
                  <span className="text-sm text-yellow-400 animate-pulse flex items-center gap-1.5" id="manifest-loading-indicator">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                    Loading Manifest
                  </span>
                )}
                {manifestError && !cuePlanError && (
                  <span className="text-sm text-red-400 font-semibold flex items-center gap-1" id="manifest-error-indicator" title={manifestError}>
                    Load Error
                  </span>
                )}
              </div>

              <div
                className="space-y-4 mb-4 pr-1 max-h-[220px] lg:max-h-[320px] overflow-y-auto"
                role="log"
                aria-live="polite"
                aria-relevant="additions text"
              >
                {manifestError && (
                  <div className="p-3 bg-red-950/40 border border-red-500/20 text-red-200 rounded-2xl text-sm flex flex-col gap-1 mb-2" role="alert" id="manifest-error-alert">
                    <span className="font-bold text-sm text-red-400 uppercase tracking-wider">⚠️ Manifest Loading Error</span>
                    <p>Failed to load the sidecar assistance manifest. Voice cues and timeline anchors will be unavailable.</p>
                    <p className="text-sm opacity-75">{manifestError}</p>
                  </div>
                )}
                {chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-2xl text-sm leading-relaxed max-w-[90%] ${msg.sender === "assistant"
                        ? "bg-slate-950 border border-slate-800 text-slate-300 self-start"
                        : "bg-yellow-400 text-slate-950 font-medium ml-auto"
                      }`}
                  >
                    <p className="font-bold text-xs mb-1 opacity-70">
                      {msg.sender === "assistant" ? "ASSISTANT" : "YOU"}
                    </p>
                    <p>{msg.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="w-full border-t border-slate-800/80 pt-4 flex flex-col">
              {isPending && (
                <div className="text-xs text-yellow-400 animate-pulse px-1 mb-2 font-medium" id="assistant-responding-indicator">
                  Assistant is responding...
                </div>
              )}
              {qaError && (
                <div className="text-xs text-red-400 px-1 mb-2 font-semibold" id="qa-error-display">
                  ⚠️ Error: {qaError}
                </div>
              )}
              <form onSubmit={handleSendMessage} className="w-full flex items-center gap-2">
                <input
                  type="text"
                  placeholder={isPending ? "Assistant is responding..." : "Ask assistant about movement setup..."}
                  disabled={isPending}
                  className="flex-1 min-w-0 px-3.5 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-yellow-400 rounded-xl text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400 transition-all disabled:opacity-50"
                  aria-label="Ask assistant for verbal clarification"
                  id="live-chat-input"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-500 text-slate-100 font-bold rounded-xl text-sm border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 shrink-0 transition-all"
                  id="live-chat-btn"
                >
                  {isPending ? "Sending..." : "Send"}
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>

      {/* Bottom Bar: Action buttons */}
      <section className="flex flex-wrap items-center justify-center gap-3 mt-8 pt-6 border-t border-slate-900" aria-label="Playback and Session Controls">
        <button
          onClick={isPlaying ? pause : play}
          className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold rounded-xl text-sm border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
          id="pause-btn"
          aria-label={isPlaying ? "Pause trainer video playback" : "Resume trainer video playback"}
        >
          {isPlaying ? "Pause Playback" : "Resume Playback"}
        </button>

        <button
          onClick={handleSkipSection}
          className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold rounded-xl text-sm border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
          id="skip-btn"
          aria-label="Skip to next workout exercise section"
        >
          Skip to Next Section
        </button>

        <div className="flex flex-col items-center gap-1.5">
          {endError && (
            <span className="text-sm text-red-400 font-semibold animate-pulse" role="alert">
              {endError}
            </span>
          )}
          <button
            onClick={handleEndSession}
            disabled={isEnding}
            className="px-5 py-3 bg-red-600 hover:bg-red-500 disabled:bg-red-800 disabled:text-slate-300 text-white font-bold rounded-xl text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
            id="end-session-btn"
            aria-label="End this assisted workout session and view progress history"
          >
            {isEnding ? "Ending..." : "End & Save Session"}
          </button>
        </div>
      </section>
    </PageWrapper>
  );
}

export default function LiveSession({ params }: LiveSessionProps) {
  return (
    <Suspense fallback={
      <PageWrapper id="live-session-suspense-wrapper">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
          <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Loading Player Page</h2>
        </div>
      </PageWrapper>
    }>
      <LiveSessionContent params={params} />
    </Suspense>
  );
}
