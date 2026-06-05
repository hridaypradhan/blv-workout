import React, { useEffect, useRef } from "react";
import { AssistanceJob } from "@/types";

interface DeleteVideoDialogProps {
  job: AssistanceJob | null;
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  error: string | null;
  focusFallbackRef?: React.RefObject<HTMLElement | null>;
}

export default function DeleteVideoDialog({
  job,
  isOpen,
  onCancel,
  onConfirm,
  isDeleting,
  error,
  focusFallbackRef,
}: DeleteVideoDialogProps) {
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Store active element when opening and restore it on close
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      // Focus the cancel button (safer default for destructive actions)
      setTimeout(() => {
        cancelButtonRef.current?.focus();
      }, 0);
    } else {
      if (previousActiveElement.current && previousActiveElement.current.isConnected) {
        previousActiveElement.current.focus();
      } else if (focusFallbackRef?.current) {
        focusFallbackRef.current.focus();
      }
    }
  }, [isOpen, focusFallbackRef]);

  // Handle escape key and focus trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        onCancel();
        return;
      }

      if (e.key === "Tab") {
        const cancelBtn = cancelButtonRef.current;
        const confirmBtn = confirmButtonRef.current;
        if (!cancelBtn || !confirmBtn) return;

        if (e.shiftKey) {
          // Shift + Tab
          if (document.activeElement === cancelBtn) {
            e.preventDefault();
            confirmBtn.focus();
          }
        } else {
          // Tab
          if (document.activeElement === confirmBtn) {
            e.preventDefault();
            cancelBtn.focus();
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen || !job) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      aria-describedby="delete-dialog-description"
    >
      {/* Click outside to cancel */}
      <div
        className="absolute inset-0 cursor-default"
        onClick={isDeleting ? undefined : onCancel}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl z-10 flex flex-col">
        <div className="flex items-start gap-4 mb-4">
          <div className="p-3 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 flex-shrink-0">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h2 id="delete-dialog-title" className="text-xl font-bold text-white">
              Delete Prepared Video
            </h2>
            <div id="delete-dialog-description" className="mt-2 text-sm text-slate-300 space-y-2">
              <p>
                Are you sure you want to delete{" "}
                <strong className="text-yellow-400 font-semibold">{job.title || "this video"}</strong>?
              </p>
              <p className="text-sm text-slate-400">
                This will permanently remove the prepared video and its assistance data from the Video Library and server memory.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div
            className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400 font-medium flex items-center gap-2"
            role="alert"
          >
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 mt-2">
          <button
            ref={cancelButtonRef}
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-bold rounded-xl text-sm border border-slate-700 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 focus-visible:outline-offset-2"
          >
            Cancel
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-800 disabled:text-slate-300 text-white font-bold rounded-xl text-sm border border-red-500 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400 focus-visible:outline-offset-2 flex items-center gap-1.5"
          >
            {isDeleting ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Deleting...
              </>
            ) : (
              "Delete Video"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
