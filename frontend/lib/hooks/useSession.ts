"use client";

import { useState } from "react";
import { ExerciseTimelineAnchor } from "../../types";

export function useSession() {
  const [repCount] = useState<number>(0);
  const [formErrors] = useState<Array<{ type: string; timestamp: string }>>([]);
  const [currentExercise] = useState<ExerciseTimelineAnchor | null>(null);
  const [sessionState] = useState<"IDLE" | "ACTIVE" | "PAUSED" | "FINISHED">("IDLE");
  const [playbackState] = useState<"playing" | "paused" | "seeking" | "idle">("idle");
  const [assistantMuted] = useState<boolean>(false);

  return {
    repCount,
    formErrors,
    currentExercise,
    sessionState,
    playbackState,
    assistantMuted,
  };
}
