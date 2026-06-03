import { useState, useEffect } from "react";
import { SidecarManifest } from "@/types";
import { getSidecarManifest } from "@/lib/api";

/**
 * Custom React hook that fetches the prepared assistance sidecar manifest
 * once the video job is available and completed.
 */
export function useSidecarManifest(videoId: string | null, isJobCompleted: boolean) {
  const [manifest, setManifest] = useState<SidecarManifest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoId || !isJobCompleted) {
      setManifest(null);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    getSidecarManifest(videoId)
      .then((data) => {
        if (!active) return;
        setManifest(data);
        setIsLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error("Failed to fetch sidecar manifest:", err);
        setError(err.message || "Failed to load assistance sidecar manifest.");
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [videoId, isJobCompleted]);

  return { manifest, isLoading, error };
}
