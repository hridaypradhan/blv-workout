# MediaPipe Pose Landmarker Model

The `pose_landmarker_heavy.task` file in this directory is the Google MediaPipe
Pose Landmarker model (Float16 precision, heavy variant, ~30 MB).

It is **committed to the repository** and served by the Next.js dev server at:

```
/mediapipe/pose_landmarker_heavy.task
```

## Resolution Order (useMediaPipePoseLandmarker)

1. **Local file (preferred)**: The hook issues a `HEAD` request at startup.
   If the dev server returns `200 OK`, the local file is used directly.
2. **CDN fallback**: If the HEAD request fails (e.g. dev server not running,
   file deleted, or running in a bare Node.js/test environment), the hook
   automatically falls back to the official Google CDN:

   ```
   https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task
   ```

## Re-downloading the Model

If you need to re-download the file (e.g. after deleting it):

```bash
curl -o frontend/public/mediapipe/pose_landmarker_heavy.task \
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task"
```

## Privacy

All MediaPipe processing runs entirely client-side in the browser.
No camera frames, landmark coordinates, or pose data are transmitted to the backend.
