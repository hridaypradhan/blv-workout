"use client";

import { useState, useEffect, useRef } from "react";

export type PrototypeHapticState = "disconnected" | "connecting" | "connected";

export const HAPTIC_STORAGE_KEY = "fita11y_haptic_connection";
export const HAPTIC_EVENT_NAME = "fita11y:haptic-updated";
export const CONNECTION_DELAY = 1500;

export interface PrototypeSleeveStatus {
  key: string;
  name: string;
  label: string;
  paired: boolean;
  statusText: string;
  colorClass: string;
  styleState: "connected" | "connecting" | "offline";
}

export function usePrototypeHapticConnection() {
  const [hapticState, setHapticState] = useState<PrototypeHapticState>("disconnected");
  const [announcement, setAnnouncement] = useState<string>("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const checkState = () => {
      if (typeof window !== "undefined") {
        const val = localStorage.getItem(HAPTIC_STORAGE_KEY) as PrototypeHapticState;
        if (val === "disconnected" || val === "connecting" || val === "connected") {
          setHapticState(val);
        } else {
          setHapticState("disconnected");
        }
      }
    };

    checkState();

    if (typeof window !== "undefined") {
      window.addEventListener(HAPTIC_EVENT_NAME, checkState);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(HAPTIC_EVENT_NAME, checkState);
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const updateState = (newState: PrototypeHapticState, msg: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(HAPTIC_STORAGE_KEY, newState);
      window.dispatchEvent(new Event(HAPTIC_EVENT_NAME));
    }
    setHapticState(newState);
    setAnnouncement(msg);
  };

  const connect = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    updateState("connecting", "Haptic sleeve connecting (Prototype)...");

    timerRef.current = setTimeout(() => {
      updateState("connected", "Haptic sleeve connected (Prototype).");
      timerRef.current = null;
    }, CONNECTION_DELAY);
  };

  const disconnect = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    updateState("disconnected", "Haptic sleeve disconnected (Prototype).");
  };

  const toggleConnection = () => {
    if (hapticState === "connected" || hapticState === "connecting") {
      disconnect();
    } else {
      connect();
    }
  };

  const isConnected = hapticState === "connected";
  const isConnecting = hapticState === "connecting";

  const statusText =
    hapticState === "connected"
      ? "Connected (Prototype)"
      : hapticState === "connecting"
      ? "Connecting..."
      : "Disconnected";

  return {
    hapticState,
    isConnected,
    isConnecting,
    statusText,
    announcement,
    connect,
    disconnect,
    toggleConnection,
  };
}

export function getPrototypeSleeveStatuses(hapticState: PrototypeHapticState): PrototypeSleeveStatus[] {
  const isConnected = hapticState === "connected";
  const isConnecting = hapticState === "connecting";
  
  const statusText = isConnected 
    ? "Connected (Prototype)" 
    : isConnecting 
    ? "Connecting..." 
    : "Disconnected";
    
  const styleState = isConnected 
    ? "connected" 
    : isConnecting 
    ? "connecting" 
    : "offline";
    
  const colorClass = isConnected 
    ? "bg-emerald-500" 
    : isConnecting 
    ? "bg-yellow-500 animate-pulse" 
    : "bg-red-500";

  return [
    { key: "la", name: "Left Arm Sleeve", label: "LA", paired: isConnected, statusText, colorClass, styleState },
    { key: "ra", name: "Right Arm Sleeve", label: "RA", paired: isConnected, statusText, colorClass, styleState },
    { key: "ll", name: "Left Leg Band", label: "LL", paired: isConnected, statusText, colorClass, styleState },
    { key: "rl", name: "Right Leg Band", label: "RL", paired: isConnected, statusText, colorClass, styleState },
  ];
}
