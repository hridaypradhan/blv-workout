/**
 * liveVoiceCommandHandlers.ts
 *
 * Pure command-dispatch functions for live voice commands.
 * Each handler receives explicit action dependencies so it can be called
 * from tests without React or closures.
 *
 * The hook useLiveVoiceCommands wraps these with stable refs.
 */

import { VoiceCommand } from "@/lib/voice/voiceCommandTypes";
import { executeScrollCommand } from "@/lib/voice/voiceNavigation";
import { SESSION_EVENTS } from "@/lib/sessionEvents";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

import { PauseOwner } from "../hooks/usePlaybackPauseCoordinator";

export interface PlaybackHandlerDeps {
  pause: () => void;
  play: () => void;
  seek: (seconds: number, reason?: string) => void;
  setPlaybackRate: (rate: number) => void;
  announce: (msg: string) => void;
  logSessionEvent: (eventType: string, timestampMs: number, payload?: Record<string, unknown>) => void;
  activeOwners?: Set<PauseOwner>;
  playbackRate?: number;
}

export interface NavigationHandlerDeps {
  handleSkipSection: () => void;
  handlePreviousSection?: () => void;
  handleReadCurrentSection?: () => void;
  announce: (msg: string) => void;
  logSessionEvent: (eventType: string, timestampMs: number, payload?: Record<string, unknown>) => void;
  isGateOpen: boolean;
}

export interface SpeechHandlerDeps {
  setAssistantMuted: (muted: boolean) => void;
  handleRepeatTrainerInstruction: () => void;
  onRepeatGuidance?: () => void;
  onCancelCountdown?: () => void;
  onSkipAlignment?: () => void;
  announce: (msg: string) => void;
  logSessionEvent: (eventType: string, timestampMs: number, payload?: Record<string, unknown>) => void;
  isGateOpen: boolean;
  isCountdownActive: boolean;
}

export interface QnAHandlerDeps {
  submitQuestion: (query: string, source: "typed" | "voice") => Promise<void>;
  announce: (msg: string) => void;
  logSessionEvent: (eventType: string, timestampMs: number, payload?: Record<string, unknown>) => void;
  isQnAPending: boolean;
}

// ---------------------------------------------------------------------------
// Playback commands (pause / resume / seek / speed)
// ---------------------------------------------------------------------------

export function handlePlaybackCommand(
  command: VoiceCommand & { rawText?: string },
  tsMs: number,
  currentTime: number,
  deps: PlaybackHandlerDeps
): boolean {
  const {
    pause,
    play,
    seek,
    setPlaybackRate,
    announce,
    logSessionEvent,
    activeOwners = new Set(),
    playbackRate = 1.0,
  } = deps;

  switch (command.type) {
    case "pause":
      pause();
      announce("Paused.");
      logSessionEvent(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
        command: "pause",
        transcript: command.rawText || "",
      });
      return true;

    case "resume":
      if (activeOwners.has("positioning_gate")) {
        announce("Alignment is active. Say skip alignment or finish alignment first.");
        logSessionEvent(SESSION_EVENTS.VOICE_COMMAND_BLOCKED, tsMs, {
          command: "resume",
          reason: "positioning_gate_active",
          transcript: command.rawText || "",
        });
        return true;
      }
      if (activeOwners.has("assistant_speech")) {
        announce("Playback is paused for assistant speech.");
        logSessionEvent(SESSION_EVENTS.VOICE_COMMAND_BLOCKED, tsMs, {
          command: "resume",
          reason: "assistant_speech_active",
          transcript: command.rawText || "",
        });
        return true;
      }
      play();
      announce("Resumed.");
      logSessionEvent(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
        command: "resume",
        transcript: command.rawText || "",
      });
      return true;

    case "rewind": {
      const target = Math.max(currentTime - command.seconds, 0);
      seek(target, `Rewound ${command.seconds} seconds.`);
      logSessionEvent(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
        command: "rewind",
        seconds: command.seconds,
        transcript: command.rawText || "",
      });
      return true;
    }

    case "forward": {
      const target = currentTime + command.seconds;
      seek(target, `Skipped ahead ${command.seconds} seconds.`);
      logSessionEvent(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
        command: "forward",
        seconds: command.seconds,
        transcript: command.rawText || "",
      });
      return true;
    }

    case "slow_down": {
      const targetRate = Math.max(playbackRate - 0.25, 0.5);
      setPlaybackRate(targetRate);
      announce(`Speed set to ${targetRate}x.`);
      logSessionEvent(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
        command: "slow_down",
        playbackRate: targetRate,
        transcript: command.rawText || "",
      });
      return true;
    }

    case "normal_speed":
      setPlaybackRate(1.0);
      announce("Speed set to 1.0x.");
      logSessionEvent(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
        command: "normal_speed",
        transcript: command.rawText || "",
      });
      return true;

    case "speed_up": {
      const targetRate = Math.min(playbackRate + 0.25, 2.0);
      setPlaybackRate(targetRate);
      announce(`Speed set to ${targetRate}x.`);
      logSessionEvent(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
        command: "speed_up",
        playbackRate: targetRate,
        transcript: command.rawText || "",
      });
      return true;
    }

    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Navigation commands (sections, scroll)
