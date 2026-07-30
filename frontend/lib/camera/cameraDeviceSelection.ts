"use client";

import { CameraPreference } from "./cameraPreference";

const INTEGRATED_CAMERA_TOKENS = [
  "integrated",
  "built-in",
  "facetime",
  "front",
  "isight",
  "internal",
];

function normalizeLabel(label = ""): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function isIntegratedCameraLabel(label = ""): boolean {
  const normalized = normalizeLabel(label);
  return INTEGRATED_CAMERA_TOKENS.some((token) => normalized.includes(token));
}

function labelSimilarityScore(candidateLabel = "", preferredLabel = ""): number {
  const preferredTokens = new Set(normalizeLabel(preferredLabel).split(" ").filter(Boolean));
  if (preferredTokens.size === 0) return 0;

  return normalizeLabel(candidateLabel)
    .split(" ")
    .filter((token) => preferredTokens.has(token)).length;
}

export function sortCameraFallbackDevices(
  devices: MediaDeviceInfo[],
  targetDeviceId: string,
  preference: CameraPreference | null
): MediaDeviceInfo[] {
  const targetDevice = devices.find((device) => device.deviceId === targetDeviceId);
  const preferredLabel = preference?.label || targetDevice?.label || "";
  const preferredGroupId = targetDevice?.groupId || "";

  return devices
    .filter((device) => device.deviceId !== targetDeviceId)
    .slice()
    .sort((a, b) => {
      const aSameGroup = preferredGroupId && a.groupId === preferredGroupId ? 1 : 0;
      const bSameGroup = preferredGroupId && b.groupId === preferredGroupId ? 1 : 0;
      if (aSameGroup !== bSameGroup) return bSameGroup - aSameGroup;

      const aScore = labelSimilarityScore(a.label, preferredLabel);
      const bScore = labelSimilarityScore(b.label, preferredLabel);
      if (aScore !== bScore) return bScore - aScore;

      const aExternal = isIntegratedCameraLabel(a.label) ? 0 : 1;
      const bExternal = isIntegratedCameraLabel(b.label) ? 0 : 1;
      if (aExternal !== bExternal) return bExternal - aExternal;

      return 0;
    });
}
