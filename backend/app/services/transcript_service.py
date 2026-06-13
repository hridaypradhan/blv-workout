"""YouTube subtitle/caption acquisition and VTT parsing service."""

from __future__ import annotations

import os
import re
import glob
import logging
from typing import Any
import yt_dlp

from app.core.config import settings

logger = logging.getLogger(__name__)


def parse_vtt_timestamp(ts_str: str) -> float:
    ts_str = ts_str.strip()
    parts = ts_str.split(':')
    if len(parts) == 3:
        hrs, mins, secs = parts
    elif len(parts) == 2:
        hrs = '0'
        mins, secs = parts
    else:
        raise ValueError(f"Invalid VTT timestamp: {ts_str}")
    
    if '.' in secs:
        secs_str, ms_str = secs.split('.')
    else:
        secs_str = secs
        ms_str = '0'
    
    ms_str = ms_str[:3].ljust(3, '0')
    total_ms = int(hrs) * 3600000 + int(mins) * 60000 + int(secs_str) * 1000 + int(ms_str)
    return float(total_ms)


def parse_vtt(vtt_text: str) -> list[dict[str, Any]]:
    blocks = re.split(r'\n\s*\n', vtt_text.replace('\r\n', '\n'))
    segments = []
    for block in blocks:
        lines = [l.strip() for l in block.split('\n') if l.strip()]
        if not lines:
            continue
        timestamp_line = None
        text_lines = []
        for line in lines:
            if '-->' in line:
                timestamp_line = line
            else:
                if not timestamp_line:
                    continue
                text_lines.append(line)
        
        if not timestamp_line:
            continue
        
        try:
            start_str, end_str = timestamp_line.split('-->')
            end_str = end_str.split()[0]
            start_ms = parse_vtt_timestamp(start_str)
            end_ms = parse_vtt_timestamp(end_str)
            text = ' '.join(text_lines)
            
            # Clean VTT tags, styling artifacts, and curly braces
            text = re.sub(r'<[^>]+>', '', text)
            text = re.sub(r'\{[^}]+\}', '', text)
            text = re.sub(r'\b(?:align|position|line|size|vertical):\S+', '', text)
            text = re.sub(r'\s+', ' ', text).strip()
            
            if text:
                # Avoid repeated identical adjacent caption text
                if not segments or segments[-1]['text'] != text:
                    segments.append({
                        'start_ms': start_ms,
                        'end_ms': end_ms,
                        'text': text
                    })
        except Exception:
            continue
    return segments


def get_youtube_transcript(youtube_url: str, video_id: str) -> tuple[list[dict[str, Any]], str, str]:
    os.makedirs(settings.TRANSIENT_ANALYSIS_DIR, exist_ok=True)
    try:
        ydl_opts_meta = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'skip_download': True
        }
        with yt_dlp.YoutubeDL(ydl_opts_meta) as ydl:
            info = ydl.extract_info(youtube_url, download=False)
        
        if not info:
            logger.warning('Could not extract info metadata for URL: %s', youtube_url)
            return [], '', 'transcript_generation_failed'
        
        subtitles = info.get('subtitles') or {}
        automatic_captions = info.get('automatic_captions') or {}
        
        manual_langs = [k for k in subtitles.keys() if k.startswith('en')]
        auto_langs = [k for k in automatic_captions.keys() if k.startswith('en')]
        
        status_state = 'captions_unavailable'
        selected_lang = None
        use_auto = False
        
        if manual_langs:
            selected_lang = 'en' if 'en' in manual_langs else manual_langs[0]
            status_state = 'captions_found'
        elif auto_langs:
            selected_lang = 'en' if 'en' in auto_langs else auto_langs[0]
            use_auto = True
            status_state = 'auto_captions_found'
            
        if not selected_lang:
            logger.info('No English captions or automatic subtitles found for %s', youtube_url)
            return [], '', 'captions_unavailable'
            
        outtmpl = os.path.join(settings.TRANSIENT_ANALYSIS_DIR, f"{video_id}_caption.%(ext)s")
        
        ydl_opts_dl = {
            'skip_download': True,
            'writesubtitles': not use_auto,
            'writeautomaticsub': use_auto,
            'subtitleslangs': [selected_lang],
            'subtitlesformat': 'vtt',
            'outtmpl': outtmpl,
            'quiet': True,
            'no_warnings': True
        }
        
        with yt_dlp.YoutubeDL(ydl_opts_dl) as ydl:
            ydl.download([youtube_url])
            
        pattern = os.path.join(settings.TRANSIENT_ANALYSIS_DIR, f"{video_id}_caption.*.vtt")
        files = glob.glob(pattern)
        if not files:
            logger.warning('Caption file not found on disk after download for %s', youtube_url)
            return [], '', 'transcript_generation_failed'
            
        caption_path = files[0]
        caption_path = os.path.abspath(caption_path)
        
        try:
            with open(caption_path, 'r', encoding='utf-8') as f:
                vtt_content = f.read()
            
            segments = parse_vtt(vtt_content)
            full_text = ' '.join([s['text'] for s in segments])
            return segments, full_text, status_state
        finally:
            try:
                if os.path.exists(caption_path):
                    os.remove(caption_path)
            except OSError:
                pass
    except Exception as e:
        logger.exception('Error during transcript acquisition from YouTube: %s', e)
        return [], '', 'transcript_generation_failed'
