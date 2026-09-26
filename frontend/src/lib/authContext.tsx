"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type UserRole = "patwari" | "tehsildar" | null;

export interface OfficerProfile {
  role: UserRole;
  name: string;
  officerId: string;
  designation: string;
  jurisdiction: string;
  department: string;
  badgeNumber: string;
  clearanceLevel: string;
  token: string;
}

export const OFFICER_PRESETS: Record<"patwari" | "tehsildar", OfficerProfile> = {
  patwari: {
    role: "patwari",
    name: "Ramesh Kumar Sharma",
    officerId: "PAT-UP-LKO-442",
    designation: "Halqa Patwari (Lekhpal)",
    jurisdiction: "Halqa Mohanlalganj-12, Lucknow",
    department: "Directorate of Land Records & Cadastral Survey, U.P.",
    badgeNumber: "UP-REV-LK442",
    clearanceLevel: "Level-1 Field Surveyor & Vertex Calibration Authority",
    token: "GEOSYNC-PAT-442-AUTH-TOKEN-2026",
  },
  tehsildar: {
    role: "tehsildar",
    name: "Smt. Priya Sharma, PCS",
    officerId: "SDM-UP-LKO-081",
    designation: "Sub-Divisional Magistrate & Tehsildar",
    jurisdiction: "Revenue Court Mohanlalganj, Lucknow",
    department: "Judicial Revenue Magistracy, U.P. Civil Services",
    badgeNumber: "UP-JUD-SDM081",
    clearanceLevel: "Level-3 Judicial e-Sign & Form-II Statutory Decree Authority",
    token: "GEOSYNC-SDM-081-AUTH-TOKEN-2026",
  },
};

interface AuthContextType {
  role: UserRole;
  profile: OfficerProfile | null;
  officer: OfficerProfile | null;
  loginAs: (role: "patwari" | "tehsildar") => void;
  logout: () => void;
  hasRole: (requiredRole: "patwari" | "tehsildar") => boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  role: null,
  profile: null,
  officer: null,
  loginAs: () => {},
  logout: () => {},
  hasRole: () => false,
  isLoading: true,
});

const STORAGE_KEY = "geosync_auth_role";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>(null);
  const [profile, setProfile] = useState<OfficerProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Sync state from localStorage on mount and storage events
  const syncFromStorage = useCallback(() => {
    try {
      if (typeof window === "undefined") return;
      const stored = localStorage.getItem(STORAGE_KEY) as UserRole;
      if (stored === "patwari" || stored === "tehsildar") {
        setRole(stored);
        setProfile(OFFICER_PRESETS[stored]);
      } else {
        setRole(null);
        setProfile(null);
      }
    } catch {
      setRole(null);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    syncFromStorage();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        syncFromStorage();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("geosync-auth-updated", syncFromStorage);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("geosync-auth-updated", syncFromStorage);
    };
  }, [syncFromStorage]);

  const loginAs = useCallback((targetRole: "patwari" | "tehsildar") => {
    try {
      localStorage.setItem(STORAGE_KEY, targetRole);
      setRole(targetRole);
      setProfile(OFFICER_PRESETS[targetRole]);
      window.dispatchEvent(new Event("geosync-auth-updated"));
    } catch (e) {
      console.error("Failed to persist auth state:", e);
    }
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setRole(null);
      setProfile(null);
      window.dispatchEvent(new Event("geosync-auth-updated"));
    } catch (e) {
      console.error("Failed to clear auth state:", e);
    }
  }, []);

  const hasRole = useCallback(
    (requiredRole: "patwari" | "tehsildar") => {
      return role === requiredRole;
    },
    [role]
  );

  return (
    <AuthContext.Provider value={{ role, profile, officer: profile, loginAs, logout, hasRole, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
