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
    { name: "Bicep Curl", start_time_seconds: 10, end_time_seconds: 20 },
    { name: "Squats", start_time_seconds: 30, end_time_seconds: 40 },
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

describe("LiveSession Per-Exercise Positioning Gate", () => {
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
      { name: "Bicep Curl", start_time_seconds: 10, end_time_seconds: 20 },
      { name: "Squats", start_time_seconds: 30, end_time_seconds: 40 },
    ];
  });

  test("triggers gate on exercise transition, pauses playback, and resumes on complete with seek back", () => {
    const { rerender, queryByTestId, getByText } = render(<LiveSessionPage params={{ videoId: "video-123" }} />);

    // Initially playing at time 0, gate is not open
    expect(queryByTestId("live-positioning-gate")).toBeNull();

    // Transition to Bicep Curl (start_time_seconds = 10)
    mockCurrentTime = 12;
    rerender(<LiveSessionPage params={{ videoId: "video-123" }} />);

    // Gate should now be open
    expect(queryByTestId("live-positioning-gate")).toBeDefined();
    expect(mockPause).toHaveBeenCalled();
    expect(mockLogSessionEvent).toHaveBeenCalledWith("positioning_gate_opened", 12000, {
      exerciseName: "Bicep Curl",
    });

    // Complete the gate
    const completeBtn = getByText("Complete Gate");
    act(() => {
      completeBtn.click();
    });

    // Gate should close, play should resume, seek back to anchor start, and keep camera running
    expect(queryByTestId("live-positioning-gate")).toBeNull();
    expect(mockPlay).toHaveBeenCalled();
    expect(mockSeek).toHaveBeenCalledWith(10);
    expect(mockStopCamera).not.toHaveBeenCalled();
    expect(mockLogSessionEvent).toHaveBeenCalledWith("positioning_gate_completed", 12000, {
      exerciseName: "Bicep Curl",
    });
  });

  test("skipping the gate resumes playback and seeks back", () => {
    const { rerender, getByText, queryByTestId } = render(<LiveSessionPage params={{ videoId: "video-123" }} />);

    // Transition to Bicep Curl
    mockCurrentTime = 12;
    rerender(<LiveSessionPage params={{ videoId: "video-123" }} />);

    const skipBtn = getByText("Skip Gate");
    act(() => {
      skipBtn.click();
    });

    expect(queryByTestId("live-positioning-gate")).toBeNull();
    expect(mockPlay).toHaveBeenCalled();
    expect(mockSeek).toHaveBeenCalledWith(10);
    expect(mockStopCamera).not.toHaveBeenCalled();
    expect(mockLogSessionEvent).toHaveBeenCalledWith("positioning_gate_skipped", 12000, expect.objectContaining({
      exerciseName: "Bicep Curl",
    }));
  });

  test("seeking backward resets gate history so that the same anchor can trigger gate again", () => {
    const { rerender, queryByTestId, getByText } = render(<LiveSessionPage params={{ videoId: "video-123" }} />);

    // 1. Transition to Bicep Curl
    mockCurrentTime = 12;
    rerender(<LiveSessionPage params={{ videoId: "video-123" }} />);
    expect(queryByTestId("live-positioning-gate")).toBeDefined();

    // 2. Complete gate
    const completeBtn = getByText("Complete Gate");
    act(() => {
      completeBtn.click();
    });
    expect(queryByTestId("live-positioning-gate")).toBeNull();

    // 3. Keep moving forward in the same exercise - should NOT trigger gate again
    mockCurrentTime = 15;
    rerender(<LiveSessionPage params={{ videoId: "video-123" }} />);
    expect(queryByTestId("live-positioning-gate")).toBeNull();

    // 4. Seek backward before exercise start (currentTime = 5, bicep start = 10)
    mockCurrentTime = 5;
    rerender(<LiveSessionPage params={{ videoId: "video-123" }} />);

    // 5. Transition to Bicep Curl again
    mockCurrentTime = 12;
    rerender(<LiveSessionPage params={{ videoId: "video-123" }} />);
    expect(queryByTestId("live-positioning-gate")).toBeDefined();
  });

  test("manual pause is not undone by gate completion", () => {
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

    const { rerender, queryByTestId, getByText } = render(<LiveSessionPage params={{ videoId: "video-123" }} />);
    expect(queryByTestId("live-positioning-gate")).toBeNull();

    // Transition to Bicep Curl
    mockCurrentTime = 12;
    rerender(<LiveSessionPage params={{ videoId: "video-123" }} />);
    expect(queryByTestId("live-positioning-gate")).toBeDefined();

    // Complete the gate
    const completeBtn = getByText("Complete Gate");
    act(() => {
      completeBtn.click();
    });

    // Gate should close, but play should NOT have been called because player was manually paused!
    expect(queryByTestId("live-positioning-gate")).toBeNull();
    expect(mockPlay).not.toHaveBeenCalled();
  });

  test("repeated exercise names do not break gate dedupe", () => {
    // Setup manifest to have two exercises with the same name at different times
    mockManifest.exercise_timeline_anchors = [
      { name: "Bicep Curl", start_time_seconds: 10, end_time_seconds: 20 },
      { name: "Bicep Curl", start_time_seconds: 30, end_time_seconds: 40 },
    ];

    const { rerender, queryByTestId, getByText } = render(<LiveSessionPage params={{ videoId: "video-123" }} />);

    // 1. Transition to first Bicep Curl
    mockCurrentTime = 12;
    rerender(<LiveSessionPage params={{ videoId: "video-123" }} />);
    expect(queryByTestId("live-positioning-gate")).toBeDefined();

    // Complete gate
    const completeBtn = getByText("Complete Gate");
    act(() => {
      completeBtn.click();
    });
    expect(queryByTestId("live-positioning-gate")).toBeNull();

    // 2. Transition to second Bicep Curl (same name, different time)
    mockCurrentTime = 32;
    rerender(<LiveSessionPage params={{ videoId: "video-123" }} />);

    // It should open gate again because of composite key!
    expect(queryByTestId("live-positioning-gate")).toBeDefined();
  });

  test("legacy fallback activeCue is suppressed when positioning gate is open", () => {
    // 1. Start with no active cue during initial load/render
    mockActiveCue = null;

    // Render with gate closed initially
    const { rerender, queryByTestId } = render(<LiveSessionPage params={{ videoId: "video-123" }} />);
    expect(queryByTestId("live-positioning-gate")).toBeNull();

    // 2. Open positioning gate by transitioning to Bicep Curl
    mockCurrentTime = 12;
    rerender(<LiveSessionPage params={{ videoId: "video-123" }} />);
    expect(queryByTestId("live-positioning-gate")).toBeDefined();

    mockTriggerHapticEvent.mockClear();

    // 3. Set the active legacy cue while the gate is already open
    act(() => {
      mockActiveCue = {
        timestamp_ms: 12000,
        text: "Speed up your repetitions",
        modality: "haptic",
        priority: "normal",
        persona: "trainer",
        metadata: { intensity: 0.8, sleeve_sides: ["both"] },
      };
    });

    // Rerender to trigger the activeCue hook delivery effect
    rerender(<LiveSessionPage params={{ videoId: "video-123" }} />);

    // 4. Since gate is open, haptic triggers and audio announcements should be completely bypassed
    expect(mockTriggerHapticEvent).not.toHaveBeenCalled();
    expect(mockLogSessionEvent).toHaveBeenCalledWith(
      SESSION_EVENTS.CUE_SUPPRESSED_BY_GATE,
      12000,
      expect.objectContaining({
        text: "Speed up your repetitions",
        modality: "haptic",
        reason: "positioning_gate_active",
        source: "legacy_fallback",
      })
    );
  });
});
