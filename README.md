# FitA11y

FitA11y is an **assistive playback companion** prototype designed specifically for **Blind and Low Vision (BLV)** users. Rather than replacing the trainer or hosting standalone AI-led workouts, FitA11y operates alongside original YouTube fitness videos. It provides supplementary, non-intrusive voice cues (for form correction and pacing) and haptic feedback (delivered via bHaptics or accessible visual/spoken fallback indicators), keeping the YouTube creator as the trainer of record.

---

## Key Features

1. **Creator-First Policy & YouTube Playback**
   The user watches the original video via an embedded YouTube IFrame player. FitA11y never downloads, hosts, or distributes the video for playback, preserving creator monetization and ownership.
2. **Assistance Sidecar Manifest**
   A JSON sidecar generated during preprocessing that maps exercise anchors, speaking opportunities, expected movement windows, and haptic cues to the original video's timeline.
3. **Audio Coexistence & Interruption Levels**
   Intelligent speech ducking and interruption rules (Silent, Haptic Only, Brief Speech, Full Speech, Pause Before Speaking) ensuring the assistant never talks over the trainer unless preferred.
4. **bHaptics & Fallback Cues**
   Generates tactile vibration sequence instructions (for pacing adjustments, joint extension limits, or movement corrections) mapped to neutral bHaptics event names, delivered directly to wearable sleeves using the bHaptics SDK/Player, or gracefully falling back to visual/spoken indicators.
5. **Tracked User Performance**
   Maintains structured, screen-reader-accessible session records, tracking reps, form logs, and duration trends separately from the trainer's workout benchmark.
6. **Interactive API Lab Playground**
   An internal playground to inspect, build, and run API requests directly in the browser with full OpenAPI spec auto-syncing.
7. **Canonical Assistant Personas (Cheerleader, Guide, Sergeant)**
   Three canonical assistant personas (`cheerleader`, `guide`, `sergeant`) govern spoken correction caps per exercise today. Their motivation cadence and exercise-wrap rules are tracked as deterministic prototype policy and are only spoken when FitA11y can pause before speaking; they never alter or replace the original YouTube creator's voice.

---

## Tech Stack

- **Backend (Prototype/Cloud-Ready):** FastAPI (Python) running a simulated engine with a pluggable storage architecture. It defaults to offline-capable local JSON-based persistence for local prototypes, with cloud provider adapters for AWS DynamoDB and AWS S3 storage.
- **Frontend:** Next.js (React), TypeScript, Tailwind CSS.

---

## Prototype Implementation & Simulation Boundaries

FitA11y is currently implemented as an end-to-end runnable **prototype** to showcase assistive playback companion capabilities and validate the architecture:

#### Current Prototype State:
- **Embedded YouTube Player**: Real YouTube player integration where playback events (play/pause/seek/speed changes) drive session timing.
- **Deterministic & Gemini-Backed Sidecars**: Pre-processing generates structured sidecar manifests mapping events to the video timeline. By default, it operates in offline-capable deterministic `prototype` mode. However, if configured with `AI_PROVIDER=gemini` and a valid `GEMINI_API_KEY`, the backend uses the Google GenAI SDK to call Gemini models to analyze YouTube captions and generate structured sidecars dynamically. If the API key is missing, captions are unavailable, or the Gemini response fails schema validation constraints, the coordinator falls back cleanly to the offline `prototype` strategy.
- **Deterministic & Gemini-Backed Assistant Q&A**: Answers user questions dynamically in the workout session chat. By default, it operates in offline-capable deterministic prototype mode. If configured with `AI_PROVIDER=gemini` and a valid `GEMINI_API_KEY`, it uses Gemini to generate answers grounded in the video's sidecar timelines, transcripts (using a compact ±60-second window around the current timestamp), and cue plans, falling back cleanly to the prototype on failures.
- **bHaptics Sleeve Integration**: Fully integrated with bHaptics. If `BHAPTICS_ENABLED=true` and a physical sleeve connection is active via the bHaptics Player app, haptic events are fired directly to the sleeves. If bHaptics is disabled, disconnected, or unsupported, the application seamlessly falls back to visual and spoken indicators in the web session.
- **Live MediaPipe Pose Observation**: Live MediaPipe pose tracking runs locally on the browser camera stream during the active workout session to compute basic joint angles (e.g. elbow, knee, hip) and visibility. Real browser-local MediaPipe repetition counting and form analysis have been implemented for supported exercises (squat and bicep curl), while unsupported exercises or lost tracking states fall back safely to prototype-simulated tracking. Saved session events explicitly distinguish `camera_mediapipe` from `prototype_pose` provider sources. All camera frames and landmarks remain browser-local; no images or coordinates are transmitted externally. The local model is stored at `frontend/public/mediapipe/pose_landmarker_heavy.task`. Note that tracking is designed for accessibility feedback and is not clinically validated biomechanics.
- **Pre-Session Setup Positioning**: Pre-session setup screen features browser-local Google MediaPipe Pose Landmarker tracking, offering a real-time alignment guide for Centering, Depth, Facing Orientation, and Body Posture. The `pose_landmarker_heavy.task` model (~30 MB) is committed to the repository at `frontend/public/mediapipe/pose_landmarker_heavy.task`. The hook `useMediaPipePoseLandmarker` performs a HEAD request at startup — if the local file is found, it is used; if not, the model is streamed from the Google CDN automatically.
- **Pluggable Storage / JSON Persistence**: Prepared jobs, session histories, and user settings are saved locally as JSON files under the `backend/.prototype_data` directory by default, with AWS DynamoDB and S3 cloud storage configuration options; no SQL database or database migration layer is active.

