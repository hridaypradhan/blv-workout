"use client";
/**
 * useLiveSessionAnnouncements.ts
 *
 * Fires screen-reader announcements in response to playback state changes
 * and artifact loading state transitions.
 */

import { useEffect, useRef } from "react";

interface UseLiveSessionAnnouncementsProps {
  isReady: boolean;
  isPlaying: boolean;
  isBuffering: boolean;
  hasEnded: boolean;
  playerError: string | null;
  youtubeId: string | null;
  isLoadingArtifacts: boolean;
  artifactsError: string | null;
  manifest: unknown;
  announce: (msg: string) => void;
}

export function useLiveSessionAnnouncements({
  isReady,
  isPlaying,
  isBuffering,
  hasEnded,
  playerError,
  youtubeId,
  isLoadingArtifacts,
  artifactsError,
  manifest,
  announce,
}: UseLiveSessionAnnouncementsProps) {
  // Playback state announcements
  const prevIsPlayingRef = useRef(false);
  useEffect(() => {
    if (playerError) {
      announce(`Trainer player error: ${playerError}`);
    } else if (hasEnded) {
      announce("Trainer video playback ended.");
    } else if (isBuffering) {
      announce("Trainer video is buffering.");
    } else if (isPlaying) {
      announce("Trainer video playback started.");
    } else if (!isPlaying && prevIsPlayingRef.current) {
      announce("Trainer video playback paused.");
    } else if (isReady) {
      announce("Trainer video player is ready.");
    } else if (!isReady && youtubeId) {
      announce("Loading trainer video player.");
    }
    prevIsPlayingRef.current = isPlaying;
  }, [isReady, isPlaying, isBuffering, hasEnded, playerError, youtubeId, announce]);

  // Artifact loading announcements
  const prevIsLoadingRef = useRef(false);
  const prevArtifactsErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (isLoadingArtifacts && !prevIsLoadingRef.current) {
      announce("Assisted playback session artifacts are loading.");
    }
    if (!isLoadingArtifacts && prevIsLoadingRef.current && manifest) {
      announce("Assisted playback session artifacts loaded successfully.");
    }
    if (artifactsError && artifactsError !== prevArtifactsErrorRef.current) {
      announce(`Failed to load assisted playback artifacts: ${artifactsError}`);
    }
    prevIsLoadingRef.current = isLoadingArtifacts;
    prevArtifactsErrorRef.current = artifactsError;
  }, [isLoadingArtifacts, manifest, artifactsError, announce]);
}
