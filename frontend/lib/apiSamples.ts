export interface ApiSample {
  pathParams?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: string;
  response?: string;
  description?: string;
}

export const apiSamples: Record<string, ApiSample> = {
  "GET /health": {
    description: "System health check",
    response: JSON.stringify({
      status: "ok"
    }, null, 2)
  },
  "POST /api/preprocessing/submit": {
    body: JSON.stringify({
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    }, null, 2),
    description: "Submit a YouTube URL for ingestion and sidecar preparation",
    response: JSON.stringify({
      video_id: "be62cb5a-b4f0-470f-9c53-0e067ae0a91b"
    }, null, 2)
  },
  "GET /api/preprocessing/status/{video_id}": {
    pathParams: {
      video_id: "00000000-0000-0000-0000-000000000000"
    },
    description: "Check status of assistance preparation job",
    response: JSON.stringify({
      video_id: "be62cb5a-b4f0-470f-9c53-0e067ae0a91b",
      youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      youtube_id: "dQw4w9WgXcQ",
      stage: "fetching_metadata",
      error: null,
      title: "Beginner Squat Tutorial",
      channel_name: "Bodyweight Coach",
      thumbnail_url: "https://img.youtube.com/vi/dQw4w9WgXcQ/0.jpg",
      duration: 360,
      created_at: "2026-05-27T01:30:00Z"
    }, null, 2)
  },
  "GET /api/preprocessing/jobs": {
    description: "List all assistance preparation jobs",
    response: JSON.stringify([
      {
        video_id: "be62cb5a-b4f0-470f-9c53-0e067ae0a91b",
        youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        youtube_id: "dQw4w9WgXcQ",
        stage: "completed",
        error: null,
        title: "Beginner Squat Tutorial",
        channel_name: "Bodyweight Coach",
        thumbnail_url: "https://img.youtube.com/vi/dQw4w9WgXcQ/0.jpg",
        duration: 360,
        created_at: "2026-05-27T01:30:00Z"
      }
    ], null, 2)
  },
  "DELETE /api/preprocessing/{video_id}": {
    pathParams: {
      video_id: "00000000-0000-0000-0000-000000000000"
    },
    description: "Delete an ingested video preparation record",
    response: JSON.stringify({
      status: "deleted",
      message: "Ingestion record deleted successfully."
    }, null, 2)
  },
  "GET /api/preprocessing/transcript/{video_id}": {
    pathParams: {
      video_id: "00000000-0000-0000-0000-000000000000"
    },
    description: "Retrieve pre-processed text and segment-level transcripts for grounding",
    response: JSON.stringify({
      video_id: "00000000-0000-0000-0000-000000000000",
      transcript_text: "Let's start with some squats...",
      transcript_segments: [
        {
          start_ms: 1000,
          end_ms: 5000,
          text: "Let's start with some squats..."
        }
      ]
    }, null, 2)
  },
  "POST /api/session/start": {
    body: JSON.stringify({
      user_id: "00000000-0000-0000-0000-000000000000",
      video_id: "11111111-1111-1111-1111-111111111111"
    }, null, 2),
    description: "Start a new assisted playback session",
    response: JSON.stringify({
      id: "be62cb5a-b4f0-470f-9c53-0e067ae0a91b",
      user_id: "00000000-0000-0000-0000-000000000000",
      video_id: "11111111-1111-1111-1111-111111111111",
      started_at: "2026-05-27T01:33:32.900838Z",
      ended_at: null,
      reps: [],
      form_errors: [],
      playback_events: [],
      summary: null
    }, null, 2)
  },
  "POST /api/session/{session_id}/finalize": {
    pathParams: {
      session_id: "00000000-0000-0000-0000-000000000000"
    },
    body: JSON.stringify({
      playback_events: [
        {
          event_type: "pause",
          timestamp_ms: 12500,
          metadata: { reason: "user_triggered" }
        }
      ],
      reps: [
        {
          exercise_id: "22222222-2222-2222-2222-222222222222",
          rep_count: 1,
          timestamp: "2026-05-27T01:35:33.170345Z",
          metadata: {}
        }
      ],
      form_errors: [
        {
          exercise_id: "22222222-2222-2222-2222-222222222222",
          form_error: {
            joint: "left_knee",
            observed_angle: 105.0,
            expected_range: [0.0, 90.0],
            severity: "medium",
            message: "Left knee is over-flexed."
          },
          timestamp: "2026-05-27T01:35:33.170345Z"
        }
      ]
    }, null, 2),
    description: "Finalize and save all workout telemetry and interaction events in a single transaction",
    response: JSON.stringify({
      status: "finalized",
      message: "Session telemetry saved and session ended successfully."
    }, null, 2)
  },
  "GET /api/session/{session_id}": {
    pathParams: {
      session_id: "00000000-0000-0000-0000-000000000000"
    },
    description: "Retrieve assisted playback session details",
    response: JSON.stringify({
      id: "576dd7b5-7b0c-4d28-8307-acea7ecc029f",
      user_id: "00000000-0000-0000-0000-000000000000",
      video_id: "11111111-1111-1111-1111-111111111111",
      started_at: "2026-05-27T01:35:32.921875Z",
      ended_at: "2026-05-27T01:35:50.000000Z",
      reps: [
        {
          id: "67acbb07-ddc7-418c-bace-e4c74eb403d5",
          session_id: "576dd7b5-7b0c-4d28-8307-acea7ecc029f",
          exercise_id: "22222222-2222-2222-2222-222222222222",
          rep_count: 1,
          timestamp: "2026-05-27T01:35:33.170345Z",
          metadata: {}
        }
      ],
      form_errors: [
        {
          joint: "left_knee",
          observed_angle: 105.0,
          expected_range: [0.0, 90.0],
          severity: "medium",
          message: "Left knee is over-flexed."
        }
      ],
      playback_events: [
        {
          event_type: "slow",
          timestamp_ms: 5000,
          metadata: { speed: 0.75 }
        }
      ],
      summary: "Session completed! You performed 1 tracked repetitions with 1 haptic/vocal corrections."
    }, null, 2)
  },
  "POST /api/assistant/correction": {
    body: JSON.stringify({
      exercise_id: "22222222-2222-2222-2222-222222222222",
      exercise_name: "Squat",
      joint: "left_knee",
      angle: 105.0,
      persona: "supportive"
    }, null, 2),
    description: "Generate corrective assistant cue feedback",
    response: JSON.stringify({
      text: "Gently guide your left knee slightly inward to align with your foot.",
      persona: "supportive",
      modality: "audio",
      metadata: {
        joint: "left_knee",
        angle: 105.0
      }
    }, null, 2)
  },
  "POST /api/assistant/qa": {
    body: JSON.stringify({
      question: "How low should I go on squats?",
      session_context: {},
      persona: "supportive"
    }, null, 2),
    description: "Interactive Q&A with the assistant persona",
    response: JSON.stringify({
      text: "For a standard bodyweight squat, try to lower your hips until your thighs are parallel to the floor, ensuring your knees track in line with your toes for stability.",
      persona: "supportive",
      modality: "audio",
      metadata: {}
    }, null, 2)
  },
  "POST /api/user/register": {
    body: JSON.stringify({
      email: "jane.doe@example.com",
      name: "Jane Doe",
      assistant_persona: "supportive",
      voice_settings: {
        speed: 1.0,
        voiceId: "en-US-Wavenet-F",
        spatialAudio: true
      },
      feedback_modalities: ["audio", "haptic"]
    }, null, 2),
    description: "Register a new user profile",
    response: JSON.stringify({
      id: "00000000-0000-0000-0000-000000000000",
      email: "jane.doe@example.com",
      name: "Jane Doe",
      assistant_persona: "supportive",
      voice_settings: {
        speed: 1.0,
        voiceId: "en-US-Wavenet-F",
        spatialAudio: true
      },
      feedback_modalities: ["audio", "haptic"],
      created_at: "2026-05-27T01:00:00Z"
    }, null, 2)
  },
  "GET /api/user/{user_id}": {
    pathParams: {
      user_id: "00000000-0000-0000-0000-000000000000"
    },
    description: "Retrieve user profile details",
    response: JSON.stringify({
      id: "00000000-0000-0000-0000-000000000000",
      email: "jane.doe@example.com",
      name: "Jane Doe",
      assistant_persona: "supportive",
      voice_settings: {
        speed: 1.0,
        voiceId: "en-US-Wavenet-F",
        spatialAudio: true
      },
      feedback_modalities: ["audio", "haptic"],
      created_at: "2026-05-27T01:00:00Z"
    }, null, 2)
  },
  "PATCH /api/user/{user_id}/settings": {
    pathParams: {
      user_id: "00000000-0000-0000-0000-000000000000"
    },
    body: JSON.stringify({
      assistant_persona: "energetic",
      feedback_modalities: ["audio", "haptic", "visual"]
    }, null, 2),
    description: "Update user preferences",
    response: JSON.stringify({
      id: "00000000-0000-0000-0000-000000000000",
      email: "jane.doe@example.com",
      name: "Jane Doe",
      assistant_persona: "energetic",
      voice_settings: {
        speed: 1.0,
        voiceId: "en-US-Wavenet-F",
        spatialAudio: true
      },
      feedback_modalities: ["audio", "haptic", "visual"],
      created_at: "2026-05-27T01:00:00Z"
    }, null, 2)
  },

  "POST /api/haptic/test": {
    body: JSON.stringify({
      sleeve_side: "left"
    }, null, 2),
    description: "Fire a test pattern pulse on selected sleeve",
    response: JSON.stringify({
      success: true
    }, null, 2)
  },
  "POST /api/haptic/trigger": {
    body: JSON.stringify({
      sleeve_sides: ["left"],
      pattern_name: "double-pulse",
      intensity: 0.8
    }, null, 2),
    description: "Manually fire a registered haptic vibration pattern",
    response: JSON.stringify({
      status: "triggered",
      pattern: "double-pulse",
      intensity: 0.8
    }, null, 2)
  }
};
