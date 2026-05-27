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
    description: "Submit a YouTube URL for ingestion",
    response: JSON.stringify({
      video_id: "be62cb5a-b4f0-470f-9c53-0e067ae0a91b"
    }, null, 2)
  },
  "GET /api/preprocessing/status/{video_id}": {
    pathParams: {
      video_id: "00000000-0000-0000-0000-000000000000"
    },
    description: "Check status of ingestion job",
    response: JSON.stringify({
      status: "downloading"
    }, null, 2)
  },
  "GET /api/preprocessing/jobs": {
    description: "List all ingestion jobs",
    response: JSON.stringify([
      {
        video_id: "be62cb5a-b4f0-470f-9c53-0e067ae0a91b",
        youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        stage: "downloading",
        error: null,
        title: "Beginner Squat Tutorial",
        duration: 360,
        video_path: "/storage/video.mp4",
        audio_path: "/storage/audio.mp3",
        created_at: "2026-05-27T01:30:00Z"
      }
    ], null, 2)
  },
  "DELETE /api/preprocessing/{video_id}": {
    pathParams: {
      video_id: "00000000-0000-0000-0000-000000000000"
    },
    description: "Delete an ingested video",
    response: JSON.stringify({
      status: "deleted",
      message: "Video and all associated files deleted successfully."
    }, null, 2)
  },
  "POST /api/session/start": {
    body: JSON.stringify({
      user_id: "00000000-0000-0000-0000-000000000000",
      video_id: "11111111-1111-1111-1111-111111111111"
    }, null, 2),
    description: "Start a new workout session",
    response: JSON.stringify({
      id: "be62cb5a-b4f0-470f-9c53-0e067ae0a91b",
      user_id: "00000000-0000-0000-0000-000000000000",
      video_id: "11111111-1111-1111-1111-111111111111",
      started_at: "2026-05-27T01:33:32.900838Z",
      ended_at: null,
      reps: [],
      form_errors: [],
      summary: null
    }, null, 2)
  },
  "POST /api/session/{session_id}/rep": {
    pathParams: {
      session_id: "00000000-0000-0000-0000-000000000000"
    },
    body: JSON.stringify({
      exercise_id: "22222222-2222-2222-2222-222222222222",
      rep_count: 1,
      metadata: {}
    }, null, 2),
    description: "Record a completed repetition",
    response: JSON.stringify({
      status: "recorded"
    }, null, 2)
  },
  "POST /api/session/{session_id}/form-error": {
    pathParams: {
      session_id: "00000000-0000-0000-0000-000000000000"
    },
    body: JSON.stringify({
      exercise_id: "22222222-2222-2222-2222-222222222222",
      form_error: {
        joint: "left_knee",
        observed_angle: 105.0,
        expected_range: [0.0, 90.0],
        severity: "medium",
        message: "Left knee is over-flexed."
      }
    }, null, 2),
    description: "Record a detected form error",
    response: JSON.stringify({
      status: "recorded"
    }, null, 2)
  },
  "POST /api/session/{session_id}/end": {
    pathParams: {
      session_id: "00000000-0000-0000-0000-000000000000"
    },
    description: "End an active workout session",
    response: JSON.stringify({
      status: "ended"
    }, null, 2)
  },
  "GET /api/session/{session_id}": {
    pathParams: {
      session_id: "00000000-0000-0000-0000-000000000000"
    },
    description: "Retrieve workout session details",
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
      summary: "Workout completed! You performed 1 repetitions with 1 form corrections."
    }, null, 2)
  },
  "POST /api/coach/correction": {
    body: JSON.stringify({
      exercise_id: "22222222-2222-2222-2222-222222222222",
      exercise_name: "Squat",
      joint: "left_knee",
      angle: 105.0,
      persona: "supportive"
    }, null, 2),
    description: "Generate corrective coaching feedback",
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
  "POST /api/coach/pacing": {
    body: JSON.stringify({
      session_id: "00000000-0000-0000-0000-000000000000",
      exercise_id: "22222222-2222-2222-2222-222222222222",
      lag_ratio: 1.15,
      persona: "supportive"
    }, null, 2),
    description: "Generic pacing feedback based on lag",
    response: JSON.stringify({
      text: "Take your time, slow it down.",
      persona: "supportive",
      modality: "audio",
      metadata: {
        lag_ratio: 1.15
      }
    }, null, 2)
  },
  "POST /api/coach/pacing/adaptive": {
    body: JSON.stringify({
      session_id: "00000000-0000-0000-0000-000000000000",
      exercise_id: "22222222-2222-2222-2222-222222222222",
      exercise_name: "Squat",
      expected_rep_duration_seconds: 4.0,
      rep_durations_seconds: [3.9, 4.0, 3.8],
      persona: "supportive"
    }, null, 2),
    description: "F3.5 Adaptive pacing and player adjustments",
    response: JSON.stringify({
      feature: "adaptive_pacing",
      decision: "recovery",
      coach_message: "Excellent job catching up. Resuming normal speed.",
      playback: {
        action: "resume",
        suggested_speed: 1.0
      },
      haptic: {
        enabled: true,
        pattern: "success-spark",
        sleeves: [],
        intensity: 0.5
      },
      rep_adjustment: null,
      metrics: {
        latest_lag_ratio: 0.95,
        rolling_average_lag_ratio: 0.975,
        sustained_lag: false,
        recovery_detected: true,
        form_errors_increasing: false
      },
      reason: "User has successfully matched the expected pace over recent repetitions."
    }, null, 2)
  },
  "POST /api/coach/pacing/rhythm": {
    body: JSON.stringify({
      session_id: "00000000-0000-0000-0000-000000000000",
      exercise_id: "22222222-2222-2222-2222-222222222222",
      exercise_name: "Pushup",
      expected_rep_duration_seconds: 3.0,
      rep_durations_seconds: [3.5, 3.6, 3.4],
      persona: "supportive"
    }, null, 2),
    description: "F3.6 Rhythmic tempo and audio coach messages",
    response: JSON.stringify({
      feature: "rhythm_pacing",
      decision: "too_slow",
      coach_message: "You're falling slightly behind the beat. Let's speed up just a bit.",
      rhythm: {
        expected_rep_duration_seconds: 3.0,
        user_average_rep_duration_seconds: 3.5,
        drift_ratio: 1.1666666666666667,
        drift_percent: 16.666666666666675,
        irregularity_score: 0.023328473740792194
      },
      reason: "User average repetition speed is slower than the video's rhythmic beat."
    }, null, 2)
  },
  "POST /api/coach/motivation": {
    body: JSON.stringify({
      milestone_event: "completed_5_reps",
      persona: "supportive"
    }, null, 2),
    description: "Motivational milestone quote generator",
    response: JSON.stringify({
      text: "Five reps in already! You are matching the pace flawlessly. Keep pushing!",
      persona: "supportive",
      modality: "audio",
      metadata: {
        milestone_event: "completed_5_reps"
      }
    }, null, 2)
  },
  "POST /api/coach/qa": {
    body: JSON.stringify({
      question: "How low should I go on squats?",
      session_context: {},
      persona: "supportive"
    }, null, 2),
    description: "Interactive Q&A with the coaching persona",
    response: JSON.stringify({
      text: "For a standard bodyweight squat, try to lower your hips until your thighs are parallel to the floor, ensuring your knees track in line with your toes for stability.",
      persona: "supportive",
      modality: "audio",
      metadata: {}
    }, null, 2)
  },
  "GET /api/coach/correction-templates/{exercise_id}": {
    pathParams: {
      exercise_id: "22222222-2222-2222-2222-222222222222"
    },
    description: "Get static correction templates for exercise",
    response: JSON.stringify([
      "Keep your back straight and chest proud.",
      "Gently lower your hips a bit more if comfortable.",
      "Track your knees straight ahead."
    ], null, 2)
  },
  "POST /api/user/register": {
    body: JSON.stringify({
      email: "jane.doe@example.com",
      name: "Jane Doe",
      coach_persona: "supportive",
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
      coach_persona: "supportive",
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
      coach_persona: "supportive",
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
      coach_persona: "energetic",
      feedback_modalities: ["audio", "haptic", "visual"]
    }, null, 2),
    description: "Update user preferences",
    response: JSON.stringify({
      id: "00000000-0000-0000-0000-000000000000",
      email: "jane.doe@example.com",
      name: "Jane Doe",
      coach_persona: "energetic",
      voice_settings: {
        speed: 1.0,
        voiceId: "en-US-Wavenet-F",
        spatialAudio: true
      },
      feedback_modalities: ["audio", "haptic", "visual"],
      created_at: "2026-05-27T01:00:00Z"
    }, null, 2)
  },
  "GET /api/user/{user_id}/history": {
    pathParams: {
      user_id: "00000000-0000-0000-0000-000000000000"
    },
    description: "Get completed session history for a user",
    response: JSON.stringify([
      {
        id: "576dd7b5-7b0c-4d28-8307-acea7ecc029f",
        user_id: "00000000-0000-0000-0000-000000000000",
        video_id: "11111111-1111-1111-1111-111111111111",
        started_at: "2026-05-27T01:35:32.921875Z",
        ended_at: "2026-05-27T01:35:50.000000Z",
        reps_count: 1,
        errors_count: 1
      }
    ], null, 2)
  },
  "GET /api/user/{user_id}/progress/{exercise_id}": {
    pathParams: {
      user_id: "00000000-0000-0000-0000-000000000000",
      exercise_id: "22222222-2222-2222-2222-222222222222"
    },
    description: "Retrieve metrics and reps for a specific movement",
    response: JSON.stringify({
      exercise_id: "22222222-2222-2222-2222-222222222222",
      exercise_name: "Squat",
      total_completed_reps: 15,
      accuracy_score: 0.92,
      form_error_breakdown: {
        left_knee: 3,
        right_knee: 1
      }
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
  },
  "GET /api/haptic/patterns": {
    description: "Retrieve the haptic patterns catalog",
    response: JSON.stringify({
      "double-pulse": {
        pulses: 2,
        interval_ms: 150,
        intensity: 0.8
      },
      "sustained-vibe": {
        duration_ms: 1000,
        intensity: 0.6
      }
    }, null, 2)
  }
};
