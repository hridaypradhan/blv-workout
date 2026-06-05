import React from "react";

interface ScreenReaderStatusProps {
  content: string;
  ariaLive?: "polite" | "assertive" | "off";
  role?: string;
  ariaAtomic?: boolean | "true" | "false";
}

export default function ScreenReaderStatus({
  content,
  ariaLive = "polite",
  role = "status",
  ariaAtomic = true,
}: ScreenReaderStatusProps) {
  return (
    <div
      className="sr-only"
      role={role}
      aria-live={ariaLive}
      aria-atomic={ariaAtomic}
    >
      {content}
    </div>
  );
}
