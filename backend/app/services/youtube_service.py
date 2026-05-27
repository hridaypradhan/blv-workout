"""YouTube ingestion service for FitA11y — F1.1 implementation."""

from __future__ import annotations

import os
import glob
import shutil
import subprocess
from typing import Any

import yt_dlp


class YouTubeDownloadError(Exception):
    """Raised when a YouTube video download fails."""


class AudioExtractionError(Exception):
    """Raised when audio extraction from a video fails."""


def download_video(youtube_url: str, video_id: str, import_dir: str) -> dict[str, Any]:
    """Download a YouTube workout video and return its local file path and metadata.

    Args:
        youtube_url: Full YouTube URL to download.
        video_id: UUID string used as the filename stem.
        import_dir: Directory to store the downloaded file.

    Returns:
        Dict with keys: video_path, title, duration.

    Raises:
        YouTubeDownloadError: If the download fails for any reason.
    """
    os.makedirs(import_dir, exist_ok=True)

    output_template = os.path.join(import_dir, f"{video_id}.%(ext)s")

    ydl_opts: dict[str, Any] = {
        "format": "best[ext=mp4]/best",
        "outtmpl": output_template,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        # Don't post-process — we want the raw video file
        "postprocessors": [],
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=True)
            if info is None:
                raise YouTubeDownloadError("yt-dlp returned no info for the URL.")
    except yt_dlp.utils.DownloadError as exc:
        raise YouTubeDownloadError(f"Failed to download video: {exc}") from exc
    except Exception as exc:
        raise YouTubeDownloadError(f"Unexpected error during download: {exc}") from exc

    # Find the downloaded file — yt-dlp fills in the extension
    pattern = os.path.join(import_dir, f"{video_id}.*")
    matches = glob.glob(pattern)
    if not matches:
        raise YouTubeDownloadError(
            "Download appeared to succeed but no output file was found."
        )

    video_path = matches[0]
    title = info.get("title", "Unknown")
    duration = info.get("duration")

    return {
        "video_path": video_path,
        "title": title,
        "duration": duration,
    }


def extract_audio(video_path: str, import_dir: str, video_id: str) -> str:
    """Extract an audio track from a local video file using FFmpeg.

    Args:
        video_path: Path to the source video file.
        import_dir: Directory for the output audio file.
        video_id: UUID string used as the filename stem.

    Returns:
        Path to the extracted audio file.

    Raises:
        AudioExtractionError: If FFmpeg is missing or extraction fails.
    """
    # Check FFmpeg availability
    if not shutil.which("ffmpeg"):
        raise AudioExtractionError(
            "FFmpeg is not installed or not found on system PATH. "
            "Audio extraction requires FFmpeg. "
            "Install it from https://ffmpeg.org/download.html and ensure it is on your PATH."
        )

    audio_path = os.path.join(import_dir, f"{video_id}_audio.m4a")

    try:
        result = subprocess.run(
            [
                "ffmpeg",
                "-i", video_path,
                "-vn",              # No video
                "-acodec", "copy",  # Copy audio codec (no re-encoding)
                "-y",               # Overwrite if exists
                audio_path,
            ],
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout
        )
        if result.returncode != 0:
            # If codec copy fails, try re-encoding to AAC
            result = subprocess.run(
                [
                    "ffmpeg",
                    "-i", video_path,
                    "-vn",
                    "-acodec", "aac",
                    "-b:a", "128k",
                    "-y",
                    audio_path,
                ],
                capture_output=True,
                text=True,
                timeout=300,
            )
            if result.returncode != 0:
                raise AudioExtractionError(
                    f"FFmpeg audio extraction failed: {result.stderr[:500]}"
                )
    except FileNotFoundError:
        raise AudioExtractionError(
            "FFmpeg binary not found. Please install FFmpeg and add it to your PATH."
        )
    except subprocess.TimeoutExpired:
        raise AudioExtractionError("Audio extraction timed out after 5 minutes.")
    except AudioExtractionError:
        raise
    except Exception as exc:
        raise AudioExtractionError(f"Unexpected error during audio extraction: {exc}") from exc

    if not os.path.exists(audio_path):
        raise AudioExtractionError("Audio extraction completed but output file was not created.")

    return audio_path


def extract_transcript(audio_path: str) -> str:
    """Extract or generate a transcript from a local audio file."""
    raise NotImplementedError("TODO: implement in F1.2+")


def detect_beats(audio_path: str) -> list[float]:
    """Detect beat timestamps from a local audio file for pacing analysis."""
    raise NotImplementedError("TODO: implement in F1.2+")
