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
  Globe2,
  Sparkles,
  Zap,
  Check,
} from "lucide-react";

export default function LandingPage() {
  const router = useRouter();
  const [hoveredRole, setHoveredRole] = useState<string | null>(null);

  // Fix Issue 3: Consistent 1-to-1 sequential feature cards (1, 2, 3, 4)
  const features = [
    {
      step: "1",
      icon: <Layers size={22} />,
      title: "1. Data Ingestion & Radiometry",
      desc: "Distorted BhuNaksha GeoJSON and 5cm drone rasters standardized into true ground meters (EPSG:3857) with CLAHE tile contrast.",
      color: "var(--accent-primary)",
      badge: "EPSG:3857 / CLAHE",
    },
    {
      step: "2",
      icon: <ScanLine size={22} />,
      title: "2. ORB & TPS Spatial Alignment",
      desc: "Global RANSAC projective homography plus non-linear Thin-Plate Splines (TPS) rubber-sheeting for 50-year paper shrinkage.",
      color: "var(--accent-sky)",
      badge: "RANSAC + TPS",
    },
    {
      step: "3",
      icon: <Sparkles size={22} />,
      title: "3. GeoSAM AI Boundary Tracing",
      desc: "Meta ViT-H zero-shot boundary delineation (<10ms) with shadow and tree canopy occlusion detection flagging <80% confidence.",
      color: "var(--accent-lavender)",
      badge: "ViT-H Zero-Shot",
    },
    {
      step: "4",
      icon: <Fingerprint size={22} />,
      title: "4. PostGIS Purity & Base-14 ULPIN",
      desc: "ST_Difference overlap trimming, ST_Snap 0.05m gap sealing, and 14-digit DoLR/ECCMA/OGC compliant Bhu-Aadhaar ID generation.",
      color: "var(--accent-mint)",
      badge: "OGC / PostGIS 3.4",
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
        style={{ textAlign: "center", marginBottom: 40, maxWidth: 840 }}
      >
        {/* Fix Issue 1: Sentence case instead of 55 all-caps chars */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 20,
            padding: "8px 20px",
            borderRadius: "var(--radius-sm)",
            background: "var(--accent-primary-bg)",
            border: "1px solid #99F6E4",
          }}
        >
          <Globe2 size={18} style={{ color: "var(--accent-primary)" }} />
          <span
            style={{
              fontSize: "0.875rem", /* 14px */
              fontWeight: 700,
              color: "var(--accent-primary)",
            }}
          >
            Smart India Hackathon 2026 &bull; Problem Statement SIH26013
          </span>
        </div>

        <h1
          style={{
            fontSize: "clamp(2.5rem, 5.5vw, 4rem)",
            fontWeight: 900,
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
            marginBottom: 16,
            color: "var(--text-primary)",
          }}
        >
          GeoSync
        </h1>

        <p
          style={{
            fontSize: "1.2rem",
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            maxWidth: 680,
            margin: "0 auto",
            fontWeight: 400,
          }}
        >
          Intelligent Geospatial Middleware harmonizing 50-year-old legacy cadastral maps with modern
          <strong style={{ color: "var(--text-primary)" }}> 5cm NAKSHA drone orthomosaics</strong> for conclusive urban land governance.
        </p>

        {/* Feature Badges */}
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
            <Check size={14} /> DILRMP 3.0 National Land Stack
          </span>
          <span className="badge-pastel-mint">
            <Zap size={14} /> Sub-10ms Air-Gapped Inference
          </span>
          <span className="badge-pastel-sun">
            <Shield size={14} /> Mandatory HITL Revenue Magistrate Sign-off
          </span>
        </div>
      </div>

      {/* ───── Feature Grid Section (Fix Issue 2: Proper H2 Heading hierarchy) ───── */}
      <section style={{ width: "100%", maxWidth: 1040, marginBottom: 48 }}>
        <h2
          style={{
            fontSize: "1.35rem",
            fontWeight: 800,
            textAlign: "center",
            marginBottom: 20,
            color: "var(--text-primary)",
          }}
        >
          Automated 4-Step Spatial Architecture
        </h2>

        <div
          className="animate-fade-in-up animate-delay-2"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
            gap: 18,
            width: "100%",
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
                background: "#FFFFFF",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "var(--radius-md)",
                      background: "var(--bg-secondary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: f.color,
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    {f.icon}
                  </div>
                  {/* Fix Issue 5: High contrast, 13px bold metadata tag */}
                  <span
                    style={{
                      fontSize: "0.8125rem", /* 13px */
                      fontWeight: 700,
                      padding: "4px 10px",
                      background: "var(--bg-secondary)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    {f.badge}
                  </span>
                </div>
                
                {/* H3 inside H2 section maintains semantic hierarchy */}
                <h3
                  style={{
                    fontSize: "1.05rem",
                    fontWeight: 800,
                    marginBottom: 8,
                    color: "var(--text-primary)",
                  }}
                >
                  {f.title}
                </h3>
                <p
                  style={{
                    fontSize: "0.875rem", /* 14px */
                    color: "var(--text-secondary)",
                    lineHeight: 1.55,
                  }}
                >
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ───── Role Selection Section ───── */}
      <section style={{ width: "100%", maxWidth: 780, textAlign: "center", marginBottom: 28 }}>
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
        <p style={{ fontSize: "0.9375rem", color: "var(--text-secondary)", marginBottom: 24 }}>
          Access role-specific interfaces tailored for field surveyors and executive magistrates
        </p>

        <div
          className="animate-fade-in-up animate-delay-4"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 20,
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
              padding: 28,
              cursor: "pointer",
              textAlign: "left",
              background: "#FFFFFF",
              borderRadius: "var(--radius-lg)",
              border:
                hoveredRole === "patwari"
                  ? "2px solid var(--accent-primary)"
                  : "1px solid var(--border-subtle)",
              transition: "all 0.2s ease",
              transform: hoveredRole === "patwari" ? "translateY(-3px)" : "none",
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "var(--radius-md)",
                background: "var(--accent-primary-bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
                border: "1px solid #99F6E4",
              }}
            >
              <MapPin size={28} style={{ color: "var(--accent-primary)" }} />
            </div>

            {/* Fix Issue 4: Tag placed directly adjacent to title, left-aligned */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)" }}>
                Revenue Patwari
              </h3>
              <span className="badge-pastel-teal">Field Surveyor</span>
            </div>

            <p
              style={{
                fontSize: "0.875rem",
                color: "var(--text-secondary)",
                lineHeight: 1.55,
                marginBottom: 20,
              }}
            >
              Access the harmonization workbench: ORB+RANSAC alignment, interactive GCP Thin-Plate Splines,
              GeoSAM ViT-H boundary extraction, and PostGIS topology cleansing.
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "var(--accent-primary)",
                fontWeight: 700,
                fontSize: "0.9375rem",
              }}
            >
              Launch Surveyor Workspace <ArrowRight size={18} />
            </div>
          </button>

          {/* Tehsildar Card */}
          <button
            onClick={() => router.push("/tehsildar")}
            onMouseEnter={() => setHoveredRole("tehsildar")}
            onMouseLeave={() => setHoveredRole(null)}
            className="glass-card"
            style={{
              padding: 28,
              cursor: "pointer",
              textAlign: "left",
              background: "#FFFFFF",
              borderRadius: "var(--radius-lg)",
              border:
                hoveredRole === "tehsildar"
                  ? "2px solid var(--accent-mint)"
                  : "1px solid var(--border-subtle)",
              transition: "all 0.2s ease",
              transform: hoveredRole === "tehsildar" ? "translateY(-3px)" : "none",
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "var(--radius-md)",
                background: "var(--accent-mint-bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
                border: "1px solid #A7F3D0",
              }}
            >
              <Shield size={28} style={{ color: "var(--accent-mint)" }} />
            </div>

            {/* Fix Issue 4: Tag placed directly adjacent to title, left-aligned */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)" }}>
                Revenue Tehsildar
              </h3>
              <span className="badge-pastel-mint">Magistrate HITL</span>
            </div>

            <p
              style={{
                fontSize: "0.875rem",
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
                color: "var(--accent-mint)",
                fontWeight: 700,
                fontSize: "0.9375rem",
              }}
            >
              Launch HITL Dashboard <ArrowRight size={18} />
            </div>
          </button>
        </div>
      </section>

      {/* ───── Footer ───── */}
      <footer
        className="animate-fade-in-up animate-delay-5"
        style={{
          marginTop: 48,
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: "0.8125rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 4 }}>
          <Cpu size={15} style={{ color: "var(--accent-primary)" }} />
          <span>GeoSync SIH26013 MVP &bull; Department of Land Resources (DoLR), Ministry of Rural Development</span>
        </div>
        <div>
          Next.js 16 &bull; React 19 &bull; Python FastAPI &bull; PostGIS &bull; GeoSAM ViT-H
        </div>
      </footer>
    </main>
  );
}
