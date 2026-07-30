/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import LiveSessionPage from "../page";
import { SESSION_EVENTS } from "@/lib/sessionEvents";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => {
      if (key === "sessionId") return "session-123";
      return null;
    },
  }),
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => "/session/video-123",
}));

// Mock layout context
vi.mock("@/components/layout/LayoutContext", () => ({
  LayoutProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useLayout: () => ({ sidebarCollapsed: false }),
}));

// Mock user profile context
const mockUser = {
  haptic_preferences: {},
  voice_settings: {},
  feedback_modalities: ["audio"],
  audio_coexistence: {
    interruption_level: "brief_speech",
    assistant_verbosity: "moderate",
    pause_before_speaking: true,
    correction_frequency: "medium",
  },
};
vi.mock("@/components/layout/UserProfileContext", () => ({
  useUserProfile: () => ({ user: mockUser }),
  UserProfileProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock artifacts loading with exercise anchors
const mockManifest = {
  exercise_timeline_anchors: [
    { id: "ex-1", name: "Bicep Curl", start_time_seconds: 10, end_time_seconds: 20, counting_joint: "elbow" },
    { id: "ex-2", name: "Squats", start_time_seconds: 30, end_time_seconds: 40, counting_joint: "knee" },
  ],
  trainer_instruction_events: [],
};

const mockUseSessionArtifacts = vi.fn(() => ({
  job: { youtube_id: "yt-123", stage: "completed" },
  manifest: mockManifest,
  cuePlan: { cue_candidates: [] },
  transcript: null,
  isLoading: false,
  error: null,
}));

vi.mock("@/lib/hooks/useSessionArtifacts", () => ({
  useSessionArtifacts: () => mockUseSessionArtifacts(),
}));

// Mock youtube player
const mockPlay = vi.fn();
const mockPause = vi.fn();
const mockSeek = vi.fn();
let mockCurrentTime = 0;

const mockUseYouTubePlayer = vi.fn(() => ({
  containerRef: { current: null },
  isReady: true,
  isPlaying: true, // Initially playing
  isBuffering: false,
  hasEnded: false,
  currentTime: mockCurrentTime,
  duration: 100,
  playbackRate: 1.0,
  error: null,
  play: mockPlay,
  pause: mockPause,
  seek: mockSeek,
  setPlaybackRate: vi.fn(),
  getVolume: vi.fn(() => 50),
  setVolume: vi.fn(),
  isPlayerMuted: vi.fn(() => false),
}));

vi.mock("@/lib/hooks/useYouTubePlayer", () => ({
  useYouTubePlayer: () => mockUseYouTubePlayer(),
}));

// Mock telemetry and haptic hooks
const mockLogSessionEvent = vi.fn();
vi.mock("@/lib/hooks/useSessionTelemetry", () => ({
  useSessionTelemetry: () => ({ logSessionEvent: mockLogSessionEvent, getBufferedEvents: vi.fn(() => []) }),
}));

const mockTriggerHapticEvent = vi.fn().mockImplementation(() => Promise.resolve());
vi.mock("@/lib/hooks/useHapticEventDelivery", () => ({
  useHapticEventDelivery: () => ({ recentEvents: [], triggerHapticEvent: mockTriggerHapticEvent }),
}));

vi.mock("@/lib/hooks/useHapticDeviceStatus", () => ({
  useHapticDeviceStatus: () => ({
    status: "connected",
    statusText: "Connected",
    deviceStatuses: [],
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/lib/hooks/usePoseSessionEvents", () => ({
  usePoseSessionEvents: () => ({
    startPoseTracking: vi.fn(),
    stopPoseTracking: vi.fn(),
    isPrototypeTracking: false,
    currentAngles: {},
    trackingStatusLabel: "",
    latestRepCount: 0,
    repsBufferRef: { current: [] },
    formErrorsBufferRef: { current: [] },
  }),
}));

const mockUseLiveVoiceCommands = vi.fn(() => ({
  voiceStatus: "idle",
  startVoice: vi.fn(),
  stopVoice: vi.fn(),
  lastTranscript: "",
  voiceError: null,
}));

vi.mock("@/lib/hooks/useLiveVoiceCommands", () => ({
  useLiveVoiceCommands: (props: unknown) => mockUseLiveVoiceCommands(props),
}));

vi.mock("@/lib/hooks/useSessionEnd", () => ({
  useSessionEnd: () => ({ isEnding: false, endError: null, handleEndSession: vi.fn() }),
}));

let mockActiveCue: Record<string, unknown> | null = null;
vi.mock("@/lib/hooks/useAssistantCueQueue", () => ({
  useAssistantCueQueue: () => ({ activeCue: mockActiveCue }),
}));

vi.mock("@/lib/hooks/useLiveCueDelivery", () => ({
  useLiveCueDelivery: () => ({ lastCheckedSecond: { current: -1 } }),
}));

vi.mock("@/lib/hooks/useSpokenCuePlayback", () => ({
  useSpokenCuePlayback: () => ({ isSpeaking: false }),
}));

vi.mock("@/lib/hooks/useQnAChat", () => ({
  useQnAChat: () => ({
    qaMessages: [],
    chatInput: "",
    setChatInput: vi.fn(),
    isPending: false,
    qaError: null,
    handleSendMessage: vi.fn(),
    submitQuestion: vi.fn(),
  }),
}));

const mockStopCamera = vi.fn();
const mockRequestCamera = vi.fn(async () => {});

// Mock Camera Stream
vi.mock("@/lib/hooks/useCameraStream", () => ({
  useCameraStream: () => ({
    status: "ready",
    stream: {},
    requestCamera: mockRequestCamera,
    stopCamera: mockStopCamera,
  }),
  useCameraLifecycleCleanup: vi.fn(),
}));

interface GateMockProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  title: string;
}

// Mock the CameraPositioningGate component
vi.mock("@/components/session/CameraPositioningGate", () => ({
  CameraPositioningGate: ({ isOpen, onClose, onComplete, title }: GateMockProps) => {
    if (!isOpen) return null;
    return (
      <div data-testid="live-positioning-gate">
        <h1>{title}</h1>
        <button onClick={onClose}>Skip Gate</button>
        <button onClick={onComplete}>Complete Gate</button>
      </div>
    );
  },
}));

describe("LiveSession Checkpoint Positioning Gate Policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStopCamera.mockClear();
    mockRequestCamera.mockClear();
    mockCurrentTime = 0;
    mockUseYouTubePlayer.mockImplementation(() => ({
      containerRef: { current: null },
      isReady: true,
      isPlaying: true, // Initially playing
      isBuffering: false,
      hasEnded: false,
      currentTime: mockCurrentTime,
      duration: 100,
      playbackRate: 1.0,
      error: null,
      play: mockPlay,
      pause: mockPause,
      seek: mockSeek,
      setPlaybackRate: vi.fn(),
      getVolume: vi.fn(() => 50),
      setVolume: vi.fn(),
      isPlayerMuted: vi.fn(() => false),
    }));
    mockActiveCue = null;
    mockTriggerHapticEvent.mockClear();
    mockManifest.exercise_timeline_anchors = [
      { id: "ex-1", name: "Bicep Curl", start_time_seconds: 10, end_time_seconds: 20, counting_joint: "elbow" },
      { id: "ex-2", name: "Squats", start_time_seconds: 30, end_time_seconds: 40, counting_joint: "knee" },
    ];
  });

  test("runs pre-workout gate initially, then pre-exercise gate on exercise transition", () => {
    const { rerender, queryByTestId, getByText } = render(<LiveSessionPage params={{ videoId: "video-123" }} />);

    // Pre-workout gate should be open initially at time 0
    expect(queryByTestId("live-positioning-gate")).toBeDefined();
    expect(getByText("Pre-Workout Camera Alignment")).toBeDefined();

    // Complete pre-workout gate
    act(() => {
      getByText("Complete Gate").click();
    });

    expect(queryByTestId("live-positioning-gate")).toBeNull();

    // Transition to Bicep Curl (start_time_seconds = 10)
    mockCurrentTime = 12;
    rerender(<LiveSessionPage params={{ videoId: "video-123" }} />);

    // Pre-exercise gate should open for Bicep Curl
    expect(queryByTestId("live-positioning-gate")).toBeDefined();
    expect(mockPause).toHaveBeenCalled();

    // Complete Bicep Curl exercise gate
    act(() => {
      getByText("Complete Gate").click();
    });

    expect(queryByTestId("live-positioning-gate")).toBeNull();
    expect(mockPlay).toHaveBeenCalled();
    expect(mockSeek).toHaveBeenCalledWith(10);
  });

  test("skipping pre-exercise gate resumes playback and seeks back", () => {
    const { rerender, getByText, queryByTestId } = render(<LiveSessionPage params={{ videoId: "video-123" }} />);

    // Complete pre-workout gate first
    act(() => {
      getByText("Complete Gate").click();
    });

    // Transition to Bicep Curl
    mockCurrentTime = 12;
    rerender(<LiveSessionPage params={{ videoId: "video-123" }} />);

    expect(queryByTestId("live-positioning-gate")).toBeDefined();

    const skipBtn = getByText("Skip Gate");
    act(() => {
      skipBtn.click();
    });

    expect(queryByTestId("live-positioning-gate")).toBeNull();
    expect(mockPlay).toHaveBeenCalled();
    expect(mockSeek).toHaveBeenCalledWith(10);
  });

  test("manual pause is respected after gate completion", () => {
    // Setup player state as paused initially (to register user_manual in coordinator)
    mockUseYouTubePlayer.mockImplementation(() => ({
      containerRef: { current: null },
      isReady: true,
      isPlaying: false, // Initially paused
      isBuffering: false,
      hasEnded: false,
      currentTime: mockCurrentTime,
      duration: 100,
      playbackRate: 1.0,
      error: null,
      play: mockPlay,
      pause: mockPause,
      seek: mockSeek,
      setPlaybackRate: vi.fn(),
      getVolume: vi.fn(() => 50),
      setVolume: vi.fn(),
      isPlayerMuted: vi.fn(() => false),
    }));

    const { getByText } = render(<LiveSessionPage params={{ videoId: "video-123" }} />);
    expect(getByText("Pre-Workout Camera Alignment")).toBeDefined();

    // Complete the gate
    act(() => {
      getByText("Complete Gate").click();
    });

    // Play should NOT have been called because player was manually paused!
    expect(mockPlay).not.toHaveBeenCalled();
  });
});