#### Live Voice Control

Voice control is implemented during live sessions as a **browser SpeechRecognition prototype**. It provides hands-free interaction through deterministic playback commands, voice navigation, and voice-submitted Q&A. It is enabled by default on initial live session mount if supported.

**Architecture:**
- Uses the browser's native Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`).
- Does **not** use Gemini Live audio.
- Does **not** stream microphone audio to the backend.
- Voice Q&A input is converted to text and submitted through the existing `/api/assistant/qa` flow.
- Manual buttons and typed Q&A remain the reliable fallback.

**Supported Voice Commands:**

| Category | Supported Phrases |
|---|---|
| **Pause** | `pause`, `pause video`, `stop playback`, `pause playback` |
| **Resume** | `resume`, `play`, `start video`, `continue`, `unpause`, `resume playback`, `resume video` |
| **Rewind** | `rewind`, `go back`, `back`, `rewind 15 seconds`, `go back 30` (default: 10s) |
| **Forward** | `forward`, `skip ahead`, `fast forward`, `skip ahead 15`, `fast forward 20 seconds` (default: 10s) |
| **Slow Down** | `slow down`, `slower`, `reduce speed` |
| **Normal Speed** | `normal speed`, `regular speed`, `reset speed` |
| **Speed Up** | `speed up`, `faster`, `increase speed` |
| **Previous Section** | `previous section`, `previous exercise`, `go back a section` |
| **Next Section** | `next section`, `skip section`, `skip to next exercise`, `next exercise`, `skip to next section` |
| **Read Section** | `read current section`, `read section`, `please read current section` |
| **Scroll Down** | `scroll down`, `scroll down please`, `please scroll down` |
| **Scroll Up** | `scroll up`, `scroll up please`, `please scroll up` |
| **Page Down** | `page down`, `page down please` |
| **Page Up** | `page up`, `page up please` |
| **Repeat Trainer** | `repeat instruction`, `repeat trainer`, `what did the trainer say`, `say that again`, `repeat last instruction`, `repeat` (repeats gate guidance if positioning gate is active) |
| **Mute Assistant** | `mute assistant`, `mute`, `silence assistant` |
| **Unmute Assistant** | `unmute assistant`, `unmute` |
| **Cancel Countdown** | `cancel countdown` (cancels live gate countdown) |
| **Skip Alignment** | `skip alignment`, `skip positioning` (bypasses live positioning gate) |
| **End Session** | `end session`, `stop workout`, `finish workout`, `end workout` — tells the user to use the End & Save Session button |
| **Q&A** | `ask ...`, `question ...`, `FitA11y ...`, `fit a 11 y ...`, `fit ally ...` — followed by your question |

**Browser Limitations:**

> [!WARNING]
> Browser SpeechRecognition support is limited and browser-dependent. This is **prototype STT**, not production-grade speech-to-text.

- **Chrome** generally works with microphone permission granted.
- **Brave** may fail even with microphone permission granted — Brave Shields, privacy settings, site permissions, VPNs, speech-service blocking, or browser-level Web Speech API support can interfere.
- Browser microphone permission is **necessary but not sufficient** — the browser must also support the Web Speech API and not block the underlying speech recognition service.
- High-volume trainer video audio, assistant TTS, speaker quality, and microphone quality can all interfere with recognition accuracy.
- If voice control fails, use manual playback controls or typed Q&A as a fallback.
- Volume ducking or pausing during voice capture is documented as a future improvement.
- **Auto-start**: Voice control is started automatically on live session mount when the Web Speech API is available. Auto-start fires once on `idle` status. **Brave** often blocks auto-start even when manual microphone permission is granted; use the microphone toggle button in the sidebar instead.

#### Pre-Session Setup Voice Control

In addition to live-session controls, the pre-session setup screen features dedicated, browser-local SpeechRecognition voice controls to facilitate hands-free workspace configuration.

**Setup Voice Commands:**

| Category | Supported Phrases | Behavior / Action |
|---|---|---|
| **Camera Settings** | `enable camera`, `start camera` | Requests browser camera stream permission. |
| | `stop camera` | Closes camera stream and returns to offline mode. |
| **Alignment Mode** | `start alignment` | Enters focused alignment modal (requires active stream). |
| | `cancel alignment`, `return to setup`, `exit alignment` | Exits alignment mode and returns focus to setup controls. |
| **Instruction Guides**| `repeat guidance`, `repeat instruction` | Repeats current MediaPipe stance alignment guide aloud. |
| **Countdown Timer** | `cancel countdown` | Stops auto-start timer and returns to alignment monitoring. |
| **Workout Controls** | `start workout`, `start assisted playback` | Triggers playback session initialization. |
| **Difficulty Settings**| `choose fresh` / `choose normal` / `choose tired` | Toggles workout assistance intensity offsets. |
| **Pre-session Q&A** | `ask assistant [query]`, `question [query]` | Submits query to assistant grounded in session context. |
| **Navigation & Scroll**| `scroll down`, `scroll up` | Scrolls the layout container by 150px. |
| | `page down`, `page up` | Scrolls the layout container by 450px. |
| | `next section`, `previous section`| Cycles keyboard focus / scroll position between setup form blocks. |
| | `read current section` | Uses TTS to announce the currently active setup block to BLV users. |

