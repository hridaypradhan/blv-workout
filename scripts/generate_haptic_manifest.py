import os
import json
import wave

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VIBRATIONS_DIR = os.path.join(BASE_DIR, "frontend", "public", "haptics", "vibrations")
MANIFEST_DIR = os.path.join(BASE_DIR, "frontend", "public", "haptics")
MANIFEST_PATH = os.path.join(MANIFEST_DIR, "manifest.json")

CUE_CATEGORIES = [
    "start",
    "countdown",
    "per_rep_tick",
    "speed_up",
    "slow_down",
    "form_warning_above",
    "cooldown"
]

def get_wav_duration_ms(file_path):
    try:
        with wave.open(file_path, 'rb') as f:
            frames = f.getnframes()
            rate = f.getframerate()
            if rate > 0:
                return round((frames / float(rate)) * 1000, 2)
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
    return 0.0

def main():
    manifest = []
    
    if not os.path.exists(VIBRATIONS_DIR):
        print(f"Vibrations directory not found at: {VIBRATIONS_DIR}")
        return
        
    for category in CUE_CATEGORIES:
        category_dir = os.path.join(VIBRATIONS_DIR, category)
        if not os.path.isdir(category_dir):
            continue
            
        # Get sorted list of WAV files
        filenames = sorted([f for f in os.listdir(category_dir) if f.endswith(".wav")])
        
        for idx, filename in enumerate(filenames, 1):
            file_path = os.path.join(category_dir, filename)
            duration_ms = get_wav_duration_ms(file_path)
            
            stable_id = f"{category}_{idx:03d}"
            
            # Label format: capitalize words and add index, e.g. "Per rep tick 1"
            cat_words = category.replace("_", " ").split()
            label = " ".join(cat_words).capitalize() + f" {idx}"
            
            source_wav = f"/haptics/vibrations/{category}/{filename}"
            
            manifest.append({
                "id": stable_id,
                "cue_type": category,
                "label": label,
                "source_wav": source_wav,
                "filename": filename,
                "duration_ms": duration_ms,
                "conversion_status": "raw_wav",
                "bhaptics_event_name": None,
                "provider_notes": f"Raw WAV file {filename} in {category} folder."
            })
            
    os.makedirs(MANIFEST_DIR, exist_ok=True)
    with open(MANIFEST_PATH, "w") as f:
        json.dump(manifest, f, indent=2)
        
    print(f"Generated manifest with {len(manifest)} haptic cues at {MANIFEST_PATH}")

if __name__ == "__main__":
    main()
