"use client";
import React, { useEffect, useRef, useState } from "react";
import { SetupPositioningGuidePanel } from "./SetupPositioningGuidePanel";
import { CameraOrientation, BodyOrientation } from "@/lib/pose/positioningTypes";
import { VideoPreviewPane } from "./VideoPreviewPane";
import { CountdownOverlay } from "./CountdownOverlay";
import { GuidanceInstructionsPanel } from "./GuidanceInstructionsPanel";
import { GateFallbackControls } from "./GateFallbackControls";
import { CameraRecoveryPane } from "./CameraRecoveryPane";
import { CameraStreamStatus } from "@/lib/hooks/useCameraStream";

export interface CameraPositioningGateProps {
  isOpen: boolean;
  onClose: () => void;
  stream: MediaStream | null;
  requiredCameraOrientation: CameraOrientation;
  requiredBodyOrientation: BodyOrientation;
  onComplete: () => void;
  isActionPending: boolean;
  actionButtonLabel: string;
  title: string;
  subtitle: string;
  currentGuidance: string;
  onGuidanceChange: (guidance: string) => void;
  onReadyChange?: (isReady: boolean) => void;
  onCountdownActiveChange?: (isActive: boolean) => void;
  onCountdownCancelled?: () => void;
  cancelCountdownTrigger?: number;
  cameraStatus?: CameraStreamStatus;
  cameraErrorMessage?: string | null;
  cameraDevices?: MediaDeviceInfo[];
  selectedCameraDeviceId?: string;
  onRequestCamera?: (deviceId?: string, isExplicit?: boolean) => Promise<void>;
  onDisableCameraGatesForSession?: () => void;
  preferredCameraLabel?: string;
  announce?: (msg: string) => void;
}

const getActionableStatus = (status?: string) => {
  switch (status) {
    case "permission_denied":
      return "Camera permission blocked.";
    case "not_found":
      return "External webcam unavailable.";
    case "error":
      return "Camera is already in use.";
    case "idle":
      return "No camera stream is active.";
    case "unsupported":
      return "Your browser does not support camera feeds.";
    case "requesting":
      return "Requesting camera stream...";
    default:
      return "Camera not available.";
  }
};

