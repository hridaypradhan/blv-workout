/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import PerformanceSummaryPanel from "./PerformanceSummaryPanel";
import CurrentAutomaticCuePanel from "./CurrentAutomaticCuePanel";
import VoiceControlPanel from "./VoiceControlPanel";
import LiveHapticStatusPanel from "./LiveHapticStatusPanel";
import QnAChatPanel from "./QnAChatPanel";

export interface LiveSessionSidebarProps {
  currentExercise: any;
  latestRepCount: number;
  currentTime: number;
  formatTime: (seconds: number) => string;
  latestAutomaticCue: any;
  isAutomaticCueActive: boolean;
  isLoadingArtifacts: boolean;
  artifactsError: string | null;
  voiceStatus: any;
  startVoice: () => void;
  stopVoice: () => void;
  voiceLastTranscript: string;
  voiceError: any;
  deviceStatuses: any;
  recentEvents: any;
  hapticStatusText: string;
  qaMessages: any;
  chatInput: string;
  setChatInput: (input: string) => void;
  isPending: boolean;
  qaError: any;
  handleSendMessage: (e: React.FormEvent) => void;
}

export function LiveSessionSidebar({
  currentExercise,
  latestRepCount,
  currentTime,
  formatTime,
  latestAutomaticCue,
  isAutomaticCueActive,
  isLoadingArtifacts,
  artifactsError,
  voiceStatus,
  startVoice,
  stopVoice,
  voiceLastTranscript,
  voiceError,
  deviceStatuses,
  recentEvents,
  hapticStatusText,
  qaMessages,
  chatInput,
  setChatInput,
  isPending,
  qaError,
  handleSendMessage,
}: LiveSessionSidebarProps) {
  return (
    <div className="lg:col-span-4 flex flex-col gap-6 order-1 lg:order-2">
      <PerformanceSummaryPanel
        currentExercise={currentExercise}
        lastHandledRep={latestRepCount}
        currentTime={currentTime}
        formatTime={formatTime}
      />

      <CurrentAutomaticCuePanel
        latestAutomaticCue={latestAutomaticCue}
        isAutomaticCueActive={isAutomaticCueActive}
        formatTime={formatTime}
        isLoadingCuePlan={isLoadingArtifacts}
        cuePlanError={artifactsError}
        isLoadingManifest={isLoadingArtifacts}
        manifestError={artifactsError}
      />

      <VoiceControlPanel
        voiceStatus={voiceStatus}
        startVoice={startVoice}
        stopVoice={stopVoice}
        lastTranscript={voiceLastTranscript}
        voiceError={voiceError}
      />

      <LiveHapticStatusPanel
        deviceStatuses={deviceStatuses}
        recentEvents={recentEvents}
        hapticStatusText={hapticStatusText}
      />

      <QnAChatPanel
        qaMessages={qaMessages}
        chatInput={chatInput}
        setChatInput={setChatInput}
        isPending={isPending}
        qaError={qaError}
        handleSendMessage={handleSendMessage}
      />
    </div>
  );
}
