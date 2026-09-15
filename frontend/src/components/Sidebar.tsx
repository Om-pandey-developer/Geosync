"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  MapPin,
  Shield,
  Layers,
  Fingerprint,
  CheckCircle2,
  BarChart3,
  Globe2,
  Sparkles,
  HelpCircle,
} from "lucide-react";

interface SidebarProps {
  role: "patwari" | "tehsildar";
  onStartTour?: () => void;
}

export default function Sidebar({ role, onStartTour }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const isPatwari = role === "patwari";
  const roleColor = isPatwari ? "var(--accent-primary)" : "var(--accent-secondary)";
  const roleLabel = isPatwari ? "Patwari (Surveyor)" : "Tehsildar (Magistrate)";
  const roleSubtitle = isPatwari ? "Field Calibration & Alignment" : "Legal Review & Publication";

  return (
    <aside
      className="glass-sidebar"
      style={{
        width: 260,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: "0",
        position: "fixed",
        left: 0,
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          padding: "24px 20px 20px",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <button
          onClick={() => router.push("/")}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 4,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "rgba(121, 199, 197, 0.2)",
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
            }}
          >
            GeoSync
          </span>
        </button>
        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginLeft: "42px" }}>
          AI Spatial Middleware
        </div>
      </div>

      {/* Role Badge */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 14px",
            borderRadius: "var(--radius-md)",
            background: "rgba(121, 199, 197, 0.08)",
            border: "1px solid var(--border-glass)",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "10px",
              background: "rgba(121, 199, 197, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: roleColor,
            }}
          >
            {isPatwari ? <MapPin size={20} /> : <Shield size={20} />}
          </div>
          <div>
            <div
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              {roleLabel}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
              {roleSubtitle}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sections */}
      <div style={{ padding: "20px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <div
          style={{
            fontSize: "0.68rem",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-muted)",
            padding: "0 10px 6px",
            fontWeight: 700,
          }}
        >
          Active Workspaces
        </div>

        <button
          onClick={() => router.push("/patwari")}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 14px",
            borderRadius: "10px",
            background: isPatwari ? "rgba(121, 199, 197, 0.18)" : "transparent",
            color: isPatwari ? "var(--accent-primary)" : "var(--text-secondary)",
            border: isPatwari ? "1px solid rgba(121, 199, 197, 0.35)" : "1px solid transparent",
            cursor: "pointer",
            fontSize: "0.84rem",
            fontWeight: 600,
            textAlign: "left",
            transition: "all 0.2s",
          }}
        >
          <Layers size={17} />
          <span>Surveyor Canvas (ORB/TPS)</span>
        </button>

        <button
          onClick={() => router.push("/tehsildar")}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 14px",
            borderRadius: "10px",
            background: !isPatwari ? "rgba(180, 236, 231, 0.18)" : "transparent",
            color: !isPatwari ? "var(--accent-secondary)" : "var(--text-secondary)",
            border: !isPatwari ? "1px solid rgba(180, 236, 231, 0.35)" : "1px solid transparent",
            cursor: "pointer",
            fontSize: "0.84rem",
            fontWeight: 600,
            textAlign: "left",
            transition: "all 0.2s",
          }}
        >
          <BarChart3 size={17} />
          <span>HITL Approval Dashboard</span>
        </button>
      </div>

      {/* System Status Footer */}
      <div
        style={{
          padding: "16px 20px",
          borderTop: "1px solid var(--border-subtle)",
          background: "rgba(10, 18, 20, 0.5)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#A8E6CF",
              boxShadow: "0 0 8px #A8E6CF",
            }}
          />
          <span style={{ fontSize: "0.72rem", color: "#A8E6CF", fontWeight: 600 }}>
            Offline Air-Gap Cache: Active
          </span>
        </div>
        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
          ViT-H Latent Embeddings: Sub-10ms
        </div>
      </div>
    </aside>
  );
}
