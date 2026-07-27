/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSpeechRecognition, SpeechRecognitionStatus } from "./useSpeechRecognition";
import { parseVoiceCommand } from "@/lib/voice/voiceCommandParser";
import { VoiceCommand } from "@/lib/voice/voiceCommandTypes";
import { SESSION_EVENTS } from "@/lib/sessionEvents";
import {
  handlePlaybackCommand,
  handleNavigationCommand,
  handleSpeechCommand,
  handleQnACommand,
  handleCameraCommand,
} from "@/lib/voice/liveVoiceCommandHandlers";
import { isSpeakingOrRecentlySpoken } from "@/lib/voice/speechRegistry";
import { PauseOwner } from "./usePlaybackPauseCoordinator";

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
  isGateOpen?: boolean;
  isCountdownActive?: boolean;
  onRepeatGuidance?: () => void;
  onCancelCountdown?: () => void;
  onSkipAlignment?: () => void;
  handlePreviousSection?: () => void;
  handleReadCurrentSection?: () => void;
  autoStart?: boolean;
  cameraDevices?: MediaDeviceInfo[];
  selectedCameraDeviceId?: string;
  requestCamera?: (deviceId?: string) => Promise<void>;
  activeOwners?: Set<PauseOwner>;
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
 * Command dispatch logic lives in liveVoiceCommandHandlers.ts.
 */
