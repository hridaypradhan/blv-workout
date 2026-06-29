"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSpeechRecognition, SpeechRecognitionStatus } from "./useSpeechRecognition";
import { parseVoiceCommand } from "@/lib/voice/voiceCommandParser";
import { VoiceCommand } from "@/lib/voice/voiceCommandTypes";
import { SESSION_EVENTS } from "@/lib/sessionEvents";

export interface UseLiveVoiceCommandsProps {
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  seek: (seconds: number, reason?: string) => void;
  currentTime: number;
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
  handleSkipSection: () => void;
  handleRepeatTrainerInstruction: () => void;
  assistantMuted: boolean;
  setAssistantMuted: (muted: boolean) => void;
  submitQuestion: (query: string, source: "typed" | "voice") => Promise<void>;
  announce: (msg: string) => void;
  logSessionEvent: (eventType: string, timestampMs: number, eventMetadata?: Record<string, unknown>) => void;
  currentTimeMs: number;
  /** Whether a Q&A question is currently pending a response. Prevents duplicate voice Q&A submissions. */
  isQnAPending?: boolean;
  /** Optional callback invoked before the mic starts listening (e.g. for audio ducking). */
  onBeforeListening?: () => void;
  /** Optional callback invoked after the mic stops listening. */
  onAfterListening?: () => void;
}

export interface UseLiveVoiceCommandsReturn {
  voiceStatus: SpeechRecognitionStatus;
  startVoice: () => void;
  stopVoice: () => void;
  lastTranscript: string;
  voiceError: string | null;
  voiceRawError: string | null;
}

/** Maximum number of processed result IDs to retain (prevents unbounded growth). */
const MAX_PROCESSED_IDS = 200;

/**
 * Live voice command orchestration hook.
 *
 * Connects the browser SpeechRecognition adapter and the deterministic
 * command parser to the live session's playback and Q&A actions.
 */
