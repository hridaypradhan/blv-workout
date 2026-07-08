# FitA11y — Frontend

This is the Next.js (React + TypeScript + Tailwind CSS) frontend for the FitA11y assistive workout companion. For full project documentation, architecture, setup instructions, and feature details, see the [root README](../README.md).

## Quick Start

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

The frontend runs on [http://localhost:3000](http://localhost:3000). The FastAPI backend must also be running on [http://localhost:8000](http://localhost:8000).

## Development Commands

```bash
# Type checking
npx tsc --noEmit

# Run unit tests
npm run test

# Production build
npm run build
```

## Key Directories

- `app/` — Next.js App Router pages and layouts
- `components/` — Reusable React components (session controls, voice panel, Q&A chat, etc.)
- `lib/` — Hooks, API clients, voice command parsing, session telemetry, and utility modules
- `lib/hooks/` — React hooks for speech recognition, voice commands, Q&A, session management
- `lib/voice/` — Voice command parser and type definitions
- `types/` — Shared TypeScript type definitions
## Testing

Tests use [Vitest](https://vitest.dev/) with `@testing-library/react`. Test files live alongside source code in `__tests__/` directories.

```bash
npm run test
```

## Live Camera Troubleshooting & Operation

- **Persisted Preferences:** The video camera selected during the setup phase carries over automatically to the live session using local preferences.
- **External Webcams:** External webcams are fully supported. If a preferred camera is disconnected, the system will fall back to an integrated webcam while retaining the preference so retry can easily reconnect it.
- **Selected vs Active Camera:** The dropdown dropdown selection (`selectedDeviceId`) and the streaming feed (`activeDeviceId`) may differ if a fallback camera is currently active. The status text will honestly indicate if fallback is running (e.g. "Selected camera failed. Using integrated webcam fallback").
- **Explicit Fallback Behavior:** If the user explicitly selects a camera from the dropdown and it fails, the system will NOT automatically switch to another camera. Instead, it will display a visible error on the recovery screen and offer choices to Retry, Use Generic Fallback, or Turn Camera Off.
- **Soft Gates by Default:** Hard positioning gates will only open if a stable camera stream exists. If the camera is not ready, the workout will automatically continue with prototype simulated tracking ("soft skip"), logging `positioning_gate_soft_skipped` to keep the user from getting trapped.
- **In-Session Controls:** During the live session, you can use the Pose Tracker controls to:
  - **Change Camera:** Select a different camera device from the active device list.
  - **Retry Camera:** Re-request the webcam stream explicitly.
  - **Turn Camera Off:** Manually disable camera tracking and transition to simulated fallback.
  - **Retry Alignment:** Explicitly trigger the positioning gate to restart alignment for the current exercise (available only when camera is ready or manual override is requested).
- **Session Telemetry:** All camera state transitions (`camera_requested`, `camera_ready`, `camera_failed`, `camera_device_selected`, `camera_fallback_used`, `camera_disabled_for_session`, `positioning_gate_soft_skipped`) are safely logged as telemetry. No camera frames or landmark coordinates are ever uploaded or stored.

