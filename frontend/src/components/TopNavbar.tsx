"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Globe2,
  Compass,
  UserCheck,
  Layers,
  Scale,
  Compass as CompassIcon,
  Shield,
  FileCheck2,
  Lock,
  ChevronRight,
  ArrowRight,
  ExternalLink,
  LogOut,
} from "lucide-react";
import OnboardingTour from "@/components/OnboardingTour";
import RegistrationModal from "@/components/RegistrationModal";
import { useAuth } from "@/lib/authContext";

export default function TopNavbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { role, officer, logout } = useAuth();
  const [tourOpen, setTourOpen] = useState(false);
  const [regModalOpen, setRegModalOpen] = useState(false);

  if (pathname === "/") return null;

  const isPatwari = pathname.includes("patwari");
  const isTehsildar = pathname.includes("tehsildar");

  const handleOpenMapSource = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("open-map-source-modal"));
    }
  };

  return (
    <>
      <header
        style={{
          height: 68,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          borderBottom: isTehsildar ? "1.5px solid #1E3A8A30" : "1px solid var(--border-subtle)",
          background: isTehsildar
            ? "linear-gradient(90deg, rgba(255, 255, 255, 0.98) 0%, rgba(240, 249, 255, 0.96) 100%)"
            : "var(--bg-glass-strong)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 1000,
          boxShadow: isTehsildar
            ? "0 4px 20px -2px rgba(30, 58, 138, 0.08)"
            : "0 1px 4px 0 rgba(0, 0, 0, 0.05)",
        }}
      >
        {/* ═══════════ LEFT: IDENTITY & JURISDICTION ═══════════ */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Logo / Home trigger */}
          <button
            onClick={() => router.push("/")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              background: "none",
              border: "none",
              padding: 0,
            }}
            title="Return to National Land Governance Gateway"
            aria-label="GeoSync Home"
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "var(--radius-md)",
                background: isTehsildar
                  ? "linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%)"
                  : "linear-gradient(135deg, #0D9488 0%, #0F766E 100%)",
                border: isTehsildar ? "1.5px solid #F59E0B" : "1.5px solid #99F6E4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                boxShadow: isTehsildar
                  ? "0 2px 8px rgba(30, 58, 138, 0.3)"
                  : "0 2px 8px rgba(13, 148, 136, 0.3)",
              }}
            >
              {isTehsildar ? <Scale size={20} /> : <Globe2 size={20} />}
            </div>

            <div style={{ textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: 900,
                    color: "var(--text-primary)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  GeoSync
                </span>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 800,
                    padding: "1px 6px",
                    borderRadius: 4,
                    background: isTehsildar ? "#EFF6FF" : "var(--accent-primary-bg)",
                    color: isTehsildar ? "#1E3A8A" : "var(--accent-primary)",
                    border: isTehsildar ? "1px solid #BFDBFE" : "1px solid #99F6E4",
                    textTransform: "uppercase",
                  }}
                >
                  {isTehsildar ? "Judicial" : "Field GIS"}
                </span>
              </div>
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "var(--text-muted)",
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                }}
              >
                DILRMP 3.0 • NAKSHA Pilot
              </div>
            </div>
          </button>

          <div style={{ width: 1, height: 28, background: "var(--border-subtle)" }} />

          {/* DEDICATED ROLE TITLE & IDENTITY */}
          {isPatwari && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  padding: "4px 10px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--accent-primary-bg)",
                  border: "1px solid #99F6E4",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#0D9488",
                    animation: "pulseGlow 2s infinite",
                  }}
                />
                <div>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 800, color: "#0F766E" }}>
                    Surveyor GIS Studio • Halqa Mohanlalganj-12
                  </div>
                  <div style={{ fontSize: "0.6875rem", color: "#0D9488", fontWeight: 600 }}>
                    Lekhpal: Ramesh Kumar • RTK GPS Locked (±1.4cm)
                  </div>
                </div>
              </div>
            </div>
          )}

          {isTehsildar && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  padding: "4px 12px",
                  borderRadius: "var(--radius-sm)",
                  background: "linear-gradient(90deg, #FEF3C7 0%, #FFFBEB 100%)",
                  border: "1px solid #FCD34D",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#D97706",
                    boxShadow: "0 0 6px #F59E0B",
                  }}
                />
                <div>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 800, color: "#92400E" }}>
                    Revenue Magistrate Adjudication Chamber
                  </div>
                  <div style={{ fontSize: "0.6875rem", color: "#B45309", fontWeight: 600 }}>
                    Bench: Smt. Priya Sharma, PCS (Assistant Collector) • e-Sign DSC Level-3
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══════════ RIGHT: DEDICATED TOOL CLUSTER & PORTAL SWITCH ═══════════ */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Universal Map Layers Modal Trigger */}
          <button
            onClick={handleOpenMapSource}
            className="btn-secondary"
            style={{
              padding: "6px 12px",
              fontSize: "0.8125rem",
              fontWeight: 700,
              background: "#FFFFFF",
              borderColor: "var(--border-glass)",
            }}
            title="Configure or upload Old Map (BhuNaksha/Scans) & New Map (Drone/Satellite)"
          >
            <Layers size={15} style={{ color: "var(--accent-primary)" }} />
            <span>Map Layers (Old & New)</span>
          </button>

          {/* Quick Onboarding Tour */}
          <button
            onClick={() => setTourOpen(true)}
            className="btn-ghost"
            style={{ padding: "6px 10px", fontSize: "0.8125rem" }}
            title="Start Guided System Tour"
          >
            <Compass size={15} style={{ color: "var(--accent-primary)" }} />
            <span>Tour</span>
          </button>

          {/* Officer KYC / Parcel Registration */}
          <button
            onClick={() => setRegModalOpen(true)}
            className="btn-ghost"
            style={{ padding: "6px 10px", fontSize: "0.8125rem" }}
            title="Verify Officer / Add Parcel"
          >
            <UserCheck size={15} style={{ color: "var(--accent-primary)" }} />
            <span>Verify</span>
          </button>

          <div style={{ width: 1, height: 26, background: "var(--border-subtle)", margin: "0 4px" }} />

          {/* ═══════════ AUTHENTICATED OFFICER CLEARANCE & SIGN OUT ═══════════ */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 10px",
                borderRadius: "var(--radius-md)",
                background: isTehsildar ? "rgba(30, 58, 138, 0.08)" : "rgba(13, 148, 136, 0.08)",
                border: isTehsildar ? "1px solid rgba(30, 58, 138, 0.25)" : "1px solid rgba(13, 148, 136, 0.25)",
              }}
            >
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: isTehsildar ? "#1E3A8A" : "#0D9488",
                  boxShadow: `0 0 6px ${isTehsildar ? "#1E3A8A" : "#0D9488"}`,
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
                <span
                  style={{
                    fontSize: "0.625rem",
                    fontWeight: 800,
                    color: isTehsildar ? "#1E3A8A" : "#0F766E",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {isTehsildar ? "⚖️ Magistrate Clearance" : "🛡️ Patwari Clearance"}
                </span>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  {officer?.name || (isTehsildar ? "Smt. Priya Sharma, PCS" : "Ramesh Kumar Sharma")}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                logout();
                router.push("/");
              }}
              className="btn-ghost"
              style={{
                padding: "6px 10px",
                fontSize: "0.8125rem",
                color: "#DC2626",
                borderColor: "rgba(220, 38, 38, 0.25)",
                background: "#FEF2F2",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
              title="Terminate officer statutory session and exit to National Gateway"
            >
              <LogOut size={13} style={{ color: "#DC2626" }} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Global Modals */}
      <OnboardingTour isOpen={tourOpen} onClose={() => setTourOpen(false)} />
      <RegistrationModal isOpen={regModalOpen} onClose={() => setRegModalOpen(false)} />
    </>
  );
}
