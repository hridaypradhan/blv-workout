"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Exercise, RepEvent, FormError } from "@/types";
import { PoseRuntimeContract, PoseRuntimeStatus, JointAngles } from "@/lib/pose/poseRuntimeTypes";
import { useMediaPipePoseLandmarker, NormalizedLandmark } from "./useMediaPipePoseLandmarker";
import { extractJointAngles, selectActiveSide } from "@/lib/pose/jointAngles";
import { getExercisePoseProfile } from "@/lib/pose/exercisePoseProfiles";
import { RepMatcher } from "@/lib/pose/repCounter";
import { analyzeForm } from "@/lib/pose/formAnalyzer";
import { determineSpecificPoseStatus, PoseStatusDetails } from "@/lib/pose/poseStatus";

export interface UseMediaPipePoseRuntimeProps {
  stream: MediaStream | null;
  currentExercise: Exercise | null;
  currentTimeMs: number;
  isPlaying: boolean;
  minVisibility?: number;
  minConfidence?: number;
  smoothingAlpha?: number;
}

export interface CameraPoseRuntimeContract extends PoseRuntimeContract {
  poseAvailable: boolean;
  landmarkConfidence: number;
  visibleLandmarkCount: number;
  requiredLandmarksVisible: boolean;
  rawPoseLandmarks: NormalizedLandmark[] | null;
}