// ---------------------------------------------------------------------------

export function handleNavigationCommand(
  command: VoiceCommand & { rawText?: string },
  tsMs: number,
  deps: NavigationHandlerDeps
): boolean {
  const {
    handleSkipSection,
    handlePreviousSection,
    handleReadCurrentSection,
    announce,
    logSessionEvent,
    isGateOpen,
  } = deps;

  switch (command.type) {
    case "next_section":
      handleSkipSection();
      logSessionEvent(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
        command: "next_section",
        transcript: command.rawText || "",
      });
      return true;

    case "previous_section":
      if (isGateOpen) {
        announce("Navigation commands are disabled during alignment.");
        return true;
      }
      handlePreviousSection?.();
      logSessionEvent(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
        command: "previous_section",
        transcript: command.rawText || "",
      });
      return true;

    case "read_current_section":
      if (isGateOpen) {
        announce("Reading sections is disabled during alignment.");
        return true;
      }
      handleReadCurrentSection?.();
      logSessionEvent(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
        command: "read_current_section",
        transcript: command.rawText || "",
      });
      return true;

    case "scroll_down":
    case "scroll_up":
    case "page_down":
    case "page_up":
      if (isGateOpen) {
        announce("Scroll commands are disabled during alignment.");
        return true;
      }
      executeScrollCommand(command.type);
      announce(`Scrolled ${command.type.replace("_", " ")}.`);
      logSessionEvent(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
        command: command.type,
        transcript: command.rawText || "",
      });
      return true;

    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Speech / gate control commands
// ---------------------------------------------------------------------------

export function handleSpeechCommand(
  command: VoiceCommand & { rawText?: string },
  tsMs: number,
  deps: SpeechHandlerDeps
): boolean {
  const {
    setAssistantMuted,
    handleRepeatTrainerInstruction,
    onRepeatGuidance,
    onCancelCountdown,
    onSkipAlignment,
    announce,
    logSessionEvent,
    isGateOpen,
    isCountdownActive,
  } = deps;

  switch (command.type) {
    case "mute_assistant":
      setAssistantMuted(true);
      announce("Assistant muted.");
      logSessionEvent(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
        command: "mute_assistant",
        transcript: command.rawText || "",
      });
      return true;

    case "unmute_assistant":
      setAssistantMuted(false);
      announce("Assistant unmuted.");
      logSessionEvent(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
        command: "unmute_assistant",
        transcript: command.rawText || "",
      });
      return true;

    case "repeat_instruction":
      if (isGateOpen && onRepeatGuidance) {
        onRepeatGuidance();
      } else {
        handleRepeatTrainerInstruction();
      }
      logSessionEvent(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
        command: "repeat_instruction",
        transcript: command.rawText || "",
      });
      return true;

    case "cancel_countdown":
      if (!isCountdownActive || !onCancelCountdown) {
        announce("No active countdown.");
        logSessionEvent(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
          command: "cancel_countdown",
          transcript: command.rawText || "",
          skipped: true,
          reason: "no_active_countdown",
        });
      } else {
        onCancelCountdown();
        logSessionEvent(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
          command: "cancel_countdown",
          transcript: command.rawText || "",
        });
      }
      return true;

    case "skip_alignment":
      if (!isGateOpen || !onSkipAlignment) {
        announce("Positioning gate is not active.");
        logSessionEvent(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
          command: "skip_alignment",
          transcript: command.rawText || "",
          skipped: true,
          reason: "gate_not_active",
        });
      } else {
        onSkipAlignment();
        logSessionEvent(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
          command: "skip_alignment",
          transcript: command.rawText || "",
        });
      }
      return true;

    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Q&A commands
