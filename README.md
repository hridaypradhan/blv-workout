# FitA11y

FitA11y is an **assistive playback companion** prototype designed specifically for **Blind and Low Vision (BLV)** users. Rather than replacing the trainer or hosting standalone AI-led workouts, FitA11y operates alongside original YouTube fitness videos. It provides supplementary, non-intrusive voice cues (for form correction and pacing) and simulated haptic feedback, keeping the YouTube creator as the trainer of record.

---

## Key Features

1. **Creator-First Policy & YouTube Playback**
   The user watches the original video via an embedded YouTube IFrame player. FitA11y never downloads, hosts, or distributes the video for playback, preserving creator monetization and ownership.
2. **Assistance Sidecar Manifest**
   A JSON sidecar generated during preprocessing that maps exercise anchors, speaking opportunities, expected movement windows, and haptic cues to the original video's timeline.
3. **Audio Coexistence & Interruption Levels**
   Intelligent speech ducking and interruption rules (Silent, Haptic Only, Brief Speech, Full Speech, Pause Before Speaking) ensuring the assistant never talks over the trainer unless preferred.
4. **Simulated Haptic & Spatial Cues**
   Generates tactile vibration sequence instructions (for pacing adjustments, joint extension limits, or movement corrections) to supplement voice guidance, designed to connect with future Bluetooth haptic sleeve hardware.
5. **Tracked User Performance**
   Maintains structured, screen-reader-accessible session records, tracking reps, form logs, and duration trends separately from the trainer's workout benchmark.
6. **Interactive API Lab Playground**
   An internal playground to inspect, build, and run API requests directly in the browser with full OpenAPI spec auto-syncing.

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
- **Simulated Assistant Q&A**: Answers to user questions are provided via deterministic mock responses rather than live LLM API calls.
- **Simulated Haptic Cues**: Haptic cues (vibration patterns) are delivered via API responses, structured to trigger simulated sleeve feedback rather than communicating with physical Bluetooth hardware sleeves.
- **Camera-Free Pose & Rep Tracking**: Joint status, repetitions, and form warnings are simulated mathematically based on elapsed video time and sidecar anchors; no camera permission or video stream model inference is active.
- **Pluggable Storage / JSON Persistence**: Prepared jobs, session histories, and user settings are saved locally as JSON files under the `backend/.prototype_data` directory by default, with AWS DynamoDB and S3 cloud storage configuration options; no SQL database or database migration layer is active.

### Intended Future System State:
- **Future AI / Gemini Work**:
  - Gemini sidecar generation exists now as an optional provider.
  - Assistant Q&A is still deterministic/prototype today.
  - Future AI work includes live Assistant Q&A, richer reasoning, stronger validation, and possibly audio/video analysis beyond captions.
- **Real Pose Detection**: Integrate Google MediaPipe on the client or server side using device camera feeds to evaluate form errors and track reps in real-time.
- **Real Haptic Sleeve Communication**: Use Web Bluetooth API or a native BLE integration layer to transmit physical vibration sequences to wearable hardware sleeves.
- **Real TTS & Audio Coexistence**: Integrate a production Text-to-Speech API and OS-level audio ducking APIs to smoothly overlay speech over YouTube trainer audio.
- **Production Cloud Storage**: Transition the application to run fully backed by AWS DynamoDB (for users, jobs, sessions, and session event tracking) and AWS S3 (for prepared video manifests, cue plans, and developer diagnostics logs).
- **Comprehensive Accessibility & Safety Validation**: Screen-reader flow audits and clinical biomechanics validation for movement tracking limits before deployment to actual users.

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

### 3. Frontend Setup & Run

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

### 5. UI Separation
Technical detail chips (like "AI: gemini" or "Captions: auto captions found") are removed from the normal Video Library UI card (`ImportedVideoCard.tsx`) to maintain clean UX. Diagnostics files and inspection endpoints are the designated routes for developers to debug AI outputs.

### 6. Cue Plan Runtime Selection
During live workout playback, the client-side session interface queries the backend's `/api/assistant/cue-plan/select` runtime selection endpoint once per second:
* **Deterministic Selection**: The selection algorithm is fully deterministic and runs offline on the backend without making any Gemini API calls during playback.
* **Smart Filtering**: Candidates are selected based on the current playback time window (`start_ms <= current_time_ms <= end_ms`), user's audio coexistence setting (Silent, Haptic Only, Brief, Full), assistant muted flag, and list of already delivered cue IDs.
* **Priority-Based Dispatch**: Tied candidate cues are resolved by priority level first, then by earliest `start_ms` timestamp, prioritizing `pause_then_speak` actions when `pause_before_speaking` is active.

### 7. How to Test & Verify
Follow these steps to manually test the full pipeline:
1. **Prepare Video**: Submit a YouTube workout URL via the Video Library. Ensure the status progresses to `Completed`.
2. **Fetch Cue Plan**: Verify that a cue plan has been generated and persisted. In `local_json` mode, verify it exists under `backend/.prototype_data/cue_plans/{video_id}.json`. In `dynamodb` mode, verify it is uploaded to the S3 bucket with key `cue-plans/{video_id}.json`. Query the GET `/api/preprocessing/cue-plan/{video_id}` API endpoint.
3. **Start Session**: Start a workout session. Open the Live Session playback screen.
4. **Confirm Cue Delivery**: Play the workout video.
   - **Speech Delivery**: Verify that cues show up in the Assistant Cue Feed panel (live cue UI). Note that spoken audio cue/TTS playback is not yet implemented on the frontend client (cues currently appear only in the Assistant Cue Feed/live cue UI, and spoken delivery is a future integration).
   - **Coexistence Check**: Toggle the assistant Mute setting in the session controls. Verify that only haptic notifications trigger when muted (or under Haptic Only mode).
   - **Action Triggers**: Check if playback actions pause or trigger audio ducking recommendations according to candidate interruption policy hints.
5. **Inspect Diagnostics**: Inspect the generated JSON diagnostics to verify the generation provider, warning lists, and timestamp. In `local_json` mode, check `backend/.prototype_data/ai_diagnostics/cue_plan_{video_id}.json`. In `dynamodb` mode, check S3 key `diagnostics/cue-plan/{video_id}.json`.

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
