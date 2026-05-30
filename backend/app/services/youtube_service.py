"""YouTube metadata and transient analysis service for FitA11y.

The original YouTube video is always played via the embedded YouTube IFrame
player. This service provides:
1. YouTube ID parsing from various URL formats
2. Video metadata fetching (title, channel, duration, thumbnail)
3. Transient audio extraction for analysis only (Whisper/Gemini processing)
4. Cleanup of transient artifacts after analysis

yt-dlp, if present, is used only for transient analysis — never for
storing video files for local playback.
"""

from __future__ import annotations

import os
import re
import glob
import shutil
import subprocess
from typing import Any

try:
    import yt_dlp
except ImportError:
    yt_dlp = None  # type: ignore[assignment]


class YouTubeMetadataError(Exception):
    """Raised when YouTube metadata extraction fails."""


class TransientAudioError(Exception):
    """Raised when transient audio extraction for analysis fails."""


# Backward-compatibility aliases
YouTubeDownloadError = YouTubeMetadataError
AudioExtractionError = TransientAudioError


def parse_youtube_id(url: str) -> str:
    """Extract the YouTube video ID from various URL formats.

    Supported formats:
    - https://www.youtube.com/watch?v=VIDEO_ID
    - https://youtu.be/VIDEO_ID
    - https://www.youtube.com/embed/VIDEO_ID
    - https://www.youtube-nocookie.com/embed/VIDEO_ID

    Returns:
        The 11-character YouTube video ID.

    Raises:
        YouTubeMetadataError: If the URL does not contain a valid YouTube ID.
    """
    patterns = [
        r'(?:youtube\.com/watch\?.*v=)([a-zA-Z0-9_-]{11})',
        r'(?:youtu\.be/)([a-zA-Z0-9_-]{11})',
        r'(?:youtube\.com/embed/)([a-zA-Z0-9_-]{11})',
        r'(?:youtube-nocookie\.com/embed/)([a-zA-Z0-9_-]{11})',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    raise YouTubeMetadataError(
        f"Could not extract YouTube video ID from URL: {url}"
    )


def fetch_youtube_metadata(url_or_id: str) -> dict[str, Any]:
    """Fetch YouTube video metadata for assistance preparation.

    Attempts to use yt-dlp first to extract full details (including duration),
    and falls back to oEmbed or placeholders if yt-dlp fails or is not present.

    Args:
        url_or_id: Full YouTube URL or 11-character video ID.

    Returns:
        Dict with keys: title, channel_name, duration, thumbnail_url, youtube_id.
    """
    try:
        youtube_id = parse_youtube_id(url_or_id) if "youtube" in url_or_id or "youtu.be" in url_or_id else url_or_id
    except YouTubeMetadataError:
        youtube_id = url_or_id

    if len(url_or_id) == 11 and not ("youtube.com" in url_or_id or "youtu.be" in url_or_id):
        youtube_url = f"https://www.youtube.com/watch?v={url_or_id}"
    else:
        youtube_url = url_or_id

    # Try yt-dlp first
    if yt_dlp is not None:
        try:
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'extract_flat': True,
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(youtube_url, download=False)
                if info:
                    duration = info.get("duration")
                    duration_val = float(duration) if duration is not None else None
                    return {
                        "youtube_id": youtube_id,
                        "title": info.get("title") or "Prepared YouTube video",
                        "channel_name": info.get("uploader") or info.get("channel") or "Unknown creator",
                        "duration": duration_val,
                        "thumbnail_url": info.get("thumbnail") or f"https://img.youtube.com/vi/{youtube_id}/hqdefault.jpg",
                    }
        except Exception:
            pass

    # Fallback to oEmbed
    try:
        import urllib.request
        import urllib.parse
        import json

        encoded_url = urllib.parse.quote(youtube_url)
        oembed_url = f"https://www.youtube.com/oembed?url={encoded_url}&format=json"

        req = urllib.request.Request(
            oembed_url,
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))

            return {
                "youtube_id": youtube_id,
                "title": data.get("title", "Prepared YouTube video"),
                "channel_name": data.get("author_name", "Unknown creator"),
                "duration": None,
                "thumbnail_url": data.get("thumbnail_url") or f"https://img.youtube.com/vi/{youtube_id}/hqdefault.jpg",
            }
    except Exception:
        # Fall back gracefully to honest placeholders
        return {
            "youtube_id": youtube_id,
            "title": "Prepared YouTube video",
            "channel_name": "Unknown creator",
            "duration": None,
            "thumbnail_url": f"https://img.youtube.com/vi/{youtube_id}/hqdefault.jpg",
        }


def fetch_transient_audio_for_analysis(
    youtube_url: str, video_id: str, analysis_dir: str
) -> str:
    """Download audio transiently for Whisper/Gemini analysis.

    This audio is NOT used for playback — it is a temporary artifact
    for generating the assistance sidecar manifest. It should be
    cleaned up after analysis via cleanup_transient_artifacts().

    Args:
        youtube_url: Full YouTube URL.
        video_id: UUID string used as the filename stem.
        analysis_dir: Directory for the transient audio file.

    Returns:
        Path to the transient audio file.

    Raises:
        TransientAudioError: If audio extraction fails.
    """
    if yt_dlp is None:
        raise TransientAudioError(
            "yt-dlp is not installed. Install it to enable transient audio analysis."
        )

    os.makedirs(analysis_dir, exist_ok=True)
    output_template = os.path.join(analysis_dir, f"{video_id}_analysis.%(ext)s")

    ydl_opts: dict[str, Any] = {
        "format": "bestaudio/best",
        "outtmpl": output_template,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "m4a",
        }],
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=True)
            if info is None:
                raise TransientAudioError("yt-dlp returned no info for the URL.")
    except Exception as exc:
        raise TransientAudioError(f"Transient audio extraction failed: {exc}") from exc

    # Find the output file
    pattern = os.path.join(analysis_dir, f"{video_id}_analysis.*")
    matches = glob.glob(pattern)
    if not matches:
        raise TransientAudioError(
            "Audio extraction appeared to succeed but no output file was found."
        )
    return matches[0]


def cleanup_transient_artifacts(video_id: str, analysis_dir: str) -> None:
    """Remove transient analysis artifacts after sidecar manifest generation.

    Args:
        video_id: UUID string identifying the analysis artifacts.
        analysis_dir: Directory containing the transient files.
    """
    pattern = os.path.join(analysis_dir, f"{video_id}_analysis.*")
    for path in glob.glob(pattern):
        try:
            os.remove(path)
        except OSError:
            pass


def extract_transcript(audio_path: str) -> str:
    """Extract or generate a transcript from a transient audio file.

    TODO: Implement using Whisper or YouTube caption API.
    """
    raise NotImplementedError("TODO: implement transcript extraction")


def detect_beats(audio_path: str) -> list[float]:
    """Detect beat timestamps from a transient audio file for pacing analysis.

    TODO: Implement using librosa beat detection.
    """
    raise NotImplementedError("TODO: implement beat detection")
