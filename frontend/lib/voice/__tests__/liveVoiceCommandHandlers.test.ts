/**
 * Tests for liveVoiceCommandHandlers.ts pure handler functions.
 * No React, no mocks needed for the main logic — just plain function calls.
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import {
  handlePlaybackCommand,
  handleNavigationCommand,
  handleSpeechCommand,
  handleQnACommand,
  handleCameraCommand,
} from "../liveVoiceCommandHandlers";
import { SESSION_EVENTS } from "@/lib/sessionEvents";
import { PauseOwner } from "@/lib/hooks/usePlaybackPauseCoordinator";

// ---------------------------------------------------------------------------
// Shared mock factories
// ---------------------------------------------------------------------------

function makeMockLog() {
  return vi.fn();
}
function makeMockAnnounce() {
  return vi.fn();
}

// ---------------------------------------------------------------------------
// handlePlaybackCommand
// ---------------------------------------------------------------------------

describe("handlePlaybackCommand", () => {
  let pause: ReturnType<typeof vi.fn>;
  let play: ReturnType<typeof vi.fn>;
  let seek: ReturnType<typeof vi.fn>;
  let setPlaybackRate: ReturnType<typeof vi.fn>;
  let announce: ReturnType<typeof vi.fn>;
  let logSessionEvent: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    pause = vi.fn();
    play = vi.fn();
    seek = vi.fn();
    setPlaybackRate = vi.fn();
    announce = makeMockAnnounce();
    logSessionEvent = makeMockLog();
  });

  const deps = () => ({ pause, play, seek, setPlaybackRate, announce, logSessionEvent });

  test("pause command calls pause() and announces", () => {
    const handled = handlePlaybackCommand({ type: "pause" }, 1000, 30, deps());
    expect(handled).toBe(true);
    expect(pause).toHaveBeenCalledOnce();
    expect(announce).toHaveBeenCalledWith("Paused.");
    expect(logSessionEvent).toHaveBeenCalledWith(
      SESSION_EVENTS.VOICE_COMMAND_EXECUTED,
      1000,
      expect.objectContaining({ command: "pause" })
    );
  });

  test("resume command calls play() and announces", () => {
    const handled = handlePlaybackCommand({ type: "resume" }, 1000, 30, { ...deps(), activeOwners: new Set() });
    expect(handled).toBe(true);
    expect(play).toHaveBeenCalledOnce();
    expect(announce).toHaveBeenCalledWith("Resumed.");
  });

  test("resume command is blocked by positioning_gate", () => {
    const activeOwners = new Set<PauseOwner>(["positioning_gate"]);
    const handled = handlePlaybackCommand({ type: "resume" }, 1000, 30, { ...deps(), activeOwners });
    expect(handled).toBe(true);
    expect(play).not.toHaveBeenCalled();
    expect(announce).toHaveBeenCalledWith("Alignment is active. Say skip alignment or finish alignment first.");
    expect(logSessionEvent).toHaveBeenCalledWith(
      SESSION_EVENTS.VOICE_COMMAND_BLOCKED,
      1000,
      expect.objectContaining({ reason: "positioning_gate_active" })
    );
  });

  test("resume command is blocked by assistant_speech", () => {
    const activeOwners = new Set<PauseOwner>(["assistant_speech"]);
    const handled = handlePlaybackCommand({ type: "resume" }, 1000, 30, { ...deps(), activeOwners });
    expect(handled).toBe(true);
    expect(play).not.toHaveBeenCalled();
    expect(announce).toHaveBeenCalledWith("Playback is paused for assistant speech.");
  });

  test("rewind command seeks backward by given seconds", () => {
    const handled = handlePlaybackCommand({ type: "rewind", seconds: 10 }, 5000, 30, deps());
    expect(handled).toBe(true);
    expect(seek).toHaveBeenCalledWith(20, expect.stringContaining("10 seconds"));
  });

  test("rewind clamps to 0 when seeking before start", () => {
    handlePlaybackCommand({ type: "rewind", seconds: 60 }, 5000, 10, deps());
    expect(seek).toHaveBeenCalledWith(0, expect.any(String));
  });

  test("forward command seeks forward by given seconds", () => {
    const handled = handlePlaybackCommand({ type: "forward", seconds: 15 }, 5000, 30, deps());
    expect(handled).toBe(true);
    expect(seek).toHaveBeenCalledWith(45, expect.any(String));
  });

  test("slow_down decreases rate by 0.25", () => {
    handlePlaybackCommand({ type: "slow_down" }, 1000, 30, { ...deps(), playbackRate: 1.0 });
    expect(setPlaybackRate).toHaveBeenCalledWith(0.75);
  });

  test("slow_down clamps rate to 0.5", () => {
    handlePlaybackCommand({ type: "slow_down" }, 1000, 30, { ...deps(), playbackRate: 0.5 });
    expect(setPlaybackRate).toHaveBeenCalledWith(0.5);
  });

  test("normal_speed sets rate to 1.0", () => {
    handlePlaybackCommand({ type: "normal_speed" }, 1000, 30, deps());
    expect(setPlaybackRate).toHaveBeenCalledWith(1.0);
  });

  test("speed_up increases rate by 0.25", () => {
    handlePlaybackCommand({ type: "speed_up" }, 1000, 30, { ...deps(), playbackRate: 1.0 });
    expect(setPlaybackRate).toHaveBeenCalledWith(1.25);
  });

  test("speed_up clamps rate to 2.0", () => {
    handlePlaybackCommand({ type: "speed_up" }, 1000, 30, { ...deps(), playbackRate: 2.0 });
    expect(setPlaybackRate).toHaveBeenCalledWith(2.0);
  });

  test("unknown command type returns false", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handled = handlePlaybackCommand({ type: "ask_question" as any, question: "?" }, 1000, 30, deps());
    expect(handled).toBe(false);
    expect(pause).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// handleNavigationCommand
// ---------------------------------------------------------------------------

describe("handleNavigationCommand", () => {
  let handleSkipSection: ReturnType<typeof vi.fn>;
  let handlePreviousSection: ReturnType<typeof vi.fn>;
  let handleReadCurrentSection: ReturnType<typeof vi.fn>;
  let announce: ReturnType<typeof vi.fn>;
  let logSessionEvent: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    handleSkipSection = vi.fn();
    handlePreviousSection = vi.fn();
    handleReadCurrentSection = vi.fn();
    announce = makeMockAnnounce();
    logSessionEvent = makeMockLog();
  });

  const deps = (isGateOpen = false) => ({
    handleSkipSection,
    handlePreviousSection,
    handleReadCurrentSection,
    announce,
    logSessionEvent,
    isGateOpen,
  });

  test("next_section calls handleSkipSection", () => {
    handleNavigationCommand({ type: "next_section" }, 1000, deps());
    expect(handleSkipSection).toHaveBeenCalledOnce();
  });

  test("previous_section calls handlePreviousSection when gate is closed", () => {
    handleNavigationCommand({ type: "previous_section" }, 1000, deps(false));
    expect(handlePreviousSection).toHaveBeenCalledOnce();
  });

  test("previous_section announces disabled message when gate is open", () => {
    handleNavigationCommand({ type: "previous_section" }, 1000, deps(true));
    expect(handlePreviousSection).not.toHaveBeenCalled();
    expect(announce).toHaveBeenCalledWith(expect.stringContaining("disabled"));
  });

  test("scroll_down announces disabled message when gate is open", () => {
    handleNavigationCommand({ type: "scroll_down" }, 1000, deps(true));
    expect(announce).toHaveBeenCalledWith(expect.stringContaining("disabled"));
  });
});

// ---------------------------------------------------------------------------
// handleSpeechCommand
// ---------------------------------------------------------------------------

describe("handleSpeechCommand", () => {
  let setAssistantMuted: ReturnType<typeof vi.fn>;
  let handleRepeatTrainerInstruction: ReturnType<typeof vi.fn>;
  let onRepeatGuidance: ReturnType<typeof vi.fn>;
  let onCancelCountdown: ReturnType<typeof vi.fn>;
  let onSkipAlignment: ReturnType<typeof vi.fn>;
  let announce: ReturnType<typeof vi.fn>;
  let logSessionEvent: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setAssistantMuted = vi.fn();
    handleRepeatTrainerInstruction = vi.fn();
    onRepeatGuidance = vi.fn();
    onCancelCountdown = vi.fn();
    onSkipAlignment = vi.fn();
    announce = makeMockAnnounce();
    logSessionEvent = makeMockLog();
  });

  const deps = (opts: { isGateOpen?: boolean; isCountdownActive?: boolean } = {}) => ({
    setAssistantMuted,
    handleRepeatTrainerInstruction,
    onRepeatGuidance,
    onCancelCountdown,
    onSkipAlignment,
    announce,
    logSessionEvent,
    isGateOpen: opts.isGateOpen ?? false,
    isCountdownActive: opts.isCountdownActive ?? false,
  });

  test("mute_assistant calls setAssistantMuted(true)", () => {
    handleSpeechCommand({ type: "mute_assistant" }, 1000, deps());
    expect(setAssistantMuted).toHaveBeenCalledWith(true);
  });

  test("unmute_assistant calls setAssistantMuted(false)", () => {
    handleSpeechCommand({ type: "unmute_assistant" }, 1000, deps());
    expect(setAssistantMuted).toHaveBeenCalledWith(false);
  });

  test("repeat_instruction calls onRepeatGuidance when gate is open", () => {
    handleSpeechCommand({ type: "repeat_instruction" }, 1000, deps({ isGateOpen: true }));
    expect(onRepeatGuidance).toHaveBeenCalledOnce();
    expect(handleRepeatTrainerInstruction).not.toHaveBeenCalled();
  });

  test("repeat_instruction calls handleRepeatTrainerInstruction when gate is closed", () => {
    handleSpeechCommand({ type: "repeat_instruction" }, 1000, deps({ isGateOpen: false }));
    expect(handleRepeatTrainerInstruction).toHaveBeenCalledOnce();
    expect(onRepeatGuidance).not.toHaveBeenCalled();
  });

  test("cancel_countdown calls onCancelCountdown when countdown is active", () => {
    handleSpeechCommand({ type: "cancel_countdown" }, 1000, deps({ isCountdownActive: true }));
    expect(onCancelCountdown).toHaveBeenCalledOnce();
  });

  test("cancel_countdown announces 'No active countdown' when not active", () => {
    handleSpeechCommand({ type: "cancel_countdown" }, 1000, deps({ isCountdownActive: false }));
    expect(onCancelCountdown).not.toHaveBeenCalled();
    expect(announce).toHaveBeenCalledWith("No active countdown.");
  });

  test("skip_alignment calls onSkipAlignment when gate is open", () => {
    handleSpeechCommand({ type: "skip_alignment" }, 1000, deps({ isGateOpen: true }));
    expect(onSkipAlignment).toHaveBeenCalledOnce();
  });

  test("skip_alignment announces gate not active when gate is closed", () => {
    handleSpeechCommand({ type: "skip_alignment" }, 1000, deps({ isGateOpen: false }));
    expect(onSkipAlignment).not.toHaveBeenCalled();
    expect(announce).toHaveBeenCalledWith("Positioning gate is not active.");
  });
});

// ---------------------------------------------------------------------------
// handleQnACommand
// ---------------------------------------------------------------------------

describe("handleQnACommand", () => {
  let submitQuestion: ReturnType<typeof vi.fn>;
  let announce: ReturnType<typeof vi.fn>;
  let logSessionEvent: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    submitQuestion = vi.fn().mockResolvedValue(undefined);
    announce = makeMockAnnounce();
    logSessionEvent = makeMockLog();
  });

  const deps = (isQnAPending = false) => ({
    submitQuestion,
    announce,
    logSessionEvent,
    isQnAPending,
  });

  test("ask_question calls submitQuestion when not pending", () => {
    handleQnACommand({ type: "ask_question", question: "How do I squat?" }, 1000, deps(false));
    expect(submitQuestion).toHaveBeenCalledWith("How do I squat?", "voice");
  });

  test("ask_question announces wait message when pending", () => {
    handleQnACommand({ type: "ask_question", question: "How do I squat?" }, 1000, deps(true));
    expect(submitQuestion).not.toHaveBeenCalled();
    expect(announce).toHaveBeenCalledWith(expect.stringContaining("wait"));
  });

  test("end_session announces button instruction", () => {
    handleQnACommand({ type: "end_session" }, 1000, deps());
    expect(announce).toHaveBeenCalledWith(expect.stringContaining("End & Save Session"));
  });
});

// ---------------------------------------------------------------------------
// handleCameraCommand
// ---------------------------------------------------------------------------

describe("handleCameraCommand", () => {
  let requestCamera: ReturnType<typeof vi.fn>;
  let announce: ReturnType<typeof vi.fn>;
  let logSessionEvent: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    requestCamera = vi.fn().mockResolvedValue(undefined);
    announce = makeMockAnnounce();
    logSessionEvent = makeMockLog();
  });

  const deps = (devices: Partial<MediaDeviceInfo>[] = [], activeId?: string) => ({
    cameraDevices: devices as MediaDeviceInfo[],
    selectedCameraDeviceId: activeId,
    requestCamera,
    announce,
    logSessionEvent,
  });

  test("returns false for non change_camera command types", () => {
    const handled = handleCameraCommand({ type: "pause" }, 1000, deps());
    expect(handled).toBe(false);
    expect(requestCamera).not.toHaveBeenCalled();
  });

  test("announces not available when requestCamera is missing", () => {
    const handled = handleCameraCommand(
      { type: "change_camera", target: "next" },
      1000,
      { cameraDevices: [], selectedCameraDeviceId: "", requestCamera: undefined, announce, logSessionEvent }
    );
    expect(handled).toBe(true);
    expect(announce).toHaveBeenCalledWith("Camera switching is not available.");
  });

  test("cycles to the next camera device on target next", () => {
    const devices = [
      { deviceId: "cam-1", label: "Integrated Camera" },
      { deviceId: "cam-2", label: "Logitech Webcam" },
    ];
    const handled = handleCameraCommand(
      { type: "change_camera", target: "next" },
      1000,
      deps(devices, "cam-1")
    );
    expect(handled).toBe(true);
    expect(requestCamera).toHaveBeenCalledWith("cam-2");
    expect(announce).toHaveBeenCalledWith(expect.stringContaining("Logitech Webcam"));
  });

  test("switches to external camera when requested and available", () => {
    const devices = [
      { deviceId: "cam-1", label: "Built-in FaceTime HD Camera" },
      { deviceId: "cam-2", label: "Logitech StreamCam" },
    ];
    const handled = handleCameraCommand(
      { type: "change_camera", target: "external" },
      1000,
      deps(devices, "cam-1")
    );
    expect(handled).toBe(true);
    expect(requestCamera).toHaveBeenCalledWith("cam-2");
    expect(announce).toHaveBeenCalledWith(expect.stringContaining("Logitech StreamCam"));
  });

  test("announces no external camera found when only integrated is available", () => {
    const devices = [
      { deviceId: "cam-1", label: "Integrated FaceTime HD Camera" },
    ];
    const handled = handleCameraCommand(
      { type: "change_camera", target: "external" },
      1000,
      deps(devices, "cam-1")
    );
    expect(handled).toBe(true);
    expect(requestCamera).not.toHaveBeenCalled();
    expect(announce).toHaveBeenCalledWith("No external camera was found.");
  });
});
