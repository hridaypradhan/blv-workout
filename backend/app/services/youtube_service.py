"""YouTube ingestion service stubs for FitA11y."""


def download_video(youtube_url: str) -> str:
    """Download a YouTube workout video and return its local file path."""
    raise NotImplementedError("TODO: implement")


def extract_audio(video_path: str) -> str:
    """Extract an audio track from a local workout video file."""
    raise NotImplementedError("TODO: implement")


def extract_transcript(audio_path: str) -> str:
    """Extract or generate a transcript from a local audio file."""
    raise NotImplementedError("TODO: implement")


def detect_beats(audio_path: str) -> list[float]:
    """Detect beat timestamps from a local audio file for pacing analysis."""
    raise NotImplementedError("TODO: implement")
