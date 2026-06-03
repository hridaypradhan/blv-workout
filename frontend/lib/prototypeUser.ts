/**
 * Prototype User Settings configuration.
 *
 * NOTE: The prototype uses in-memory backend user registration and onboarding.
 * In production, this fallback configuration can be replaced with full database
 * persistence and a real authentication system.
 */

// A stable UUID representing the current test user for session lifecycle prototyping
export const PROTOTYPE_USER_ID = "00000000-0000-0000-0000-000000000001";

export const PROTOTYPE_USER_DATA = {
  id: PROTOTYPE_USER_ID,
  email: "prototype.user@fita11y.local",
  name: "Prototype User",
  assistant_persona: "supportive",
};

/** Get the currently active user ID from localStorage, defaulting to the prototype user. */
export function getActiveUserId(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("fita11y_active_user_id") || PROTOTYPE_USER_ID;
  }
  return PROTOTYPE_USER_ID;
}

export const USER_UPDATED_EVENT = "fita11y:user-updated";

/** Set the active user ID in localStorage and notify listeners of the profile change. */
export function setActiveUserId(userId: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("fita11y_active_user_id", userId);
    notifyActiveUserUpdated();
  }
}

/** Dispatch a custom event to notify components that the user preferences have been updated. */
export function notifyActiveUserUpdated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(USER_UPDATED_EVENT));
  }
}
