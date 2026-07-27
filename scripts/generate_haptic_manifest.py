import os
import sys
import json
import wave

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VIBRATIONS_DIR = os.path.join(BASE_DIR, "frontend", "public", "haptics", "vibrations")
MANIFEST_DIR = os.path.join(BASE_DIR, "frontend", "public", "haptics")
MANIFEST_PATH = os.path.join(MANIFEST_DIR, "manifest.json")
METADATA_PATH = os.path.join(BASE_DIR, "scripts", "curated_haptic_metadata.json")

CANONICAL_CATEGORIES = ["start", "finish", "reps", "speed_up", "slow_down"]

def get_wav_duration_ms(file_path):
    try:
        with wave.open(file_path, 'rb') as f:
            frames = f.getnframes()
            rate = f.getframerate()
            if rate > 0:
                return round((frames / float(rate)) * 1000, 2)
    except Exception as e:
        raise ValueError(f"Error reading WAV file {file_path}: {e}")
    return 0.0

def main():
    if not os.path.exists(METADATA_PATH):
        sys.exit(f"Error: Curated metadata file not found at {METADATA_PATH}")

    with open(METADATA_PATH, "r") as f:
        metadata_list = json.load(f)

    if not os.path.exists(VIBRATIONS_DIR):
        sys.exit(f"Error: Vibrations directory not found at {VIBRATIONS_DIR}")

    # Collect all WAV files on disk to validate against expected metadata
    all_disk_wavs = set()
    for root, dirs, files in os.walk(VIBRATIONS_DIR):
        for file in files:
            if file.endswith(".wav"):
                rel_path = os.path.relpath(os.path.join(root, file), VIBRATIONS_DIR)
                all_disk_wavs.add(rel_path.replace("\\", "/"))

    seen_ids = set()
    seen_paths = set()
    manifest = []
    expected_wav_paths = set()

    for entry in metadata_list:
        stable_id = entry.get("id")
        cue_type = entry.get("cue_type")
        filename = entry.get("filename")
        source_wav = entry.get("source_wav")

        if not stable_id or stable_id in seen_ids:
            sys.exit(f"Validation error: Duplicate or missing stable ID: {stable_id}")
        seen_ids.add(stable_id)

        if cue_type not in CANONICAL_CATEGORIES:
            sys.exit(f"Validation error: Non-canonical cue_type '{cue_type}' for entry {stable_id}")

        if not source_wav or source_wav in seen_paths:
            sys.exit(f"Validation error: Duplicate or missing source_wav path: {source_wav}")
        seen_paths.add(source_wav)

        file_path = os.path.join(VIBRATIONS_DIR, cue_type, filename)
        rel_wav_path = f"{cue_type}/{filename}"
        expected_wav_paths.add(rel_wav_path)

        if not os.path.exists(file_path):
            sys.exit(f"Validation error: Referenced WAV file missing at {file_path}")

        duration_ms = get_wav_duration_ms(file_path)
        if duration_ms <= 0:
            sys.exit(f"Validation error: Invalid duration ({duration_ms} ms) for {file_path}")

        record = {
            "id": stable_id,
            "cue_type": cue_type,
            "label": entry.get("label"),
            "source_wav": source_wav,
            "filename": filename,
            "original_vibviz_id": entry.get("original_vibviz_id"),
            "duration_ms": duration_ms,
            "pleasantness_score": entry.get("pleasantness_score"),
            "pleasantness_band": entry.get("pleasantness_band"),
            "conversion_status": entry.get("conversion_status", "pending_bhaptics_authoring"),
            "bhaptics_event_name": entry.get("bhaptics_event_name"),
            "provider_notes": entry.get("provider_notes")
        }
        manifest.append(record)

    unexpected_wavs = all_disk_wavs - expected_wav_paths
    if unexpected_wavs:
        sys.exit(f"Validation error: Found unexpected WAV files on disk: {unexpected_wavs}")

    category_counts = {}
    for item in manifest:
        ct = item["cue_type"]
        category_counts[ct] = category_counts.get(ct, 0) + 1

    expected_counts = {"start": 6, "finish": 6, "reps": 6, "speed_up": 6, "slow_down": 4}
    if category_counts != expected_counts:
        sys.exit(f"Validation error: Category counts {category_counts} do not match expected {expected_counts}")

    os.makedirs(MANIFEST_DIR, exist_ok=True)
    with open(MANIFEST_PATH, "w", newline="\n") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")

    print(f"Successfully generated deterministic manifest with {len(manifest)} haptic cues at {MANIFEST_PATH}")
    print(f"Category breakdown: {category_counts}")

if __name__ == "__main__":
    main()
