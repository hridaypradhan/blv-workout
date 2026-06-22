import { useState, useCallback } from "react";
import { askAssistant } from "@/lib/api";
import { SESSION_EVENTS } from "@/lib/sessionEvents";
import { buildFrontendQnAContext } from "@/lib/qnaContextBuilder";
import {
  ExerciseTimelineAnchor,
  SidecarManifest,
  AudioCoexistenceSettings,
  User,
  TrainerInstructionEvent,
  CuePlan,
  TranscriptArtifact,
} from "@/types";

interface UseQnAChatProps {
  sessionId: string | null;
  videoId: string;
  currentTime: number;
  currentTimeMs: number;
  currentExercise: ExerciseTimelineAnchor | null;
  manifest: SidecarManifest | null;
  cuePlan: CuePlan | null;
  transcript: TranscriptArtifact | null;
  coexistenceSettings: AudioCoexistenceSettings;
  assistantMuted: boolean;
  metadata: { title?: string | null } | null;
  userProfile: User | null;
  announce: (msg: string) => void;
  logSessionEvent: (eventType: string, timestampMs: number, eventMetadata?: Record<string, unknown>) => void;
}

/**
 * Hook to manage interactive workout Q&A state, text input values, and response processing.
 */
export function useQnAChat({
  sessionId,
  videoId,
  currentTime,
  currentTimeMs,
  currentExercise,
  manifest,
  cuePlan,
  transcript,
  coexistenceSettings,
  assistantMuted,
  metadata,
  userProfile,
  announce,
  logSessionEvent,
}: UseQnAChatProps) {
  const [qaMessages, setQaMessages] = useState<Array<{ sender: "assistant" | "user"; text: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);

  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const query = chatInput.trim();
    if (!query || isPending) return;

    setIsPending(true);
    setQaError(null);
    setChatInput("");

    // Append user message immediately
    setQaMessages((prev) => [
      ...prev,
      { sender: "user", text: query }
    ]);
    announce(`User question submitted: "${query}"`);

    const activeExerciseName = currentExercise ? currentExercise.name : null;
    let latestInstructionText = null;
    if (manifest && manifest.trainer_instruction_events) {
      const priorEvents = manifest.trainer_instruction_events.filter(
        (evt: TrainerInstructionEvent) => evt.start_ms !== null && evt.start_ms !== undefined && evt.start_ms <= currentTimeMs
      );
      if (priorEvents.length > 0) {
        priorEvents.sort((a: TrainerInstructionEvent, b: TrainerInstructionEvent) => (b.start_ms ?? 0) - (a.start_ms ?? 0));
        latestInstructionText = priorEvents[0].text;
      }
    }

    logSessionEvent(SESSION_EVENTS.USER_QUESTION_SUBMITTED, currentTimeMs, {
      question: query,
      active_exercise: activeExerciseName,
      latest_trainer_instruction: latestInstructionText
    });

    try {
      announce("Assistant is responding.");

      let groundedSessionContext: Record<string, unknown>;
      if (manifest && cuePlan && transcript) {
        groundedSessionContext = buildFrontendQnAContext({
          videoTitle: metadata?.title || null,
          currentTimeMs,
          manifest,
          cuePlan,
          transcript,
          audioCoexistence: coexistenceSettings,
          assistantVoiceMuted: assistantMuted,
        });
      } else {
        groundedSessionContext = {
          is_grounded: false,
          active_exercise: activeExerciseName,
          latest_trainer_instruction: latestInstructionText,
          audio_coexistence: coexistenceSettings,
          assistant_voice_muted: assistantMuted,
          youtube_metadata: metadata ? { title: metadata.title } : null,
        };
      }

      const fullContext: Record<string, unknown> = {
        ...groundedSessionContext,
        sessionId,
        videoId,
        currentTimeSeconds: currentTime,
        currentTimeMs,
      };

      const response = await askAssistant({
        question: query,
        video_id: videoId,
        session_id: sessionId,
        current_timestamp_ms: currentTimeMs,
        persona: userProfile?.assistant_persona || undefined,
        session_context: fullContext,
        runtime_observation_context: {
          pose_available: false,
          pose_confidence: null,
          observation_capability: "not_available",
          latest_form_error: null,
          latest_rep_event: null,
          notes: "Real-time camera observation is not available."
        }
      });

      setQaMessages((prev) => [
        ...prev,
        { sender: "assistant", text: response.answer_text }
      ]);
      announce(`Assistant response received: "${response.answer_text}"`);

      logSessionEvent(SESSION_EVENTS.ASSISTANT_ANSWER_DELIVERED, currentTimeMs, {
        question: query,
        answer: response.answer_text,
        current_timestamp_ms: currentTimeMs,
        active_exercise: activeExerciseName,
        latest_trainer_instruction: latestInstructionText,
        source: response.provider || "prototype",
        provider: response.provider || "prototype_assistant"
      });
    } catch (err) {
      console.error("Assistant Q&A failed:", err);
      const errMsg = err instanceof Error ? err.message : "Failed to get response from assistant.";
      setQaError(errMsg);

      setQaMessages((prev) => [
        ...prev,
        { sender: "assistant", text: `Error: ${errMsg}` }
      ]);
      announce(`Assistant response failed: ${errMsg}`);

      logSessionEvent(SESSION_EVENTS.ASSISTANT_ANSWER_FAILED, currentTimeMs, {
        question: query,
        error: errMsg,
        current_timestamp_ms: currentTimeMs,
        active_exercise: activeExerciseName,
        latest_trainer_instruction: latestInstructionText
      });
    } finally {
      setIsPending(false);
    }
  }, [
    chatInput,
    isPending,
    sessionId,
    videoId,
    currentTime,
    currentTimeMs,
    currentExercise,
    manifest,
    cuePlan,
    transcript,
    coexistenceSettings,
    assistantMuted,
    metadata,
    userProfile,
    announce,
    logSessionEvent,
  ]);

  return {
    qaMessages,
    chatInput,
    setChatInput,
    isPending,
    qaError,
    handleSendMessage,
  };
}