export function useLiveVoiceCommands({
  isPlaying,
  play,
  pause,
  seek,
  currentTime,
  playbackRate = 1.0,
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
  isGateOpen = false,
  isCountdownActive = false,
  onRepeatGuidance,
  onCancelCountdown,
  onSkipAlignment,
  handlePreviousSection,
  handleReadCurrentSection,
  autoStart = true,
  cameraDevices,
  selectedCameraDeviceId,
  requestCamera,
  activeOwners,
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

  // Stable refs for current values (avoids stale closures)
  const currentTimeRef = useRef(currentTime);
  const currentTimeMsRef = useRef(currentTimeMs);
  const isPlayingRef = useRef(isPlaying);
  const isGateOpenRef = useRef(isGateOpen);
  const isCountdownActiveRef = useRef(isCountdownActive);
  const isQnAPendingRef = useRef(isQnAPending);
  const assistantMutedRef = useRef(assistantMuted);
  void assistantMutedRef; // read via deps in handlers

  const playbackRateRef = useRef(playbackRate);
  const activeOwnersRef = useRef<Set<PauseOwner>>(activeOwners || new Set<PauseOwner>());

  useEffect(() => { playbackRateRef.current = playbackRate; }, [playbackRate]);
  useEffect(() => { activeOwnersRef.current = activeOwners || new Set<PauseOwner>(); }, [activeOwners]);

  // Stable refs for callback props
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
  const onRepeatGuidanceRef = useRef(onRepeatGuidance);
  const onCancelCountdownRef = useRef(onCancelCountdown);
  const onSkipAlignmentRef = useRef(onSkipAlignment);
  const handlePreviousSectionRef = useRef(handlePreviousSection);
  const handleReadCurrentSectionRef = useRef(handleReadCurrentSection);

  // Keep all refs current
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { currentTimeMsRef.current = currentTimeMs; }, [currentTimeMs]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { isGateOpenRef.current = isGateOpen; }, [isGateOpen]);
  useEffect(() => { isCountdownActiveRef.current = isCountdownActive; }, [isCountdownActive]);
  useEffect(() => { isQnAPendingRef.current = isQnAPending; }, [isQnAPending]);
  useEffect(() => { assistantMutedRef.current = assistantMuted; }, [assistantMuted]);
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
  useEffect(() => { handlePreviousSectionRef.current = handlePreviousSection; }, [handlePreviousSection]);
  useEffect(() => { handleReadCurrentSectionRef.current = handleReadCurrentSection; }, [handleReadCurrentSection]);
  useEffect(() => { onRepeatGuidanceRef.current = onRepeatGuidance; }, [onRepeatGuidance]);
  useEffect(() => { onCancelCountdownRef.current = onCancelCountdown; }, [onCancelCountdown]);
  useEffect(() => { onSkipAlignmentRef.current = onSkipAlignment; }, [onSkipAlignment]);

  const cameraDevicesRef = useRef(cameraDevices);
  const selectedCameraDeviceIdRef = useRef(selectedCameraDeviceId);
  const requestCameraRef = useRef(requestCamera);

  useEffect(() => { cameraDevicesRef.current = cameraDevices; }, [cameraDevices]);
  useEffect(() => { selectedCameraDeviceIdRef.current = selectedCameraDeviceId; }, [selectedCameraDeviceId]);
  useEffect(() => { requestCameraRef.current = requestCamera; }, [requestCamera]);

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

  // Speech recognition error telemetry (deduped)
  const lastLoggedErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (!voiceRawError) {
      lastLoggedErrorRef.current = null;
      return;
    }
    if (lastLoggedErrorRef.current === voiceRawError) return;
    lastLoggedErrorRef.current = voiceRawError;
    logSessionEventRef.current(SESSION_EVENTS.VOICE_RECOGNITION_ERROR, currentTimeMsRef.current, {
      rawError: voiceRawError,
      message: voiceError,
    });
  }, [voiceRawError, voiceError]);

  /**
   * Dispatch a parsed voice command using the extracted pure handler functions.
   * All state values are accessed via stable refs to keep callback identity stable.
   */
  const executeCommand = useCallback((command: VoiceCommand, rawTranscript: string) => {
    const tsMs = currentTimeMsRef.current;
    const ct = currentTimeRef.current;
    const cmd = { ...command, rawText: rawTranscript };

    // Avoid echo / app fighting voice recognition when TTS is speaking or recently spoke
    if (isSpeakingOrRecentlySpoken(rawTranscript)) {
      const isPriority = command.type === "pause" || 
                         command.type === "cancel_countdown" || 
                         command.type === "skip_alignment";
      if (!isPriority) {
        return; // Silently ignore non-priority command or noise during/after TTS
      }
    }

    try {
      if (handlePlaybackCommand(cmd, tsMs, ct, {
        pause: pauseRef.current,
        play: playRef.current,
        seek: seekRef.current,
        setPlaybackRate: setPlaybackRateRef.current,
        announce: announceRef.current,
        logSessionEvent: logSessionEventRef.current,
        activeOwners: activeOwnersRef.current as Set<PauseOwner>,
        playbackRate: playbackRateRef.current,
      })) return;

      if (handleNavigationCommand(cmd, tsMs, {
        handleSkipSection: handleSkipSectionRef.current,
        handlePreviousSection: handlePreviousSectionRef.current,
        handleReadCurrentSection: handleReadCurrentSectionRef.current,
        announce: announceRef.current,
        logSessionEvent: logSessionEventRef.current,
        isGateOpen: isGateOpenRef.current,
      })) return;

      if (handleSpeechCommand(cmd, tsMs, {
        setAssistantMuted: setAssistantMutedRef.current,
        handleRepeatTrainerInstruction: handleRepeatTrainerInstructionRef.current,
        onRepeatGuidance: onRepeatGuidanceRef.current,
        onCancelCountdown: onCancelCountdownRef.current,
        onSkipAlignment: onSkipAlignmentRef.current,
        announce: announceRef.current,
        logSessionEvent: logSessionEventRef.current,
        isGateOpen: isGateOpenRef.current,
        isCountdownActive: isCountdownActiveRef.current,
      })) return;

      if (handleQnACommand(cmd, tsMs, {
        submitQuestion: submitQuestionRef.current,
        announce: announceRef.current,
        logSessionEvent: logSessionEventRef.current,
        isQnAPending: isQnAPendingRef.current,
      })) return;

      if (handleCameraCommand(cmd, tsMs, {
        cameraDevices: cameraDevicesRef.current,
        selectedCameraDeviceId: selectedCameraDeviceIdRef.current,
        requestCamera: requestCameraRef.current,
        announce: announceRef.current,
        logSessionEvent: logSessionEventRef.current,
      })) return;

      if (command.type === "rejected") {
        announceRef.current("Voice command not recognized.");
        logSessionEventRef.current(SESSION_EVENTS.VOICE_COMMAND_REJECTED, tsMs, {
          reason: command.reason,
          transcript: rawTranscript,
        });
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
  }, []); // No deps — all values accessed via refs

  // Process new final recognition results (deduped by ID)
  useEffect(() => {
    if (!lastResult) return;
    if (processedIdsRef.current.has(lastResult.id)) return;

    processedIdsRef.current.add(lastResult.id);
    if (processedIdsRef.current.size > MAX_PROCESSED_IDS) {
      const idsArray = Array.from(processedIdsRef.current);
      processedIdsRef.current = new Set(idsArray.slice(idsArray.length - 100));
    }

    logSessionEventRef.current(SESSION_EVENTS.VOICE_COMMAND_RECOGNIZED, currentTimeMsRef.current, {
      transcript: lastResult.transcript,
      resultId: lastResult.id,
    });

    const command = parseVoiceCommand(lastResult.transcript);
    executeCommand(command, lastResult.transcript);
    clearLastResult();
  }, [lastResult, executeCommand, clearLastResult]);

  // Auto-start voice control on mount if supported
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStart && !autoStartedRef.current && voiceStatus === "idle") {
      autoStartedRef.current = true;
      try {
        startVoice();
      } catch (err) {
        console.error("Auto-start voice control failed:", err);
      }
    }
  }, [autoStart, voiceStatus, startVoice]);

  return {
    voiceStatus,
    startVoice,
    stopVoice,
    lastTranscript,
    voiceError,
    voiceRawError,
  };
}
