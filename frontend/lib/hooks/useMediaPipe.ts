"use client";

import { useState, useEffect, useRef } from "react";
import { ExerciseTimelineAnchor, FormError, RepEvent } from "../../types";

export interface UseMediaPipeProps {
  currentTimeMs: number;
  activeAnchor: ExerciseTimelineAnchor | null;
  isPlaying: boolean;
}

export function useMediaPipe({
  currentTimeMs,
  activeAnchor,
  isPlaying,
}: UseMediaPipeProps) {
  const [poseData, setPoseData] = useState<object | null>(null);
  const [isReady, setIsReady] = useState<boolean>(false);

  const [isPrototypeTracking, setIsPrototypeTracking] = useState(false);
  const [currentAngles, setCurrentAngles] = useState<Record<string, number>>({});
  const [latestRepEvent, setLatestRepEvent] = useState<RepEvent | null>(null);
  const [latestFormError, setLatestFormError] = useState<FormError | null>(null);
  const [trackingStatusLabel, setTrackingStatusLabel] = useState("Prototype pose runtime offline");

  const startCamera = () => {
    console.log("Starting prototype camera tracking...");
    setIsReady(true);
    setIsPrototypeTracking(true);
    setTrackingStatusLabel("Prototype Pose Runtime Active");
    setPoseData({ tracking: true, source: "prototype" });
  };

  const stopCamera = () => {
    console.log("Stopping prototype camera tracking...");
    setIsReady(false);
    setIsPrototypeTracking(false);
    setTrackingStatusLabel("Prototype pose runtime offline");
    setPoseData(null);
    setCurrentAngles({});
    setLatestRepEvent(null);
    setLatestFormError(null);
  };

  const lastRepCountRef = useRef<number>(-1);
  const lastErrorRepRef = useRef<number>(-1);

  // Clear counters when the exercise section changes
  const lastExerciseIdRef = useRef<string | null>(null);
  useEffect(() => {
    const activeId = activeAnchor ? activeAnchor.id : null;
    if (activeId !== lastExerciseIdRef.current) {
      lastExerciseIdRef.current = activeId;
      lastRepCountRef.current = -1;
      lastErrorRepRef.current = -1;
    }
  }, [activeAnchor]);

  useEffect(() => {
    if (!isPrototypeTracking || !activeAnchor || !isPlaying) {
      return;
    }

    const exerciseName = activeAnchor.name.toLowerCase();
    const cycleDuration = 4000; // 4 seconds per rep
    const cycle = (currentTimeMs % cycleDuration) / cycleDuration;

    // Sine wave oscillation [0.0, 1.0]
    const phase = (Math.sin(cycle * 2 * Math.PI) + 1.0) / 2.0;

    let angles: Record<string, number> = {};
    const joint = activeAnchor.counting_joint || "left_knee";

    if (exerciseName.includes("squat")) {
      // Oscillate knee between 72 degrees (deep squat, below 75 threshold) and 170 degrees
      const kneeAngle = 72.0 + (170.0 - 72.0) * phase;
      angles = {
        left_knee: kneeAngle,
        right_knee: kneeAngle,
        left_hip: 80.0 + 85.0 * phase,
      };
    } else if (exerciseName.includes("curl")) {
      // Oscillate elbow between 35 degrees (flexed, below 40 threshold) and 165 degrees
      const elbowAngle = 35.0 + (165.0 - 35.0) * phase;
      angles = {
        left_elbow: elbowAngle,
        right_elbow: elbowAngle,
      };
    } else {
      // Generic movement
      const angle = 70.0 + 100.0 * phase;
      angles = {
        [joint]: angle,
      };
    }

    setCurrentAngles(angles);

    // Compute deterministic rep count based on current timestamp
    const repCount = Math.floor(currentTimeMs / cycleDuration);

    // Rep completion trigger (occurs at phase valley/peak of motion, say around cycle 0.5)
    if (repCount > lastRepCountRef.current) {
      if (lastRepCountRef.current !== -1) {
        setLatestRepEvent({
          rep_count: repCount,
          timestamp: new Date().toISOString(),
          session_id: "", // filled by caller
          exercise_id: activeAnchor.id,
          metadata: {
            source: "prototype",
            provider: "prototype_pose",
            replace_with: "mediapipe_service",
          },
        });
      }
      lastRepCountRef.current = repCount;
    }

    // Form error trigger (when angle goes out of acceptable bounds)
    const angleValue = angles[joint];
    if (angleValue !== undefined) {
      // Look up acceptable range from manifest
      const range = activeAnchor.acceptable_ranges?.[joint] || [75, 180];
      const [minVal, maxVal] = range;

      if (angleValue < minVal || angleValue > maxVal) {
        // Only trigger once per rep index to avoid spam
        if (repCount > lastErrorRepRef.current) {
          const observed = angleValue;
          const diff = Math.abs(observed < minVal ? minVal - observed : observed - maxVal);
          let severity = "low";
          if (diff > 20) severity = "high";
          else if (diff > 10) severity = "medium";

          setLatestFormError({
            joint,
            observed_angle: observed,
            expected_range: [minVal, maxVal],
            severity,
            message: `Observed ${joint.replace("_", " ")} angle (${observed.toFixed(0)}°) is outside range [${minVal}°, ${maxVal}°].`,
          });
          lastErrorRepRef.current = repCount;
        }
      }
    }
  }, [currentTimeMs, activeAnchor, isPlaying, isPrototypeTracking]);

  return {
    poseData,
    isReady,
    startCamera,
    stopCamera,
    isPrototypeTracking,
    currentAngles,
    latestRepEvent,
    latestFormError,
    trackingStatusLabel,
  };
}