**Important Safety & Browser Information:**
- Setup voice control is browser SpeechRecognition-based and browser-dependent. Microphone and Speech API support is required.
- Standard visual buttons and screen-reader keyboard navigation remain the primary fully supported pathways.
- Setup MediaPipe alignment operates 100% locally client-side. No camera video stream, landmarks, or coordinate arrays ever leave the browser.
- Live-session workout playback pose telemetry uses local MediaPipe tracking for reps/forms, falling back to simulated prototype tracking when camera visibility or exercise support is limited.

### Live Haptic Feed Layout Stability & Speech Policies
To support BLV users relying on assistive hardware or screen readers without inducing page layout shifts:
- **Stable Dimension Panel**: The `LiveHapticStatusPanel` renders as a dedicated layout element in the sidebar with a fixed height constraint (`h-[220px] min-h-[220px]`). This prevents shifts when the stream of haptic events fluctuates.
- **Sleeve Status Fallback**: When physical sleeves are active/connected, the noisy visual log is hidden by default (accessible via manual toggle) to minimize visual clutter. If sleeves are disconnected, a virtual screen-reader fallback feed is shown to present simulated indicator cues under an `aria-live="polite"` DOM region.
- **Speech Suppression**: Modality-specific haptic events are mapped exclusively to target vibrations or screen-reader virtual text fields. Speech synthesis is suppressed for haptic events to prevent audio queue overlaps.

### Camera Lifespan and Track Management
To avoid browser camera indicators remaining green after workout completion or page navigation:
- **Global Active Stream Registry**: A centralized registry in `useCameraStream.ts` tracks active MediaStream instances across the app.
- **Unified Track Cleanup**: All active streams are aggressively terminated via `stopAllActiveCameraStreams()` on the following lifecycle events:
  - Session end (End & Save Session button).
  - Live session route unmount.
  - Setup page route unmount.
  - Positioning gate close, skip, or complete.
  - Browser `beforeunload` (tab close / page refresh).
  - Router `navigation-start` events (Next.js route change).
- **`useCameraLifecycleCleanup`**: This hook must be rendered on any page that consumes a camera stream. It installs the beforeunload and navigation-start listeners.

### Intended Future System State:
- **Future AI / Gemini Work**:
  - Gemini sidecar generation exists now as an optional provider. Both prototype and Gemini sidecars generate exercise-specific reference form models (`body_region`, `primary_joints`, `counting`, `user_direction`, `form_reminders`, and `form_model` joint importance/tolerance ratings) to empower deterministic browser-local pose checking. Live camera video frames remain 100% browser-local and are never uploaded to the cloud.
  - Gemini-backed Assistant Q&A is fully implemented as an optional provider. It enforces strict capability boundaries that prevent the model from claiming it can see the user when no real-time camera pose tracking is active.
  - Future AI work includes cloud vision coaching and multi-modal audio/video pose curve extraction beyond text captions.
- **Richer Biomechanics**: Future enhancements include support for additional exercise types and more complex pose profiles.
- **Physical Sleeve Playback** *(hardware path available now)*: Physical bHaptics TactSleeve playback via the bHaptics Player and bHaptics Python SDK is already integrated. Connecting real sleeves requires a Python 3.8–3.12 environment, the `bhaptics-python` package, and bHaptics Player running on the same machine. See **Section 3** of this README for setup steps.
- **Real TTS & Audio Coexistence**: Integrate a production Text-to-Speech API and OS-level audio ducking APIs to smoothly overlay speech over YouTube trainer audio.
- **Production Cloud Storage**: Transition the application to run fully backed by AWS DynamoDB (for users, jobs, sessions, and session event tracking) and AWS S3 (for prepared video manifests, cue plans, and developer diagnostics logs).
- **Comprehensive Accessibility & Safety Validation**: Screen-reader flow audits and clinical biomechanics validation for movement tracking limits before deployment to actual users.

### Camera Integration Staging & Playback Coordination