// ---------------------------------------------------------------------------

export function handleQnACommand(
  command: VoiceCommand & { rawText?: string },
  tsMs: number,
  deps: QnAHandlerDeps
): boolean {
  const { submitQuestion, announce, logSessionEvent, isQnAPending } = deps;

  switch (command.type) {
    case "ask_question":
      if (isQnAPending) {
        announce("Please wait for the current question to finish.");
        logSessionEvent(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
          command: "ask_question",
          question: command.question,
          transcript: command.rawText || "",
          skipped: true,
          reason: "qna_pending",
        });
        return true;
      }
      submitQuestion(command.question, "voice");
      logSessionEvent(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
        command: "ask_question",
        question: command.question,
        transcript: command.rawText || "",
      });
      return true;

    case "end_session":
      announce("To end the session, please use the End & Save Session button.");
      logSessionEvent(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
        command: "end_session",
        confirmation_needed: true,
        transcript: command.rawText || "",
      });
      return true;

    default:
      return false;
  }
}

export interface CameraHandlerDeps {
  cameraDevices?: MediaDeviceInfo[];
  selectedCameraDeviceId?: string;
  requestCamera?: (deviceId?: string) => Promise<void>;
  announce: (msg: string) => void;
  logSessionEvent: (eventType: string, timestampMs: number, payload?: Record<string, unknown>) => void;
}

export function handleCameraCommand(
  command: VoiceCommand & { rawText?: string },
  tsMs: number,
  deps: CameraHandlerDeps
): boolean {
  if (command.type !== "change_camera") return false;

  const { cameraDevices = [], selectedCameraDeviceId, requestCamera, announce, logSessionEvent } = deps;
  if (!requestCamera || cameraDevices.length === 0) {
    announce("Camera switching is not available.");
    return true;
  }

  if (command.target === "external") {
    // Find the first external camera (non-integrated)
    const externalDevice = cameraDevices.find((d) => {
      const label = (d.label || "").toLowerCase();
      const isIntegrated =
        label.includes("integrated") ||
        label.includes("built-in") ||
        label.includes("facetime") ||
        label.includes("front") ||
        label.includes("isight") ||
        label.includes("internal");
      return !isIntegrated && d.label !== "";
    });

    if (externalDevice) {
      announce(`Switching to external camera: ${externalDevice.label}.`);
      requestCamera(externalDevice.deviceId);
      logSessionEvent(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
        command: "change_camera",
        target: "external",
        deviceId: externalDevice.deviceId,
        transcript: command.rawText || "",
      });
    } else {
      announce("No external camera was found.");
    }
  } else {
    // Cycle to the next device
    const currentIndex = cameraDevices.findIndex((d) => d.deviceId === selectedCameraDeviceId);
    const nextIndex = (currentIndex + 1) % cameraDevices.length;
    const nextDevice = cameraDevices[nextIndex];

    if (nextDevice) {
      announce(`Switching camera to ${nextDevice.label || `device ${nextIndex + 1}`}.`);
      requestCamera(nextDevice.deviceId);
      logSessionEvent(SESSION_EVENTS.VOICE_COMMAND_EXECUTED, tsMs, {
        command: "change_camera",
        target: "next",
        deviceId: nextDevice.deviceId,
        transcript: command.rawText || "",
      });
    }
  }

  return true;
}
