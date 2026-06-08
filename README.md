# FitA11y

FitA11y is an **assistive playback companion** application designed specifically for **Blind and Low Vision (BLV)** users. Rather than replacing the trainer or hosting standalone AI-led workouts, FitA11y operates alongside original YouTube fitness videos. It provides supplementary, non-intrusive voice cues (for form correction and pacing) and spatial haptic feedback, keeping the YouTube creator as the trainer of record.

---

## Key Features

1. **Creator-First Policy & YouTube Playback**
   The user watches the original video via an embedded YouTube IFrame player. FitA11y never downloads, hosts, or distributes the video for playback, preserving creator monetization and ownership.
2. **Assistance Sidecar Manifest**
   A JSON sidecar generated during preprocessing that maps exercise anchors, speaking opportunities, expected movement windows, and haptic cues to the original video's timeline.
3. **Audio Coexistence & Interruption Levels**
   Intelligent speech ducking and interruption rules (Silent, Haptic Only, Brief Speech, Full Speech, Pause Before Speaking) ensuring the assistant never talks over the trainer unless preferred.
4. **Haptic & Spatial Feedback**
   Sends tactile vibration cues to Bluetooth haptic sleeves (for pacing adjustments, joint extension limits, or movement corrections) to augment voice guidance.
5. **Tracked User Performance**
   Maintains structured, screen-reader-accessible session records, tracking reps, form logs, and duration trends separately from the trainer's workout benchmark.
6. **Interactive API Lab Playground**
   An internal playground to inspect, build, and run API requests directly in the browser with full OpenAPI spec auto-syncing.

---

## Tech Stack

- **Backend (Prototype Level):** FastAPI (Python), with built-in mock modules simulating MediaPipe (Pose/Motion Analysis), SQLAlchemy/PostgreSQL, Google Generative AI (Gemini), Google Cloud Text-to-Speech, `yt-dlp` (for transient audio/metadata analysis only; never stored for playback), and `librosa` (Rhythm Analysis).
- **Frontend:** Next.js (React), TypeScript, Tailwind CSS.

> [!IMPORTANT]
> **Prototype Implementation & Simulation Boundaries**:
> FitA11y is currently implemented as an end-to-end runnable **prototype** to showcase assistive playback companion capabilities:
> - **Deterministic Haptics**: Sleeve haptic feedback and limb status checks are simulated using deterministic prototype haptic responses; they do not communicate with physical Bluetooth hardware sleeves.
> - **Camera-Free Pose Tracking**: Joint angles and rep/error telemetry are generated mathematically relative to playback speed and timeline anchors; no camera permission, video stream processing, or real MediaPipe model inference is active.
> - **JSON Persistence**: Prepared jobs, session histories, and user settings are saved locally as JSON files under the `backend/.prototype_data` directory; there is no SQL database or PostgreSQL migration layer.
> - **Replaceable Modules**: Real integrations for Gemini, MediaPipe, BLE haptic sleeves, TTS speech services, and production databases remain future replaceable provider integration layers.

> [!TIP]
> **Prototype Persistence**: For local developer and demo convenience, prepared jobs, session history, and user settings are persisted locally in the `backend/.prototype_data` directory. To reset the application back to its default clean state, simply delete the `backend/.prototype_data` directory.

---

## Setup & Running the Application

### 1. Prerequisites
- **Python**: Version 3.10 or higher.
- **Node.js**: Version 18 or higher, along with `npm`.
- **Database**: PostgreSQL (if implementing database-driven features).

---

### 2. Backend Setup & Run

Go to the `backend` directory:
```bash
cd backend
```

#### Step A: Set up a Virtual Environment
We recommend using Python's built-in `venv`.

On **Windows** (Command Prompt or PowerShell):
```powershell
python -m venv .venv
# Activate in PowerShell:
.venv\Scripts\Activate.ps1
# Or in Command Prompt:
.venv\Scripts\activate.bat
```

On **macOS / Linux**:
```bash
python3 -m venv .venv
source .venv/bin/activate
```

#### Step B: Install Packages
With your virtual environment activated, install the required packages:
```bash
pip install -r requirements.txt
```

#### Step C: Configure Environment Variables
Copy `.env.example` to `.env` and fill in your API credentials:
```bash
cp .env.example .env
```
Ensure you provide a valid `GEMINI_API_KEY`, `DATABASE_URL` (if configured), and `YOUTUBE_API_KEY`.

#### Step D: Run the Backend
Start the FastAPI server:
```bash
uvicorn app.main:app --reload
```
The backend API will run on [http://localhost:8000](http://localhost:8000). You can access the auto-generated Swagger documentation at [http://localhost:8000/docs](http://localhost:8000/docs).

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