export function useMediaPipePoseRuntime({
  stream,
  currentExercise,
  currentTimeMs,
  isPlaying,
  minVisibility = 0.5,
  minConfidence = 0.5,
}: UseMediaPipePoseRuntimeProps): CameraPoseRuntimeContract {
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [latestRepEvent, setLatestRepEvent] = useState<RepEvent | null>(null);
  const [latestFormError, setLatestFormError] = useState<FormError | null>(null);

  // Resolve the active exercise pose profile
  const profile = useMemo(() => getExercisePoseProfile(currentExercise), [currentExercise]);

  const repMatcherRef = useRef<RepMatcher>(
    new RepMatcher({
      keyAngles: profile.primaryJoints.length > 0 ? profile.primaryJoints : ["left_elbow", "right_elbow"],
      minRepIntervalS: (profile.cooldownMs ?? 1500) / 1000,
    })
  );
  const lastErrorTimeRef = useRef<Record<string, number>>({});

  // Monitor stream active status to set tracking state or clean up
  useEffect(() => {
    if (!stream) {
      setIsTracking(false);
      return;
    }

    if (stream.active !== false) {
      setIsTracking(true);
    }

    if (typeof stream.getTracks !== "function") {
      return;
    }

    const handleTrackEnded = () => {
      const anyActive = stream.getTracks().some((track) => track.readyState === "live");
      if (!anyActive) {
        setIsTracking(false);
      }
    };

    stream.getTracks().forEach((track) => {
      track.addEventListener("ended", handleTrackEnded);
    });

    return () => {
      stream.getTracks().forEach((track) => {
        track.removeEventListener("ended", handleTrackEnded);
      });
    };
  }, [stream]);

  const { isLoading, error, poseResult, isModelLoaded } = useMediaPipePoseLandmarker({
    stream: isTracking ? stream : null,
  });

  const startTracking = () => {
    if (stream) {
      setIsTracking(true);
    }
  };

  const stopTracking = () => {
    setIsTracking(false);
  };

  // Determine runtime status
  const runtimeStatus = useMemo<PoseRuntimeStatus>(() => {
    if (!isTracking) return "offline";
    if (error) return "error";
    if (!stream || !stream.active) return "unavailable";
    if (isLoading || !isModelLoaded) return "initializing";
    return "active";
  }, [isTracking, error, stream, isLoading, isModelLoaded]);

  // Extract raw landmarks
  const rawPoseLandmarks = useMemo<NormalizedLandmark[] | null>(() => {
    if (runtimeStatus !== "active" || !poseResult?.poseLandmarks?.[0]) {
      return null;
    }
    return poseResult.poseLandmarks[0];
  }, [runtimeStatus, poseResult]);

  // Compute confidence (average visibility of landmarks)
  const landmarkConfidence = useMemo<number>(() => {
    if (!rawPoseLandmarks || rawPoseLandmarks.length === 0) return 0;
    const sum = rawPoseLandmarks.reduce((acc, lm) => acc + (lm.visibility ?? 0), 0);
    return sum / rawPoseLandmarks.length;
  }, [rawPoseLandmarks]);

  const poseAvailable = rawPoseLandmarks !== null && rawPoseLandmarks.length > 0 && landmarkConfidence >= minConfidence;

  // Compute visible landmark count
  const visibleLandmarkCount = useMemo<number>(() => {
    if (!rawPoseLandmarks) return 0;
    return rawPoseLandmarks.filter((lm) => (lm.visibility ?? 0) >= minVisibility).length;
  }, [rawPoseLandmarks, minVisibility]);

  // Check if required landmarks for this exercise are visible
  const requiredLandmarksVisible = useMemo<boolean>(() => {
    if (!rawPoseLandmarks) return false;
    const requiredIndices = profile.requiredLandmarks;
    return requiredIndices.every((idx) => {
      const lm = rawPoseLandmarks[idx];
      return lm !== undefined && (lm.visibility ?? 0) >= minVisibility;
    });
  }, [rawPoseLandmarks, profile, minVisibility]);

  // Track active exercise changes to reset the matcher and form errors
  const lastExerciseIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentId = currentExercise ? currentExercise.id : null;
    if (currentId !== lastExerciseIdRef.current) {
      lastExerciseIdRef.current = currentId;
      const keys = profile.primaryJoints.length > 0 ? profile.primaryJoints : ["left_elbow", "right_elbow"];
      repMatcherRef.current = new RepMatcher({
        keyAngles: keys,
        minRepIntervalS: (profile.cooldownMs ?? 1500) / 1000,
      });
      lastErrorTimeRef.current = {};
      setLatestRepEvent(null);
      setLatestFormError(null);
    }
  }, [currentExercise, profile]);

  // Run rep matcher & form analyzer logic on frame / time updates
  useEffect(() => {
    if (!isPlaying || !poseAvailable || !requiredLandmarksVisible || !rawPoseLandmarks) {
      return;
    }

    // Bypass completely if exercise is unsupported
    if (!profile.supported) {
      return;
    }

    const angles = extractJointAngles(rawPoseLandmarks);
    const nowS = currentTimeMs / 1000.0;

    // 1. Update RepMatcher
    const repFired = repMatcherRef.current.update(angles, nowS);

    if (repFired) {
      setLatestRepEvent({
        rep_count: repMatcherRef.current.repCount,
        timestamp: new Date().toISOString(),
        session_id: "", // filled by caller
        exercise_id: currentExercise ? currentExercise.id : "",
        metadata: {
          source: "camera_mediapipe",
          provider: "camera_mediapipe",
        },
      });
    }

    // 2. Perform form error analysis
    const leftJoint = profile.primaryJoints[0];
    let leftIdx = -1;
    let rightIdx = -1;
    if (leftJoint?.includes("elbow")) {
      leftIdx = 13;
      rightIdx = 14;
    } else if (leftJoint?.includes("knee")) {
      leftIdx = 25;
      rightIdx = 26;
    }

    const leftVis = leftIdx !== -1 ? (rawPoseLandmarks[leftIdx]?.visibility ?? 0) : 0;
    const rightVis = rightIdx !== -1 ? (rawPoseLandmarks[rightIdx]?.visibility ?? 0) : 0;
    const side = selectActiveSide(leftVis, rightVis);

    const formErr = analyzeForm(
      angles,
      currentExercise,
      profile,
      poseAvailable,
      requiredLandmarksVisible,
      isPlaying,
      currentTimeMs,
      side,
      lastErrorTimeRef.current,
      {
        providerSource: "camera_mediapipe",
      }
    );

    if (formErr) {
      lastErrorTimeRef.current[formErr.joint] = currentTimeMs;
      setLatestFormError(formErr);
    }
  }, [rawPoseLandmarks, currentTimeMs, isPlaying, profile, currentExercise, poseAvailable, requiredLandmarksVisible]);

  // Compute current joint angles
  const currentAngles = useMemo<JointAngles>(() => {
    if (!rawPoseLandmarks) return {};
    return extractJointAngles(rawPoseLandmarks);
  }, [rawPoseLandmarks]);

  // Compute specific status details
  const poseStatusDetails = useMemo<PoseStatusDetails>(() => {
    return determineSpecificPoseStatus({
      streamActive: !!stream && stream.active,
      runtimeStatus,
      rawPoseLandmarks,
      landmarkConfidence,
      profile,
      minVisibility,
      minConfidence,
      fallbackActive: !isTracking,
    });
  }, [stream, runtimeStatus, rawPoseLandmarks, landmarkConfidence, profile, minVisibility, minConfidence, isTracking]);

  const specificPoseStatus = poseStatusDetails.status;

  const trackingStatusLabel = useMemo<string>(() => {
    if (runtimeStatus === "offline") {
      return "Camera pose runtime offline";
    }
    return poseStatusDetails.guidance;
  }, [runtimeStatus, poseStatusDetails]);

  // poseData object conforming to prototype pattern
  const poseData = useMemo(() => {
    if (runtimeStatus !== "active") return null;
    return {
      provider: "camera_mediapipe",
      tracking: isTracking,
      poseAvailable,
      landmarkConfidence,
      visibleLandmarkCount,
      requiredLandmarksVisible,
      currentTimeMs,
      isPlaying,
    };
  }, [runtimeStatus, isTracking, poseAvailable, landmarkConfidence, visibleLandmarkCount, requiredLandmarksVisible, currentTimeMs, isPlaying]);

  return {
    poseData,
    isReady: isModelLoaded && isTracking && !!stream,
    providerSource: "camera_mediapipe",
    runtimeStatus,
    isTracking,
    startTracking,
    stopTracking,
    currentAngles,
    latestRepEvent,
    latestFormError,
    trackingStatusLabel,
    poseAvailable,
    landmarkConfidence,
    visibleLandmarkCount,
    requiredLandmarksVisible,
    rawPoseLandmarks,
    specificPoseStatus,
    poseStatusDetails,
  };
}
