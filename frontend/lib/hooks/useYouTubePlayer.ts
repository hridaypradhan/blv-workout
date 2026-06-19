"use client";

import { useEffect, useRef, useState } from "react";

export interface YTEvent {
  target: YTPlayer;
  data: number;
}

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setPlaybackRate(suggestedRate: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlaybackRate(): number;
  getIframe(): HTMLIFrameElement;
  destroy(): void;
  getVolume(): number;
  setVolume(volume: number): void;
  isMuted(): boolean;
  mute(): void;
  unMute(): void;
}

export interface YTPlayerOptions {
  width?: string | number;
  height?: string | number;
  videoId: string;
  playerVars?: {
    enablejsapi?: number;
    playsinline?: number;
    modestbranding?: number;
    rel?: number;
    origin?: string;
  };
  events?: {
    onReady?: (event: YTEvent) => void;
    onStateChange?: (event: YTEvent) => void;
    onPlaybackRateChange?: (event: YTEvent) => void;
    onError?: (event: YTEvent) => void;
  };
}

export interface YTGlobal {
  Player: new (element: HTMLElement | string, options: YTPlayerOptions) => YTPlayer;
  PlayerState: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
}

declare global {
  interface Window {
    YT?: YTGlobal;
    onYouTubeIframeAPIReady?: () => void;
    __ytIframeAPIReadyPromise?: Promise<void>;
  }
}

/**
 * Loads the YouTube IFrame API script exactly once.
 * Reuses a single Promise saved globally on the window object to handle multiple mounts safely.
 */
const loadYouTubeIframeAPI = (): Promise<void> => {
  if (typeof window === "undefined") return Promise.resolve();

  if (window.YT && window.YT.Player) {
    return Promise.resolve();
  }

  if (window.__ytIframeAPIReadyPromise) {
    return window.__ytIframeAPIReadyPromise;
  }

  const promise = new Promise<void>((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let resolved = false;

    // Timeout after 10 seconds if API never becomes ready
    timeoutId = setTimeout(() => {
      window.__ytIframeAPIReadyPromise = undefined;
      if (!resolved) {
        resolved = true;
        reject(new Error("YouTube API load timed out."));
      }
    }, 10000);

    const previousAPIReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (previousAPIReady) {
        previousAPIReady();
      }
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";

    // Handle script load failures
    tag.onerror = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      window.__ytIframeAPIReadyPromise = undefined;
      if (!resolved) {
        resolved = true;
        reject(new Error("Failed to load YouTube script."));
      }
    };

    const firstScriptTag = document.getElementsByTagName("script")[0];
    if (firstScriptTag && firstScriptTag.parentNode) {
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    } else {
      document.head.appendChild(tag);
    }
  });

  window.__ytIframeAPIReadyPromise = promise;
  return promise;
};

