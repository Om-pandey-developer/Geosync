"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth, OFFICER_PRESETS, UserRole } from "@/lib/authContext";
import {
  ShieldAlert,
  Lock,
  ArrowLeft,
  ArrowRight,
  UserCheck,
  Scale,
  Compass,
  AlertTriangle,
  LogOut,
  Building2,
  FileCheck2,
} from "lucide-react";

interface RoleGuardProps {
  requiredRole: "patwari" | "tehsildar";
  children: React.ReactNode;
}

export default function RoleGuard({ requiredRole, children }: RoleGuardProps) {
  const router = useRouter();
  const { role, profile, loginAs, logout, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-primary)",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: "3px solid #E2E8F0",
            borderTopColor: "var(--accent-primary)",
            animation: "spin 1s linear infinite",
          }}
        />
        <div style={{ color: "var(--text-secondary)", fontSize: "0.9375rem", fontWeight: 600 }}>
          Verifying Statutory Officer Security Clearance…
        </div>
      </div>
    );
  }

  // 1. Authorized: User possesses required role
  if (role === requiredRole) {
    return <>{children}</>;
  }

  // 2. Cross-Role Conflict (e.g. Patwari accessing Tehsildar or vice versa)
  if (role !== null && role !== requiredRole) {
    const isAttemptingTehsildar = requiredRole === "tehsildar";
    const assignedPortalUrl = role === "patwari" ? "/patwari" : "/tehsildar";
    const assignedPortalName = role === "patwari" ? "Surveyor GIS Studio (Patwari)" : "Magistrate Chamber (Tehsildar)";

    return (
      <div
        style={{
          minHeight: "100vh",
          padding: "100px 24px 60px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(ellipse at top, #F8FAFC 0%, #E2E8F0 100%)",
        }}
      >
        <div
          className="glass-card animate-fade-in-up"
          style={{
            maxWidth: 680,
            width: "100%",
            padding: "36px 40px",
            borderRadius: "var(--radius-lg)",
            background: "#FFFFFF",
            border: isAttemptingTehsildar ? "2px solid #FCD34D" : "2px solid #99F6E4",
            boxShadow: "0 20px 50px -10px rgba(15, 23, 42, 0.2)",
            textAlign: "center",
          }}
        >
          {/* Header Icon */}
          <div
            style={{
              width: 72,
              height: 72,
              margin: "0 auto 20px",
              borderRadius: "50%",
              background: isAttemptingTehsildar
                ? "linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)"
                : "linear-gradient(135deg, #CCFBF1 0%, #99F6E4 100%)",
              border: isAttemptingTehsildar ? "2px solid #F59E0B" : "2px solid #0D9488",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isAttemptingTehsildar ? "#B45309" : "#0F766E",
              boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            }}
          >
            {isAttemptingTehsildar ? <Scale size={36} /> : <Compass size={36} />}
          </div>

          {/* Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 14px",
              borderRadius: "999px",
              background: "#FEE2E2",
              border: "1px solid #FCA5A5",
              color: "#991B1B",
              fontSize: "0.78rem",
              fontWeight: 800,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            <ShieldAlert size={14} />
            <span>403 Forbidden &bull; Role-Based Access Control (RBAC)</span>
          </div>

          {/* Heading */}
          <h1
            style={{
              fontSize: "1.65rem",
              fontWeight: 900,
              color: "var(--text-primary)",
              marginBottom: 10,
              letterSpacing: "-0.02em",
            }}
          >
            {isAttemptingTehsildar
              ? "Statutory Judicial Clearance Required"
              : "Field Surveyor GIS Studio Restricted"}
          </h1>

          {/* Statutory Subtitle */}
          <p
            style={{
              fontSize: "0.875rem",
              fontWeight: 700,
              color: isAttemptingTehsildar ? "#92400E" : "#0D9488",
              marginBottom: 16,
            }}
          >
            {isAttemptingTehsildar
              ? "U.P. Land Revenue Code, 2006 &bull; Section 144 Revenue Court Rules"
              : "Survey & Boundary Operations Act &bull; Evidentiary Separation Directive"}
          </p>

          {/* Detailed Legal Reason */}
          <p
            style={{
              fontSize: "0.9375rem",
              lineHeight: 1.6,
              color: "var(--text-secondary)",
              marginBottom: 24,
              background: "#F8FAFC",
              padding: "16px 20px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
              textAlign: "left",
            }}
          >
            {isAttemptingTehsildar ? (
              <>
                <strong>Notice to Field Survey Officer:</strong> You are currently logged in with{" "}
                <strong>Halqa Patwari (Field Surveyor)</strong> credentials. The Tehsildar Adjudication Chamber is a formal
                revenue magistracy bench. Under state statutory rules, field surveyors cannot adjudicate disputes, approve
                cadastral dockets, or issue Form-II legal decrees to prevent conflict of interest.
              </>
            ) : (
              <>
                <strong>Notice to Presiding Magistrate:</strong> You are currently logged in with{" "}
                <strong>Tehsildar (Judicial Magistrate)</strong> credentials. The Field Surveyor Studio is designated exclusively
                for certified Patwaris to capture RTK ground control points, adjust vertex handles, and run AI segmentations.
                Presiding magistrates are prohibited from altering raw field evidence.
              </>
            )}
          </p>

          {/* Current Active Profile Card */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 18px",
              borderRadius: "var(--radius-md)",
              background: "#F1F5F9",
              border: "1px solid var(--border-subtle)",
              marginBottom: 26,
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "var(--radius-sm)",
                  background: role === "patwari" ? "#CCFBF1" : "#FEF3C7",
                  color: role === "patwari" ? "#0D9488" : "#D97706",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                }}
              >
                <UserCheck size={20} />
              </div>
              <div>
                <div style={{ fontSize: "0.875rem", fontWeight: 800, color: "var(--text-primary)" }}>
                  {profile?.name || "Active Officer"}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  {profile?.designation} &bull; ID: <code>{profile?.officerId}</code>
                </div>
              </div>
            </div>

            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: 800,
                padding: "3px 8px",
                borderRadius: 4,
                background: "#E2E8F0",
                color: "#334155",
              }}
            >
              Session Active
            </span>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Primary: Return to authorized portal */}
            <button
              onClick={() => router.push(assignedPortalUrl)}
              className={role === "patwari" ? "btn-primary" : "btn-judicial"}
              style={{
                width: "100%",
                padding: "12px 20px",
                fontSize: "0.95rem",
                justifyContent: "center",
              }}
            >
              <ArrowLeft size={18} />
              <span>Return to My Authorized Workspace: {assignedPortalName}</span>
            </button>

            {/* Secondary: Switch to requested role */}
            <button
              onClick={() => {
                loginAs(requiredRole);
              }}
              className="btn-secondary"
              style={{
                width: "100%",
                padding: "11px 20px",
                fontSize: "0.875rem",
                justifyContent: "center",
                background: "#FFFFFF",
              }}
            >
              <span>Switch Officer Clearance &rarr; Authenticate as {requiredRole === "tehsildar" ? "Tehsildar (Magistrate)" : "Patwari (Surveyor)"}</span>
            </button>

            {/* Tertiary: Sign out / Gateway */}
            <button
              onClick={() => {
                logout();
                router.push("/");
              }}
              className="btn-ghost"
              style={{
                width: "100%",
                padding: "8px 16px",
                fontSize: "0.8125rem",
                justifyContent: "center",
                color: "var(--text-muted)",
              }}
            >
              <LogOut size={14} />
              <span>Sign Out & Return to National Gateway</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Unauthenticated (role === null) — Require Login Gate
  const targetName = requiredRole === "patwari" ? "Halqa Patwari (Field Surveyor)" : "Tehsildar (Revenue Magistrate)";
  const otherRole = requiredRole === "patwari" ? "tehsildar" : "patwari";
  const otherName = requiredRole === "patwari" ? "Tehsildar (Magistrate)" : "Patwari (Field Surveyor)";

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "100px 24px 60px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(ellipse at top, #F0FDFA 0%, #E2E8F0 100%)",
      }}
    >
      <div
        className="glass-card animate-fade-in-up"
        style={{
          maxWidth: 620,
          width: "100%",
          padding: "36px 40px",
          borderRadius: "var(--radius-lg)",
          background: "#FFFFFF",
          border: "2px solid var(--border-glass)",
          boxShadow: "0 20px 50px -10px rgba(15, 23, 42, 0.16)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 68,
            height: 68,
            margin: "0 auto 18px",
            borderRadius: "50%",
            background: requiredRole === "patwari" ? "var(--accent-primary-bg)" : "linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)",
            border: requiredRole === "patwari" ? "2px solid #99F6E4" : "2px solid #F59E0B",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: requiredRole === "patwari" ? "var(--accent-primary)" : "#B45309",
          }}
        >
          <Lock size={32} />
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 12px",
            borderRadius: "999px",
            background: "var(--bg-secondary)",
            color: "var(--text-secondary)",
            fontSize: "0.78rem",
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          <Building2 size={13} />
          <span>Statutory Officer Authentication Required</span>
        </div>

        <h1
          style={{
            fontSize: "1.6rem",
            fontWeight: 900,
            color: "var(--text-primary)",
            marginBottom: 10,
            letterSpacing: "-0.02em",
          }}
        >
          Authenticate as {targetName}
        </h1>

        <p
          style={{
            fontSize: "0.9375rem",
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            marginBottom: 24,
          }}
        >
          GeoSync enforces strict Role-Based Access Control (RBAC). Please sign in with your verified government revenue
          credentials to access this portal.
        </p>

        {/* Preset Identity Card */}
        <div
          style={{
            background: "#F8FAFC",
            border: "1.5px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            padding: "16px 20px",
            textAlign: "left",
            marginBottom: 24,
          }}
        >
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Demonstration Digital Token
          </div>
          <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text-primary)", marginTop: 4 }}>
            {OFFICER_PRESETS[requiredRole].name}
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: 2 }}>
            {OFFICER_PRESETS[requiredRole].designation} &bull; {OFFICER_PRESETS[requiredRole].jurisdiction}
          </div>
          <div style={{ marginTop: 8, fontSize: "0.72rem", color: "var(--accent-primary)", fontWeight: 700 }}>
            ✓ Clearance: {OFFICER_PRESETS[requiredRole].clearanceLevel}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={() => router.push(`/login?role=${requiredRole}`)}
            className={requiredRole === "patwari" ? "btn-primary" : "btn-judicial"}
            style={{ width: "100%", padding: "12px 20px", fontSize: "0.95rem", justifyContent: "center" }}
          >
            <Lock size={18} />
            <span>Open Officer Login Portal &rarr;</span>
          </button>

          <button
            onClick={() => loginAs(requiredRole)}
            className="btn-secondary"
            style={{ width: "100%", padding: "10px 16px", fontSize: "0.85rem", justifyContent: "center" }}
          >
            <UserCheck size={16} />
            <span>Quick 1-Click Demo Login as {targetName}</span>
          </button>

          <button
            onClick={() => router.push(requiredRole === "patwari" ? "/tehsildar" : "/patwari")}
            className="btn-secondary"
            style={{ width: "100%", padding: "10px 16px", fontSize: "0.84rem", justifyContent: "center" }}
          >
            <span>Switch to {otherName} Portal &rarr;</span>
          </button>

          <button
            onClick={() => router.push("/")}
            className="btn-ghost"
            style={{ width: "100%", padding: "8px 16px", fontSize: "0.8125rem", justifyContent: "center" }}
          >
            <span>Return to National Gateway</span>
          </button>
        </div>
      </div>
    </div>
  );
}
