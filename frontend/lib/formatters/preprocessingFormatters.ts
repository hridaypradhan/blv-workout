import { ProcessingStage } from "../../types";

export interface StageMetadata {
  stage: ProcessingStage;
  label: string;
  stepNumber: number;
  totalSteps: number;
  compactProgress: string;
  description: string;
  accessibleDescription: string;
}

export const PIPELINE_STEPS = [
  {
    key: ProcessingStage.SUBMITTED,
    name: "Submitted",
    desc: "Your YouTube video has been queued for assistance preparation.",
  },
  {
    key: ProcessingStage.FETCHING_METADATA,
    name: "Fetching Metadata",
    desc: "Retrieving channel name, duration, and video metadata.",
  },
  {
    key: ProcessingStage.TRANSCRIBING,
    name: "Transcribing",
    desc: "Analyzing the trainer's speech track for alignment.",
  },
  {
    key: ProcessingStage.ANCHORING_TIMELINE,
    name: "Anchoring Timeline",
    desc: "Identifying key workout segments and transitions.",
  },
  {
    key: ProcessingStage.CLASSIFYING_TRAINER_INSTRUCTIONS,
    name: "Classifying Instructions",
    desc: "Mapping exercise cues, rep calls, and instructions.",
  },
  {
    key: ProcessingStage.ANALYZING_MOVEMENT_WINDOWS,
    name: "Analyzing Movement",
    desc: "Determining expected joint angles and rep thresholds.",
  },
  {
    key: ProcessingStage.GENERATING_SIDECAR_MANIFEST,
    name: "Generating Sidecar Manifest",
    desc: "Compiling the final sidecar data structure for playback.",
  },
  {
    key: ProcessingStage.COMPLETED,
    name: "Completed",
    desc: "Assistance sidecar is ready in your library.",
  },
] as const;

export function getPreprocessingStageMetadata(stage: ProcessingStage): StageMetadata | null {
  if (stage === ProcessingStage.COMPLETED || stage === ProcessingStage.FAILED) {
    return null;
  }
  const idx = PIPELINE_STEPS.findIndex((s) => s.key === stage);
  if (idx === -1) return null;
  
  const step = PIPELINE_STEPS[idx];
  const stepNumber = idx + 1;
  const totalSteps = 7; // excluding COMPLETED

  return {
    stage,
    label: step.name,
    stepNumber,
    totalSteps,
    compactProgress: `Step ${stepNumber} of ${totalSteps}: ${step.name}`,
    description: step.desc,
    accessibleDescription: `Step ${stepNumber} of ${totalSteps}: ${step.name}. ${step.desc}`,
  };
}

export interface StageBadgeMetadata {
  text: string;
  semanticState: "ready" | "failed" | "preparing" | "unknown";
}

export function getPreprocessingStageBadge(stage: ProcessingStage): StageBadgeMetadata {
  switch (stage) {
    case ProcessingStage.COMPLETED:
      return {
        text: "Ready",
        semanticState: "ready",
      };
    case ProcessingStage.FAILED:
      return {
        text: "Failed",
        semanticState: "failed",
      };
    case ProcessingStage.SUBMITTED:
    case ProcessingStage.FETCHING_METADATA:
    case ProcessingStage.TRANSCRIBING:
    case ProcessingStage.ANCHORING_TIMELINE:
    case ProcessingStage.CLASSIFYING_TRAINER_INSTRUCTIONS:
    case ProcessingStage.ANALYZING_MOVEMENT_WINDOWS:
    case ProcessingStage.GENERATING_SIDECAR_MANIFEST:
      return {
        text: "Preparing",
        semanticState: "preparing",
      };
    default:
      return {
        text: stage,
        semanticState: "unknown",
      };
  }
}

