export enum CoachPersona {
  HYPE = "HYPE",
  TECHNICAL = "TECHNICAL",
  SUPPORTIVE = "SUPPORTIVE",
}

export enum ProcessingStage {
  SUBMITTED = "submitted",
  DOWNLOADING = "downloading",
  TRANSCRIBING = "transcribing",
  SEGMENTING = "segmenting",
  ANALYZING = "analyzing",
  GENERATING_MANIFEST = "generating_manifest",
  COMPLETED = "completed",
  FAILED = "failed",
}

/** Lightweight import job record returned by the backend. */
export interface ImportJob {
  video_id: string;
  youtube_url: string;
  stage: ProcessingStage;
  error?: string | null;
  title?: string | null;
  duration?: number | null;
  video_path?: string | null;
  audio_path?: string | null;
  created_at?: string | null;
}

export interface SleeveStatus {
  leftArm: boolean;
  rightArm: boolean;
  leftLeg: boolean;
  rightLeg: boolean;
}

export interface User {
  id: string;
  name: string;
  visionLevel: string;
  screenReaderType: string;
  personaPreference: CoachPersona;
  voiceSettings: {
    speed: number;
    voiceId: string;
    spatialAudio: boolean;
  };
  sleeveMap: SleeveStatus;
}

export interface Exercise {
  id: string;
  name: string;
  primaryBodyPart: string;
  secondaryBodyParts: string[];
  countingJoint: string;
  repThresholds: {
    minAngle: number;
    maxAngle: number;
  };
  hapticProfile: string;
  descriptions: string[];
}

export interface Video {
  id: string;
  youtubeUrl: string;
  title: string;
  exercises: Exercise[];
  processingStatus: ProcessingStage;
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  videoId: string;
  startTime: string;
  endTime: string;
  repEvents: Array<{
    timestamp: string;
    repNumber: number;
    accuracy: number;
  }>;
  formErrors: Array<{
    timestamp: string;
    exerciseName: string;
    errorType: string;
    details: string;
  }>;
  paceScore: string;
}
