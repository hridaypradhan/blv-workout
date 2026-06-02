"use client";

import { useState, useEffect } from "react";
import { getProcessingStatus } from "../api";
import { ProcessingStage } from "@/types";


export interface PreparedVideoData {
  isLoading: boolean;
  error: string | null;
  youtubeId: string | null;
  metadata: {
    title?: string;
    channel_name?: string;
    duration?: number;
  } | null;
  stage: ProcessingStage | null;
}

/** Hook to fetch and hold the preparation status and metadata of a video job. */
export function usePreparedVideo(videoId: string): PreparedVideoData {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [youtubeId, setYoutubeId] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<{
    title?: string;
    channel_name?: string;
    duration?: number;
  } | null>(null);
  const [stage, setStage] = useState<ProcessingStage | null>(null);

  useEffect(() => {
    let active = true;
    const fetchStatus = async () => {
      try {
        const job = await getProcessingStatus(videoId);
        if (!active) return;

        setStage(job.stage);
        if (job.stage === ProcessingStage.COMPLETED) {
          if (job.youtube_id) {
            setYoutubeId(job.youtube_id);
            setMetadata({
              title: job.title || undefined,
              channel_name: job.channel_name || undefined,
              duration: job.duration || undefined,
            });
          } else {
            setError("YouTube video ID unavailable for this prepared workout.");
          }
        } else if (job.stage === ProcessingStage.FAILED) {
          setError(job.error || "Workout assistance preparation failed.");
        }
      } catch (err: unknown) {
        if (!active) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(
          msg ||
            "Workout details could not be loaded. Please ensure the backend is running and that the video was imported."
        );
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    fetchStatus();

    return () => {
      active = false;
    };
  }, [videoId]);

  return { isLoading, error, youtubeId, metadata, stage };
}