export function CameraPositioningGate({
  isOpen,
  onClose,
  stream,
  requiredCameraOrientation,
  requiredBodyOrientation,
  onComplete,
  isActionPending,
  actionButtonLabel,
  title,
  subtitle,
  currentGuidance,
  onGuidanceChange,
  onReadyChange,
  onCountdownActiveChange,
  onCountdownCancelled,
  cancelCountdownTrigger = 0,
  cameraStatus = "ready",
  cameraErrorMessage,
  cameraDevices,
  selectedCameraDeviceId,
  onRequestCamera,
  onDisableCameraGatesForSession,
  preferredCameraLabel,
  announce,
}: CameraPositioningGateProps) {
  const [isReady, setIsReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Announce camera status diagnostic messages to screen reader
  useEffect(() => {
    if (isOpen) {
      const msg = getActionableStatus(cameraStatus);
      if (announce) {
        announce(msg);
      }
    }
  }, [isOpen, cameraStatus, announce]);

  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSpokenGuidanceRef = useRef("");
  const lastSpokenTimeRef = useRef(0);
  const countdownActiveRef = useRef(false);

  // Speak helper using Web Speech API
  const speakText = React.useCallback((text: string) => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const cancelSpeech = React.useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const clearCountdown = React.useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);
    if (countdownActiveRef.current) {
      countdownActiveRef.current = false;
      onCountdownActiveChange?.(false);
    }
  }, [onCountdownActiveChange]);

  // Announce guidance updates to screen reader and SpeechSynthesis
  const handleGuidanceChange = React.useCallback((guidance: string, readyStatus: boolean) => {
    onGuidanceChange(guidance);
    setIsReady(readyStatus);

    const now = Date.now();
    const elapsed = now - lastSpokenTimeRef.current;
    if (
      guidance !== lastSpokenGuidanceRef.current &&
      !readyStatus &&
      !countdownActiveRef.current &&
      elapsed >= 3000
    ) {
      lastSpokenGuidanceRef.current = guidance;
      lastSpokenTimeRef.current = now;
      speakText(guidance);
    }
  }, [onGuidanceChange, speakText]);

  // Repeat current alignment instructions
  const handleRepeatGuidance = React.useCallback(() => {
    if (countdownActiveRef.current && countdown !== null) {
      speakText(`Position confirmed. Starting in ${countdown}.`);
    } else {
      speakText(currentGuidance);
    }
  }, [currentGuidance, countdown, speakText]);

  // Bind stream to video preview element inside modal
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Propagate isReady status up to parent page
  useEffect(() => {
    onReadyChange?.(isReady);
  }, [isReady, onReadyChange]);

  // Handle countdown trigger and cancellation
  useEffect(() => {
    if (isReady && !countdownActiveRef.current && !isActionPending) {
      countdownActiveRef.current = true;
      onCountdownActiveChange?.(true);
      setCountdown(5);
      speakText("Position confirmed. Starting in 5, 4, 3, 2, 1.");

      let currentVal = 5;
      countdownIntervalRef.current = setInterval(() => {
        currentVal -= 1;
        if (currentVal > 0) {
          setCountdown(currentVal);
        } else {
          clearCountdown();
          onComplete();
        }
      }, 1000);
    } else if (!isReady && countdownActiveRef.current) {
      clearCountdown();
      onCountdownCancelled?.();
      speakText("Position lost. Resuming setup.");
    }
  }, [isReady, onComplete, isActionPending, onCountdownActiveChange, onCountdownCancelled, clearCountdown, speakText]);

  const handleCancelCountdown = React.useCallback(() => {
    clearCountdown();
    onCountdownCancelled?.();
    setIsReady(false);
    speakText("Countdown cancelled.");
  }, [clearCountdown, onCountdownCancelled, speakText]);

  // Listen to parent cancel countdown trigger
  useEffect(() => {
    if (cancelCountdownTrigger > 0) {
      handleCancelCountdown();
    }
  }, [cancelCountdownTrigger, handleCancelCountdown]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  // Trap focus & scroll management
  useEffect(() => {
    if (!isOpen) return;

    const previousActiveElement = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusableElements = modalRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    if (focusableElements && focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (countdown === null) {
          clearCountdown();
          cancelSpeech();
          onClose();
        }
      }

      if (e.key === "Tab") {
        if (!focusableElements || focusableElements.length === 0) return;
        const firstEl = focusableElements[0];
        const lastEl = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstEl) {
            lastEl.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastEl) {
            firstEl.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      if (previousActiveElement && typeof previousActiveElement.focus === "function") {
        previousActiveElement.focus();
      }
    };
  }, [isOpen, onClose, countdown, clearCountdown, cancelSpeech]);

  const handleClose = () => {
    clearCountdown();
    cancelSpeech();
    onClose();
  };

  const handleManualComplete = () => {
    clearCountdown();
    cancelSpeech();
    onComplete();
  };

  if (!isOpen) return null;

  const showRecoveryPane = !stream || cameraStatus !== "ready";

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="alignment-modal-title"
      className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white p-4 sm:p-6 md:p-8 overflow-y-auto"
    >
      <div className="max-w-4xl w-full mx-auto flex flex-col flex-1 gap-6">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-800 pb-4">
          <div>
            <h2 id="alignment-modal-title" className="text-xl font-extrabold tracking-tight">
              {title}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 font-bold rounded-xl text-sm border border-slate-700 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
            aria-label="Exit alignment mode and return to setup"
          >
            Cancel & Return
          </button>
        </div>

        {/* Main Content Area */}
        {showRecoveryPane ? (
          <CameraRecoveryPane
            cameraStatus={cameraStatus}
            cameraErrorMessage={cameraErrorMessage}
            cameraDevices={cameraDevices}
            selectedCameraDeviceId={selectedCameraDeviceId}
            preferredCameraLabel={preferredCameraLabel}
            onRequestCamera={onRequestCamera}
            onContinueWithoutCamera={handleClose}
            onDisableCameraGatesForSession={onDisableCameraGatesForSession}
            getActionableStatus={getActionableStatus}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 items-stretch">
            {/* Left Side: Video Stream Preview */}
            <VideoPreviewPane stream={stream} videoRef={videoRef}>
              <CountdownOverlay
                countdown={countdown}
                handleCancelCountdown={handleCancelCountdown}
              />
            </VideoPreviewPane>

            {/* Right Side: Instructions & Guides */}
            <div className="flex flex-col justify-between bg-slate-900/50 border border-slate-800/80 p-5 rounded-2xl gap-6">
              <GuidanceInstructionsPanel
                currentGuidance={currentGuidance}
                handleRepeatGuidance={handleRepeatGuidance}
              />

              {/* Hidden placement for MediaPipe logic hook */}
              <div className="hidden">
                <SetupPositioningGuidePanel
                  stream={stream}
                  requiredCameraOrientation={requiredCameraOrientation}
                  requiredBodyOrientation={requiredBodyOrientation}
                  onReadyChange={setIsReady}
                  onGuidanceChange={handleGuidanceChange}
                  isCountdownActive={countdown !== null}
                />
              </div>

              {/* Manual Fallback Action Block */}
              <GateFallbackControls
                handleManualComplete={handleManualComplete}
                isActionPending={isActionPending}
                actionButtonLabel={actionButtonLabel}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
