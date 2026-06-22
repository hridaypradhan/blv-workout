import { useState, useEffect } from "react";
import { AssistanceJob, SidecarManifest, CuePlan, TranscriptArtifact } from "@/types";
import { getProcessingStatus, getSidecarManifest, getCuePlan, getTranscript } from "@/lib/api";

interface SessionArtifacts {
  job: AssistanceJob;
  manifest: SidecarManifest;
  cuePlan: CuePlan;
  transcript: TranscriptArtifact;
}

// Module-scoped cache of promises for deduplication
const fetchCache: Record<string, Promise<SessionArtifacts> | undefined> = {};

export function getSessionArtifacts(videoId: string): Promise<SessionArtifacts> {
  const cached = fetchCache[videoId];
  if (cached) {
    return cached;
  }

  fetchCache[videoId] = Promise.all([
    getProcessingStatus(videoId),
    getSidecarManifest(videoId),
    getCuePlan(videoId),
    getTranscript(videoId),
  ]).then(([job, manifest, cuePlan, transcript]) => {
    return { job, manifest, cuePlan, transcript };
  });

  return fetchCache[videoId];
}

export function useSessionArtifacts(videoId: string | null) {
  const [artifacts, setArtifacts] = useState<SessionArtifacts | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoId) {
      setArtifacts(null);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    getSessionArtifacts(videoId)
      .then((data) => {
        if (!active) return;
        setArtifacts(data);
        setIsLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error("Failed to load session artifacts:", err);
        setError(err.message || "Failed to load session artifacts.");
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [videoId]);

  return {
    job: artifacts?.job || null,
    manifest: artifacts?.manifest || null,
    cuePlan: artifacts?.cuePlan || null,
    transcript: artifacts?.transcript || null,
    isLoading,
    error,
  };
}
