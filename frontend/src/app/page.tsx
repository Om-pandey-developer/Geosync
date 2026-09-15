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
  Sparkles,
  Zap,
  Check,
  Building2,
} from "lucide-react";

export default function LandingPage() {
  const router = useRouter();
  const [hoveredRole, setHoveredRole] = useState<string | null>(null);

  const features = [
    {
      icon: <ScanLine size={22} />,
      title: "1 & 2. ORB & TPS Warping",
      desc: "Global RANSAC homography plus non-linear Thin-Plate Spline rubber-sheeting for paper shrinkage.",
      color: "var(--accent-primary)",
      badge: "EPSG:3857",
    },
    {
      icon: <Sparkles size={22} />,
      title: "3. GeoSAM AI Segmentation",
      desc: "Meta ViT-H zero-shot boundary tracing (<10ms) with radiometric shadow & canopy occlusion scoring.",
      color: "var(--accent-teal)",
      badge: "Zero-Shot",
    },
    {
      icon: <Layers size={22} />,
      title: "4. PostGIS Purity Engine",
      desc: "Mathematical ST_Difference overlap trimming and ST_Snap sliver sealing (0.05m tolerance).",
      color: "#008080",
      badge: "GEOS C-Engine",
    },
    {
      icon: <Fingerprint size={22} />,
      title: "5. Base-14 Bhu-Aadhaar",
      desc: "14-digit alphanumeric ULPIN strictly compliant with DoLR/ECCMA/OGC (strips ambiguous 'I','0').",
      color: "var(--accent-mint)",
      badge: "OGC / ECCMA",
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
        padding: "80px 24px 40px",
        position: "relative",
      }}
    >
      {/* ───── Hero Section ───── */}
      <div
        className="animate-fade-in-up"
        style={{ textAlign: "center", marginBottom: 44, maxWidth: 840 }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 20,
            padding: "8px 22px",
            borderRadius: 9999,
            background: "rgba(121, 199, 197, 0.15)",
            border: "1px solid rgba(121, 199, 197, 0.35)",
          }}
        >
          <Globe2 size={16} style={{ color: "var(--accent-primary)" }} />
          <span
            style={{
              fontSize: "0.78rem",
              fontWeight: 700,
              color: "var(--accent-primary)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Smart India Hackathon 2026 &bull; Problem Statement SIH26013
          </span>
        </div>

        <h1
          style={{
            fontSize: "clamp(2.4rem, 5.5vw, 4rem)",
            fontWeight: 900,
            letterSpacing: "-0.03em",
            lineHeight: 1.12,
            marginBottom: 16,
            background: "linear-gradient(135deg, #1E293B 0%, #008080 60%, #4FA8A4 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          GeoSync
        </h1>

        <p
          style={{
            fontSize: "1.18rem",
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            maxWidth: 680,
            margin: "0 auto",
            fontWeight: 400,
          }}
        >
          Intelligent Geospatial Middleware harmonizing 50-year-old legacy cadastral maps with modern
          <strong> 5cm NAKSHA drone orthomosaics</strong> for conclusive urban land governance.
        </p>

        {/* Highlight Pills */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 10,
            marginTop: 20,
          }}
        >
          <span className="badge-pastel-teal">
            <Check size={12} /> DILRMP 3.0 National Land Stack
          </span>
          <span className="badge-pastel-mint">
            <Zap size={12} /> Sub-10ms Air-Gapped Inference
          </span>
          <span className="badge-pastel-peach">
            <Shield size={12} /> Mandatory HITL Revenue Magistrate Sign-off
          </span>
        </div>
      </div>

      {/* ───── Feature Cards Grid ───── */}
      <div
        className="animate-fade-in-up animate-delay-2"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: 18,
          maxWidth: 1040,
          width: "100%",
          marginBottom: 48,
        }}
      >
        {features.map((f, i) => (
          <div
            key={i}
            className="glass-card"
            style={{
              padding: "24px 20px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "var(--radius-sm)",
                    background: "rgba(121, 199, 197, 0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: f.color,
                  }}
                >
                  {f.icon}
                </div>
                <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "2px 8px", background: "rgba(0,0,0,0.04)", borderRadius: 6, color: "var(--text-muted)" }}>
                  {f.badge}
                </span>
              </div>
              <h3
                style={{
                  fontSize: "0.98rem",
                  fontWeight: 700,
                  marginBottom: 8,
                  color: "var(--text-primary)",
                }}
              >
                {f.title}
              </h3>
              <p
                style={{
                  fontSize: "0.82rem",
                  color: "var(--text-secondary)",
                  lineHeight: 1.5,
                }}
              >
                {f.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ───── Role Selection Section ───── */}
      <div
        className="animate-fade-in-up animate-delay-3"
        style={{ textAlign: "center", marginBottom: 28 }}
      >
        <h2
          style={{
            fontSize: "1.35rem",
            fontWeight: 800,
            marginBottom: 6,
            color: "var(--text-primary)",
          }}
        >
          Select Operational Role
        </h2>
        <p style={{ fontSize: "0.86rem", color: "var(--text-secondary)" }}>
          Access role-specific interfaces tailored for field surveyors and executive magistrates
        </p>
      </div>

      <div
        className="animate-fade-in-up animate-delay-4"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 24,
          maxWidth: 760,
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
            padding: 30,
            cursor: "pointer",
            textAlign: "left",
            border:
              hoveredRole === "patwari"
                ? "2px solid var(--accent-primary)"
                : "1px solid var(--border-glass)",
            transition: "all 0.2s ease",
            transform: hoveredRole === "patwari" ? "translateY(-4px)" : "none",
          }}
        >
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: "var(--radius-md)",
              background: "rgba(121, 199, 197, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 18,
            }}
          >
            <MapPin size={28} style={{ color: "var(--accent-primary)" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text-primary)" }}>
              Revenue Patwari
            </h3>
            <span className="badge-pastel-teal">Field Surveyor</span>
          </div>
          <p
            style={{
              fontSize: "0.84rem",
              color: "var(--text-secondary)",
              lineHeight: 1.55,
              marginBottom: 20,
            }}
          >
            Access 5-stage harmonization workbench: ORB+RANSAC alignment, interactive GCP Thin-Plate Splines,
            GeoSAM ViT-H boundary extraction, and PostGIS topology cleansing.
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "var(--accent-primary)",
              fontWeight: 700,
              fontSize: "0.88rem",
            }}
          >
            Launch Surveyor Workspace <ArrowRight size={16} />
          </div>
        </button>

        {/* Tehsildar Card */}
        <button
          onClick={() => router.push("/tehsildar")}
          onMouseEnter={() => setHoveredRole("tehsildar")}
          onMouseLeave={() => setHoveredRole(null)}
          className="glass-card"
          style={{
            padding: 30,
            cursor: "pointer",
            textAlign: "left",
            border:
              hoveredRole === "tehsildar"
                ? "2px solid var(--accent-teal)"
                : "1px solid var(--border-glass)",
            transition: "all 0.2s ease",
            transform: hoveredRole === "tehsildar" ? "translateY(-4px)" : "none",
          }}
        >
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: "var(--radius-md)",
              background: "rgba(79, 168, 164, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 18,
            }}
          >
            <Shield size={28} style={{ color: "var(--accent-teal)" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text-primary)" }}>
              Revenue Tehsildar
            </h3>
            <span className="badge-pastel-mint">Magistrate HITL</span>
          </div>
          <p
            style={{
              fontSize: "0.84rem",
              color: "var(--text-secondary)",
              lineHeight: 1.55,
              marginBottom: 20,
            }}
          >
            Executive Adjudication Chamber: Review overlay discrepancies, evaluate occlusion confidence alerts,
            and legally sanction/publish parcels to the National Land Stack.
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "var(--accent-teal)",
              fontWeight: 700,
              fontSize: "0.88rem",
            }}
          >
            Launch HITL Dashboard <ArrowRight size={16} />
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
          fontSize: "0.78rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 4 }}>
          <Cpu size={14} style={{ color: "var(--accent-primary)" }} />
          <span>GeoSync SIH26013 MVP &bull; Department of Land Resources (DoLR), Ministry of Rural Development</span>
        </div>
        <div>
          Technology Stack: Next.js 16 &bull; React 19 &bull; Python FastAPI &bull; PostGIS &bull; GeoSAM ViT-H &bull; Open-Source Geospatial Middleware
        </div>
      </div>
    </main>
  );
}
