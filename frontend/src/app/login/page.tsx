"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Globe2,
  Compass,
  Scale,
  Lock,
  User,
  KeyRound,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  Building2,
  FileCheck2,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth, DEMO_CREDENTIALS } from "@/lib/authContext";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithCredentials, role: currentRole } = useAuth();

  const initialRole = searchParams.get("role") === "tehsildar" ? "tehsildar" : "patwari";
  const [activeRole, setActiveRole] = useState<"patwari" | "tehsildar">(initialRole);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const roleParam = searchParams.get("role");
    if (roleParam === "tehsildar" || roleParam === "patwari") {
      setActiveRole(roleParam);
      setErrorMsg(null);
    }
  }, [searchParams]);

  // Quick auto-fill helper
  const handleAutoFill = (roleToFill: "patwari" | "tehsildar") => {
    setActiveRole(roleToFill);
    const creds = DEMO_CREDENTIALS[roleToFill];
    setUsername(creds.username);
    setPassword(creds.password);
    setErrorMsg(null);
    toast.success(`Credentials applied: ${creds.username}`);
  };

  const handleTabSwitch = (newRole: "patwari" | "tehsildar") => {
    setActiveRole(newRole);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!username.trim() || !password.trim()) {
      setErrorMsg("Please enter both Officer ID and Password.");
      return;
    }

    setIsSubmitting(true);

    // Simulate authentic government encryption & DSC verification latency
    setTimeout(() => {
      const result = loginWithCredentials(username, password);

      if (result.success && result.role) {
        toast.success(
          `Authentication Successful! Welcome, ${
            result.role === "patwari" ? "Surveyor Ramesh Kumar" : "Magistrate Smt. Priya Sharma"
          }`
        );
        router.push(result.role === "patwari" ? "/patwari" : "/tehsildar");
      } else {
        setErrorMsg(result.error || "Authentication failed. Please verify credentials.");
        setIsSubmitting(false);
      }
    }, 450);
  };

  const isPatwari = activeRole === "patwari";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        background: isPatwari
          ? "radial-gradient(ellipse at top, #F0FDFA 0%, #E2E8F0 100%)"
          : "radial-gradient(ellipse at top, #FFFBEB 0%, #E2E8F0 100%)",
        transition: "background 0.3s ease",
      }}
    >
      {/* Top National Context Bar */}
      <div
        className="animate-fade-in-up"
        style={{
          width: "100%",
          maxWidth: 580,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 18px",
          background: "rgba(255, 255, 255, 0.90)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-glass)",
          boxShadow: "var(--shadow-sm)",
          marginBottom: 20,
        }}
      >
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: "0.8125rem",
            fontWeight: 700,
            color: "var(--text-secondary)",
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={16} />
          <span>National Gateway</span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ShieldCheck size={16} style={{ color: "#0D9488" }} />
          <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--text-primary)" }}>
            DILRMP 3.0 &bull; Statutory SSO
          </span>
        </div>
      </div>

      {/* Main Login Card */}
      <div
        className="glass-card animate-fade-in-up"
        style={{
          width: "100%",
          maxWidth: 580,
          background: "#FFFFFF",
          borderRadius: "var(--radius-lg)",
          border: isPatwari ? "2px solid #99F6E4" : "2px solid #FDE68A",
          boxShadow: isPatwari
            ? "0 20px 50px -10px rgba(13, 148, 136, 0.2)"
            : "0 20px 50px -10px rgba(217, 119, 6, 0.2)",
          overflow: "hidden",
          transition: "border-color 0.3s ease, box-shadow 0.3s ease",
        }}
      >
        {/* Card Header Strip */}
        <div
          style={{
            height: 6,
            background: isPatwari
              ? "linear-gradient(90deg, #0D9488 0%, #2DD4BF 100%)"
              : "linear-gradient(90deg, #D97706 0%, #1E3A8A 100%)",
          }}
        />

        <div style={{ padding: "36px 36px 30px" }}>
          {/* Brand Header */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div
              style={{
                width: 60,
                height: 60,
                margin: "0 auto 14px",
                borderRadius: "var(--radius-md)",
                background: isPatwari
                  ? "linear-gradient(135deg, #0D9488 0%, #0F766E 100%)"
                  : "linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                boxShadow: isPatwari
                  ? "0 4px 14px rgba(13, 148, 136, 0.35)"
                  : "0 4px 14px rgba(30, 58, 138, 0.35)",
                border: isPatwari ? "1.5px solid #99F6E4" : "1.5px solid #F59E0B",
                transition: "all 0.3s ease",
              }}
            >
              {isPatwari ? <Compass size={32} /> : <Scale size={32} />}
            </div>

            <h1
              style={{
                fontSize: "1.65rem",
                fontWeight: 900,
                letterSpacing: "-0.03em",
                color: "var(--text-primary)",
                marginBottom: 4,
              }}
            >
              GeoSync Officer Login
            </h1>
            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
              Department of Land Resources &bull; Government of India
            </p>
          </div>

          {/* Role Selection Tabs */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              background: "#F1F5F9",
              padding: 5,
              borderRadius: "var(--radius-md)",
              marginBottom: 24,
            }}
          >
            <button
              type="button"
              onClick={() => handleTabSwitch("patwari")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "10px 14px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                cursor: "pointer",
                background: isPatwari ? "#FFFFFF" : "transparent",
                color: isPatwari ? "#0F766E" : "var(--text-secondary)",
                fontWeight: isPatwari ? 800 : 600,
                fontSize: "0.875rem",
                boxShadow: isPatwari ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.2s ease",
              }}
            >
              <Compass size={17} style={{ color: isPatwari ? "#0D9488" : "inherit" }} />
              <span>Patwari / Lekhpal</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabSwitch("tehsildar")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "10px 14px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                cursor: "pointer",
                background: !isPatwari ? "#FFFFFF" : "transparent",
                color: !isPatwari ? "#92400E" : "var(--text-secondary)",
                fontWeight: !isPatwari ? 800 : 600,
                fontSize: "0.875rem",
                boxShadow: !isPatwari ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.2s ease",
              }}
            >
              <Scale size={17} style={{ color: !isPatwari ? "#D97706" : "inherit" }} />
              <span>Tehsildar / Magistrate</span>
            </button>
          </div>

          {/* Role Description Banner */}
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              background: isPatwari ? "rgba(13, 148, 136, 0.08)" : "rgba(217, 119, 6, 0.08)",
              border: isPatwari ? "1px solid rgba(13, 148, 136, 0.2)" : "1px solid rgba(217, 119, 6, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 20,
              fontSize: "0.8125rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: isPatwari ? "#0D9488" : "#D97706",
                }}
              />
              <span style={{ fontWeight: 700, color: isPatwari ? "#0F766E" : "#92400E" }}>
                {isPatwari ? "Field GIS Surveyor Chamber (Level 1)" : "Statutory Revenue Bench (Level 2)"}
              </span>
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              {isPatwari ? "Field Sector 1" : "Revenue Court LKO"}
            </span>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div
              className="animate-fade-in-up"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "12px 14px",
                borderRadius: "var(--radius-sm)",
                background: "#FEF2F2",
                border: "1.5px solid #FCA5A5",
                color: "#991B1B",
                fontSize: "0.84rem",
                fontWeight: 600,
                marginBottom: 20,
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>{errorMsg}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* Officer ID / Email */}
            <div style={{ marginBottom: 18 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                  }}
                >
                  Officer ID / Government Email
                </label>
                <button
                  type="button"
                  onClick={() => handleAutoFill(isPatwari ? "patwari" : "tehsildar")}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: isPatwari ? "#0D9488" : "#D97706",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                  title="Click to autofill this ID"
                >
                  {isPatwari ? "patwari@geosync.gov.in" : "tehsildar@geosync.gov.in"}
                </button>
              </div>
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <User size={18} />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={
                    isPatwari ? "e.g. patwari@geosync.gov.in" : "e.g. tehsildar@geosync.gov.in"
                  }
                  required
                  style={{
                    width: "100%",
                    padding: "12px 14px 12px 42px",
                    borderRadius: "var(--radius-md)",
                    border: "1.5px solid var(--border-glass)",
                    background: "#F8FAFC",
                    fontSize: "0.9375rem",
                    color: "var(--text-primary)",
                    outline: "none",
                    transition: "border-color 0.2s ease",
                  }}
                  onFocus={(e) =>
                    (e.target.style.borderColor = isPatwari ? "var(--accent-primary)" : "var(--accent-gold)")
                  }
                  onBlur={(e) => (e.target.style.borderColor = "var(--border-glass)")}
                />
              </div>
            </div>

            {/* Password / Security Key */}
            <div style={{ marginBottom: 22 }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  marginBottom: 6,
                }}
              >
                Officer Security Password / PIN
              </label>
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <KeyRound size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter authorized password"
                  required
                  style={{
                    width: "100%",
                    padding: "12px 44px 12px 42px",
                    borderRadius: "var(--radius-md)",
                    border: "1.5px solid var(--border-glass)",
                    background: "#F8FAFC",
                    fontSize: "0.9375rem",
                    color: "var(--text-primary)",
                    outline: "none",
                    transition: "border-color 0.2s ease",
                  }}
                  onFocus={(e) =>
                    (e.target.style.borderColor = isPatwari ? "var(--accent-primary)" : "var(--accent-gold)")
                  }
                  onBlur={(e) => (e.target.style.borderColor = "var(--border-glass)")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={isPatwari ? "btn-primary" : "btn-judicial"}
              style={{
                width: "100%",
                padding: "14px 24px",
                fontSize: "1rem",
                fontWeight: 800,
                justifyContent: "center",
                boxShadow: isPatwari
                  ? "0 4px 16px rgba(13, 148, 136, 0.35)"
                  : "0 4px 16px rgba(30, 58, 138, 0.35)",
              }}
            >
              {isSubmitting ? (
                <>
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      border: "2px solid #FFFFFF",
                      borderTopColor: "transparent",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                  <span>Verifying DSC Credentials…</span>
                </>
              ) : (
                <>
                  <span>
                    Sign In to {isPatwari ? "Patwari / Lekhpal Studio" : "Tehsildar Adjudication Chamber"}
                  </span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Officer Login IDs */}
          <div
            style={{
              marginTop: 22,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
            }}
          >
            {/* Patwari Login ID */}
            <button
              type="button"
              onClick={() => handleAutoFill("patwari")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "11px 14px",
                borderRadius: "var(--radius-md)",
                background: isPatwari ? "#F0FDFA" : "#F8FAFC",
                border: isPatwari ? "1.5px solid #0D9488" : "1px solid var(--border-subtle)",
                color: isPatwari ? "#0F766E" : "var(--text-secondary)",
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow: isPatwari ? "0 2px 8px rgba(13, 148, 136, 0.12)" : "none",
              }}
              title="Click to autofill patwari@geosync.gov.in"
            >
              <Compass size={15} style={{ color: isPatwari ? "#0D9488" : "var(--text-muted)" }} />
              <span
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  fontFamily: "monospace",
                }}
              >
                patwari@geosync.gov.in
              </span>
            </button>

            {/* Tehsildar Login ID */}
            <button
              type="button"
              onClick={() => handleAutoFill("tehsildar")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "11px 14px",
                borderRadius: "var(--radius-md)",
                background: !isPatwari ? "#FFFBEB" : "#F8FAFC",
                border: !isPatwari ? "1.5px solid #D97706" : "1px solid var(--border-subtle)",
                color: !isPatwari ? "#92400E" : "var(--text-secondary)",
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow: !isPatwari ? "0 2px 8px rgba(217, 119, 6, 0.12)" : "none",
              }}
              title="Click to autofill tehsildar@geosync.gov.in"
            >
              <Scale size={15} style={{ color: !isPatwari ? "#D97706" : "var(--text-muted)" }} />
              <span
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  fontFamily: "monospace",
                }}
              >
                tehsildar@geosync.gov.in
              </span>
            </button>
          </div>
        </div>

        {/* Footer Note */}
        <div
          style={{
            padding: "14px 24px",
            background: "#F8FAFC",
            borderTop: "1px solid var(--border-subtle)",
            textAlign: "center",
            fontSize: "0.75rem",
            color: "var(--text-muted)",
          }}
        >
          Protected by Ministry of Rural Development Digital Security Standards &bull; SHA-256 e-Sign Compliant
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--bg-primary)",
            color: "var(--text-secondary)",
          }}
        >
          Loading GeoSync Officer Gateway…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
