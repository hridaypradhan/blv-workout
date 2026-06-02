/**
 * Formats a session's started_at or ended_at date string into a human-readable date.
 * If verbose is true, returns a full date representation including weekday.
 */
export function formatSessionDate(dateStr: string | null | undefined, verbose = false): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (verbose) {
      return d.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Calculates and formats the duration between two dates (started_at and ended_at).
 */
export function formatSessionDuration(startStr: string | null | undefined, endStr: string | null | undefined): string {
  if (!startStr || !endStr) return "-";
  try {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return "-";
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.round((diffMs % 60000) / 1000);
    if (diffMins === 0) return `${diffSecs}s`;
    return `${diffMins}m ${diffSecs}s`;
  } catch {
    return "-";
  }
}

/**
 * Formats seconds into a M:SS play time readout.
 */
export function formatPlaybackTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

/**
 * Returns a shortened string of a video's ID.
 */
export function shortVideoId(videoId: string | null | undefined): string {
  return videoId ? videoId.substring(0, 8) : "Unknown";
}
