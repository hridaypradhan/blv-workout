import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useQnAChat } from "../useQnAChat";
import { askAssistant } from "@/lib/api";
import { InterruptionLevel, AssistantVerbosity, User } from "@/types";

vi.mock("@/lib/api", () => ({
  askAssistant: vi.fn(),
}));

describe("useQnAChat Hook Q&A Speech Integration", () => {
  const defaultProps = {
    sessionId: "sess-123",
    videoId: "vid-456",
    currentTime: 10,
    currentTimeMs: 10000,
    currentExercise: null,
    manifest: null,
    cuePlan: null,
    transcript: null,
    coexistenceSettings: {
      interruption_level: InterruptionLevel.BRIEF_SPEECH,
      assistant_verbosity: AssistantVerbosity.MODERATE,
      pause_before_speaking: true,
      correction_frequency: "medium",
    },
    assistantMuted: false,
    metadata: null,
    userProfile: null,
    announce: vi.fn(),
    logSessionEvent: vi.fn(),
    onAssistantAnswerReady: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("submitting a typed question calls askAssistant and triggers onAssistantAnswerReady", async () => {
    vi.mocked(askAssistant).mockResolvedValue({
      answer_text: "Stand six feet away from the screen.",
      answer_kind: "general_guidance",
      provider: "test-provider",
      grounding_sources: [],
      spoken_safe: true,
    });

    const { result } = renderHook(() => useQnAChat(defaultProps));

    await act(async () => {
      await result.current.submitQuestion("How should I position myself?", "typed");
    });

    expect(askAssistant).toHaveBeenCalledTimes(1);
    expect(defaultProps.onAssistantAnswerReady).toHaveBeenCalledWith(
      "Stand six feet away from the screen."
    );
  });

  test("submitting a voice question also calls askAssistant and triggers onAssistantAnswerReady", async () => {
    vi.mocked(askAssistant).mockResolvedValue({
      answer_text: "Keep your feet shoulder width apart.",
      answer_kind: "general_guidance",
      provider: "test-provider",
      grounding_sources: [],
      spoken_safe: true,
    });

    const { result } = renderHook(() => useQnAChat(defaultProps));

    await act(async () => {
      await result.current.submitQuestion("Where should my feet be?", "voice");
    });

    expect(askAssistant).toHaveBeenCalledTimes(1);
    expect(defaultProps.onAssistantAnswerReady).toHaveBeenCalledWith(
      "Keep your feet shoulder width apart."
    );
  });

  test("onAssistantAnswerReady is not triggered if askAssistant fails", async () => {
    vi.mocked(askAssistant).mockRejectedValue(new Error("API failure"));

    const { result } = renderHook(() => useQnAChat(defaultProps));

    await act(async () => {
      await result.current.submitQuestion("Should I jump?", "typed");
    });

    expect(askAssistant).toHaveBeenCalledTimes(1);
    expect(defaultProps.onAssistantAnswerReady).not.toHaveBeenCalled();
  });

  test("announces full answer through live region when speech is disabled", async () => {
    vi.mocked(askAssistant).mockResolvedValue({
      answer_text: "Stand six feet away.",
      answer_kind: "general_guidance",
      provider: "test-provider",
      grounding_sources: [],
      spoken_safe: true,
    });

    vi.stubGlobal("speechSynthesis", undefined);

    const announceMock = vi.fn();
    const props = {
      ...defaultProps,
      announce: announceMock,
    };

    const { result } = renderHook(() => useQnAChat(props));

    await act(async () => {
      await result.current.submitQuestion("How should I position myself?", "typed");
    });

    expect(announceMock).toHaveBeenCalledWith('Assistant response received: "Stand six feet away."');
    vi.unstubAllGlobals();
  });

  test("announces short status through live region when speech is enabled", async () => {
    vi.mocked(askAssistant).mockResolvedValue({
      answer_text: "Stand six feet away.",
      answer_kind: "general_guidance",
      provider: "test-provider",
      grounding_sources: [],
      spoken_safe: true,
    });

    vi.stubGlobal("speechSynthesis", { speak: vi.fn(), cancel: vi.fn(), getVoices: vi.fn(() => []) });

    const announceMock = vi.fn();
    const props = {
      ...defaultProps,
      announce: announceMock,
      userProfile: {
        feedback_modalities: ["audio"],
      } as unknown as User,
    };

    const { result } = renderHook(() => useQnAChat(props));

    await act(async () => {
      await result.current.submitQuestion("How should I position myself?", "typed");
    });

    expect(announceMock).toHaveBeenCalledWith("Assistant response received.");
    vi.unstubAllGlobals();
  });
});
