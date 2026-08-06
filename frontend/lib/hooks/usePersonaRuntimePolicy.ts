import { useRef, useCallback, useEffect } from "react";
import { AssistantPersona } from "@/types";
import { FrontendPersonaRuntimeEngine, PersonaTriggerDecision } from "@/lib/personaPolicy";

export function usePersonaRuntimePolicy(
  activePersona: AssistantPersona = AssistantPersona.GUIDE,
  timed: boolean = false
) {
  const engineRef = useRef<FrontendPersonaRuntimeEngine>(
    new FrontendPersonaRuntimeEngine(activePersona, timed)
  );

  useEffect(() => {
    engineRef.current.resetExercise(timed, activePersona);
  }, [activePersona, timed]);

  const resetExercise = useCallback(
    (isTimed: boolean = false, persona?: AssistantPersona) => {
      engineRef.current.resetExercise(isTimed, persona || activePersona);
    },
    [activePersona]
  );

  const canVoiceCorrection = useCallback(() => {
    return engineRef.current.canVoiceCorrection();
  }, []);

  const noteFormError = useCallback(() => {
    engineRef.current.noteFormError();
  }, []);

  const onRepCompleted = useCallback(
    (clean: boolean, repsBehind?: number | null, canSpeak: boolean = true): PersonaTriggerDecision => {
      return engineRef.current.onRepCompleted(clean, repsBehind, canSpeak);
    },
    []
  );

  const onProgress = useCallback(
    (fracDone: number, elapsedS?: number | null, canSpeak: boolean = true): PersonaTriggerDecision => {
      return engineRef.current.onProgress(fracDone, elapsedS, canSpeak);
    },
    []
  );

  const onExerciseCompleted = useCallback(
    (completedCount: number): PersonaTriggerDecision => {
      return engineRef.current.onExerciseCompleted(completedCount);
    },
    []
  );

  return {
    engineRef,
    resetExercise,
    canVoiceCorrection,
    noteFormError,
    onRepCompleted,
    onProgress,
    onExerciseCompleted,
  };
}
