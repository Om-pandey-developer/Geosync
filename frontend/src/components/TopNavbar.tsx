"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Globe2,
  Compass,
  UserCheck,
  Layers,
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
      <header
        style={{
          height: 64,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-glass-strong)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 1000,
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
        }}
      >
        {/* Left: Brand & National Context */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
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
            aria-label="GeoSync Home"
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "var(--radius-md)",
                background: "var(--accent-primary-bg)",
                border: "1px solid var(--accent-primary-light)",
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
                fontSize: "1.25rem",
                fontWeight: 800,
                color: "var(--text-primary)",
                letterSpacing: "-0.02em",
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
              padding: "6px 14px",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.875rem", /* Fixed Issue 3: 14px body text */
              fontWeight: 600,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--accent-primary)",
                boxShadow: "0 0 8px var(--accent-primary)",
              }}
            />
            <span>DILRMP 3.0 / NAKSHA Pilot &mdash; Ward 12 Lucknow</span>
          </div>
        </div>

        {/* Right: Consolidated Action Cluster */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Quick Onboarding Tour Button */}
          <button
            onClick={() => setTourOpen(true)}
            className="btn-secondary"
            title="Start Guided System Tour"
          >
            <Compass size={16} style={{ color: "var(--accent-primary)" }} /> Quick Tour
          </button>

          {/* Strict Officer KYC / Parcel Registration */}
          <button
            onClick={() => setRegModalOpen(true)}
            className="btn-secondary"
            title="Verify Officer / Add Parcel"
          >
            <UserCheck size={16} style={{ color: "var(--accent-primary)" }} /> Verify / Register
          </button>

          <div style={{ width: 1, height: 24, background: "var(--border-subtle)", margin: "0 2px" }} />

          {/* Role Segmented Control */}
          <div
            role="group"
            aria-label="Workspace Role Switcher"
            style={{
              display: "flex",
              alignItems: "center",
              background: "var(--bg-secondary)",
              borderRadius: "var(--radius-md)",
              padding: 3,
              border: "1px solid var(--border-subtle)",
              gap: 2,
            }}
          >
            <button
              onClick={() => router.push("/patwari")}
              style={{
                padding: "6px 12px",
                fontSize: "0.8125rem",
                fontWeight: 600,
                borderRadius: "var(--radius-sm)",
                background: isPatwari ? "#FFFFFF" : "transparent",
                color: isPatwari ? "var(--accent-primary)" : "var(--text-secondary)",
                border: isPatwari ? "1px solid var(--border-subtle)" : "1px solid transparent",
                cursor: "pointer",
                transition: "all 0.15s ease",
                boxShadow: isPatwari ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              }}
            >
              Patwari (Surveyor)
            </button>
            <button
              onClick={() => router.push("/tehsildar")}
              style={{
                padding: "6px 12px",
                fontSize: "0.8125rem",
                fontWeight: 600,
                borderRadius: "var(--radius-sm)",
                background: isTehsildar ? "#FFFFFF" : "transparent",
                color: isTehsildar ? "var(--accent-primary)" : "var(--text-secondary)",
                border: isTehsildar ? "1px solid var(--border-subtle)" : "1px solid transparent",
                cursor: "pointer",
                transition: "all 0.15s ease",
                boxShadow: isTehsildar ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              }}
            >
              Tehsildar (Magistrate)
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
