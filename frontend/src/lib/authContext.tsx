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
    jurisdiction: "Assigned Field Halqa 12",
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
    jurisdiction: "District Revenue Court",
    department: "Judicial Revenue Magistracy, U.P. Civil Services",
    badgeNumber: "UP-JUD-SDM081",
    clearanceLevel: "Level-3 Judicial e-Sign & Form-II Statutory Decree Authority",
    token: "GEOSYNC-SDM-081-AUTH-TOKEN-2026",
  },
};

export interface DemoCredential {
  username: string;
  aliases: string[];
  password: string;
  role: "patwari" | "tehsildar";
  label: string;
}

export const DEMO_CREDENTIALS: Record<"patwari" | "tehsildar", DemoCredential> = {
  patwari: {
    username: "patwari@geosync.gov.in",
    aliases: ["patwari", "pat-442", "PAT-UP-LKO-442", "patwari123"],
    password: "patwari@123",
    role: "patwari",
    label: "Halqa Patwari (Field Surveyor)",
  },
  tehsildar: {
    username: "tehsildar@geosync.gov.in",
    aliases: ["tehsildar", "sdm-081", "SDM-UP-LKO-081", "tehsildar123"],
    password: "tehsildar@123",
    role: "tehsildar",
    label: "Tehsildar (Revenue Magistrate)",
  },
};

interface AuthContextType {
  role: UserRole;
  profile: OfficerProfile | null;
  officer: OfficerProfile | null;
  loginAs: (role: "patwari" | "tehsildar") => void;
  loginWithCredentials: (username: string, password: string) => { success: boolean; role?: "patwari" | "tehsildar"; error?: string };
  logout: () => void;
  hasRole: (requiredRole: "patwari" | "tehsildar") => boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  role: null,
  profile: null,
  officer: null,
  loginAs: () => {},
  loginWithCredentials: () => ({ success: false, error: "Not initialized" }),
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

  const loginWithCredentials = useCallback(
    (username: string, password: string) => {
      const cleanUser = username.trim().toLowerCase();
      const cleanPass = password.trim();

      // Check Patwari credentials
      const isPatwariUser =
        cleanUser === DEMO_CREDENTIALS.patwari.username.toLowerCase() ||
        DEMO_CREDENTIALS.patwari.aliases.map((a) => a.toLowerCase()).includes(cleanUser);
      const isPatwariPass = cleanPass === DEMO_CREDENTIALS.patwari.password;

      if (isPatwariUser && isPatwariPass) {
        loginAs("patwari");
        return { success: true, role: "patwari" as const };
      }

      // Check Tehsildar credentials
      const isTehsildarUser =
        cleanUser === DEMO_CREDENTIALS.tehsildar.username.toLowerCase() ||
        DEMO_CREDENTIALS.tehsildar.aliases.map((a) => a.toLowerCase()).includes(cleanUser);
      const isTehsildarPass = cleanPass === DEMO_CREDENTIALS.tehsildar.password;

      if (isTehsildarUser && isTehsildarPass) {
        loginAs("tehsildar");
        return { success: true, role: "tehsildar" as const };
      }

      // If user matched but wrong password
      if (isPatwariUser && !isPatwariPass) {
        return {
          success: false,
          error: "Incorrect password for Patwari officer profile.",
        };
      }
      if (isTehsildarUser && !isTehsildarPass) {
        return {
          success: false,
          error: "Incorrect password for Tehsildar judicial profile.",
        };
      }

      return {
        success: false,
        error: "Invalid Officer ID or Password. Please verify your credentials.",
      };
    },
    [loginAs]
  );

  return (
    <AuthContext.Provider
      value={{
        role,
        profile,
        officer: profile,
        loginAs,
        loginWithCredentials,
        logout,
        hasRole,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
