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

- **Backend (Prototype Level):** FastAPI (Python) running a simulated engine with local JSON-based persistence instead of a live database server.
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
- **JSON Persistence**: Prepared jobs, session histories, and user settings are saved locally as JSON files under the `backend/.prototype_data` directory; no SQL database or PostgreSQL migration layer is active.

### Intended Future System State:
- **Future AI / Gemini Work**:
  - Gemini sidecar generation exists now as an optional provider.
  - Assistant Q&A is still deterministic/prototype today.
  - Future AI work includes live Assistant Q&A, richer reasoning, stronger validation, and possibly audio/video analysis beyond captions.
- **Real Pose Detection**: Integrate Google MediaPipe on the client or server side using device camera feeds to evaluate form errors and track reps in real-time.
- **Real Haptic Sleeve Communication**: Use Web Bluetooth API or a native BLE integration layer to transmit physical vibration sequences to wearable hardware sleeves.
- **Real TTS & Audio Coexistence**: Integrate a production Text-to-Speech API and OS-level audio ducking APIs to smoothly overlay speech over YouTube trainer audio.
- **Production Database**: Replace the JSON filesystem persistence with a SQL database (e.g., PostgreSQL/SQLAlchemy) with user authentication, secure sessions, and migratable schema tables.
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
DATABASE_URL=postgresql+asyncpg://user:password@localhost/blvworkout
YOUTUBE_API_KEY=
FRONTEND_URL=http://localhost:3000
```

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

### API Lab Playground
FitA11y includes a browser-based HTTP testing suite under the route `/api-lab` to help developer debugging:
* **Auto-Discovery**: Dynamically queries the backend server's `/openapi.json` specs on demand, so frontend testing lists are always synchronized with the FastAPI implementation.
* **No Path Truncation**: Fully wrapped endpoint path strings (with native hover tooltips) allow easy identification of long routes.
* **Expected Mock Responses**: Pre-loaded request templates include sample expected output schemas (collapsible and copy-to-clipboard ready) so developers can understand expected server behavior instantly.
* **Base URL Configurator**: Allows testing local, staging, or remote backend hosts using local storage caching.
* **Safety Confirmations**: Protects against accidental state modifications with confirmations on operations like `DELETE`.

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
