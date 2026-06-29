/**
 * Typed discriminated union for all voice commands recognized by the parser.
 * Pure data types — no React, no browser APIs.
 */

export type VoiceCommandType =
  | "pause"
  | "resume"
  | "rewind"
  | "forward"
  | "slow_down"
  | "normal_speed"
  | "speed_up"
  | "next_section"
  | "repeat_instruction"
  | "mute_assistant"
  | "unmute_assistant"
  | "ask_question"
  | "end_session"
  | "rejected";

export interface PauseCommand {
  type: "pause";
}

export interface ResumeCommand {
  type: "resume";
}

export interface RewindCommand {
  type: "rewind";
  seconds: number;
}

export interface ForwardCommand {
  type: "forward";
  seconds: number;
}

export interface SlowDownCommand {
  type: "slow_down";
}

export interface NormalSpeedCommand {
  type: "normal_speed";
}

export interface SpeedUpCommand {
  type: "speed_up";
}

export interface NextSectionCommand {
  type: "next_section";
}

export interface RepeatInstructionCommand {
  type: "repeat_instruction";
}

export interface MuteAssistantCommand {
  type: "mute_assistant";
}

export interface UnmuteAssistantCommand {
  type: "unmute_assistant";
}

export interface AskQuestionCommand {
  type: "ask_question";
  question: string;
}

export interface EndSessionCommand {
  type: "end_session";
  confirmationNeeded: true;
}

export interface RejectedCommand {
  type: "rejected";
  reason: "empty" | "too_short" | "unrecognized";
  transcript: string;
}

export type VoiceCommand =
  | PauseCommand
  | ResumeCommand
  | RewindCommand
  | ForwardCommand
  | SlowDownCommand
  | NormalSpeedCommand
  | SpeedUpCommand
  | NextSectionCommand
  | RepeatInstructionCommand
  | MuteAssistantCommand
  | UnmuteAssistantCommand
  | AskQuestionCommand
  | EndSessionCommand
  | RejectedCommand;
