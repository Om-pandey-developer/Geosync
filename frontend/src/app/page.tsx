"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Shield,
  Layers,
  Cpu,
  ArrowRight,
  Fingerprint,
  ScanLine,
  CheckCircle2,
  Globe2,
} from "lucide-react";

export default function LandingPage() {
  const router = useRouter();
  const [hoveredRole, setHoveredRole] = useState<string | null>(null);

  const features = [
    {
      icon: <ScanLine size={24} />,
      title: "Raster Alignment",
      desc: "ORB/RANSAC/TPS-based alignment of legacy BhuNaksha maps with drone imagery",
    },
    {
      icon: <Layers size={24} />,
      title: "Topological Cleanup",
      desc: "PostGIS spatial operations to fix overlaps, gaps, and boundary inconsistencies",
    },
    {
      icon: <Fingerprint size={24} />,
      title: "ULPIN Generation",
      desc: "14-digit Base-14 Bhu-Aadhaar unique land parcel identification numbers",
    },
    {
      icon: <CheckCircle2 size={24} />,
      title: "HITL Workflow",
      desc: "Legal Human-in-the-Loop Revenue Officer approval for cadastral changes",
    },
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
      }}
    >
      {/* ───── Header / Hero ───── */}
      <div
        className="animate-fade-in-up"
        style={{ textAlign: "center", marginBottom: 48, maxWidth: 700 }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
            padding: "8px 20px",
            borderRadius: 100,
            background: "rgba(59, 130, 246, 0.1)",
            border: "1px solid rgba(59, 130, 246, 0.2)",
          }}
        >
          <Globe2 size={16} style={{ color: "var(--accent-primary)" }} />
          <span
            style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "var(--accent-primary)",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            Smart India Hackathon 2026
          </span>
        </div>

        <h1
          style={{
            fontSize: "clamp(2.2rem, 5vw, 3.5rem)",
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: 16,
            background: "linear-gradient(135deg, #f0f4ff 0%, #3b82f6 50%, #06b6d4 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          GeoSync
        </h1>
        <p
          style={{
            fontSize: "1.1rem",
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            maxWidth: 560,
            margin: "0 auto",
          }}
        >
          AI-Powered Geospatial Middleware bridging legacy cadastral maps with
          high-precision drone imagery for modern land records.
        </p>
      </div>

      {/* ───── Feature Cards ───── */}
      <div
        className="animate-fade-in-up animate-delay-2"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          maxWidth: 960,
          width: "100%",
          marginBottom: 56,
        }}
      >
        {features.map((f, i) => (
          <div
            key={i}
            className="glass-card"
            style={{ padding: "24px 20px", cursor: "default" }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "var(--radius-sm)",
                background: "rgba(59, 130, 246, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent-primary)",
                marginBottom: 14,
              }}
            >
              {f.icon}
            </div>
            <h3
              style={{
                fontSize: "0.95rem",
                fontWeight: 700,
                marginBottom: 8,
                color: "var(--text-primary)",
              }}
            >
              {f.title}
            </h3>
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                lineHeight: 1.5,
              }}
            >
              {f.desc}
            </p>
          </div>
        ))}
      </div>

      {/* ───── Role Selection ───── */}
      <div
        className="animate-fade-in-up animate-delay-3"
        style={{ textAlign: "center", marginBottom: 32 }}
      >
        <h2
          style={{
            fontSize: "1.2rem",
            fontWeight: 700,
            marginBottom: 6,
            color: "var(--text-primary)",
          }}
        >
          Select Your Role
        </h2>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 28 }}>
          Choose your workspace to continue
        </p>
      </div>

      <div
        className="animate-fade-in-up animate-delay-4"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 24,
          maxWidth: 680,
          width: "100%",
        }}
      >
        {/* Patwari Card */}
        <button
          onClick={() => router.push("/patwari")}
          onMouseEnter={() => setHoveredRole("patwari")}
          onMouseLeave={() => setHoveredRole(null)}
          className="glass-card"
          style={{
            padding: 32,
            cursor: "pointer",
            textAlign: "left",
            border:
              hoveredRole === "patwari"
                ? "1px solid rgba(59, 130, 246, 0.5)"
                : "1px solid var(--border-glass)",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "var(--radius-md)",
              background:
                "linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(6, 182, 212, 0.1))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <MapPin size={28} style={{ color: "var(--accent-primary)" }} />
          </div>
          <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: 8 }}>
            Patwari
          </h3>
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--text-muted)",
              lineHeight: 1.5,
              marginBottom: 20,
            }}
          >
            Surveyor Workspace — Upload cadastral maps, trigger alignment,
            generate ULPINs, and submit for approval.
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "var(--accent-primary)",
              fontWeight: 600,
              fontSize: "0.85rem",
            }}
          >
            Enter Workspace <ArrowRight size={16} />
          </div>
        </button>

        {/* Tehsildar Card */}
        <button
          onClick={() => router.push("/tehsildar")}
          onMouseEnter={() => setHoveredRole("tehsildar")}
          onMouseLeave={() => setHoveredRole(null)}
          className="glass-card"
          style={{
            padding: 32,
            cursor: "pointer",
            textAlign: "left",
            border:
              hoveredRole === "tehsildar"
                ? "1px solid rgba(139, 92, 246, 0.5)"
                : "1px solid var(--border-glass)",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "var(--radius-md)",
              background:
                "linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(59, 130, 246, 0.1))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <Shield size={28} style={{ color: "var(--accent-purple)" }} />
          </div>
          <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: 8 }}>
            Tehsildar
          </h3>
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--text-muted)",
              lineHeight: 1.5,
              marginBottom: 20,
            }}
          >
            Approval Dashboard — Review aligned maps, verify topology,
            and approve or reject ULPIN assignments.
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "var(--accent-purple)",
              fontWeight: 600,
              fontSize: "0.85rem",
            }}
          >
            Enter Dashboard <ArrowRight size={16} />
          </div>
        </button>
      </div>

      {/* ───── Footer ───── */}
      <div
        className="animate-fade-in-up animate-delay-5"
        style={{
          marginTop: 64,
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Cpu size={14} />
          <span>GeoSync v1.0 MVP — Powered by OpenCV • PostGIS • FastAPI • Next.js</span>
        </div>
      </div>
    </main>
  );
}