export function useLiveVoiceCommands({
  isPlaying,
  play,
  pause,
  seek,
  currentTime,
  playbackRate,
  setPlaybackRate,
  handleSkipSection,
  handleRepeatTrainerInstruction,
  assistantMuted,
  setAssistantMuted,
  submitQuestion,
  announce,
  logSessionEvent,
  currentTimeMs,
  isQnAPending = false,
  onBeforeListening,
  onAfterListening,
}: UseLiveVoiceCommandsProps): UseLiveVoiceCommandsReturn {
  const {
    status: voiceStatus,
    lastTranscript,
    lastResult,
    error: voiceError,
    rawError: voiceRawError,
    startListening,
    stopListening,
    clearLastResult,
  } = useSpeechRecognition();

  // Dedup guard: track processed result IDs to prevent reprocessing
  const processedIdsRef = useRef<Set<string>>(new Set());

  // Stable refs for current values to avoid stale closures in the effect
  const currentTimeRef = useRef(currentTime);
  const currentTimeMsRef = useRef(currentTimeMs);
  const playbackRateRef = useRef(playbackRate);
  const isPlayingRef = useRef(isPlaying);
  const assistantMutedRef = useRef(assistantMuted);
  const isQnAPendingRef = useRef(isQnAPending);

  // Stable refs for callback props to keep executeCommand identity stable
  const submitQuestionRef = useRef(submitQuestion);
  const announceRef = useRef(announce);
  const logSessionEventRef = useRef(logSessionEvent);
  const pauseRef = useRef(pause);
  const playRef = useRef(play);
  const seekRef = useRef(seek);
  const setPlaybackRateRef = useRef(setPlaybackRate);
  const handleSkipSectionRef = useRef(handleSkipSection);
  const handleRepeatTrainerInstructionRef = useRef(handleRepeatTrainerInstruction);
  const setAssistantMutedRef = useRef(setAssistantMuted);

  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { currentTimeMsRef.current = currentTimeMs; }, [currentTimeMs]);
  useEffect(() => { playbackRateRef.current = playbackRate; }, [playbackRate]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { assistantMutedRef.current = assistantMuted; }, [assistantMuted]);
  useEffect(() => { isQnAPendingRef.current = isQnAPending; }, [isQnAPending]);
  useEffect(() => { submitQuestionRef.current = submitQuestion; }, [submitQuestion]);
  useEffect(() => { announceRef.current = announce; }, [announce]);
  useEffect(() => { logSessionEventRef.current = logSessionEvent; }, [logSessionEvent]);
  useEffect(() => { pauseRef.current = pause; }, [pause]);
  useEffect(() => { playRef.current = play; }, [play]);
  useEffect(() => { seekRef.current = seek; }, [seek]);
  useEffect(() => { setPlaybackRateRef.current = setPlaybackRate; }, [setPlaybackRate]);
  useEffect(() => { handleSkipSectionRef.current = handleSkipSection; }, [handleSkipSection]);
  useEffect(() => { handleRepeatTrainerInstructionRef.current = handleRepeatTrainerInstruction; }, [handleRepeatTrainerInstruction]);
  useEffect(() => { setAssistantMutedRef.current = setAssistantMuted; }, [setAssistantMuted]);

  const startVoice = useCallback(() => {
    onBeforeListening?.();
    startListening();
    logSessionEventRef.current(SESSION_EVENTS.VOICE_MIC_ENABLED, currentTimeMsRef.current);
    announceRef.current("Voice control activated. Listening for commands.");
  }, [startListening, onBeforeListening]);

  const stopVoice = useCallback(() => {
    stopListening();
    onAfterListening?.();
    logSessionEventRef.current(SESSION_EVENTS.VOICE_MIC_DISABLED, currentTimeMsRef.current);
    announceRef.current("Voice control deactivated.");
  }, [stopListening, onAfterListening]);

  // --- Speech recognition error telemetry ---
  // Tracks the last error we logged to avoid spamming repeated identical errors.
  const lastLoggedErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (!voiceRawError) {
      // Error was cleared (e.g. retry or stop) — reset the dedup guard
      lastLoggedErrorRef.current = null;
      return;
    }

    // Don't log the same raw error code twice in a row without user action
    if (lastLoggedErrorRef.current === voiceRawError) return;

    lastLoggedErrorRef.current = voiceRawError;
    logSessionEventRef.current(SESSION_EVENTS.VOICE_RECOGNITION_ERROR, currentTimeMsRef.current, {
      rawError: voiceRawError,
      message: voiceError,
    });
  }, [voiceRawError, voiceError]);

  /**
   * Execute a parsed voice command against the live session handlers.
   * Uses refs for all callback props to keep this callback's identity stable.
   */
  const executeCommand = useCallback((command: VoiceCommand, rawTranscript: string) => {
    const tsMs = currentTimeMsRef.current;
    const ct = currentTimeRef.current;

    // Check if speech synthesis is actively speaking — avoid command collision
    if (typeof window !== "undefined" && window.speechSynthesis?.speaking) {
      announceRef.current("Please wait for assistant to finish speaking.");
      return;
    }

    try {
      switch (command.type) {
        case "pause":
          pauseRef.current();
          announceRef.current("Paused.");
          logSessionEventRef.current(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
            command: "pause",
            transcript: rawTranscript,
          });
          break;

        case "resume":
          playRef.current();
          announceRef.current("Resumed.");
          logSessionEventRef.current(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
            command: "resume",
            transcript: rawTranscript,
          });
          break;

        case "rewind": {
          const target = Math.max(ct - command.seconds, 0);
          seekRef.current(target, `Rewound ${command.seconds} seconds.`);
          logSessionEventRef.current(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
            command: "rewind",
            seconds: command.seconds,
            transcript: rawTranscript,
          });
          break;
        }

        case "forward": {
          const target = ct + command.seconds;
          seekRef.current(target, `Skipped ahead ${command.seconds} seconds.`);
          logSessionEventRef.current(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
            command: "forward",
            seconds: command.seconds,
            transcript: rawTranscript,
          });
          break;
        }

        case "slow_down":
          setPlaybackRateRef.current(0.75);
          announceRef.current("Slowed to 0.75x.");
          logSessionEventRef.current(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
            command: "slow_down",
            transcript: rawTranscript,
          });
          break;

        case "normal_speed":
          setPlaybackRateRef.current(1.0);
          announceRef.current("Speed set to normal.");
          logSessionEventRef.current(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
            command: "normal_speed",
            transcript: rawTranscript,
          });
          break;

        case "speed_up":
          setPlaybackRateRef.current(1.5);
          announceRef.current("Speed set to 1.5x.");
          logSessionEventRef.current(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
            command: "speed_up",
            transcript: rawTranscript,
          });
          break;

        case "next_section":
          handleSkipSectionRef.current();
          logSessionEventRef.current(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
            command: "next_section",
            transcript: rawTranscript,
          });
          break;

        case "repeat_instruction":
          handleRepeatTrainerInstructionRef.current();
          logSessionEventRef.current(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
            command: "repeat_instruction",
            transcript: rawTranscript,
          });
          break;

        case "mute_assistant":
          setAssistantMutedRef.current(true);
          announceRef.current("Assistant muted.");
          logSessionEventRef.current(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
            command: "mute_assistant",
            transcript: rawTranscript,
          });
          break;

        case "unmute_assistant":
          setAssistantMutedRef.current(false);
          announceRef.current("Assistant unmuted.");
          logSessionEventRef.current(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
            command: "unmute_assistant",
            transcript: rawTranscript,
          });
          break;

        case "ask_question":
          // Guard: do not submit another voice Q&A while current one is pending
          if (isQnAPendingRef.current) {
            announceRef.current("Please wait for the current question to finish.");
            logSessionEventRef.current(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
              command: "ask_question",
              question: command.question,
              transcript: rawTranscript,
              skipped: true,
              reason: "qna_pending",
            });
            break;
          }
          submitQuestionRef.current(command.question, "voice");
          logSessionEventRef.current(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
            command: "ask_question",
            question: command.question,
            transcript: rawTranscript,
          });
          break;

        case "end_session":
          announceRef.current("To end the session, please use the End & Save Session button.");
          logSessionEventRef.current(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
            command: "end_session",
            confirmation_needed: true,
            transcript: rawTranscript,
          });
          break;

        case "rejected":
          announceRef.current("Voice command not recognized.");
          logSessionEventRef.current(SESSION_EVENTS.VOICE_COMMAND_REJECTED, tsMs, {
            reason: command.reason,
            transcript: rawTranscript,
          });
          break;
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      announceRef.current(`Voice command failed: ${errMsg}`);
      logSessionEventRef.current(SESSION_EVENTS.VOICE_COMMAND_FAILED, tsMs, {
        command: command.type,
        error: errMsg,
        transcript: rawTranscript,
      });
    }
  }, []); // No dependencies — all values accessed via refs

  // Watch for new final results (by ID) and process them
  useEffect(() => {
    if (!lastResult) return;

    // Dedup: skip if this result ID was already processed
    if (processedIdsRef.current.has(lastResult.id)) {
      return;
    }

    // Mark as processed
    processedIdsRef.current.add(lastResult.id);

    // Prevent unbounded growth of the processed set
    if (processedIdsRef.current.size > MAX_PROCESSED_IDS) {
      const idsArray = Array.from(processedIdsRef.current);
      processedIdsRef.current = new Set(idsArray.slice(idsArray.length - 100));
    }

    // Log recognition
    logSessionEventRef.current(SESSION_EVENTS.VOICE_COMMAND_RECOGNIZED, currentTimeMsRef.current, {
      transcript: lastResult.transcript,
      resultId: lastResult.id,
    });

    // Parse and execute
    const command = parseVoiceCommand(lastResult.transcript);
    executeCommand(command, lastResult.transcript);

    // Clear the result after processing
    clearLastResult();
  }, [lastResult, executeCommand, clearLastResult]);

  return {
    voiceStatus,
    startVoice,
    stopVoice,
    lastTranscript,
    voiceError,
    voiceRawError,
  };
}
