import React from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import LiveSessionPage from "../page";

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

// Mock artifacts loading
vi.mock("@/lib/hooks/useSessionArtifacts", () => ({
  useSessionArtifacts: () => ({
    job: { youtube_id: "yt-123", stage: "completed" },
    manifest: { exercise_timeline_anchors: [], trainer_instruction_events: [] },
    cuePlan: { cue_candidates: [] },
    transcript: null,
    isLoading: false,
    error: null,
  }),
}));

// Mock youtube player
vi.mock("@/lib/hooks/useYouTubePlayer", () => ({
  useYouTubePlayer: () => ({
    containerRef: { current: null },
    isReady: true,
    isPlaying: false,
    isBuffering: false,
    hasEnded: false,
    currentTime: 0,
    duration: 100,
    playbackRate: 1.0,
    error: null,
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    setPlaybackRate: vi.fn(),
    getVolume: vi.fn(() => 50),
    setVolume: vi.fn(),
    isPlayerMuted: vi.fn(() => false),
  }),
}));

// Mock telemetry and haptic hooks
vi.mock("@/lib/hooks/useSessionTelemetry", () => ({
  useSessionTelemetry: () => ({ logSessionEvent: vi.fn(), getBufferedEvents: vi.fn(() => []) }),
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
vi.mock("@/lib/hooks/usePrototypePoseSessionEvents", () => ({
  usePrototypePoseSessionEvents: () => ({
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
vi.mock("@/lib/hooks/useLiveVoiceCommands", () => ({
  useLiveVoiceCommands: () => ({
    voiceStatus: "idle",
    startVoice: vi.fn(),
    stopVoice: vi.fn(),
    lastTranscript: "",
    voiceError: null,
  }),
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

// Mock speech playback and Q&A chat to capture props
const mockUseSpokenCuePlayback = vi.fn();
vi.mock("@/lib/hooks/useSpokenCuePlayback", () => ({
  useSpokenCuePlayback: (props: unknown) => {
    mockUseSpokenCuePlayback(props);
    return { isSpeaking: false };
  },
}));

const mockUseQnAChat = vi.fn();
vi.mock("@/lib/hooks/useQnAChat", () => ({
  useQnAChat: (props: unknown) => {
    mockUseQnAChat(props);
    return {
      qaMessages: [],
      chatInput: "",
      setChatInput: vi.fn(),
      isPending: false,
      qaError: null,
      handleSendMessage: vi.fn(),
      submitQuestion: vi.fn(),
    };
  },
}));

describe("LiveSession Q&A Speech Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.audio_coexistence.pause_before_speaking = true;
  });

  test("onAssistantAnswerReady callback creates a spoken Q&A item with pause_before_speaking when configured", () => {
    render(<LiveSessionPage params={{ videoId: "video-123" }} />);

    // Get the onAssistantAnswerReady callback passed to useQnAChat hook
    const qnaProps = mockUseQnAChat.mock.calls[0][0];
    expect(qnaProps.onAssistantAnswerReady).toBeDefined();

    // Trigger the callback
    act(() => {
      qnaProps.onAssistantAnswerReady("Stand six feet away.");
    });

    // Check that useSpokenCuePlayback was called with the spoken item
    const lastPlaybackProps = mockUseSpokenCuePlayback.mock.calls[mockUseSpokenCuePlayback.mock.calls.length - 1][0];
    expect(lastPlaybackProps.text).toBe("Stand six feet away.");
    expect(lastPlaybackProps.cueId).toMatch(/^qna-/);
    expect(lastPlaybackProps.recommendedPlaybackAction).toBe("pause_before_speaking");
    expect(lastPlaybackProps.timestampMs).toBeUndefined(); // Should bypass timeline stale check
  });

  test("onAssistantAnswerReady callback sets recommended playback action to none when pause_before_speaking is false", () => {
    mockUser.audio_coexistence.pause_before_speaking = false;
    render(<LiveSessionPage params={{ videoId: "video-123" }} />);

    const qnaProps = mockUseQnAChat.mock.calls[0][0];

    act(() => {
      qnaProps.onAssistantAnswerReady("Do not pause video.");
    });

    const lastPlaybackProps = mockUseSpokenCuePlayback.mock.calls[mockUseSpokenCuePlayback.mock.calls.length - 1][0];
    expect(lastPlaybackProps.text).toBe("Do not pause video.");
    expect(lastPlaybackProps.recommendedPlaybackAction).toBe("none");
  });
});
