"""FastAPI application entrypoint for the FitA11y backend."""

import os
from functools import partial

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.routers import coach, haptic, preprocessing, session, user

app = FastAPI(title="FitA11y Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(preprocessing.router, prefix="/api/preprocessing", tags=["preprocessing"])
app.include_router(session.router, prefix="/api/session", tags=["session"])
app.include_router(coach.router, prefix="/api/coach", tags=["coach"])
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
    """Create the import directory on startup if it does not exist."""
    os.makedirs(settings.IMPORT_DIR, exist_ok=True)
