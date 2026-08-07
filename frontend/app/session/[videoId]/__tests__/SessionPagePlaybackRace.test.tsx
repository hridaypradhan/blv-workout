import React from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import LiveSessionPage from "../page";
import { UseLiveVoiceCommandsProps } from "@/lib/hooks/useLiveVoiceCommands";
import { handlePlaybackCommand } from "@/lib/voice/liveVoiceCommandHandlers";

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

const mockMediaPipePoseRuntime = {
  isReady: false,
  runtimeStatus: "offline",
  poseAvailable: false,
  requiredLandmarksVisible: false,
  landmarkConfidence: null,
  latestFormError: null,
  latestRepEvent: null,
  isTracking: false,
  startTracking: vi.fn(),
  stopTracking: vi.fn(),
};

const mockPrototypePoseRuntime = {
  isReady: true,
  runtimeStatus: "active",
  poseAvailable: true,
  requiredLandmarksVisible: true,
  landmarkConfidence: 0.9,
  latestFormError: null,
  latestRepEvent: null,
  isTracking: false,
  startTracking: vi.fn(),
  stopTracking: vi.fn(),
};

vi.mock("@/lib/hooks/useMediaPipePoseRuntime", () => ({
  useMediaPipePoseRuntime: () => mockMediaPipePoseRuntime,
}));
vi.mock("@/lib/hooks/usePrototypePoseRuntime", () => ({
  usePrototypePoseRuntime: () => mockPrototypePoseRuntime,
}));

let mockIsGateOpen = false;
vi.mock("@/lib/hooks/useLivePositioningGate", () => ({
  useLivePositioningGate: () => ({
    isLiveGateOpen: mockIsGateOpen,
    liveGateExerciseName: mockIsGateOpen ? "Squats" : null,
    isLiveCountdownActive: false,
    liveCancelCountdownTrigger: 0,
    setLiveCancelCountdownTrigger: vi.fn(),
    liveGuidance: "Position yourself in front of the camera.",
    setLiveGuidance: vi.fn(),
    handleSkipLiveGate: vi.fn(),
    handleCompleteLiveGate: vi.fn(),
    cameraGatesDisabled: false,
    handleDisableCameraGates: vi.fn(),
    handleRetryAlignment: vi.fn(),
    setIsLiveCountdownActive: vi.fn(),
    gateType: null,
  }),
}));

vi.mock("@/lib/hooks/useSessionArtifacts", () => ({
  useSessionArtifacts: () => ({
    job: { youtube_id: "yt-123", stage: "completed" },
    manifest: {
      exercise_timeline_anchors: [
        { exercise_id: "ex-1", name: "Squats", start_time_seconds: 0, end_time_seconds: 120 }
      ],
      trainer_instruction_events: []
    },
    cuePlan: { cue_candidates: [] },
    transcript: null,
    isLoading: false,
    error: null,
  }),
}));

let mockIsPlaying = false;
const mockPlay = vi.fn(() => {
  mockIsPlaying = true;
});
const mockPause = vi.fn(() => {
  mockIsPlaying = false;
});

vi.mock("@/lib/hooks/useYouTubePlayer", () => ({
  useYouTubePlayer: () => ({
    containerRef: { current: null },
    isReady: true,
    isPlaying: mockIsPlaying,
    isBuffering: false,
    hasEnded: false,
    currentTime: 10,
    duration: 120,
    playbackRate: 1.0,
    error: null,
    play: mockPlay,
    pause: mockPause,
    seek: vi.fn(),
    setPlaybackRate: vi.fn(),
    getVolume: vi.fn(() => 50),
    setVolume: vi.fn(),
    isPlayerMuted: vi.fn(() => false),
  }),
}));

let mockLogSessionEvent = vi.fn();
vi.mock("@/lib/hooks/useSessionTelemetry", () => ({
  useSessionTelemetry: () => ({ logSessionEvent: mockLogSessionEvent, getBufferedEvents: vi.fn(() => []) }),
}));

