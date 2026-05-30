"use client";

import { useState } from "react";

export function useYouTubePlayer() {
  const [currentTime, setCurrentTime] = useState<number>(0);
  const duration = 0;
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackRate, setPlaybackRateState] = useState<number>(1.0);

  // TODO: Integrate with the standard YouTube IFrame Player API.
  // This hook will bind to the window.YT global instance, hook events,
  // and trigger state changes on pause/play/seek/rate-change.
  
  const play = () => {
    console.log("YouTube Play triggered via hook stub");
    setIsPlaying(true);
  };

  const pause = () => {
    console.log("YouTube Pause triggered via hook stub");
    setIsPlaying(false);
  };

  const seek = (seconds: number) => {
    console.log(`YouTube Seek to ${seconds}s triggered via hook stub`);
    setCurrentTime(seconds);
  };

  const setPlaybackRate = (rate: number) => {
    console.log(`YouTube SetPlaybackRate to ${rate}x triggered via hook stub`);
    setPlaybackRateState(rate);
  };

  return {
    currentTime,
    duration,
    isPlaying,
    playbackRate,
    play,
    pause,
    seek,
    setPlaybackRate,
  };
}