The camera integration is implemented in progressive stages:
1. **Stage 1 (Pose & Positioning Contracts)**: Introduced provider-agnostic pose runtime contracts in [poseRuntimeTypes.ts](frontend/lib/pose/poseRuntimeTypes.ts) and positioning state definitions in [positioningTypes.ts](frontend/lib/pose/positioningTypes.ts).
2. **Stage 2 (Camera Permission & Setup Preview)**: Introduces frontend browser camera permission acquisition, device enumerate selection, and a client-only video preview component in the pre-session setup screen (leveraging a dedicated client hook and the native HTML5 `video` stream).
3. **Stage 3 (Pre-Session Setup MediaPipe Alignment)**: Enforces hands-free stance alignment guide powered by client-side browser-local Google MediaPipe Pose Landmarker, tracking centering, orientation, and body posture to auto-start workouts.
4. **Stage 4 (Checkpoint-Based Live Positioning Gates & Playback Pause Coordination)**: Runs camera alignment before the workout and before supported exercise checkpoints, then monitors opportunistically during playback. Brief tracking loss does not interrupt the user; sustained loss can pause playback for mid-exercise realignment.
5. **Stage 5 (Live MediaPipe Rep Counting & Form Analysis)**: Integrates real-time, browser-local Google MediaPipe Pose Landmarker tracking during live workouts for supported movements (squats and bicep curls) to count repetitions and analyze form errors. Unusable or unsupported tracking states automatically fall back to prototype-simulated tracking.

#### Playback Pause Coordinator Model
To prevent background playback from resuming incorrectly (e.g. when multiple features request pause state), a typesafe coordinator tracks active pause owners:
- **`positioning_gate`**: Active when the user is performing per-exercise camera alignment.
- **`assistant_speech`**: Active when the assistant is speaking a "pause before speaking" cue.
- **`voice_listening`**: Reserved for future audio ducking during active voice capture (not active in this stage).
- **`user_manual`**: Active when the user pauses manually (including IFrame player clicks or manual voice command).

The playback player will only resume playing if the list of active pause owners becomes completely empty. This guarantees that manual user pauses are never programmatically undone by gate completions or assistant cue speech finishes.

#### Gate Cue Suppression Policy
Cues whose delivery window overlaps an active positioning gate are permanently suppressed (logged via `cue_suppressed_by_gate` events) and are not marked as recently delivered. Once the alignment gate is completed or skipped, playback seeks back to the start of the exercise anchor, so the cue selection engine naturally re-evaluates and delivers the cues on the replayed segment.

> [!IMPORTANT]
> - **No Server-Side Video Transmission**: All camera permissions and media stream renders are handled entirely client-side within the browser setup page. No video frames, image data, or tracking telemetry are sent to the backend server.
> - **Live MediaPipe Tracking and Fallbacks**: Real-time browser-local repetition counting and form analysis are active for supported exercises. If the camera is unavailable, tracking visibility is low, or the exercise is unsupported, the session proceeds using the automatic simulated prototype fallback runtime.
> - **Browser API Dependencies**: SpeechRecognition and SpeechSynthesis are browser-dependent features. Microphone access and native Web Speech API support are required.

> [!NOTE]
> The `video2exercise-main` reference directory contains Python algorithms and guidance ratios for tracking alignment. It is **not** a runtime dependency of the web application and will be removed in a later stage.


> [!TIP]
> **Prototype Persistence**: For local developer and demo convenience, prepared jobs, session history, and user settings are persisted locally in the `backend/.prototype_data` directory. To reset the application back to its default clean state, simply delete the `backend/.prototype_data` directory.
>
> If you make changes to your local configuration and want to reset the cache, delete the `jobs.json` file inside `backend/.prototype_data/` to reset the active job list.

---

#### Setup & Running the Application

### 1. Prerequisites
- **Python**: Version 3.10 or higher.
- **Node.js**: Version 18 or higher, along with `npm`.

---

### 2. Backend Setup & Run

Perform the following steps from the repository root:

```powershell
# Go to the repository root directory
cd "C:\Users\hrida\Documents\ASU\Summer 26\Teal Lab\blv-workout"

# Set up a Virtual Environment
python -m venv .venv

# Activate the virtual environment
# Note: On Windows, use "python", not "python3", after activating.
# If PowerShell blocks activation, run this execution policy bypass first:
# Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1

# Upgrade pip and install package dependencies
python -m pip install --upgrade pip
python -m pip install -r backend\requirements.txt

# Run the FastAPI server from the backend directory.
# (Running from backend/ is required so that "backend/.env" is loaded correctly)
cd backend
python -m uvicorn app.main:app --reload --log-level debug
```

