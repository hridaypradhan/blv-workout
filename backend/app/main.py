"""FastAPI application entrypoint for the FitA11y backend.

FitA11y is an assistive playback companion for BLV (Blind and Low Vision)
users. It provides supplementary assistance — form correction, motivation,
haptic/spatial cues, and Q&A — alongside the original embedded YouTube
workout video. The YouTube trainer remains the primary instructor.
"""

import os
from functools import partial

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.routers import assistant, haptic, preprocessing, session, user

app = FastAPI(
    title="FitA11y Backend",
    description="Assistive playback companion API for BLV fitness accessibility.",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(preprocessing.router, prefix="/api/preprocessing", tags=["assistance-preparation"])
app.include_router(session.router, prefix="/api/session", tags=["session"])
app.include_router(assistant.router, prefix="/api/assistant", tags=["assistant"])
app.include_router(assistant.router, prefix="/api/coach", tags=["assistant-legacy"])
app.include_router(user.router, prefix="/api/user", tags=["user"])
app.include_router(haptic.router, prefix="/api/haptic", tags=["haptic"])

def health_check():
    return {"status": "ok"}

app.add_api_route(
    "/health",
    health_check,
    methods=["GET"],
    tags=["health"],
)


@app.on_event("startup")
async def startup_event():
    """Create the transient analysis directory on startup if it does not exist."""
    os.makedirs(settings.TRANSIENT_ANALYSIS_DIR, exist_ok=True)
