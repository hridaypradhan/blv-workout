# FitA11y

FitA11y is an AI-powered fitness accessibility application designed specifically for **Blind and Low Vision (BLV)** users. It enables users to exercise confidently by providing real-time audio-first coaching, posture corrections, pacing feedback, and spatial haptic guidance.

---

## Key Features

1. **Audio-First AI Coaching**
   Real-time vocal instructions, repetition counts, pacing feedback, and corrective posture cues.
2. **Haptic Spatial Feedback**
   Support for Bluetooth-enabled haptic sleeves to guide users through tactile vibration pulses (speeding up/slowing down, extension limits, posture correction).
3. **Smart Progress Tracking**
   Maintains structured, screen-reader-accessible workout logs, session duration trends, and form accuracy history.
4. **YouTube Workout Preprocessing**
   Processes any workout video from YouTube, extracts exercises using AI, generates posture benchmarks, and builds custom audio/haptic manifests.
5. **Adaptive Pacing & Rhythmic Tempo Engine**
   Tracks repetition timings (lag ratios, drift, irregularity scores) using MediaPipe to dynamically generate tailored speed adjustments and vocal pacing cues.
6. **Interactive API Lab Playground**
   An internal Postman-like interface to inspect, build, and run API requests directly in the browser with full OpenAPI spec auto-syncing.

---

## Tech Stack

- **Backend:** FastAPI (Python), MediaPipe (Pose/Motion Analysis), SQL Alchemy / PostgreSQL, Google Generative AI (Gemini), Google Cloud Text-to-Speech, `yt-dlp` (Video Fetching), `librosa` (Audio Analysis).
- **Frontend:** Next.js (React), TypeScript, Tailwind CSS.

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
