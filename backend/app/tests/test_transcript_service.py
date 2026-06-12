"""Unit tests for transcript acquisition and VTT subtitle parsing."""

from __future__ import annotations

import unittest
from unittest.mock import patch, MagicMock

from app.services.transcript_service import get_youtube_transcript


class TestTranscriptService(unittest.TestCase):

    @patch("yt_dlp.YoutubeDL")
    @patch("builtins.open", new_callable=MagicMock)
    @patch("glob.glob")
    def test_transcript_acquisition_manual_captions(self, mock_glob, mock_open, mock_ytdl):
        """Verify transcript acquisition works and parses VTT properly with manual subtitles."""
        mock_instance = MagicMock()
        mock_ytdl.return_value.__enter__.return_value = mock_instance
        mock_instance.extract_info.return_value = {
            "subtitles": {"en": [{"url": "http://example.com/en.vtt", "ext": "vtt"}]},
            "automatic_captions": {}
        }
        mock_glob.return_value = ["/tmp/fake_caption.en.vtt"]
        
        vtt_content = (
            "WEBVTT\n\n"
            "00:00:01.000 --> 00:00:04.000\n"
            "Hello world\n\n"
            "00:00:05.500 --> 00:00:08.000\n"
            "Let's get ready\n"
        )
        
        # Setup mock file reading
        mock_file = MagicMock()
        mock_file.read.return_value = vtt_content
        mock_open.return_value.__enter__.return_value = mock_file

        with patch("os.path.exists", return_value=True), patch("os.remove") as mock_remove:
            segments, full_text, status = get_youtube_transcript("https://youtube.com/watch?v=12345678901", "vid_uuid")
            self.assertEqual(status, "captions_found")
            self.assertEqual(len(segments), 2)
            self.assertEqual(segments[0]["text"], "Hello world")
            self.assertEqual(segments[0]["start_ms"], 1000.0)
            self.assertEqual(segments[0]["end_ms"], 4000.0)
            self.assertEqual(full_text, "Hello world Let's get ready")
            mock_remove.assert_called_once()

    @patch("yt_dlp.YoutubeDL")
    @patch("builtins.open", new_callable=MagicMock)
    @patch("glob.glob")
    def test_transcript_acquisition_auto_captions(self, mock_glob, mock_open, mock_ytdl):
        """Verify transcript acquisition works and parses VTT properly with automatic subtitles."""
        mock_instance = MagicMock()
        mock_ytdl.return_value.__enter__.return_value = mock_instance
        mock_instance.extract_info.return_value = {
            "subtitles": {},
            "automatic_captions": {"en-US": [{"url": "http://example.com/en-US.vtt", "ext": "vtt"}]}
        }
        mock_glob.return_value = ["/tmp/fake_caption.en-US.vtt"]
        
        vtt_content = (
            "WEBVTT\n\n"
            "00:01.500 --> 00:03.000\n"
            "Automatic caption\n"
        )
        
        # Setup mock file reading
        mock_file = MagicMock()
        mock_file.read.return_value = vtt_content
        mock_open.return_value.__enter__.return_value = mock_file

        with patch("os.path.exists", return_value=True), patch("os.remove") as mock_remove:
            segments, full_text, status = get_youtube_transcript("https://youtube.com/watch?v=12345678901", "vid_uuid")
            self.assertEqual(status, "auto_captions_found")
            self.assertEqual(len(segments), 1)
            self.assertEqual(segments[0]["text"], "Automatic caption")
            self.assertEqual(segments[0]["start_ms"], 1500.0)
            self.assertEqual(segments[0]["end_ms"], 3000.0)
            self.assertEqual(full_text, "Automatic caption")
            mock_remove.assert_called_once()

    @patch("yt_dlp.YoutubeDL")
    def test_transcript_acquisition_failing(self, mock_ytdl):
        """Verify transcript acquisition returns failure state when yt-dlp fails."""
        mock_instance = MagicMock()
        mock_ytdl.return_value.__enter__.return_value = mock_instance
        mock_instance.extract_info.return_value = None

        segments, full_text, status = get_youtube_transcript("https://youtube.com/watch?v=12345678901", "vid_uuid")
        self.assertEqual(status, "transcript_generation_failed")
        self.assertEqual(segments, [])
        self.assertEqual(full_text, "")


if __name__ == "__main__":
    unittest.main()
