import { User } from "../../types";
import { API_BASE_URL, checkResponse } from "./client";

// ============================================================================
// Wired API Surface - User Settings and Preferences
// ============================================================================

/** Register a new user profile with accessibility and assistant preferences. */
export async function registerUser(payload: Partial<User>): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/api/user/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return checkResponse<User>(res, "Register user profile failed");
}

/** Retrieve user profile details by ID. */
export async function getUserProfile(userId: string): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/api/user/${userId}`);
  return checkResponse<User>(res, "Retrieve user profile failed");
}

/** Update assistant persona, voice settings, audio coexistence, and feedback preferences. */
export async function updateUserSettings(userId: string, settings: Partial<User>): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/api/user/${userId}/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  return checkResponse<User>(res, "Update user settings failed");
}