vi.mock("@/lib/hooks/useHapticEventDelivery", () => ({
  useHapticEventDelivery: () => ({ recentEvents: [], triggerHapticEvent: vi.fn() }),
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

let capturedVoiceProps: UseLiveVoiceCommandsProps | null = null;
vi.mock("@/lib/hooks/useLiveVoiceCommands", () => ({
  useLiveVoiceCommands: (props: UseLiveVoiceCommandsProps) => {
    capturedVoiceProps = props;
    return {
      voiceStatus: "idle",
      startVoice: vi.fn(),
      stopVoice: vi.fn(),
      lastTranscript: "",
      voiceError: null,
    };
  },
}));

vi.mock("@/lib/hooks/useSessionEnd", () => ({
  useSessionEnd: () => ({ isEnding: false, endError: null, handleEndSession: vi.fn() }),
}));
vi.mock("@/lib/hooks/useAssistantCueQueue", () => ({
  useAssistantCueQueue: () => ({ activeCue: null }),
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

describe("LiveSession Page Playback Race & Intent Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPlaying = false;
    mockIsGateOpen = false;
    capturedVoiceProps = null;
    mockLogSessionEvent = vi.fn();
  });

  test("voice/manual play after pause sets intent and resumes without re-requesting user_manual", () => {
    const { rerender } = render(<LiveSessionPage params={{ videoId: "video-123" }} />);

    // Clear initial mount telemetry calls (e.g. initial iframe pause detection)
    mockLogSessionEvent.mockClear();

    // 1. Trigger manual pause
    act(() => {
      capturedVoiceProps.pause();
    });

    expect(mockPause).toHaveBeenCalled();

    // 2. Trigger voice/manual play
    act(() => {
      capturedVoiceProps.play();
    });

    expect(mockPlay).toHaveBeenCalled();
    expect(mockLogSessionEvent).toHaveBeenCalledWith(
      "pause_coordinator_release",
      expect.any(Number),
      expect.objectContaining({ owner: "user_manual", willResume: true })
    );

    // Clear calls recorded so far
    mockLogSessionEvent.mockClear();

    // 3. Rerender while mockIsPlaying is still false (simulating iframe async delay)
    rerender(<LiveSessionPage params={{ videoId: "video-123" }} />);

    // Verify that pause_coordinator_request for user_manual was NOT called again during rerender
    const rePauseCalls = mockLogSessionEvent.mock.calls.filter(
      (call) =>
        call[0] === "pause_coordinator_request" &&
        call[2]?.reason === "IFrame manual pause detected"
    );
    expect(rePauseCalls).toHaveLength(0);
  });

  test("voice/manual pause does not immediately release user_manual while iframe is still playing", () => {
    mockIsPlaying = true;
    const { rerender } = render(<LiveSessionPage params={{ videoId: "video-123" }} />);

    mockLogSessionEvent.mockClear();

    act(() => {
      capturedVoiceProps.pause();
    });

    rerender(<LiveSessionPage params={{ videoId: "video-123" }} />);

    const prematureReleaseCalls = mockLogSessionEvent.mock.calls.filter(
      (call) =>
        call[0] === "pause_coordinator_release" &&
        call[2]?.reason === "IFrame manual play detected"
    );
    expect(prematureReleaseCalls).toHaveLength(0);
  });

  test("direct iframe pause creates user_manual owner when no intent or programmatic owner exists", () => {
    mockIsPlaying = true;
    const { rerender } = render(<LiveSessionPage params={{ videoId: "video-123" }} />);

    // Clear initial mount telemetry
    mockLogSessionEvent.mockClear();

    // Simulate direct iframe pause event (iframe transitions to isPlaying: false spontaneously)
    act(() => {
      mockIsPlaying = false;
    });
    rerender(<LiveSessionPage params={{ videoId: "video-123" }} />);

    expect(mockLogSessionEvent).toHaveBeenCalledWith(
      "pause_coordinator_request",
      expect.any(Number),
      expect.objectContaining({
        owner: "user_manual",
        reason: "IFrame manual pause detected",
      })
    );
  });

  test("direct iframe play releases user_manual owner when isPlaying transitions to true", () => {
    const { rerender } = render(<LiveSessionPage params={{ videoId: "video-123" }} />);

    // Manually pause first to establish user_manual owner
    act(() => {
      capturedVoiceProps.pause();
    });

    // Let the iframe report the requested pause, which clears the pending pause intent.
    act(() => {
      mockIsPlaying = false;
    });
    rerender(<LiveSessionPage params={{ videoId: "video-123" }} />);

    mockLogSessionEvent.mockClear();

    // Simulate direct iframe play event (user clicks play on YouTube iframe)
    act(() => {
      mockIsPlaying = true;
    });
    rerender(<LiveSessionPage params={{ videoId: "video-123" }} />);

    expect(mockLogSessionEvent).toHaveBeenCalledWith(
      "pause_coordinator_release",
      expect.any(Number),
      expect.objectContaining({
        owner: "user_manual",
        reason: "IFrame manual play detected",
      })
    );
  });

  test("resume is blocked when positioning_gate is active", () => {
    mockIsGateOpen = true;
    render(<LiveSessionPage params={{ videoId: "video-123" }} />);

    // Request positioning_gate pause on the page's pauseCoordinator
    // to simulate live gate pause coordinator state
    const gateProps = capturedVoiceProps;
    expect(gateProps).toBeDefined();

    // Verify handlePlaybackCommand blocks resume when activeOwners contains positioning_gate
    const activeOwnersWithGate = new Set<"positioning_gate">(["positioning_gate"]);
    const logSpy = vi.fn();
    const playSpy = vi.fn();
    const announceSpy = vi.fn();

    const handled = handlePlaybackCommand(
      { type: "resume", rawText: "play" },
      1000,
      10,
      {
        pause: vi.fn(),
        play: playSpy,
        seek: vi.fn(),
        setPlaybackRate: vi.fn(),
        announce: announceSpy,
        logSessionEvent: logSpy,
        activeOwners: activeOwnersWithGate,
      }
    );

    expect(handled).toBe(true);
    expect(playSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      "voice_command_blocked",
      1000,
      expect.objectContaining({
        command: "resume",
        reason: "positioning_gate_active",
      })
    );
  });
});
