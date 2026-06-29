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
