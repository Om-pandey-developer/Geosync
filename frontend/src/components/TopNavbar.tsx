"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Globe2,
  Compass,
  UserCheck,
  Layers,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import OnboardingTour from "@/components/OnboardingTour";
import RegistrationModal from "@/components/RegistrationModal";

export default function TopNavbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [tourOpen, setTourOpen] = useState(false);
  const [regModalOpen, setRegModalOpen] = useState(false);

  if (pathname === "/") return null;

  const isPatwari = pathname.includes("patwari");
  const isTehsildar = pathname.includes("tehsildar");

  return (
    <>
      <div
        style={{
          height: 64,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          borderBottom: "1px solid var(--border-glass)",
          background: "var(--bg-glass-strong)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 1000,
        }}
      >
        {/* Left: Brand & National Context */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <button
            onClick={() => router.push("/")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              background: "none",
              border: "none",
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: "rgba(121, 199, 197, 0.2)",
                border: "1px solid rgba(121, 199, 197, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent-primary)",
              }}
            >
              <Globe2 size={20} />
            </div>
            <span
              style={{
                fontSize: "1.2rem",
                fontWeight: 800,
                color: "var(--text-primary)",
                letterSpacing: "-0.3px",
              }}
            >
              GeoSync
            </span>
          </button>

          <div
            className="badge-pastel-teal"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 14px",
              borderRadius: 100,
              fontSize: "0.74rem",
              fontWeight: 600,
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#79C7C5",
                boxShadow: "0 0 10px #79C7C5",
              }}
            />
            <span>DILRMP 3.0 / NAKSHA Pilot — Ward 12 Lucknow</span>
          </div>
        </div>

        {/* Right: Actions, Tour, KYC, Role Switcher */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Quick Onboarding Tour Button */}
          <button
            onClick={() => setTourOpen(true)}
            className="btn-pastel-secondary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              fontSize: "0.8rem",
            }}
            title="Start Guided System Tour"
          >
            <Compass size={15} /> Quick Tour
          </button>

          {/* Strict Officer KYC / Parcel Registration */}
          <button
            onClick={() => setRegModalOpen(true)}
            className="btn-pastel-secondary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              fontSize: "0.8rem",
            }}
            title="Verify Officer / Add Parcel"
          >
            <UserCheck size={15} /> Verify / Register
          </button>

          <div style={{ width: 1, height: 26, background: "var(--border-glass)" }} />

          {/* Role Navigation Toggle */}
          <div
            style={{
              display: "flex",
              background: "rgba(18, 32, 35, 0.7)",
              borderRadius: 10,
              padding: 4,
              border: "1px solid var(--border-glass)",
            }}
          >
            <button
              onClick={() => router.push("/patwari")}
              style={{
                padding: "6px 14px",
                fontSize: "0.78rem",
                fontWeight: 600,
                borderRadius: 8,
                background: isPatwari ? "var(--accent-primary)" : "transparent",
                color: isPatwari ? "#091416" : "var(--text-muted)",
                border: "none",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              Patwari (Surveyor)
            </button>
            <button
              onClick={() => router.push("/tehsildar")}
              style={{
                padding: "6px 14px",
                fontSize: "0.78rem",
                fontWeight: 600,
                borderRadius: 8,
                background: isTehsildar ? "var(--accent-secondary)" : "transparent",
                color: isTehsildar ? "#091416" : "var(--text-muted)",
                border: "none",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              Tehsildar (HITL Approval)
            </button>
          </div>
        </div>
      </div>

      {/* Global Modals */}
      <OnboardingTour isOpen={tourOpen} onClose={() => setTourOpen(false)} />
      <RegistrationModal isOpen={regModalOpen} onClose={() => setRegModalOpen(false)} />
    </>
  );
}
