"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { User } from "@/types";
import { getActiveUserId, USER_UPDATED_EVENT } from "@/lib/prototypeUser";
import { getUserProfile } from "@/lib/api";

interface UserProfileContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Track active fetches for deduplication
  const activeFetchPromiseRef = useRef<Promise<User> | null>(null);
  const activeFetchUserIdRef = useRef<string | null>(null);

  const refreshProfile = useCallback(async () => {
    const activeUserId = getActiveUserId();
    if (!activeUserId) {
      setUser(null);
      setLoading(false);
      return;
    }

    // Deduplicate calls for the same userId
    if (activeFetchPromiseRef.current && activeFetchUserIdRef.current === activeUserId) {
      try {
        await activeFetchPromiseRef.current;
      } catch {
        // Handled by the original promise chain
      }
      return;
    }

    setLoading(true);
    setError(null);
    activeFetchUserIdRef.current = activeUserId;
    
    const fetchPromise = getUserProfile(activeUserId);
    activeFetchPromiseRef.current = fetchPromise;

    try {
      const profile = await fetchPromise;
      // Double check that user id hasn't changed while we were fetching
      if (activeFetchUserIdRef.current === activeUserId) {
        setUser(profile);
        setError(null);
      }
    } catch (err) {
      if (activeFetchUserIdRef.current === activeUserId) {
        const errMsg = err instanceof Error ? err.message : "Failed to retrieve user profile";
        setError(errMsg);
        setUser(null);
      }
    } finally {
      if (activeFetchUserIdRef.current === activeUserId) {
        setLoading(false);
        activeFetchPromiseRef.current = null;
        activeFetchUserIdRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    refreshProfile();

    if (typeof window !== "undefined") {
      window.addEventListener(USER_UPDATED_EVENT, refreshProfile);
      return () => {
        window.removeEventListener(USER_UPDATED_EVENT, refreshProfile);
      };
    }
  }, [refreshProfile]);

  return (
    <UserProfileContext.Provider value={{ user, loading, error, refreshProfile }}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error("useUserProfile must be used within a UserProfileProvider");
  }
  return context;
}
