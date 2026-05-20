"use client";

import { useState } from "react";
import { Exercise } from "../../types";

export function useSession() {
  const [repCount] = useState<number>(0);
  const [formErrors] = useState<Array<{ type: string; timestamp: string }>>([]);
  const [currentExercise] = useState<Exercise | null>(null);
  const [sessionState] = useState<"IDLE" | "ACTIVE" | "PAUSED" | "FINISHED">("IDLE");

  return {
    repCount,
    formErrors,
    currentExercise,
    sessionState,
  };
}
