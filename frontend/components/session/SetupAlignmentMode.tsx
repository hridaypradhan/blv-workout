"use client";

import React from "react";
import { CameraPositioningGate } from "./CameraPositioningGate";
import { CameraOrientation, BodyOrientation } from "@/lib/pose/positioningTypes";

export interface SetupAlignmentModeProps {
  isOpen: boolean;
  onClose: () => void;
  stream: MediaStream | null;
  requiredCameraOrientation: CameraOrientation;
  requiredBodyOrientation: BodyOrientation;
  onStartWorkout: () => void;
  isStarting: boolean;
  onReadyChange?: (isReady: boolean) => void;
  onGuidanceChange?: (guidance: string) => void;
  currentGuidance: string;
  onCountdownActiveChange?: (isActive: boolean) => void;
  cancelCountdownTrigger?: number;
}

export function SetupAlignmentMode({
  isOpen,
  onClose,
  stream,
  requiredCameraOrientation,
  requiredBodyOrientation,
  onStartWorkout,
  isStarting,
  onReadyChange,
  onGuidanceChange,
  currentGuidance,
  onCountdownActiveChange,
  cancelCountdownTrigger,
}: SetupAlignmentModeProps) {
  return (
    <CameraPositioningGate
      isOpen={isOpen}
      onClose={onClose}
      stream={stream}
      requiredCameraOrientation={requiredCameraOrientation}
      requiredBodyOrientation={requiredBodyOrientation}
      onComplete={onStartWorkout}
      isActionPending={isStarting}
      actionButtonLabel="Start Workout Manually"
      title="Hands-Free Camera Alignment"
      subtitle="Please stand back so your full body is visible to the camera. We will automatically start once your stance is aligned."
      currentGuidance={currentGuidance}
      onGuidanceChange={onGuidanceChange || (() => {})}
      onReadyChange={onReadyChange}
      onCountdownActiveChange={onCountdownActiveChange}
      cancelCountdownTrigger={cancelCountdownTrigger}
    />
  );
}
