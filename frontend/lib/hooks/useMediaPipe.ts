"use client";

import { useState } from "react";

export function useMediaPipe() {
  const [poseData, setPoseData] = useState<object | null>(null);
  const [isReady, setIsReady] = useState<boolean>(false);

  const startCamera = () => {
    // TODO: Request camera permissions and initialize MediaPipe Pose tracking
    console.log("Starting camera tracking feed...");
    setIsReady(true);
    setPoseData({ tracking: true });
  };

  const stopCamera = () => {
    // TODO: Release camera track streams
    console.log("Stopping camera tracking feed...");
    setIsReady(false);
    setPoseData(null);
  };

  return {
    poseData,
    isReady,
    startCamera,
    stopCamera,
  };
}
