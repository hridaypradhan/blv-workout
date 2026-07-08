"use client";
/**
 * useLiveSessionNavigation.ts
 *
 * Groups the four section navigation handlers that were previously inlined
 * on the live session page component.
 */

import React from "react";
import { SidecarManifest } from "@/types";
import { SESSION_EVENTS } from "@/lib/sessionEvents";

interface UseLiveSessionNavigationProps {
  manifest: SidecarManifest | null;
  currentTime: number;
  currentTimeMs: number;
  currentExercise: { name: string } | null;
  handleSeek: (seconds: number, reason?: string) => void;
  logSessionEvent: (eventType: string, timestampMs: number, payload?: Record<string, unknown>) => void;
  announce: (msg: string) => void;
}

interface UseLiveSessionNavigationReturn {
  handleRepeatTrainerInstruction: () => void;
  handleSkipSection: () => void;
  handlePreviousSection: () => void;
  handleReadCurrentSection: () => void;
}

export function useLiveSessionNavigation({
  manifest,
  currentTime,
  currentTimeMs,
  currentExercise,
  handleSeek,
  logSessionEvent,
  announce,
}: UseLiveSessionNavigationProps): UseLiveSessionNavigationReturn {
  const handleRepeatTrainerInstruction = React.useCallback(() => {
    if (!manifest || !manifest.trainer_instruction_events) return;
    const priorEvents = manifest.trainer_instruction_events.filter(
      (evt) => evt.start_ms !== null && evt.start_ms !== undefined && evt.start_ms <= currentTimeMs
    );
    if (priorEvents.length > 0) {
      priorEvents.sort((a, b) => (b.start_ms ?? 0) - (a.start_ms ?? 0));
      const latestEvent = priorEvents[0];
      if (latestEvent.start_ms !== null && latestEvent.start_ms !== undefined) {
        handleSeek(latestEvent.start_ms / 1000, `Repeating trainer instruction: "${latestEvent.text}"`);
        logSessionEvent(SESSION_EVENTS.TRAINER_INSTRUCTION_REPEATED, currentTimeMs, {
          text: latestEvent.text,
          timestamp_ms: latestEvent.start_ms,
        });
      }
    } else {
      announce("No prior trainer instructions found in this workout session.");
    }
  }, [manifest, currentTimeMs, handleSeek, logSessionEvent, announce]);

  const handleSkipSection = React.useCallback(() => {
    if (!manifest || !manifest.exercise_timeline_anchors) return;
    const nextAnchor = manifest.exercise_timeline_anchors.find(
      (anchor) => anchor.start_time_seconds > currentTime + 1.0
    );
    if (nextAnchor) {
      handleSeek(nextAnchor.start_time_seconds, `Skipped to section: ${nextAnchor.name}`);
      logSessionEvent(SESSION_EVENTS.SECTION_SKIPPED, currentTimeMs, {
        section_name: nextAnchor.name,
        start_time_seconds: nextAnchor.start_time_seconds,
      });
    } else {
      announce("No more exercise sections found in this workout.");
    }
  }, [manifest, currentTime, currentTimeMs, handleSeek, logSessionEvent, announce]);

  const handlePreviousSection = React.useCallback(() => {
    if (!manifest || !manifest.exercise_timeline_anchors) return;
    const currentIdx = manifest.exercise_timeline_anchors.findIndex(
      (anchor) => currentTime >= anchor.start_time_seconds && currentTime <= anchor.end_time_seconds
    );
    if (currentIdx > 0) {
      const prevAnchor = manifest.exercise_timeline_anchors[currentIdx - 1];
      handleSeek(prevAnchor.start_time_seconds, `Go back to section: ${prevAnchor.name}`);
      logSessionEvent(SESSION_EVENTS.SECTION_SKIPPED, currentTimeMs, {
        direction: "backward",
        section_name: prevAnchor.name,
        start_time_seconds: prevAnchor.start_time_seconds,
      });
    } else {
      announce("Already at the first exercise section.");
    }
  }, [manifest, currentTime, currentTimeMs, handleSeek, logSessionEvent, announce]);

  const handleReadCurrentSection = React.useCallback(() => {
    if (currentExercise) {
      announce(`We are currently on the ${currentExercise.name} exercise.`);
    } else {
      announce("No active exercise section currently playing.");
    }
  }, [currentExercise, announce]);

  return {
    handleRepeatTrainerInstruction,
    handleSkipSection,
    handlePreviousSection,
    handleReadCurrentSection,
  };
}
