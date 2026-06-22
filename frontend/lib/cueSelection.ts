import {
  CuePlan,
  CueCandidate,
  CueModality,
  RuntimeCueSelectionResponse,
  AudioCoexistenceSettings,
  InterruptionLevel,
  AssistantVerbosity
} from "@/types";

/**
 * Deterministically selects the best cue candidate for the current playback time
 * completely on the client side, avoiding per-second backend polling.
 */
export function selectCuePlanCandidateLocal(
  cuePlan: CuePlan | null,
  currentTimeMs: number,
  settings: AudioCoexistenceSettings,
  assistantMuted: boolean,
  recentlyDeliveredCueIds: string[] | null = []
): RuntimeCueSelectionResponse {
  if (!cuePlan) {
    return {
      cue_id: null,
      should_deliver: false,
      modality: null,
      text: null,
      haptic_cue_ref: null,
      interruption_policy_hint: null,
      recommended_playback_action: "none",
      reason: "cue_plan_not_found"
    };
  }

  const recentlyDelivered = recentlyDeliveredCueIds || [];

  // 1. Filter candidates by current time window: start_ms <= currentTimeMs <= end_ms
  const activeCandidates = cuePlan.cue_candidates.filter(
    (c) => c.start_ms <= currentTimeMs && currentTimeMs <= c.end_ms
  );

  if (activeCandidates.length === 0) {
    return {
      cue_id: null,
      should_deliver: false,
      modality: null,
      text: null,
      haptic_cue_ref: null,
      interruption_policy_hint: null,
      recommended_playback_action: "none",
      reason: "no_active_candidates_in_window"
    };
  }

  // 2. Skip recently delivered candidates
  const eligibleCandidates = activeCandidates.filter(
    (c) => !recentlyDelivered.includes(c.id)
  );

  if (eligibleCandidates.length === 0) {
    return {
      cue_id: null,
      should_deliver: false,
      modality: null,
      text: null,
      haptic_cue_ref: null,
      interruption_policy_hint: null,
      recommended_playback_action: "none",
      reason: "all_active_candidates_recently_delivered"
    };
  }

  // 3. Check modality and policy compatibility for each candidate
  if (settings.interruption_level === InterruptionLevel.SILENT) {
    return {
      cue_id: null,
      should_deliver: false,
      modality: null,
      text: null,
      haptic_cue_ref: null,
      interruption_policy_hint: null,
      recommended_playback_action: "none",
      reason: "silent_mode_suppresses_all_cues"
    };
  }

  const audioAllowedBySettings =
    !assistantMuted &&
    (settings.interruption_level === InterruptionLevel.BRIEF_SPEECH ||
      settings.interruption_level === InterruptionLevel.FULL_SPEECH);

  const finalCandidates: Array<{
    candidate: CueCandidate;
    modality: CueModality;
    text: string | null;
  }> = [];

  for (const c of eligibleCandidates) {
    let chosenModality: CueModality | null = null;
    let textToDeliver: string | null = null;

    // Try to deliver as audio first
    let canDeliverAudio = false;
    if (audioAllowedBySettings && c.allowed_modalities.includes("audio")) {
      if (settings.interruption_level === InterruptionLevel.BRIEF_SPEECH) {
        if (
          c.interruption_policy_hint === "safe_gap_only" ||
          c.interruption_policy_hint === "pause_then_speak"
        ) {
          canDeliverAudio = true;
        }
      } else if (settings.interruption_level === InterruptionLevel.FULL_SPEECH) {
        if (
          c.interruption_policy_hint === "safe_gap_only" ||
          c.interruption_policy_hint === "pause_then_speak" ||
          c.interruption_policy_hint === "duck_speak"
        ) {
          canDeliverAudio = true;
        }
      }
    }

    if (canDeliverAudio) {
      chosenModality = "audio";
      const variants = c.text_variants;
      if (variants) {
        if (
          settings.interruption_level === InterruptionLevel.BRIEF_SPEECH ||
          settings.assistant_verbosity === AssistantVerbosity.MINIMAL
        ) {
          textToDeliver = variants.brief || variants.moderate;
        } else if (settings.assistant_verbosity === AssistantVerbosity.DETAILED) {
          textToDeliver = variants.detailed || variants.moderate;
        } else {
          textToDeliver = variants.moderate;
        }
      } else {
        textToDeliver = "Please perform the movement.";
      }
    } else if (c.allowed_modalities.includes("haptic")) {
      // Haptic fallback
      chosenModality = "haptic";
      if (audioAllowedBySettings) {
        const variants = c.text_variants;
        if (variants) {
          if (settings.assistant_verbosity === AssistantVerbosity.MINIMAL) {
            textToDeliver = variants.brief || variants.moderate;
          } else if (settings.assistant_verbosity === AssistantVerbosity.DETAILED) {
            textToDeliver = variants.detailed || variants.moderate;
          } else {
            textToDeliver = variants.moderate;
          }
        }
      }
    }

    if (chosenModality) {
      finalCandidates.push({
        candidate: c,
        modality: chosenModality,
        text: textToDeliver
      });
    }
  }

  if (finalCandidates.length === 0) {
    return {
      cue_id: null,
      should_deliver: false,
      modality: null,
      text: null,
      haptic_cue_ref: null,
      interruption_policy_hint: null,
      recommended_playback_action: "none",
      reason: "no_candidates_compatible_with_settings"
    };
  }

  // 4. Sort candidates:
  const priorityMap: Record<string, number> = {
    high: 3,
    medium: 2,
    low: 1
  };

  finalCandidates.sort((a, b) => {
    const priorityA = priorityMap[a.candidate.priority] || 2;
    const priorityB = priorityMap[b.candidate.priority] || 2;
    if (priorityA !== priorityB) {
      return priorityB - priorityA; // descending
    }

    const preferPauseA =
      settings.pause_before_speaking &&
      a.candidate.interruption_policy_hint === "pause_then_speak"
        ? 1
        : 0;
    const preferPauseB =
      settings.pause_before_speaking &&
      b.candidate.interruption_policy_hint === "pause_then_speak"
        ? 1
        : 0;
    if (preferPauseA !== preferPauseB) {
      return preferPauseB - preferPauseA; // descending
    }

    return a.candidate.start_ms - b.candidate.start_ms; // ascending
  });

  const { candidate: selectedCand, modality: selectedModality, text: selectedText } =
    finalCandidates[0];

  // 5. Determine recommended playback action
  let recommendedAction: "none" | "pause_before_speaking" | "duck_audio" = "none";
  if (selectedModality === "audio") {
    if (
      selectedCand.interruption_policy_hint === "pause_then_speak" &&
      settings.pause_before_speaking
    ) {
      recommendedAction = "pause_before_speaking";
    } else if (selectedCand.interruption_policy_hint === "duck_speak") {
      recommendedAction = "duck_audio";
    }
  }

  return {
    cue_id: selectedCand.id,
    should_deliver: true,
    modality: selectedModality,
    text: selectedText,
    haptic_cue_ref: selectedCand.haptic_cue_ref || null,
    interruption_policy_hint: selectedCand.interruption_policy_hint,
    recommended_playback_action: recommendedAction,
    reason: "candidate_selected"
  };
}