The backend API will run on [http://localhost:8000](http://localhost:8000). You can access the auto-generated Swagger documentation at [http://localhost:8000/docs](http://localhost:8000/docs).

#### Environment Variables Configuration
The `backend/.env` file is untracked by Git to protect secrets. You must create it manually in the `backend/` directory or copy it from `backend/.env.example`. 

Never commit real API keys to the repository. The `backend/.env.example` file must always contain placeholders only.

The `backend/.env` file should include the following configuration:
```env
AI_PROVIDER=prototype
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash
YOUTUBE_API_KEY=
FRONTEND_URL=http://localhost:3000

# Storage Architecture (default is local_json)
STORAGE_PROVIDER=local_json  # 'local_json' or 'dynamodb'

# AWS Configuration (required when STORAGE_PROVIDER=dynamodb)
AWS_PROFILE=fita11y-dev
AWS_REGION=us-east-2
DYNAMODB_USERS_TABLE=FitA11y-dev-Users
DYNAMODB_JOBS_TABLE=FitA11y-dev-Jobs
DYNAMODB_SESSIONS_TABLE=FitA11y-dev-Sessions
DYNAMODB_SESSION_EVENTS_TABLE=FitA11y-dev-SessionEvents
ARTIFACTS_BUCKET=fita11y-dev-artifacts-905418181041
```

> [!WARNING]
> **AWS Access Credentials Warning**
> Do NOT commit AWS access keys, secret keys, or session tokens to the repository. Use local credential helper profiles (e.g. `AWS_PROFILE=fita11y-dev` using the standard `~/.aws/credentials` file) or IAM Roles/Instance Profiles in deployed environments.

To enable and test the Gemini-backed sidecar generation:
```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your_real_key_here
GEMINI_MODEL=gemini-3.5-flash
```

---

### 3. When Sleeves are Available (Optional Hardware Setup)
For development, testing, and normal runs without hardware, the app operates fully in dry-run/indicator fallback mode. However, if physical bHaptics sleeves are available, you can enable real haptic playback:
1. **Python Environment**: Ensure the Python backend is running on a Python version supported by the bHaptics SDK (3.8 - 3.12 inclusive). If your standard development python is version 3.13 or higher, configure and activate a Python 3.12 virtual environment for the backend.
2. **Install SDK Package**: Install the optional `bhaptics-python` package in the backend environment. You can use the optional requirements file:
   ```bash
   pip install -r backend/requirements-bhaptics.txt
   ```
3. **Run bHaptics Player**: Install and launch the official bHaptics Player application on the same machine.
4. **Connect Devices**: Turn on and connect/pair the physical TactSleeve devices within the bHaptics Player app.
5. **Environment Configuration**: Set the following variables in your `backend/.env` file:
   ```env
   BHAPTICS_ENABLED=true
   BHAPTICS_PROVIDER=bhaptics
   BHAPTICS_APP_ID=your_registered_bhaptics_app_id
   BHAPTICS_API_KEY=your_registered_bhaptics_api_key
   ```
6. **Execution**: Play a session as normal. Connected sleeve hardware will receive physical vibration triggers corresponding to the cue events.

---

### 3.1 Haptic Vibration System & bHaptics Integration

The application features a curated haptic vibration asset library and bHaptics event mapping system designed for blind and low-vision (BLV) workout guidance.

#### Haptic Categories & Candidate Library
- **5 Canonical Categories**:
  - `start`: Workout / active phase commencement.
  - `finish`: Workout completion or cooldown phase.
  - `reps`: Per-repetition detection tick.
  - `speed_up`: Pace acceleration guidance.
  - `slow_down`: Pace deceleration guidance.
- **28 Curated Candidates**: Curated patterns sourced from the VibViz research dataset with quantitative pleasantness ratings categorized into **Higher pleasantness** and **Lower pleasantness** optgroups. Note that pleasantness groups represent aggregated research ratings rather than individual user guarantees, and these patterns have not yet been validated specifically for FitA11y users or bHaptics sleeves.
- **User Preference Customization**: Users select their preferred vibration candidate for each category in the Settings UI ([HapticSettingsPanel.tsx](frontend/components/settings/HapticSettingsPanel.tsx)).
- **Browser Audio WAV Preview**: Clicking "Audio Preview" plays an in-browser audio preview of the source WAV asset. WAV audio playback is for browser preview purposes only; physical haptic sleeve playback requires bHaptics pattern registration.

#### bHaptics Event Resolution & Hardware Readiness
- **Candidate-Specific Event Mapping**: Each selectable vibration candidate maps to its own unique bHaptics event name (e.g., `assist_start_high_01`, `assist_reps_high_01`).
- **Resolution Order**:
  1. Valid manifest candidate `bhaptics_event_name` (e.g., `assist_start_high_01`)
  2. Explicit candidate event name when provided
  3. Canonical category fallback (`assist_start`, `assist_finish`, `assist_reps`, `assist_speed_up`, `assist_slow_down`)
  4. Neutral fallback (`assist_attention_double`)
- **Dry-Run & Indicator Modes**: When hardware is unavailable or the SDK is offline, the backend deterministically returns `delivery_mode="indicator"` or `"would_trigger"` with screen-reader feedback, ensuring complete testability without physical sleeves.
- **External bHaptics Authoring Requirement**: All 28 candidate bHaptics patterns (`assist_start_high_01` through `assist_slow_down_low_02`) remain pending external authoring and must be created in [bHaptics Designer](https://designer.bhaptics.com) and registered in the bHaptics Player. Candidates are marked with `conversion_status="pending_bhaptics_authoring"` until physical `.tact` files are deployed.
- **Form Warning & Countdown Policy**: Countdown and Form Warning cues operate exclusively via non-haptic modalities (speech announcements, countdown timing, visual UI overlays, and assistant form corrections). They do not request or deliver haptic feedback.

---

### 4. Frontend Setup & Run

Go to the `frontend` directory:
```bash
cd ../frontend
```

#### Step A: Install Packages
Install the Node.js packages:
```bash
npm install
```

#### Step B: Run the Frontend Dev Server
Start the development server:
```bash
npm run dev
```
The UI will run on [http://localhost:3000](http://localhost:3000). Open this address in your browser to view the application.

---

## Development Utilities & Testing

### Running Unit Tests
To run the backend unit tests, navigate to the `backend/` directory and run the test suite:
```powershell
cd backend
..\.venv\Scripts\python.exe -m unittest app.tests.test_cue_plan_generation
```
* **Repository Root Running**: Running the backend tests from the repository root instead of the `backend/` directory requires setting the python path environment variable (e.g. `$env:PYTHONPATH="backend"` or `PYTHONPATH=backend`).
* **Starlette Deprecation Warning**: You may see a `StarletteDeprecationWarning` concerning `httpx` and `TestClient` from FastAPI dependencies. This warning is non-fatal and can be ignored for now.

### API Lab Playground
FitA11y includes a browser-based HTTP testing suite under the route `/api-lab` to help developer debugging:
* **Auto-Discovery**: Dynamically queries the backend server's `/openapi.json` specs on demand, so frontend testing lists are always synchronized with the FastAPI implementation.
* **No Path Truncation**: Fully wrapped endpoint path strings (with native hover tooltips) allow easy identification of long routes.
* **Expected Mock Responses**: Pre-loaded request templates include sample expected output schemas (collapsible and copy-to-clipboard ready) so developers can understand expected server behavior instantly.
* **Base URL Configurator**: Allows testing local, staging, or remote backend hosts using local storage caching.
* **Safety Confirmations**: Protects against accidental state modifications with confirmations on operations like `DELETE`.

## AI Sidecar & Cue Plan Debugging

To assist developers in validating, quality-checking, and debugging sidecar manifests and cue plans generated by either the offline prototype or Gemini:

### 1. Architectural Roles
* **Sidecar Manifest**: Extracts and verifies structured video facts (exercise anchors, speaking opportunity windows, trainer instruction events, form risk templates, haptic cue profiles, expected movement windows).
* **Cue Plan**: Converts sidecar manifest facts into candidate assistant cues (pre-session overview, exercise accessible descriptions, short audio/haptic cue candidates with brief/moderate/detailed text variants, repeatable instruction summaries, form reminders). Cues are kept flexible so that runtime session code can choose modalities or verbosity levels based on current user settings.

### 2. Enabling Gemini Strategy Generation
Add the following to your `backend/.env` file:
```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash
AI_DIAGNOSTICS_ENABLED=True
```

### 3. Preprocessing and Storage Options
Submit a YouTube video via the UI or by POSTing to `/api/preprocessing/submit` with a `url`.
Upon video preparation completion, the backend persists the generated sidecars, cue plans, and diagnostics. The storage locations depend on the configured `STORAGE_PROVIDER`:

#### When using local JSON persistence (`STORAGE_PROVIDER=local_json`):
* **Sidecar Manifest**: `backend/.prototype_data/manifest_{video_id}.json`
* **Cue Plan**: `backend/.prototype_data/cue_plans/{video_id}.json`
* **Sidecar Diagnostics**: `backend/.prototype_data/ai_diagnostics/{video_id}.json`
* **Cue Plan Diagnostics**: `backend/.prototype_data/ai_diagnostics/cue_plan_{video_id}.json`
* **Transcript Artifact**: `backend/.prototype_data/transcripts/{video_id}.json`

#### When using DynamoDB/S3 persistence (`STORAGE_PROVIDER=dynamodb`):
Job metadata is updated in the DynamoDB table, and artifacts are uploaded to S3 with the following object keys:
* **Sidecar Manifest**: `manifests/{video_id}.json`
* **Cue Plan**: `cue-plans/{video_id}.json`
* **Sidecar Diagnostics**: `diagnostics/sidecar/{video_id}.json`
* **Cue Plan Diagnostics**: `diagnostics/cue-plan/{video_id}.json`
* **Transcript Artifact**: `transcripts/{video_id}.json`

To check job status, fetch progress via `/api/preprocessing/status/{video_id}`. This response includes `sidecar_provider`, `cue_plan_provider`, `caption_status`, and any corresponding fallback reasons. Note that large transcript payloads are stored only as developer/analysis artifacts and are omitted from the status endpoint responses to minimize network bandwidth during workout playback.

### 4. API Endpoints
* **Get Sidecar Manifest**:
  ```http
  GET http://localhost:8000/api/preprocessing/manifest/{video_id}
  ```
* **Inspect Sidecar Manifest**:
  ```http
  GET http://localhost:8000/api/preprocessing/manifest/{video_id}/inspection
  ```
* **Get Cue Plan**:
  ```http
  GET http://localhost:8000/api/preprocessing/cue-plan/{video_id}
  ```
* **Inspect Cue Plan**:
  ```http
  GET http://localhost:8000/api/preprocessing/cue-plan/{video_id}/inspection
  ```
  Both inspection endpoints are side-effect-free, loading persisted files from disk only and returning 404 if not found.
* **Assistant Q&A**:
  ```http
  POST http://localhost:8000/api/assistant/qa
  ```
  Answers a user question grounded in video timeline context and current playback timestamp.

### 5. UI Separation
Technical detail chips (like "AI: gemini" or "Captions: auto captions found") are removed from the normal Video Library UI card (`ImportedVideoCard.tsx`) to maintain clean UX. Diagnostics files and inspection endpoints are the designated routes for developers to debug AI outputs.

### 6. Cue Plan Runtime Selection
During live workout playback, the client-side session interface queries the backend's `/api/assistant/cue-plan/select` runtime selection endpoint once per second:
* **Deterministic Selection**: The selection algorithm is fully deterministic and runs offline on the backend without making any Gemini API calls during playback.
* **Smart Filtering**: Candidates are selected based on the current playback time window (`start_ms <= current_time_ms <= end_ms`), user's audio coexistence setting (Silent, Haptic Only, Brief, Full), assistant muted flag, and list of already delivered cue IDs.
* **Priority-Based Dispatch**: Tied candidate cues are resolved by priority level first, then by earliest `start_ms` timestamp, prioritizing `pause_then_speak` actions when `pause_before_speaking` is active.

### 7. Grounded Assistant Q&A
* **Gemini Q&A Provider**: If `AI_PROVIDER=gemini` and `GEMINI_API_KEY` is configured, calls to `/api/assistant/qa` utilize Gemini to generate dynamic answers.
* **Grounded Context Window**: It builds a compact context from video metadata, sidecar timelines, transcript segments within a ±60-second window (clamped to a max of 3000 characters), and trainer instruction summaries. It avoids sending the full transcript to Gemini.
* **Strict Capability Boundaries**: If `pose_available` is `false` or confidence is low (< 0.5), the assistant is forbidden from claiming it can see the user. It must state that it cannot see or check form right now, and offer general guidance or ask the user to describe their position.
* **Developer Diagnostics & Retention**: If `AI_DIAGNOSTICS_ENABLED=True`, QnA diagnostics are saved in local JSON (or S3) containing metadata counts, question classification, and length, ensuring full transcripts and user question texts are omitted for privacy. These logs are session-scoped and are retained for developer monitoring; they are not deleted with prepared videos.

### 8. How to Test & Verify
Follow these steps to manually test the full pipeline:
1. **Prepare Video**: Submit a YouTube workout URL via the Video Library. Ensure the status progresses to `Completed`.
2. **Fetch Cue Plan**: Verify that a cue plan has been generated and persisted. In `local_json` mode, verify it exists under `backend/.prototype_data/cue_plans/{video_id}.json`. In `dynamodb` mode, verify it is uploaded to the S3 bucket with key `cue-plans/{video_id}.json`. Query the GET `/api/preprocessing/cue-plan/{video_id}` API endpoint.
3. **Start Session**: Start a workout session. Open the Live Session playback screen.
4. **Confirm Cue Delivery**: Play the workout video.
   - **Speech Delivery**: Verify that cues show up in the Assistant Cue Feed panel (live cue UI) and are spoken aloud. Spoken cue playback is implemented using the browser Web Speech API (`window.speechSynthesis`) on the client side. No cloud TTS, backend audio generation, or S3 audio storage is used.
     - *How to test*: Play the video in a live session with the assistant unmuted and coexistence level set to Brief Speech or Full Speech. The browser should speak the selected audio cues as they appear in the feed.
     - *Known limitation*: Voice availability, language accents, and overall speech quality depend entirely on the browser and OS-specific voices installed on the user's local machine.
   - **Coexistence Check**: Toggle the assistant Mute setting in the session controls. Verify that only haptic notifications trigger when muted (or under Haptic Only mode), and any active speech synthesis is cancelled immediately.
   - **Action Triggers**: Verify that playback actions operate correctly:
     - *Pause Before Speaking*: The YouTube player pauses when speech starts and resumes automatically when speech ends (if it was playing previously).
     - *Duck Audio*: The YouTube player volume is ducked/lowered to `25` during speech and restored to its original value when speech ends or is cancelled (unless the player was already muted or volume was already below target).
 5. **Test Assistant Q&A**: Enter the workout playback page and type questions in the chat:
    - *Video-Grounded Questions*: Ask "What exercise are we doing?" or "What's next?". It should answer correctly based on the active exercise segment.
    - *Form-Observation Questions*: Ask "Can you see if my knees are right?" or "Is my back straight?". It should return a boundary answer stating it cannot see or check your form right now, and suggest an alternative (e.g. ask you to describe your position).
    - *Safety/Medical Questions*: Ask "My chest hurts, what should I do?". It should advise you to stop immediately and seek medical attention.
 6. **Inspect Diagnostics**: Inspect the generated JSON diagnostics to verify the generation provider, warning lists, and timestamp. In `local_json` mode, check `backend/.prototype_data/ai_diagnostics/cue_plan_{video_id}.json`. For QnA, check `backend/.prototype_data/ai_diagnostics/qna_{session_id}_{suffix}.json`. In `dynamodb` mode, check S3 key `diagnostics/cue-plan/{video_id}.json` and `diagnostics/qna/{session_id}/{suffix}.json`.

### 9. Real Gemini Manual Validation Hooks
To manually validate live Gemini-backed QnA:
1. Edit your `backend/.env` file:
   ```env
   AI_PROVIDER=gemini
   GEMINI_API_KEY=your_real_key_here
   GEMINI_MODEL=gemini-3.5-flash
   ```
2. Run the backend and frontend dev servers.
3. Import and prepare a workout video in the Video Library.
4. Launch the live workout session and open the chat window.
5. Submit the following questions:
   - *"What did the trainer just say?"* -> Verify the response quotes or summarizes the trainer's last instruction.
   - *"What exercise are we doing?"* -> Verify it names the current exercise.
   - *"Can you see if my knees are right?"* -> Verify it truthfully states that it cannot see or check your form right now, and offers a general guidance alternative.
6. Verify the diagnostic details under `backend/.prototype_data/ai_diagnostics/qna_{session_id}_{suffix}.json`. Confirm it logs `question_classification: "self_observation_form_check"` and `question_length` without saving the sensitive question text or full transcript.


---

## Stage 3: MediaPipe Pose Landmarker Setup

FitA11y uses a **checkpoint-based camera alignment policy** designed to avoid constant gate interruptions during live workouts:
- **Pre-workout & pre-exercise checkpoints**: Alignment confirmation runs before the workout begins and once before each supported exercise boundary when the camera is available.
- **Opportunistic exercise monitoring**: During exercises, MediaPipe pose tracking is used opportunistically whenever landmarks are visible for rep counting and form feedback.
- **Debounced tracking loss**: Brief pose-confidence dips do not interrupt playback. Low confidence / partial landmark loss for roughly 3-5 seconds displays a gentle status warning. Sustained loss for 5 seconds during a supported exercise prompts mid-exercise realignment, with a cooldown so the same exercise can re-arm later without flickering.
- **User agency & camera controls**: Users can retry alignment, change camera devices, turn off the camera, or disable automatic camera gates for the session. Camera failures never trap the workout.
- **Automatic soft fallback**: Fallback tracking is automatic when the camera is unavailable or the current exercise is unsupported.
- **Client-Side Security**: All camera frames, media streams, and landmark metrics remain 100% browser-local; no raw images or landmarks leave the device.
- **Camera Selection & Handoff Persistence**: When the user selects or switches webcams (including external USB webcams), preference is saved upon successful stream start and auto-requested in live sessions without resetting back to the laptop webcam.
- **Prioritized Webcam Fallback Hierarchy**: If the preferred webcam is unplugged or fails to start, the camera lifecycle engine automatically falls back using this priority hierarchy:
  1. Exact preferred device id.
  2. Devices with the same group id as the preferred camera, when the browser exposes one.
  3. Devices with labels most similar to the preferred camera.
  4. Other external-looking webcams before integrated/internal camera labels.
  5. Generic browser camera selection.
  6. Camera-off mode with simulated prototype fallback if no camera works.
- **Camera Feature Split & Fallback Integration**:
  - **Real Camera & Preview**: User-approved camera feeds, active device listings, and toggle controls are fully operational.
  - **Real Setup MediaPipe Alignment**: The pre-session setup screen performs live browser-local MediaPipe keypoint detection to calibrate posture, orientation, and depth positioning.
  - **Real Live MediaPipe Tracking**: Live workout repetition counting and form checking are fully integrated for supported exercises (e.g. squats, bicep curls).
  - **Simulated Fallback**: For unsupported movements or when the camera is offline/unusable, the app automatically engages a simulated prototype fallback that generates timestamp-based oscillations to simulate workout flow without implying the assistant can see the user.
- **Decoupled Reference**: The `video2exercise-main/` folder is used strictly for design references and must not become an application dependency.

### Model Asset — Local File (Committed) + CDN Fallback

The `pose_landmarker_heavy.task` model file (~30 MB, Float16 precision) is committed directly to the repository at:

```
frontend/public/mediapipe/pose_landmarker_heavy.task
```

The initialization hook `useMediaPipePoseLandmarker` follows this resolution order at runtime:

1. **Local file (preferred)**: Issues a `HEAD /mediapipe/pose_landmarker_heavy.task` request. If the Next.js dev server returns `200 OK`, the file is used directly from the local public directory.
2. **CDN fallback**: If the HEAD request fails (non-ok status or network error), the hook falls back to streaming the model from the Google CDN:
   `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task`

> [!IMPORTANT]
> The local file is only served when the Next.js dev server (`npm run dev`) is running. The HEAD request will fail in bare `node` or test environments — this is expected and handled by the CDN fallback.

If you need to re-download the model (e.g. after deleting it), use:
```bash
curl -o frontend/public/mediapipe/pose_landmarker_heavy.task \
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task"
```

---

## AI Generated Code Disclaimer

> [!IMPORTANT]
> **Disclaimer on AI-Generated Assets and Code**
> 
> Parts of the codebase, documentation, and logic in this repository have been generated or assisted by AI models, including but not limited to **Codex**, **Antigravity**, and **Claude**. 
> While these AI agents help accelerate development, optimize accessibility routines, and structure UI elements:
> - The code is provided "as is" without warranty of any kind.
> - Double-check calculations and pose estimation thresholds for safety-critical physical training routines.
> - Maintainers and developers should verify, test, and audit any AI-generated implementations for production safety, security, and accuracy.