export function useYouTubePlayer(videoId: string | null) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoId) {
      // Clear player state if videoId becomes null/undefined
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // Ignore destroy errors
        }
        playerRef.current = null;
      }
      setIsReady(false);
      setIsPlaying(false);
      setIsBuffering(false);
      setHasEnded(false);
      setCurrentTime(0);
      setDuration(0);
      setPlaybackRate(1.0);
      setError(null);
      return;
    }

    let active = true;
    let localPlayer: YTPlayer | null = null;

    const initPlayer = async () => {
      try {
        await loadYouTubeIframeAPI();
        if (!active) return;
        if (!containerRef.current) return;

        // Clean up previous contents inside container (if any)
        containerRef.current.innerHTML = "";

        // Create a placeholder child element that the YouTube API replaces
        const mountDiv = document.createElement("div");
        containerRef.current.appendChild(mountDiv);

        if (!window.YT) {
          throw new Error("YouTube API global is not available.");
        }

        localPlayer = new window.YT.Player(mountDiv, {
          width: "100%",
          height: "100%",
          videoId: videoId,
          playerVars: {
            enablejsapi: 1,
            playsinline: 1,
            modestbranding: 1,
            rel: 0,
            origin: typeof window !== "undefined" ? window.location.origin : undefined,
          },
          events: {
            onReady: (event: YTEvent) => {
              if (!active) return;
              setIsReady(true);
              setError(null);
              if (event.target.getDuration) {
                setDuration(event.target.getDuration());
              }
              if (event.target.getPlaybackRate) {
                setPlaybackRate(event.target.getPlaybackRate());
              }
              try {
                if (event.target.getIframe) {
                  const iframe = event.target.getIframe();
                  if (iframe) {
                    iframe.style.width = "100%";
                    iframe.style.height = "100%";
                    iframe.style.display = "block";
                    iframe.style.position = "absolute";
                    iframe.style.top = "0";
                    iframe.style.left = "0";
                  }
                }
              } catch {
                // Ignore transient errors
              }
            },
            onStateChange: (event: YTEvent) => {
              if (!active) return;
              const state = event.data;
              const ytStates = window.YT?.PlayerState;
              if (ytStates) {
                setIsPlaying(state === ytStates.PLAYING);
                setIsBuffering(state === ytStates.BUFFERING);
                setHasEnded(state === ytStates.ENDED);
              }
            },
            onPlaybackRateChange: (event: YTEvent) => {
              if (!active) return;
              setPlaybackRate(event.data);
            },
            onError: (event: YTEvent) => {
              if (!active) return;
              const errorCode = event.data;
              let message = "An error occurred with the YouTube player.";
              if (errorCode === 2) {
                message = "Invalid video parameter.";
              } else if (errorCode === 5) {
                message = "The requested video cannot be played in this player.";
              } else if (errorCode === 100) {
                message = "The requested YouTube video was not found.";
              } else if (errorCode === 101 || errorCode === 150) {
                message = "This video does not allow embedded playback.";
              }
              setError(message);
            },
          },
        });

        playerRef.current = localPlayer;
      } catch {
        if (active) {
          setError("Failed to load the YouTube Player API.");
        }
      }
    };

    initPlayer();

    return () => {
      active = false;
      if (localPlayer && localPlayer.destroy) {
        try {
          localPlayer.destroy();
        } catch {
          // Ignore destroy errors
        }
      }
      playerRef.current = null;
      setIsReady(false);
      setIsPlaying(false);
      setIsBuffering(false);
      setHasEnded(false);
      setCurrentTime(0);
      setDuration(0);
      setPlaybackRate(1.0);
      setError(null);
    };
  }, [videoId]);

  // Poll for current playback time & duration periodically while player exists
  useEffect(() => {
    let active = true;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const poll = () => {
      if (!active) return;
      if (playerRef.current && isReady) {
        try {
          if (playerRef.current.getCurrentTime) {
            setCurrentTime(playerRef.current.getCurrentTime());
          }
          if (playerRef.current.getDuration) {
            setDuration(playerRef.current.getDuration());
          }
        } catch {
          // ignore transient issues
        }
      }
      timerId = setTimeout(poll, 250);
    };

    poll();

    return () => {
      active = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [isReady, videoId]);

  const play = () => {
    if (playerRef.current && isReady && playerRef.current.playVideo) {
      playerRef.current.playVideo();
    }
  };

  const pause = () => {
    if (playerRef.current && isReady && playerRef.current.pauseVideo) {
      playerRef.current.pauseVideo();
    }
  };

  const seek = (seconds: number) => {
    if (playerRef.current && isReady && playerRef.current.seekTo) {
      playerRef.current.seekTo(seconds, true);
      setCurrentTime(seconds);
    }
  };

  const setPlaybackRateState = (rate: number) => {
    if (playerRef.current && isReady && playerRef.current.setPlaybackRate) {
      playerRef.current.setPlaybackRate(rate);
    }
  };

  const getVolume = () => {
    if (playerRef.current && isReady && playerRef.current.getVolume) {
      try {
        return playerRef.current.getVolume();
      } catch {
        return null;
      }
    }
    return null;
  };

  const setVolume = (volume: number) => {
    if (playerRef.current && isReady && playerRef.current.setVolume) {
      try {
        const clamped = Math.max(0, Math.min(100, volume));
        playerRef.current.setVolume(clamped);
      } catch {
        // ignore errors
      }
    }
  };

  const isPlayerMuted = () => {
    if (playerRef.current && isReady && playerRef.current.isMuted) {
      try {
        return playerRef.current.isMuted();
      } catch {
        return null;
      }
    }
    return null;
  };

  return {
    containerRef,
    isReady,
    isPlaying,
    isBuffering,
    hasEnded,
    currentTime,
    duration,
    playbackRate,
    error,
    play,
    pause,
    seek,
    setPlaybackRate: setPlaybackRateState,
    getVolume,
    setVolume,
    isPlayerMuted,
  };
}
