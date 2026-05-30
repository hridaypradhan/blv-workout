# Pacing & Rhythm Backend Testing Guide (Windows/PowerShell Compatible)

This guide describes how to run the FitA11y backend server and test all logic flows for Adaptive Video Pacing Control and Beat & Rhythm Pacing Assistant using PowerShell-compatible commands.

> [!IMPORTANT]
> **PowerShell Alias Warning**: By default, `curl` in PowerShell is an alias for `Invoke-WebRequest`, which does not support the standard Unix headers syntax and throws binding errors. 
> To test on Windows PowerShell, please use either:
> 1. **`Invoke-RestMethod`** (PowerShell's native REST cmdlet - Recommended)
> 2. **`curl.exe`** (the actual curl binary built into Windows 10+)

---

## 1. Start the Backend Server

First, navigate to the `backend` directory and launch the FastAPI server using `uvicorn`:

```powershell
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Confirm the server is healthy by hitting the `/health` endpoint:

```powershell
# PowerShell native
Invoke-RestMethod -Uri http://localhost:8000/health

# curl.exe
curl.exe http://localhost:8000/health
```
**Expected Response:** `{"status":"ok"}`

---

## 2. Session Management Endpoints

Sessions are managed in-memory and must be started first to capture reps and form errors.

### 2.1 Start Workout Session and Save ID
To test subsequent endpoints without manually copying UUIDs, we save the started session's ID to a variable:

```powershell
# PowerShell native (Recommended)
$Session = Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/session/start `
  -ContentType "application/json" `
  -Body '{"user_id": "00000000-0000-0000-0000-000000000000", "video_id": "11111111-1111-1111-1111-111111111111"}'
$SessionId = $Session.id
echo "Created Session ID: $SessionId"

# curl.exe equivalent (Manually copy the returned "id" value into $SessionId = "..." afterwards)
curl.exe -X POST http://localhost:8000/api/session/start `
  -H "Content-Type: application/json" `
  -d '{\"user_id\": \"00000000-0000-0000-0000-000000000000\", \"video_id\": \"11111111-1111-1111-1111-111111111111\"}'
```
**Expected Outcome:** Returns a complete `Session` object containing a generated UUID.

### 2.2 Record a Repetition
```powershell
# PowerShell native
Invoke-RestMethod -Method Post -Uri "http://localhost:8000/api/session/$SessionId/rep" `
  -ContentType "application/json" `
  -Body '{"exercise_id": "22222222-2222-2222-2222-222222222222", "rep_count": 1, "metadata": {}}'

# curl.exe (Assuming $SessionId is populated, or replace $SessionId with actual UUID)
curl.exe -X POST http://localhost:8000/api/session/$SessionId/rep `
  -H "Content-Type: application/json" `
  -d '{\"exercise_id\": \"22222222-2222-2222-2222-222222222222\", \"rep_count\": 1}'
```

### 2.3 Record a Form Error
```powershell
# PowerShell native
Invoke-RestMethod -Method Post -Uri "http://localhost:8000/api/session/$SessionId/form-error" `
  -ContentType "application/json" `
  -Body '{"exercise_id": "22222222-2222-2222-2222-222222222222", "form_error": {"joint": "left_knee", "observed_angle": 105.0, "expected_range": [0.0, 90.0], "severity": "medium", "message": "Left knee is over-flexed."}}'

# curl.exe
curl.exe -X POST http://localhost:8000/api/session/$SessionId/form-error `
  -H "Content-Type: application/json" `
  -d '{\"exercise_id\": \"22222222-2222-2222-2222-222222222222\", \"form_error\": {\"joint\": \"left_knee\", \"observed_angle\": 105.0, \"expected_range\": [0.0, 90.0], \"severity\": \"medium\", \"message\": \"Left knee is over-flexed.\"}}'
```

### 2.4 Get Current Session State
```powershell
# PowerShell native
Invoke-RestMethod -Uri "http://localhost:8000/api/session/$SessionId"

# curl.exe
curl.exe http://localhost:8000/api/session/$SessionId
```

### 2.5 End Session (Generates Summary)
```powershell
# PowerShell native
Invoke-RestMethod -Method Post -Uri "http://localhost:8000/api/session/$SessionId/end"

# curl.exe
curl.exe -X POST http://localhost:8000/api/session/$SessionId/end
```
**Expected Outcome:** Returns `{"status":"ended"}`.

---

## 3. Adaptive Video Pacing Control Endpoints

Adaptive pacing monitors user rep pacing compared to the video guide and suggests playback adjustments or haptic pulses.

### 3.1 Scenario: On Pace (`none`)
User's rep durations closely match the expected 4 seconds.
```powershell
# PowerShell native
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/assistant/pacing/adaptive `
  -ContentType "application/json" `
  -Body '{"session_id": "00000000-0000-0000-0000-000000000000", "exercise_id": "22222222-2222-2222-2222-222222222222", "exercise_name": "Squat", "expected_rep_duration_seconds": 4.0, "rep_durations_seconds": [3.9, 4.0, 3.8], "persona": "supportive"}'

# curl.exe
curl.exe -X POST http://localhost:8000/api/assistant/pacing/adaptive `
  -H "Content-Type: application/json" `
  -d '{\"session_id\": \"00000000-0000-0000-0000-000000000000\", \"exercise_id\": \"22222222-2222-2222-2222-222222222222\", \"exercise_name\": \"Squat\", \"expected_rep_duration_seconds\": 4.0, \"rep_durations_seconds\": [3.9, 4.0, 3.8], \"persona\": \"supportive\"}'
```
**Expected Response:** Decision `"none"`. Suggested playback speed is `1.0`. Pacing message is positive: `"Great pace! Keep it up."`

### 3.2 Scenario: Slight Pacing Lag (`slow_prompt`)
User is slightly behind pace (between 1% and 20% slower than expected).
```powershell
# PowerShell native
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/assistant/pacing/adaptive `
  -ContentType "application/json" `
  -Body '{"session_id": "00000000-0000-0000-0000-000000000000", "exercise_id": "22222222-2222-2222-2222-222222222222", "exercise_name": "Squat", "expected_rep_duration_seconds": 4.0, "rep_durations_seconds": [4.5], "persona": "supportive"}'

# curl.exe
curl.exe -X POST http://localhost:8000/api/assistant/pacing/adaptive `
  -H "Content-Type: application/json" `
  -d '{\"session_id\": \"00000000-0000-0000-0000-000000000000\", \"exercise_id\": \"22222222-2222-2222-2222-222222222222\", \"exercise_name\": \"Squat\", \"expected_rep_duration_seconds\": 4.0, \"rep_durations_seconds\": [4.5], \"persona\": \"supportive\"}'
```
**Expected Response:** Decision `"slow_prompt"`. Action is `"slow"`, suggested speed is `0.75`, and the double-pulse haptic pattern is enabled to alert the user.

### 3.3 Scenario: Sustained Medium Pacing Lag (`hold_cue`)
User has sustained lag (ratios > 1.2 for at least 2 reps) and is between 21% and 40% behind.
```powershell
# PowerShell native
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/assistant/pacing/adaptive `
  -ContentType "application/json" `
  -Body '{"session_id": "00000000-0000-0000-0000-000000000000", "exercise_id": "22222222-2222-2222-2222-222222222222", "exercise_name": "Squat", "expected_rep_duration_seconds": 4.0, "recent_lag_ratios": [1.3, 1.3], "persona": "supportive"}'

# curl.exe
curl.exe -X POST http://localhost:8000/api/assistant/pacing/adaptive `
  -H "Content-Type: application/json" `
  -d '{\"session_id\": \"00000000-0000-0000-0000-000000000000\", \"exercise_id\": \"22222222-2222-2222-2222-222222222222\", \"exercise_name\": \"Squat\", \"expected_rep_duration_seconds\": 4.0, \"recent_lag_ratios\": [1.3, 1.3], \"persona\": \"supportive\"}'
```
**Expected Response:** Decision `"hold_cue"`. Action is `"pause"`, suggested speed is `0.0`, and the `sustained-vibe` haptic pattern is triggered on the sleeves.

### 3.4 Scenario: Sustained Severe Pacing Lag (`adaptation_recommendation`)
User is more than 40% behind pace on a sustained basis. Target reps is reduced.
```powershell
# PowerShell native
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/assistant/pacing/adaptive `
  -ContentType "application/json" `
  -Body '{"session_id": "00000000-0000-0000-0000-000000000000", "exercise_id": "22222222-2222-2222-2222-222222222222", "exercise_name": "Squat", "expected_rep_duration_seconds": 4.0, "recent_lag_ratios": [1.5, 1.6], "target_reps": 10, "completed_reps": 3, "persona": "supportive"}'

# curl.exe
curl.exe -X POST http://localhost:8000/api/assistant/pacing/adaptive `
  -H "Content-Type: application/json" `
  -d '{\"session_id\": \"00000000-0000-0000-0000-000000000000\", \"exercise_id\": \"22222222-2222-2222-2222-222222222222\", \"exercise_name\": \"Squat\", \"expected_rep_duration_seconds\": 4.0, \"recent_lag_ratios\": [1.5, 1.6], \"target_reps\": 10, \"completed_reps\": 3, \"persona\": \"supportive\"}'
```
**Expected Response:** Decision `"adaptation_recommendation"`. Action `"slow"`, suggested speed `0.75`. `adaptation_recommendation` shows the tracking target adjusted from 10 to 8. Haptic pattern is `triple-pulse`.

### 3.5 Scenario: Sustained Lag with Increasing Form Errors (`modification_offer`)
Sustained pacing lag accompanied by climbing form error counts.
```powershell
# PowerShell native
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/assistant/pacing/adaptive `
  -ContentType "application/json" `
  -Body '{"session_id": "00000000-0000-0000-0000-000000000000", "exercise_id": "22222222-2222-2222-2222-222222222222", "exercise_name": "Squat", "expected_rep_duration_seconds": 4.0, "recent_lag_ratios": [1.3, 1.3], "recent_form_error_counts": [1, 2], "persona": "supportive"}'

# curl.exe
curl.exe -X POST http://localhost:8000/api/assistant/pacing/adaptive `
  -H "Content-Type: application/json" `
  -d '{\"session_id\": \"00000000-0000-0000-0000-000000000000\", \"exercise_id\": \"22222222-2222-2222-2222-222222222222\", \"exercise_name\": \"Squat\", \"expected_rep_duration_seconds\": 4.0, \"recent_lag_ratios\": [1.3, 1.3], \"recent_form_error_counts\": [1, 2], \"persona\": \"supportive\"}'
```
**Expected Response:** Decision `"modification_offer"`. Cues user to try a modified version: `"If this is feeling tough, we can try a modified version to keep you safe."`

### 3.6 Scenario: Pace Recovery (`recovery`)
User catches up and returns below the lag threshold.
```powershell
# PowerShell native
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/assistant/pacing/adaptive `
  -ContentType "application/json" `
  -Body '{"session_id": "00000000-0000-0000-0000-000000000000", "exercise_id": "22222222-2222-2222-2222-222222222222", "exercise_name": "Squat", "expected_rep_duration_seconds": 4.0, "recent_lag_ratios": [1.0, 1.0], "persona": "supportive"}'

# curl.exe
curl.exe -X POST http://localhost:8000/api/assistant/pacing/adaptive `
  -H "Content-Type: application/json" `
  -d '{\"session_id\": \"00000000-0000-0000-0000-000000000000\", \"exercise_id\": \"22222222-2222-2222-2222-222222222222\", \"exercise_name\": \"Squat\", \"expected_rep_duration_seconds\": 4.0, \"recent_lag_ratios\": [1.0, 1.0], \"persona\": \"supportive\"}'
```
**Expected Response:** Decision `"recovery"`. Action is `"play"`, suggested speed is `1.0`. Haptic is `success-spark`.

### 3.7 Scenario: User Command Override (`override_acknowledged`)
User command `"keep_going"` bypasses the pacing intervention.
```powershell
# PowerShell native
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/assistant/pacing/adaptive `
  -ContentType "application/json" `
  -Body '{"session_id": "00000000-0000-0000-0000-000000000000", "exercise_id": "22222222-2222-2222-2222-222222222222", "exercise_name": "Squat", "expected_rep_duration_seconds": 4.0, "recent_lag_ratios": [1.3, 1.3], "user_command": "keep_going", "persona": "supportive"}'

# curl.exe
curl.exe -X POST http://localhost:8000/api/assistant/pacing/adaptive `
  -H "Content-Type: application/json" `
  -d '{\"session_id\": \"00000000-0000-0000-0000-000000000000\", \"exercise_id\": \"22222222-2222-2222-2222-222222222222\", \"exercise_name\": \"Squat\", \"expected_rep_duration_seconds\": 4.0, \"recent_lag_ratios\": [1.3, 1.3], \"user_command\": \"keep_going\", \"persona\": \"supportive\"}'
```
**Expected Response:** Decision `"override_acknowledged"`. Suggested playback speed returns to `1.0` and message confirms override.

---

## 4. Rhythm Pacing Assistant Endpoints

Rhythm pacing calculates the drift ratio and irregularity of user movements relative to beat tracks.

### 4.1 Scenario: On Rhythm
User average durations perfectly match the expected 3.0s interval.
```powershell
# PowerShell native
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/assistant/pacing/rhythm `
  -ContentType "application/json" `
  -Body '{"session_id": "00000000-0000-0000-0000-000000000000", "exercise_id": "22222222-2222-2222-2222-222222222222", "exercise_name": "Pushup", "expected_rep_duration_seconds": 3.0, "rep_durations_seconds": [3.0, 3.1, 2.9], "persona": "supportive"}'

# curl.exe
curl.exe -X POST http://localhost:8000/api/assistant/pacing/rhythm `
  -H "Content-Type: application/json" `
  -d '{\"session_id\": \"00000000-0000-0000-0000-000000000000\", \"exercise_id\": \"22222222-2222-2222-2222-222222222222\", \"exercise_name\": \"Pushup\", \"expected_rep_duration_seconds\": 3.0, \"rep_durations_seconds\": [3.0, 3.1, 2.9], \"persona\": \"supportive\"}'
```
**Expected Response:** Decision `"on_rhythm"`. `irregularity_score` is low, and `drift_percent` is near zero.

### 4.2 Scenario: Too Slow
User reps are on average slower than the 3.0s guide.
```powershell
# PowerShell native
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/assistant/pacing/rhythm `
  -ContentType "application/json" `
  -Body '{"session_id": "00000000-0000-0000-0000-000000000000", "exercise_id": "22222222-2222-2222-2222-222222222222", "exercise_name": "Pushup", "expected_rep_duration_seconds": 3.0, "rep_durations_seconds": [3.5, 3.6, 3.4], "persona": "supportive"}'

# curl.exe
curl.exe -X POST http://localhost:8000/api/assistant/pacing/rhythm `
  -H "Content-Type: application/json" `
  -d '{\"session_id\": \"00000000-0000-0000-0000-000000000000\", \"exercise_id\": \"22222222-2222-2222-2222-222222222222\", \"exercise_name\": \"Pushup\", \"expected_rep_duration_seconds\": 3.0, \"rep_durations_seconds\": [3.5, 3.6, 3.4], \"persona\": \"supportive\"}'
```
**Expected Response:** Decision `"too_slow"`. Message: `"You're falling slightly behind the beat. Let's speed up just a bit."`

### 4.3 Scenario: Too Fast
User reps are consistently faster than the 3.0s pace.
```powershell
# PowerShell native
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/assistant/pacing/rhythm `
  -ContentType "application/json" `
  -Body '{"session_id": "00000000-0000-0000-0000-000000000000", "exercise_id": "22222222-2222-2222-2222-222222222222", "exercise_name": "Pushup", "expected_rep_duration_seconds": 3.0, "rep_durations_seconds": [2.5, 2.6, 2.4], "persona": "supportive"}'

# curl.exe
curl.exe -X POST http://localhost:8000/api/assistant/pacing/rhythm `
  -H "Content-Type: application/json" `
  -d '{\"session_id\": \"00000000-0000-0000-0000-000000000000\", \"exercise_id\": \"22222222-2222-2222-2222-222222222222\", \"exercise_name\": \"Pushup\", \"expected_rep_duration_seconds\": 3.0, \"rep_durations_seconds\": [2.5, 2.6, 2.4], \"persona\": \"supportive\"}'
```
**Expected Response:** Decision `"too_fast"`. Message: `"You're ahead of the beat. Let's slow down and feel the rhythm."`

### 4.4 Scenario: Irregular Rhythm
User pace fluctuates widely between repetitions.
```powershell
# PowerShell native
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/assistant/pacing/rhythm `
  -ContentType "application/json" `
  -Body '{"session_id": "00000000-0000-0000-0000-000000000000", "exercise_id": "22222222-2222-2222-2222-222222222222", "exercise_name": "Pushup", "expected_rep_duration_seconds": 3.0, "rep_durations_seconds": [2.0, 4.0, 2.2, 3.8], "persona": "supportive"}'

# curl.exe
curl.exe -X POST http://localhost:8000/api/assistant/pacing/rhythm `
  -H "Content-Type: application/json" `
  -d '{\"session_id\": \"00000000-0000-0000-0000-000000000000\", \"exercise_id\": \"22222222-2222-2222-2222-222222222222\", \"exercise_name\": \"Pushup\", \"expected_rep_duration_seconds\": 3.0, \"rep_durations_seconds\": [2.0, 4.0, 2.2, 3.8], \"persona\": \"supportive\"}'
```
**Expected Response:** Decision `"irregular"`. `irregularity_score` is >= 0.15, triggering the cue to stabilize.

### 4.5 Scenario: Insufficient Data
User has only completed 1 rep so far, preventing standard deviation calculations.
```powershell
# PowerShell native
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/assistant/pacing/rhythm `
  -ContentType "application/json" `
  -Body '{"session_id": "00000000-0000-0000-0000-000000000000", "exercise_id": "22222222-2222-2222-2222-222222222222", "exercise_name": "Pushup", "expected_rep_duration_seconds": 3.0, "rep_durations_seconds": [3.0], "persona": "supportive"}'

# curl.exe
curl.exe -X POST http://localhost:8000/api/assistant/pacing/rhythm `
  -H "Content-Type: application/json" `
  -d '{\"session_id\": \"00000000-0000-0000-0000-000000000000\", \"exercise_id\": \"22222222-2222-2222-2222-222222222222\", \"exercise_name\": \"Pushup\", \"expected_rep_duration_seconds\": 3.0, \"rep_durations_seconds\": [3.0], \"persona\": \"supportive\"}'
```
**Expected Response:** Decision `"insufficient_data"`. Message advises the user to perform more reps.
