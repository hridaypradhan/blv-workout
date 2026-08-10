"use client";

import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Status values for the speech recognition adapter.
 */
export type SpeechRecognitionStatus = "unsupported" | "idle" | "listening" | "retrying" | "blocked" | "error";

/**
 * A consumable speech recognition result with a unique ID.
 * Each final transcript from the browser produces exactly one of these.
 * Consumers should track processed IDs to prevent duplicate handling.
 */
export interface VoiceRecognitionResult {
  /** Unique identifier for this specific recognition result. */
  id: string;
  /** The recognized transcript text (trimmed). */
  transcript: string;
  /** Timestamp (ms since epoch) when this result was created. */
  createdAt: number;
}

/** Generate a unique result ID. Uses crypto.randomUUID when available, falls back to timestamp+counter. */
let _resultCounter = 0;
function generateResultId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sr-${Date.now()}-${++_resultCounter}`;
}

/**
 * Minimal type declarations for the Web Speech API.
 * These are not included in all TypeScript lib definitions.
 */
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: { transcript: string; confidence: number };
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResultEvent {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorResultEvent {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorResultEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

// Extend Window to include vendor-prefixed SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

/**
 * Map a raw Web Speech API error code to a user-readable message.
 *
 * Exported for direct unit-testing; also used internally by the hook.
 */
export function mapSpeechError(rawCode: string): string {
  switch (rawCode) {
    case "network":
      return "Browser speech service is unavailable. Manual controls still work.";
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone or speech recognition permission is blocked.";
    case "no-speech":
      return "No speech was detected. Try again.";
    case "audio-capture":
      return "No microphone was detected.";
    default:
      return "Voice recognition encountered an error.";
  }
}

function isRecoverableSpeechError(rawCode: string | null): boolean {
  return rawCode === "no-speech";
}

/**
 * Browser speech recognition adapter hook.
 *
 * Uses the Web Speech API (SpeechRecognition / webkitSpeechRecognition).
 * Handles unsupported browsers cleanly. Supports explicit start/stop only —
 * the mic never starts without user intent.
 *
 * Only emits final recognition results. Interim results are ignored for
 * command execution safety.
 */
export function useSpeechRecognition() {
  const [status, setStatus] = useState<SpeechRecognitionStatus>(() => {
    if (typeof window === "undefined") return "unsupported";
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    return SpeechRecognitionAPI ? "idle" : "unsupported";
  });

  const [lastTranscript, setLastTranscript] = useState<string>("");
  const [lastResult, setLastResult] = useState<VoiceRecognitionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);

  const [userWantsVoiceControl, setUserWantsVoiceControl] = useState<boolean>(false);
  const userWantsVoiceRef = useRef<boolean>(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isStoppingRef = useRef(false);
  /** Whether onerror fired during the current recognition session. */
  const hadErrorRef = useRef(false);
  const lastErrorCodeRef = useRef<string | null>(null);

  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  /**
   * Internal function to initialize and start browser speech recognition.
   */
  const startListeningInternal = useCallback(() => {
    const SpeechRecognitionAPI =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (!SpeechRecognitionAPI) {
      setStatus("unsupported");
      return;
    }

    clearRestartTimer();

    // Stop any existing recognition instance
    if (recognitionRef.current) {
      try {
        isStoppingRef.current = true;
        recognitionRef.current.stop();
      } catch {
        // Ignore stop errors
      }
      recognitionRef.current = null;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal && result[0]) {
          const transcript = result[0].transcript.trim();
          if (transcript) {
            setLastTranscript(transcript);
            setLastResult({
              id: generateResultId(),
              transcript,
              createdAt: Date.now(),
            });
          }
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorResultEvent) => {
      // "aborted" is normal when we call stop() ourselves
      if (event.error === "aborted" && isStoppingRef.current) return;

      hadErrorRef.current = true;
      const raw = event.error || "unknown";
      lastErrorCodeRef.current = raw;
      setRawError(raw);
      setError(mapSpeechError(raw));

      if (raw === "not-allowed" || raw === "service-not-allowed") {
        userWantsVoiceRef.current = false;
        setUserWantsVoiceControl(false);
        setStatus("blocked");
      } else if (isRecoverableSpeechError(raw) && userWantsVoiceRef.current) {
        setStatus("retrying");
      } else {
        setStatus("error");
      }
    };

    recognition.onend = () => {
      const wereStopping = isStoppingRef.current;
      isStoppingRef.current = false;

      const scheduleAutoRestart = (delayMs = 400) => {
        clearRestartTimer();
        restartTimerRef.current = setTimeout(() => {
          if (!userWantsVoiceRef.current) return;

          // Avoid restarting while app TTS is actively speaking
          if (typeof window !== "undefined" && window.speechSynthesis?.speaking) {
            scheduleAutoRestart(300);
            return;
          }

          startListeningInternal();
        }, delayMs);
      };

      // Explicit stop by user
      if (wereStopping) {
        setStatus("idle");
        userWantsVoiceRef.current = false;
        setUserWantsVoiceControl(false);
        return;
      }

      // If onerror already fired for this session, keep blocked/error states
      // visible unless the browser only reported temporary silence.
      if (hadErrorRef.current) {
        if (lastErrorCodeRef.current === "not-allowed" || lastErrorCodeRef.current === "service-not-allowed") {
          userWantsVoiceRef.current = false;
          setUserWantsVoiceControl(false);
          setStatus("blocked");
        } else if (isRecoverableSpeechError(lastErrorCodeRef.current) && userWantsVoiceRef.current) {
          setStatus("retrying");
          scheduleAutoRestart(400);
        }
        return;
      }

      // Natural end (e.g., silence timeout)
      if (userWantsVoiceRef.current) {
        setStatus("retrying");
        scheduleAutoRestart(400);
      } else {
        setStatus("idle");
      }
    };

    recognitionRef.current = recognition;
    isStoppingRef.current = false;
    hadErrorRef.current = false;
    lastErrorCodeRef.current = null;

    setError(null);
    setRawError(null);

    try {
      recognition.start();
      setStatus("listening");
    } catch (err) {
      hadErrorRef.current = true;
      const msg = err instanceof Error ? err.message : "Failed to start speech recognition";
      setRawError("start-exception");
      setError(msg);
      setStatus("error");
    }
  }, [clearRestartTimer]);

  /**
   * Start listening for voice input (explicit user intent).
   */
  const startListening = useCallback(() => {
    userWantsVoiceRef.current = true;
    setUserWantsVoiceControl(true);
    startListeningInternal();
  }, [startListeningInternal]);

  /**
   * Stop listening for voice input (explicit user intent).
   */
  const stopListening = useCallback(() => {
    userWantsVoiceRef.current = false;
    setUserWantsVoiceControl(false);
    clearRestartTimer();

    if (recognitionRef.current) {
      try {
        isStoppingRef.current = true;
        recognitionRef.current.stop();
      } catch {
        // Ignore stop errors
      }
      recognitionRef.current = null;
    }
    setStatus("idle");
    setError(null);
    setRawError(null);
  }, [clearRestartTimer]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      userWantsVoiceRef.current = false;
      clearRestartTimer();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore cleanup errors
        }
        recognitionRef.current = null;
      }
    };
  }, [clearRestartTimer]);

  /**
   * Clear the last result after it has been consumed.
   */
  const clearLastResult = useCallback(() => {
    setLastResult(null);
  }, []);

  return {
    status,
    userWantsVoiceControl,
    lastTranscript,
    lastResult,
    error,
    rawError,
    startListening,
    stopListening,
    clearLastResult,
  };
}
