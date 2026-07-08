"use client";

import { useEffect, useRef, useState } from "react";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { parseSetupVoiceCommand } from "../voice/setupVoiceCommandParser";
import { executeScrollCommand, navigateSetupSection, readActiveSetupSection } from "../voice/voiceNavigation";
import { isSpeakingOrRecentlySpoken } from "../voice/speechRegistry";

export interface SetupVoiceCommandProps {
  requestCamera: () => Promise<void>;
  stopCamera: () => void;
  onStartAlignment: () => void;
  onCancelAlignment: () => void;
  onRepeatGuidance: () => void;
  onCancelCountdown: () => void;
  onStartWorkout: () => void;
  onChooseDifficulty: (difficulty: string) => void;
  onAskAssistant?: (query: string) => void;
  isAlignmentOpen: boolean;
  isCountdownActive: boolean;
  isCameraStreamReady: boolean;
  isStarting: boolean;
}

export function useSetupVoiceCommands({
  requestCamera,
  stopCamera,
  onStartAlignment,
  onCancelAlignment,
  onRepeatGuidance,
  onCancelCountdown,
  onStartWorkout,
  onChooseDifficulty,
  onAskAssistant,
  isAlignmentOpen,
  isCountdownActive,
  isCameraStreamReady,
  isStarting,
}: SetupVoiceCommandProps) {
  const {
    status,
    lastResult,
    error,
    startListening,
    stopListening,
    clearLastResult,
  } = useSpeechRecognition();

  const [announcement, setAnnouncement] = useState<string | null>(null);
  const processedIdsRef = useRef<Set<string>>(new Set());

  // Speech helper using Web Speech API
  const speakText = (text: string) => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    if (!lastResult) return;
    if (processedIdsRef.current.has(lastResult.id)) return;
    processedIdsRef.current.add(lastResult.id);

    // Suspend or throttle processing when TTS is speaking or recently spoke (to avoid app echo)
    if (isSpeakingOrRecentlySpoken(lastResult.transcript)) {
      const tempCmd = parseSetupVoiceCommand(lastResult.transcript);
      const isPriority = tempCmd && (
        tempCmd.type === "cancel_alignment" ||
        tempCmd.type === "cancel_countdown" ||
        tempCmd.type === "stop_camera"
      );
      if (!isPriority) {
        clearLastResult();
        return;
      }
    }

    const cmd = parseSetupVoiceCommand(lastResult.transcript);
    if (!cmd) {
      const msg = `Unknown setup command: "${lastResult.transcript}"`;
      setAnnouncement(msg);
      // No spoken rejection to prevent spamming
      clearLastResult();
      return;
    }

    setAnnouncement(`Executed command: ${cmd.type}`);

    switch (cmd.type) {
      case "enable_camera":
        speakText("Enabling camera.");
        requestCamera();
        break;
      case "stop_camera":
        speakText("Stopping camera.");
        stopCamera();
        break;
      case "start_alignment":
        if (!isCameraStreamReady) {
          speakText("Please enable the camera first.");
          setAnnouncement("Alignment rejected: Camera is offline");
        } else {
          speakText("Starting alignment.");
          onStartAlignment();
        }
        break;
      case "cancel_alignment":
        if (!isAlignmentOpen) {
          speakText("Alignment mode is not open.");
          setAnnouncement("Command rejected: Alignment mode not open");
        } else {
          speakText("Returning to setup.");
          onCancelAlignment();
        }
        break;
      case "repeat_guidance":
        if (!isAlignmentOpen) {
          speakText("Alignment mode is not open.");
          setAnnouncement("Command rejected: Alignment mode not open");
        } else {
          onRepeatGuidance();
        }
        break;
      case "cancel_countdown":
        if (!isCountdownActive) {
          speakText("No active countdown.");
          setAnnouncement("Command rejected: No active countdown");
        } else {
          onCancelCountdown();
        }
        break;
      case "start_workout":
        if (isStarting) {
          speakText("Workout is already starting.");
        } else {
          speakText("Starting workout.");
          onStartWorkout();
        }
        break;
      case "choose_fresh":
        speakText("Difficulty set to fresh.");
        onChooseDifficulty("diff-fresh");
        break;
      case "choose_normal":
        speakText("Difficulty set to normal.");
        onChooseDifficulty("diff-norm");
        break;
      case "choose_tired":
        speakText("Difficulty set to tired.");
        onChooseDifficulty("diff-tired");
        break;
      case "ask_assistant":
        if (onAskAssistant && cmd.payload) {
          speakText(`Asking assistant: ${cmd.payload}`);
          onAskAssistant(cmd.payload);
        }
        break;
      case "scroll_down":
      case "scroll_up":
      case "page_down":
      case "page_up":
        if (isAlignmentOpen) {
          speakText("Scroll commands are disabled during alignment.");
        } else {
          executeScrollCommand(cmd.type);
        }
        break;
      case "next_section":
        if (isAlignmentOpen) {
          speakText("Navigation is disabled during alignment.");
        } else {
          navigateSetupSection("next");
        }
        break;
      case "previous_section":
        if (isAlignmentOpen) {
          speakText("Navigation is disabled during alignment.");
        } else {
          navigateSetupSection("prev");
        }
        break;
      case "read_current_section":
        if (isAlignmentOpen) {
          speakText("Guidance is repeated automatically. Speak repeat guidance if needed.");
        } else {
          readActiveSetupSection(speakText);
        }
        break;
      default:
        speakText("Command not supported.");
    }

    clearLastResult();
  }, [
    lastResult,
    requestCamera,
    stopCamera,
    onStartAlignment,
    onCancelAlignment,
    onRepeatGuidance,
    onCancelCountdown,
    onStartWorkout,
    onChooseDifficulty,
    onAskAssistant,
    isAlignmentOpen,
    isCountdownActive,
    isCameraStreamReady,
    isStarting,
    clearLastResult,
  ]);

  return {
    status,
    announcement,
    error,
    startListening,
    stopListening,
  };
}
