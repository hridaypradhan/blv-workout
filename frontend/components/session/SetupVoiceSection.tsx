/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { SetupVoiceControlPanel } from "./SetupVoiceControlPanel";

export interface SetupVoiceSectionProps {
  setupVoice: any;
}

export function SetupVoiceSection({ setupVoice }: SetupVoiceSectionProps) {
  return (
    <section id="voice-control-section">
      <SetupVoiceControlPanel
        status={setupVoice.status}
        announcement={setupVoice.announcement}
        errorMessage={setupVoice.error}
        startListening={setupVoice.startListening}
        stopListening={setupVoice.stopListening}
      />
    </section>
  );
}
