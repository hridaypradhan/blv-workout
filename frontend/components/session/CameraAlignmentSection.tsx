/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { CameraSetupPreview } from "./CameraSetupPreview";

export interface CameraAlignmentSectionProps {
  cameraStream: any;
  setIsAlignmentOpen: (open: boolean) => void;
}

export function CameraAlignmentSection({
  cameraStream,
  setIsAlignmentOpen,
}: CameraAlignmentSectionProps) {
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl p-4 sm:p-6 shadow-xl" aria-labelledby="camera-heading" id="camera-setup-section">
      <CameraSetupPreview
        status={cameraStream.status}
        statusLabel={cameraStream.statusLabel}
        errorMessage={cameraStream.errorMessage}
        stream={cameraStream.stream}
        devices={cameraStream.devices}
        selectedDeviceId={cameraStream.selectedDeviceId}
        setSelectedDeviceId={cameraStream.setSelectedDeviceId}
        requestCamera={cameraStream.requestCamera}
        stopCamera={cameraStream.stopCamera}
        onStartAlignment={() => setIsAlignmentOpen(true)}
      />
    </section>
  );
}
