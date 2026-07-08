"use client";

import { useState, useEffect, useRef } from "react";

export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
  presence?: number;
}

export interface PoseLandmarkerResult {
  poseLandmarks: NormalizedLandmark[][];
  poseWorldLandmarks: NormalizedLandmark[][];
}

export interface UseMediaPipePoseLandmarkerProps {
  stream: MediaStream | null;
}

// MediaPipe package / resolver version constant to align WASM resolution
export const MEDIAPIPE_VISION_VERSION = "0.10.35";

/** Local-first model path (served from /public/mediapipe/). */
export const MEDIAPIPE_LOCAL_MODEL_PATH = "/mediapipe/pose_landmarker_heavy.task";

/** CDN fallback used when the local file is unavailable. */
export const MEDIAPIPE_CDN_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task";

export function useMediaPipePoseLandmarker({ stream }: UseMediaPipePoseLandmarkerProps) {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [poseResult, setPoseResult] = useState<PoseLandmarkerResult | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState<boolean>(false);

  const landmarkerRef = useRef<import("@mediapipe/tasks-vision").PoseLandmarker | null>(null);

  // Initialize MediaPipe PoseLandmarker
  useEffect(() => {
    if (!stream) {
      // Clear landmarker instance and state when stream is not active
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
      setIsModelLoaded(false);
      setIsLoading(false);
      setPoseResult(null);
      return;
    }

    let active = true;
    let localLandmarker: import("@mediapipe/tasks-vision").PoseLandmarker | null = null;

    const initLandmarker = async () => {
      if (typeof window === "undefined") return;
      setIsLoading(true);
      setError(null);

      try {
        const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks(
          `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VISION_VERSION}/wasm`
        );

        // Try local model task asset, fallback to CDN
        let modelAssetPath = MEDIAPIPE_LOCAL_MODEL_PATH;
        try {
          const res = await fetch(modelAssetPath, { method: "HEAD" });
          if (!res.ok) {
            modelAssetPath = MEDIAPIPE_CDN_MODEL_URL;
          }
        } catch {
          modelAssetPath = MEDIAPIPE_CDN_MODEL_URL;
        }

        const instance = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        });

        if (active) {
          localLandmarker = instance;
          landmarkerRef.current = instance;
          setIsModelLoaded(true);
          setIsLoading(false);
        } else {
          instance.close();
        }
      } catch (err: unknown) {
        console.error("Failed to initialize MediaPipe PoseLandmarker:", err);
        const errorMsg = err instanceof Error ? err.message : "Failed to load MediaPipe model.";
        if (active) {
          setError(errorMsg);
          setIsLoading(false);
        }
      }
    };

    initLandmarker();

    return () => {
      active = false;
      if (localLandmarker) {
        localLandmarker.close();
        if (landmarkerRef.current === localLandmarker) {
          landmarkerRef.current = null;
        }
      }
      setIsModelLoaded(false);
      setPoseResult(null);
    };
  }, [stream]);

  // Frame processing loop
  useEffect(() => {
    const landmarker = landmarkerRef.current;
    if (!stream || !landmarker || !isModelLoaded) {
      setPoseResult(null);
      return;
    }

    let active = true;
    let animationFrameId: number;

    // Create a hidden video element to process stream frames
    const video = document.createElement("video");
    video.srcObject = stream;
    video.playsInline = true;
    video.muted = true;

    // Start video playback
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((err) => {
        console.error("Failed to play media stream inside landmarker processor:", err);
      });
    }

    let lastVideoTime = -1;

    const processFrame = () => {
      if (!active) return;

      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const currentTime = video.currentTime;
        if (currentTime !== lastVideoTime) {
          lastVideoTime = currentTime;
          try {
            const timestampMs = performance.now();
            const results = landmarker.detectForVideo(video, timestampMs);
            if (results && results.landmarks) {
              setPoseResult({
                poseLandmarks: results.landmarks,
                poseWorldLandmarks: results.worldLandmarks,
              });
            }
          } catch (err) {
            console.error("MediaPipe frame inference failure:", err);
          }
        }
      }

      animationFrameId = requestAnimationFrame(processFrame);
    };

    video.onloadeddata = () => {
      processFrame();
    };

    return () => {
      active = false;
      cancelAnimationFrame(animationFrameId);
      video.pause();
      video.srcObject = null;
      video.load();
    };
  }, [stream, isModelLoaded]);

  return {
    isLoading,
    error,
    poseResult,
    isModelLoaded,
  };
}
