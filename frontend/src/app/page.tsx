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
  Scale,
  Compass,
  FileCheck2,
  Lock,
  Eye,
  Sliders,
  Database,
  History,
  CheckCircle2,
  SplitSquareVertical,
  ArrowRightLeft,
  ChevronRight,
  ShieldCheck,
  FileText,
  BadgeAlert,
  Activity,
  Maximize2,
  ExternalLink,
  Search,
  Filter,
  Radio,
  Building2,
} from "lucide-react";
import MapSourceModal, { BASEMAP_PRESETS, BasemapOption } from "@/components/MapSourceModal";
import { useAuth } from "@/lib/authContext";

export default function LandingPage() {
  const router = useRouter();
  const { role: activeAuthRole, loginAs, logout } = useAuth();
  const [hoveredRole, setHoveredRole] = useState<string | null>(null);
  const [sliderPos, setSliderPos] = useState(52);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [activeBasemap, setActiveBasemap] = useState<BasemapOption>(BASEMAP_PRESETS[0]);
  const [simBasemapMode, setSimBasemapMode] = useState<"drone" | "satellite" | "topo">("drone");
  const [testbedFilter, setTestbedFilter] = useState<string>("ALL");

  const handleEnterPatwari = () => {
    loginAs("patwari");
    router.push("/patwari");
  };

  const handleEnterTehsildar = () => {
    loginAs("tehsildar");
    router.push("/tehsildar");
  };

  const workflowSteps = [
    {
      step: "01",
      icon: <Layers size={22} />,
      title: "1. Multi-Source Cadastral Ingestion",
      desc: "Historical 50-year distorted cloth cadastre maps (scanned raster or legacy BhuNaksha vectors) ingested alongside 5cm NAKSHA drone orthomosaics standardized to true ground coordinates in EPSG:3857.",
      color: "var(--accent-primary)",
      badge: "EPSG:3857 • Old & New Layers",
    },
    {
      step: "02",
      icon: <ScanLine size={22} />,
      title: "2. ORB Homography & TPS Warping",
      desc: "Fast ORB descriptor matching and RANSAC projective homography combined with dual-click Ground Control Point (GCP) Thin-Plate Spline rubber-sheeting to correct severe non-linear paper shrinkage and rotational skew.",
      color: "var(--accent-sky)",
      badge: "RANSAC + TPS Warping",
    },
    {
      step: "03",
      icon: <Sparkles size={22} />,
      title: "3. GeoSAM AI Zero-Shot Segmentation",
      desc: "Air-gapped Meta ViT-H vision foundation model zero-shot property boundary tracing in <10ms, enhanced with dual-channel radiometric tree canopy and shadow occlusion detection scoring.",
      color: "var(--accent-lavender)",
      badge: "ViT-H Zero-Shot AI",
    },
    {
      step: "04",
      icon: <Fingerprint size={22} />,
      title: "4. PostGIS Purity & Base-14 ULPIN",
      desc: "Autonomous PostGIS 3.4 ST_Difference overlap trimming, ST_Snap 0.05m gap sealing, and automated 14-digit DoLR/ECCMA compliant Bhu-Aadhaar generation with Tehsildar SHA-256 e-Sign sealing.",
      color: "var(--accent-mint)",
      badge: "OGC / PostGIS 3.4",
    },
  ];

  const testbedParcels = [
    {
      khasra: "117",
      owner: "Ram Prasad Maurya",
      area: "2,450.5 m²",
      status: "PUBLISHED",
      statusLabel: "Bhu-Aadhaar Issued",
      ulpin: "9YYD56AA2Z9Y3A",
      disp: "0.038m (Aligned)",
      statusColor: "var(--accent-mint)",
      statusBg: "var(--accent-mint-bg)",
      statusBorder: "#A7F3D0",
    },
    {
      khasra: "118",
      owner: "Shyam Sundar Gupta",
      area: "1,890.2 m²",
      status: "ALIGNED_DRAFT",
      statusLabel: "Pending Judicial Review",
      ulpin: "9YYD56AA2Z9Y3B",
      disp: "0.042m (Aligned)",
      statusColor: "var(--accent-sky)",
      statusBg: "var(--accent-sky-bg)",
      statusBorder: "#BAE6FD",
    },
    {
      khasra: "119",
      owner: "Smt. Shanti Devi",
      area: "3,120.0 m²",
      status: "TOPOLOGY_CLEANED",
      statusLabel: "100% Purity Cleansed",
      ulpin: "9YYD56AA2Z9Y3C",
      disp: "0.035m (Cleaned)",
      statusColor: "var(--accent-primary)",
      statusBg: "var(--accent-primary-bg)",
      statusBorder: "#99F6E4",
    },
    {
      khasra: "120",
      owner: "Mohd. Aslam Siddiqui",
      area: "2,760.8 m²",
      status: "OCCLUDED",
      statusLabel: "Tree Canopy Occlusion (38%)",
      ulpin: null,
      disp: "3.42m (Raw Displaced)",
      statusColor: "#D97706",
      statusBg: "#FEF3C7",
      statusBorder: "#FDE68A",
    },
    {
      khasra: "121",
      owner: "Ganga Ram Yadav",
      area: "1,540.3 m²",
      status: "DRAFT",
      statusLabel: "Raw Paper Cadastre",
      ulpin: null,
      disp: "4.82m (Severe Skew)",
      statusColor: "#E11D48",
      statusBg: "#FFE4E6",
      statusBorder: "#FECDD3",
    },
  ];

  const filteredParcels = testbedParcels.filter((p) => {
    if (testbedFilter === "ALL") return true;
    if (testbedFilter === "ALIGNED") return p.status === "PUBLISHED" || p.status === "ALIGNED_DRAFT" || p.status === "TOPOLOGY_CLEANED";
    if (testbedFilter === "ISSUES") return p.status === "OCCLUDED" || p.status === "DRAFT";
    return true;
  });

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "0 0 60px",
        position: "relative",
      }}
    >
      {/* ═════════════════════════════════════════════════════════════
          TOP EXECUTIVE FLOATING COMMAND NAVBAR
          ═════════════════════════════════════════════════════════════ */}
      <header
        style={{
          width: "100%",
          height: 70,
          background: "rgba(255, 255, 255, 0.94)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border-glass)",
          position: "sticky",
          top: 0,
          zIndex: 100,
          boxShadow: "0 2px 10px rgba(15, 23, 42, 0.05)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
        }}
      >
        {/* Brand / Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: "var(--radius-md)",
              background: "linear-gradient(135deg, #0D9488 0%, #0F766E 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              boxShadow: "0 3px 10px rgba(13, 148, 136, 0.35)",
              border: "1.5px solid #99F6E4",
            }}
          >
            <Globe2 size={24} />
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: "1.3rem",
                  fontWeight: 900,
                  letterSpacing: "-0.03em",
                  color: "var(--text-primary)",
                }}
              >
                GeoSync
              </span>
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 800,
                  padding: "2px 7px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--accent-primary-bg)",
                  color: "var(--accent-primary)",
                  border: "1px solid #99F6E4",
                  textTransform: "uppercase",
                }}
              >
                DILRMP 3.0
              </span>
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>
              National Cadastral Harmonization Engine &bull; SIH 2026
            </div>
          </div>
        </div>

        {/* Center Navigation Anchors */}
        <nav
          style={{
            display: "none",
            alignItems: "center",
            gap: 22,
          }}
          className="lg:flex"
        >
          <a
            href="#simulator"
            style={{
              fontSize: "0.875rem",
              fontWeight: 700,
              color: "var(--text-secondary)",
              textDecoration: "none",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "var(--accent-primary)")}
            onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "var(--text-secondary)")}
          >
            Harmonization Studio
          </a>
          <a
            href="#portals"
            style={{
              fontSize: "0.875rem",
              fontWeight: 700,
              color: "var(--text-secondary)",
              textDecoration: "none",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "var(--accent-primary)")}
            onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "var(--text-secondary)")}
          >
            Dual Portals
          </a>
          <a
            href="#pipeline"
            style={{
              fontSize: "0.875rem",
              fontWeight: 700,
              color: "var(--text-secondary)",
              textDecoration: "none",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "var(--accent-primary)")}
            onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "var(--text-secondary)")}
          >
            4-Stage Architecture
          </a>
          <a
            href="#testbed"
            style={{
              fontSize: "0.875rem",
              fontWeight: 700,
              color: "var(--text-secondary)",
              textDecoration: "none",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "var(--accent-primary)")}
            onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "var(--text-secondary)")}
          >
            Mohanlalganj Testbed
          </a>
        </nav>

        {/* Right Action Trigger Group */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setIsSourceModalOpen(true)}
            className="btn-secondary"
            style={{ padding: "8px 14px", fontSize: "0.8125rem" }}
            title="Upload Old Map (Paper Scan) and New Map (Drone Photo)"
          >
            <Layers size={16} style={{ color: "var(--accent-primary)" }} />
            <span>Map Layers</span>
          </button>

          <a
            href="#portals"
            className="btn-primary"
            style={{
              padding: "8px 16px",
              fontSize: "0.8125rem",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontWeight: 700,
            }}
          >
            <Compass size={15} />
            <span>Officer Portals ↓</span>
          </a>
        </div>
      </header>

      {/* ═════════════════════════════════════════════════════════════
          TOP TELEMETRY & INSTITUTIONAL CONTEXT STRIP
          ═════════════════════════════════════════════════════════════ */}
      <div
        className="animate-fade-in-up"
        style={{
          width: "100%",
          maxWidth: 1140,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          padding: "10px 18px",
          background: "rgba(255, 255, 255, 0.90)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-glass)",
          boxShadow: "var(--shadow-sm)",
          margin: "24px 24px 28px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #0D9488 0%, #0F766E 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
            }}
          >
            <ShieldCheck size={15} />
          </div>
          <span style={{ fontSize: "0.8125rem", fontWeight: 800, color: "var(--text-primary)" }}>
            Smart India Hackathon 2026 &bull; SIH26013
          </span>
          <span style={{ color: "var(--border-glass)" }}>|</span>
          <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", fontWeight: 600 }}>
            Department of Land Resources (DoLR) &bull; NAKSHA Drone Pilot
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="pulsing-dot" style={{ background: "#0D9488" }} />
          <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#0F766E", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Active Operational Testbed: Mohanlalganj Ward 12
          </span>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════
          HERO SECTION
          ═════════════════════════════════════════════════════════════ */}
      <div
        className="animate-fade-in-up"
        style={{ textAlign: "center", marginBottom: 40, maxWidth: 980, padding: "0 24px" }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 20,
            padding: "8px 24px",
            borderRadius: "999px",
            background: "linear-gradient(90deg, #FEF3C7 0%, #CCFBF1 100%)",
            border: "1.5px solid #99F6E4",
            boxShadow: "0 4px 14px rgba(13, 148, 136, 0.15)",
          }}
        >
          <Sparkles size={16} style={{ color: "var(--accent-primary)" }} />
          <span
            style={{
              fontSize: "0.875rem",
              fontWeight: 800,
              color: "var(--text-primary)",
            }}
          >
            National Land Records Modernization &bull; 50-Year Legacy to 5cm Centimeter Drone Alignment
          </span>
        </div>

        <h1
          style={{
            fontSize: "clamp(2.5rem, 5.5vw, 4.3rem)",
            fontWeight: 900,
            letterSpacing: "-0.04em",
            lineHeight: 1.1,
            marginBottom: 20,
            color: "var(--text-primary)",
          }}
        >
          AI-Powered Cadastral Harmonization & Land Adjudication Engine
        </h1>

        <p
          style={{
            fontSize: "1.22rem",
            color: "var(--text-secondary)",
            lineHeight: 1.65,
            maxWidth: 780,
            margin: "0 auto",
            fontWeight: 500,
          }}
        >
          Intelligent geospatial middleware harmonizing distorted 1970s cloth cadastre maps with{" "}
          <strong style={{ color: "var(--text-primary)" }}>5cm centimeter-accurate NAKSHA drone orthomosaics</strong>.
          Accelerate land governance with automated TPS rubber-sheeting, Meta GeoSAM ViT-H AI boundary tracing, and PostGIS 3.4 Bhu-Aadhaar issuance.
        </p>

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
            gap: 14,
            marginTop: 32,
          }}
        >
          <a
            href="#portals"
            className="btn-primary"
            style={{
              padding: "14px 28px",
              fontSize: "0.95rem",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              fontWeight: 800,
              boxShadow: "0 4px 16px rgba(13, 148, 136, 0.35)",
            }}
          >
            <Compass size={20} />
            <span>Select Officer Portal Below ↓</span>
            <ArrowRight size={18} />
          </a>

          <button
            onClick={() => setIsSourceModalOpen(true)}
            className="btn-secondary"
            style={{ padding: "14px 24px", fontSize: "0.95rem" }}
          >
            <Layers size={20} style={{ color: "var(--accent-primary)" }} />
            <span>Upload Old &amp; New Maps</span>
          </button>
        </div>

        {/* Live Technical Stack Counters */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 14,
            marginTop: 40,
            textAlign: "left",
          }}
        >
          <div className="stats-counter-card">
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "var(--accent-primary)" }} />
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 800, textTransform: "uppercase" }}>
              Cadastral Resolution
            </div>
            <div style={{ fontSize: "1.45rem", fontWeight: 900, color: "var(--accent-primary)", marginTop: 4 }}>
              5cm GSD Drone
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 2, fontWeight: 500 }}>
              True orthomosaic EPSG:3857
            </div>
          </div>

          <div className="stats-counter-card">
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "var(--accent-sky)" }} />
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 800, textTransform: "uppercase" }}>
              AI Boundary Model
            </div>
            <div style={{ fontSize: "1.45rem", fontWeight: 900, color: "var(--accent-sky)", marginTop: 4 }}>
              &lt;10ms ViT-H
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 2, fontWeight: 500 }}>
              Zero-shot GeoSAM with canopy filter
            </div>
          </div>

          <div className="stats-counter-card">
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "var(--accent-mint)" }} />
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 800, textTransform: "uppercase" }}>
              Topological Purity
            </div>
            <div style={{ fontSize: "1.45rem", fontWeight: 900, color: "var(--accent-mint)", marginTop: 4 }}>
              100% Purity
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 2, fontWeight: 500 }}>
              ST_Difference &bull; 0.05m Snap
            </div>
          </div>

          <div className="stats-counter-card">
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "var(--accent-gold)" }} />
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 800, textTransform: "uppercase" }}>
              Legal Sanctity
            </div>
            <div style={{ fontSize: "1.45rem", fontWeight: 900, color: "var(--accent-gold)", marginTop: 4 }}>
              SHA-256 Seal
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 2, fontWeight: 500 }}>
              Form-II Decree &bull; 14-Digit ULPIN
            </div>
          </div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════
          INTERACTIVE CADASTRAL HARMONIZATION SIMULATOR 2.0
          ═════════════════════════════════════════════════════════════ */}
      <section
        id="simulator"
        style={{
          width: "100%",
          maxWidth: 1140,
          margin: "0 24px 54px",
          background: "#FFFFFF",
          borderRadius: "var(--radius-lg)",
          border: "1.5px solid var(--border-glass)",
          boxShadow: "0 12px 35px -5px rgba(15, 23, 42, 0.12)",
          overflow: "hidden",
        }}
      >
        {/* Simulator Control Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 14,
            background: "linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "var(--radius-md)",
                background: "var(--accent-primary-bg)",
                border: "1px solid #99F6E4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent-primary)",
              }}
            >
              <SplitSquareVertical size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text-primary)" }}>
                Interactive Cadastral Harmonization Simulator
              </h3>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                Swipe the handle horizontally to inspect how GeoSync warps 1974 cloth maps to 2026 drone imagery
              </p>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>Curtain Split:</span>
            <span className="badge-pastel-teal" style={{ fontWeight: 800 }}>{sliderPos}%</span>

            <div style={{ width: 1, height: 20, background: "var(--border-subtle)", margin: "0 4px" }} />

            <button
              onClick={() => setSliderPos(10)}
              className="btn-secondary"
              style={{ padding: "5px 12px", fontSize: "0.75rem" }}
            >
              Drone Ground Truth
            </button>
            <button
              onClick={() => setSliderPos(50)}
              className="btn-secondary"
              style={{ padding: "5px 12px", fontSize: "0.75rem" }}
            >
              50/50 Split
            </button>
            <button
              onClick={() => setSliderPos(90)}
              className="btn-secondary"
              style={{ padding: "5px 12px", fontSize: "0.75rem" }}
            >
              Legacy Cadastre
            </button>
          </div>
        </div>

        {/* Visual Comparison Stage */}
        <div
          style={{
            position: "relative",
            height: "400px",
            width: "100%",
            overflow: "hidden",
            background: "#0F172A",
            userSelect: "none",
          }}
        >
          {/* Right Image: Modern 2026 5cm Drone Orthomosaic (Target Ground Truth) */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                simBasemapMode === "satellite"
                  ? "radial-gradient(#0284C7 1px, transparent 1px), linear-gradient(135deg, #0C4A6E 0%, #075985 50%, #082F49 100%)"
                  : simBasemapMode === "topo"
                  ? "radial-gradient(#64748B 1px, transparent 1px), linear-gradient(135deg, #334155 0%, #1E293B 50%, #0F172A 100%)"
                  : "radial-gradient(#14B8A6 1px, transparent 1px), linear-gradient(135deg, #042F2E 0%, #064E3B 50%, #022C22 100%)",
              backgroundSize: "28px 28px, 100% 100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "40px 60px",
            }}
          >
            {/* Top Right Badges */}
            <div style={{ position: "absolute", top: 16, right: 24, zIndex: 10, display: "flex", gap: 8 }}>
              <span
                style={{
                  background: "#CCFBF1",
                  color: "#0F766E",
                  fontWeight: 800,
                  fontSize: "0.8125rem",
                  padding: "4px 10px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid #99F6E4",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#0D9488" }} />
                2026 5cm NAKSHA Drone Truth &bull; EPSG:3857 &bull; PostGIS Cleaned
              </span>
            </div>

            {/* Simulated Centimeter Accurate Parcels */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 620, marginLeft: "auto" }}>
              <div
                style={{
                  border: "2px solid #2DD4BF",
                  background: "rgba(45, 212, 191, 0.22)",
                  borderRadius: 10,
                  padding: 18,
                  color: "#FFFFFF",
                  boxShadow: "0 0 25px rgba(45, 212, 191, 0.25)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: "0.78rem", color: "#99F6E4", fontWeight: 800 }}>KHASRA 117 (ALIGNED)</div>
                  <span style={{ fontSize: "0.6875rem", background: "#0D9488", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>
                    VALIDATED
                  </span>
                </div>
                <div style={{ fontSize: "1rem", fontWeight: 800, marginTop: 6 }}>Bhu-Aadhaar ULPIN</div>
                <code style={{ fontSize: "0.75rem", background: "rgba(0,0,0,0.5)", padding: "3px 8px", borderRadius: 4, display: "inline-block", marginTop: 4, color: "#CCFBF1", letterSpacing: "1px" }}>
                  9YYD56AA2Z9Y3A
                </code>
                <div style={{ fontSize: "0.75rem", color: "#A7F3D0", marginTop: 8, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  <Check size={14} /> 100% Topology Purity &bull; 0 Overlaps
                </div>
              </div>

              <div
                style={{
                  border: "2px solid #2DD4BF",
                  background: "rgba(45, 212, 191, 0.22)",
                  borderRadius: 10,
                  padding: 18,
                  color: "#FFFFFF",
                  boxShadow: "0 0 25px rgba(45, 212, 191, 0.25)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: "0.78rem", color: "#99F6E4", fontWeight: 800 }}>KHASRA 118 (ALIGNED)</div>
                  <span style={{ fontSize: "0.6875rem", background: "#0D9488", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>
                    VALIDATED
                  </span>
                </div>
                <div style={{ fontSize: "1rem", fontWeight: 800, marginTop: 6 }}>Bhu-Aadhaar ULPIN</div>
                <code style={{ fontSize: "0.75rem", background: "rgba(0,0,0,0.5)", padding: "3px 8px", borderRadius: 4, display: "inline-block", marginTop: 4, color: "#CCFBF1", letterSpacing: "1px" }}>
                  9YYD56AA2Z9Y3B
                </code>
                <div style={{ fontSize: "0.75rem", color: "#A7F3D0", marginTop: 8, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  <Check size={14} /> GeoSAM ViT-H AI (96.8% Confidence)
                </div>
              </div>
            </div>
          </div>

          {/* Left Image: Distorted 1974 Legacy Paper Cadastre (Clipped by slider) */}
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: `${sliderPos}%`,
              overflow: "hidden",
              borderRight: "3px solid #FFFFFF",
              boxShadow: "6px 0 25px rgba(0, 0, 0, 0.6)",
              backgroundImage: "linear-gradient(135deg, #78350F 0%, #451A03 100%)",
            }}
          >
            <div
              style={{
                width: "1140px",
                height: "400px",
                padding: "40px 60px",
                position: "relative",
                backgroundImage: "radial-gradient(#F59E0B 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            >
              <div style={{ position: "absolute", top: 16, left: 24, zIndex: 10 }}>
                <span
                  style={{
                    background: "#FEF3C7",
                    color: "#92400E",
                    fontWeight: 800,
                    fontSize: "0.8125rem",
                    padding: "4px 10px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid #FDE68A",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <BadgeAlert size={14} /> 1974 BhuNaksha Legacy Cloth Cadastre &bull; 4.8m Shrinkage &bull; Rotational Drift
                </span>
              </div>

              {/* Distorted Legacy Polygons with Rotational Drift */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 620, marginTop: 50, transform: "rotate(-3.5deg) scale(0.95)" }}>
                <div style={{ border: "2px dashed #F59E0B", background: "rgba(245, 158, 11, 0.22)", borderRadius: 10, padding: 18, color: "#FFFFFF" }}>
                  <div style={{ fontSize: "0.78rem", color: "#FDE68A", fontWeight: 800 }}>KHASRA 117 (RAW PAPER)</div>
                  <div style={{ fontSize: "1rem", fontWeight: 800, marginTop: 6 }}>Uncorrected Cadastre</div>
                  <div style={{ fontSize: "0.75rem", color: "#FCA5A5", marginTop: 8, fontWeight: 700 }}>
                    ⚠️ Displacement: 3.42 meters
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#FCA5A5", marginTop: 3, fontWeight: 700 }}>
                    ⚠️ Overlap with Khasra 118 Boundary
                  </div>
                </div>

                <div style={{ border: "2px dashed #F59E0B", background: "rgba(245, 158, 11, 0.22)", borderRadius: 10, padding: 18, color: "#FFFFFF" }}>
                  <div style={{ fontSize: "0.78rem", color: "#FDE68A", fontWeight: 800 }}>KHASRA 118 (RAW PAPER)</div>
                  <div style={{ fontSize: "1rem", fontWeight: 800, marginTop: 6 }}>Uncorrected Cadastre</div>
                  <div style={{ fontSize: "0.75rem", color: "#FCA5A5", marginTop: 8, fontWeight: 700 }}>
                    ⚠️ Displacement: 4.82 meters
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#FCA5A5", marginTop: 3, fontWeight: 700 }}>
                    ⚠️ Severe Non-Linear Distortion
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Grab Slider Handle */}
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${sliderPos}%`,
              transform: "translateX(-50%)",
              zIndex: 30,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "#0D9488",
                border: "3px solid #FFFFFF",
                boxShadow: "0 4px 20px rgba(13, 148, 136, 0.8), 0 2px 8px rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
              }}
            >
              <ArrowRightLeft size={20} />
            </div>
          </div>

          {/* Live Floating Geodetic Telemetry Overlay */}
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: 20,
              zIndex: 25,
              background: "rgba(15, 23, 42, 0.85)",
              backdropFilter: "blur(12px)",
              padding: "6px 14px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#FFFFFF",
              fontSize: "0.75rem",
              fontFamily: "monospace",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ color: "#2DD4BF" }}>● LAT: 26.7612° N</span>
            <span style={{ color: "#38BDF8" }}>LON: 80.8998° E</span>
            <span style={{ color: "#FCD34D" }}>RMSE: 0.038m (PASS)</span>
          </div>
        </div>

        {/* Scrub Slider Bar & Basemap Switcher */}
        <div
          style={{
            padding: "16px 24px",
            background: "#F8FAFC",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 260 }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 800, color: "var(--text-secondary)", flexShrink: 0 }}>
              Curtain Swipe:
            </span>
            <input
              type="range"
              min="5"
              max="95"
              value={sliderPos}
              onChange={(e) => setSliderPos(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--accent-primary)", cursor: "pointer" }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>Target Basemap:</span>
            <button
              onClick={() => setSimBasemapMode("drone")}
              className={simBasemapMode === "drone" ? "btn-primary" : "btn-secondary"}
              style={{ padding: "4px 10px", fontSize: "0.75rem" }}
            >
              5cm Drone
            </button>
            <button
              onClick={() => setSimBasemapMode("satellite")}
              className={simBasemapMode === "satellite" ? "btn-primary" : "btn-secondary"}
              style={{ padding: "4px 10px", fontSize: "0.75rem" }}
            >
              Esri Satellite
            </button>
            <button
              onClick={() => setSimBasemapMode("topo")}
              className={simBasemapMode === "topo" ? "btn-primary" : "btn-secondary"}
              style={{ padding: "4px 10px", fontSize: "0.75rem" }}
            >
              Survey Topo
            </button>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════
          SEPARATE DEDICATED INSTITUTIONAL PORTALS (PATWARI vs TEHSILDAR)
          ═════════════════════════════════════════════════════════════ */}
      <section id="portals" style={{ width: "100%", maxWidth: 1140, margin: "0 24px 54px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h2
            style={{
              fontSize: "1.75rem",
              fontWeight: 900,
              color: "var(--text-primary)",
              letterSpacing: "-0.03em",
            }}
          >
            Dual-Chamber Cadastral Governance Portals
          </h2>
          <p style={{ fontSize: "0.95rem", color: "var(--text-secondary)", marginTop: 6 }}>
            Purpose-built operational chambers for grassroots survey engineering and statutory court adjudication
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))",
            gap: 24,
            width: "100%",
          }}
        >
          {/* ──────── PORTAL 1: REVENUE PATWARI (SURVEYOR GIS STUDIO) ──────── */}
          <div
            onClick={handleEnterPatwari}
            onMouseEnter={() => setHoveredRole("patwari")}
            onMouseLeave={() => setHoveredRole(null)}
            className="card-elevated-hover"
            style={{
              padding: 32,
              cursor: "pointer",
              textAlign: "left",
              background: "#FFFFFF",
              borderRadius: "var(--radius-lg)",
              border:
                hoveredRole === "patwari"
                  ? "2px solid var(--accent-primary)"
                  : "1.5px solid var(--border-glass)",
              boxShadow:
                hoveredRole === "patwari"
                  ? "0 20px 40px -5px rgba(13, 148, 136, 0.25)"
                  : "var(--shadow-card)",
              position: "relative",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 5,
                background: "linear-gradient(90deg, #0D9488 0%, #2DD4BF 100%)",
              }}
            />

            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: "var(--radius-md)",
                    background: "var(--accent-primary-bg)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1.5px solid #99F6E4",
                    color: "var(--accent-primary)",
                  }}
                >
                  <Compass size={32} />
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className="badge-live-pulse" style={{ background: "#CCFBF1", color: "#0F766E", border: "1px solid #99F6E4" }}>
                    <div className="pulsing-dot" style={{ background: "#0D9488" }} />
                    RTK GPS Active (0.02m)
                  </span>
                  <span className="badge-pastel-teal">
                    Level 1 &bull; Field GIS Studio
                  </span>
                </div>
              </div>

              <h3 style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--text-primary)", marginBottom: 8 }}>
                Patwari / Lekhpal Studio
              </h3>

              <p
                style={{
                  fontSize: "0.9375rem",
                  color: "var(--text-secondary)",
                  lineHeight: 1.6,
                  marginBottom: 20,
                }}
              >
                The field engineer's command center: Import historical BhuNaksha GeoJSON or scanned cloth maps, drop Ground Control Points (GCPs), execute Thin-Plate Spline rubber-sheeting, drag polygon corner vertices (HITL calibration), and extract boundaries using zero-shot GeoSAM ViT-H AI.
              </p>

              {/* Key Features */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px 14px",
                  fontSize: "0.8125rem",
                  color: "var(--text-secondary)",
                  marginBottom: 20,
                  background: "var(--bg-secondary)",
                  padding: 18,
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Check size={16} style={{ color: "var(--accent-primary)", flexShrink: 0 }} />
                  <span style={{ fontWeight: 700 }}>Old & New Map Manager</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Check size={16} style={{ color: "var(--accent-primary)", flexShrink: 0 }} />
                  <span style={{ fontWeight: 700 }}>Paired Landmark TPS Warping</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Check size={16} style={{ color: "var(--accent-primary)", flexShrink: 0 }} />
                  <span style={{ fontWeight: 700 }}>GeoSAM AI Bounding Box</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Check size={16} style={{ color: "var(--accent-primary)", flexShrink: 0 }} />
                  <span style={{ fontWeight: 700 }}>Corner Drag Handle (HITL)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Check size={16} style={{ color: "var(--accent-primary)", flexShrink: 0 }} />
                  <span style={{ fontWeight: 700 }}>Canopy & Shadow Occlusion</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Check size={16} style={{ color: "var(--accent-primary)", flexShrink: 0 }} />
                  <span style={{ fontWeight: 700 }}>50-Parcel Batch Alignment</span>
                </div>
              </div>

              {/* Role-Based Clearance Status */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  background: "rgba(13, 148, 136, 0.08)",
                  border: "1px solid rgba(13, 148, 136, 0.2)",
                  marginBottom: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: "#0F766E", fontWeight: 700 }}>
                  <Shield size={14} />
                  <span>Authorized Role: Revenue Patwari / Field Surveyor</span>
                </div>
                <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", fontFamily: "monospace", fontWeight: 700 }}>#PAT-442</span>
              </div>
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 22px",
                borderRadius: "var(--radius-md)",
                background: "linear-gradient(135deg, #0D9488 0%, #0F766E 100%)",
                color: "#FFFFFF",
                fontWeight: 800,
                fontSize: "0.9375rem",
                boxShadow: "0 4px 14px rgba(13, 148, 136, 0.35)",
              }}
            >
              <span>Authenticate &amp; Enter Patwari Studio</span>
              <ArrowRight size={18} />
            </div>
          </div>

          {/* ──────── PORTAL 2: REVENUE TEHSILDAR (MAGISTRATE COURT CHAMBER) ──────── */}
          <div
            onClick={handleEnterTehsildar}
            onMouseEnter={() => setHoveredRole("tehsildar")}
            onMouseLeave={() => setHoveredRole(null)}
            className="card-elevated-hover"
            style={{
              padding: 32,
              cursor: "pointer",
              textAlign: "left",
              background: "#FFFFFF",
              borderRadius: "var(--radius-lg)",
              border:
                hoveredRole === "tehsildar"
                  ? "2px solid var(--accent-gold)"
                  : "1.5px solid var(--border-glass)",
              boxShadow:
                hoveredRole === "tehsildar"
                  ? "0 20px 40px -5px rgba(217, 119, 6, 0.25)"
                  : "var(--shadow-card)",
              position: "relative",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 5,
                background: "linear-gradient(90deg, #D97706 0%, #1E3A8A 100%)",
              }}
            />

            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: "var(--radius-md)",
                    background: "var(--accent-gold-bg)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1.5px solid #FDE68A",
                    color: "var(--accent-gold)",
                  }}
                >
                  <Scale size={32} />
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className="badge-live-pulse" style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A" }}>
                    <div className="pulsing-dot" style={{ background: "#D97706" }} />
                    e-Sign DSC Token Active
                  </span>
                  <span className="badge-pastel-gold">
                    Level 2 &bull; Magistrate Chamber
                  </span>
                </div>
              </div>

              <h3 style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--text-primary)", marginBottom: 8 }}>
                Tehsildar Adjudication Chamber
              </h3>

              <p
                style={{
                  fontSize: "0.9375rem",
                  color: "var(--text-secondary)",
                  lineHeight: 1.6,
                  marginBottom: 20,
                }}
              >
                The revenue magistrate's judicial bench: Adjudicate contested boundary disputes, review split-screen curtain swipe evidence between historical and drone cadastre, verify AI confidence, stamp cryptographic SHA-256 seals, and issue statutory Form-II Survey Certificates.
              </p>

              {/* Key Features */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px 14px",
                  fontSize: "0.8125rem",
                  color: "var(--text-secondary)",
                  marginBottom: 20,
                  background: "linear-gradient(90deg, #FEF3C7 0%, #F8FAFC 100%)",
                  padding: 18,
                  borderRadius: "var(--radius-md)",
                  border: "1px solid #FDE68A",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Check size={16} style={{ color: "var(--accent-gold)", flexShrink: 0 }} />
                  <span style={{ fontWeight: 700 }}>Quasi-Judicial Docket Queue</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Check size={16} style={{ color: "var(--accent-gold)", flexShrink: 0 }} />
                  <span style={{ fontWeight: 700 }}>Curtain Swipe Evidence Canvas</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Check size={16} style={{ color: "var(--accent-gold)", flexShrink: 0 }} />
                  <span style={{ fontWeight: 700 }}>Cryptographic SHA-256 e-Sign</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Check size={16} style={{ color: "var(--accent-gold)", flexShrink: 0 }} />
                  <span style={{ fontWeight: 700 }}>Form-II PDF Certificate Export</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Check size={16} style={{ color: "var(--accent-gold)", flexShrink: 0 }} />
                  <span style={{ fontWeight: 700 }}>Immutable Cadastral Audit Log</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Check size={16} style={{ color: "var(--accent-gold)", flexShrink: 0 }} />
                  <span style={{ fontWeight: 700 }}>Statutory Land Stack Sanction</span>
                </div>
              </div>

              {/* Role-Based Clearance Status */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  background: "rgba(30, 58, 138, 0.08)",
                  border: "1px solid rgba(30, 58, 138, 0.2)",
                  marginBottom: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: "#1E3A8A", fontWeight: 700 }}>
                  <Scale size={14} />
                  <span>Authorized Role: Judicial Revenue Magistrate</span>
                </div>
                <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", fontFamily: "monospace", fontWeight: 700 }}>#SDM-081</span>
              </div>
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 22px",
                borderRadius: "var(--radius-md)",
                background: "linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%)",
                color: "#FFFFFF",
                fontWeight: 800,
                fontSize: "0.9375rem",
                boxShadow: "0 4px 16px rgba(30, 58, 138, 0.35)",
                border: "1px solid rgba(245, 158, 11, 0.4)",
              }}
            >
              <span>Authenticate &amp; Enter Magistrate Chamber</span>
              <ArrowRight size={18} style={{ color: "#FCD34D" }} />
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════
          INTERACTIVE LIVE TESTBED EXPLORER (MOHANLALGANJ WARD 12)
          ═════════════════════════════════════════════════════════════ */}
      <section id="testbed" style={{ width: "100%", maxWidth: 1140, margin: "0 24px 54px" }}>
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "var(--radius-lg)",
            border: "1.5px solid var(--border-glass)",
            boxShadow: "var(--shadow-card)",
            padding: "26px 28px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 14,
              marginBottom: 20,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 900, color: "var(--text-primary)" }}>
                  Mohanlalganj Ward 12 &bull; Active Cadastral Parcel Testbed
                </h3>
                <span className="badge-pastel-teal">Live Database Roster</span>
              </div>
              <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: 4 }}>
                Review live parcel alignment statuses, calculated areas, and Bhu-Aadhaar identifiers across the pilot zone
              </p>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: "flex", gap: 6, background: "var(--bg-secondary)", padding: 4, borderRadius: "var(--radius-md)" }}>
              <button
                onClick={() => setTestbedFilter("ALL")}
                className={testbedFilter === "ALL" ? "btn-primary" : "btn-secondary"}
                style={{ padding: "6px 12px", fontSize: "0.75rem", border: "none" }}
              >
                All Parcels (5)
              </button>
              <button
                onClick={() => setTestbedFilter("ALIGNED")}
                className={testbedFilter === "ALIGNED" ? "btn-primary" : "btn-secondary"}
                style={{ padding: "6px 12px", fontSize: "0.75rem", border: "none" }}
              >
                Aligned & Cleaned (3)
              </button>
              <button
                onClick={() => setTestbedFilter("ISSUES")}
                className={testbedFilter === "ISSUES" ? "btn-primary" : "btn-secondary"}
                style={{ padding: "6px 12px", fontSize: "0.75rem", border: "none" }}
              >
                Discrepancies / Draft (2)
              </button>
            </div>
          </div>

          {/* Testbed Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ background: "var(--bg-secondary)", borderBottom: "1.5px solid var(--border-subtle)" }}>
                  <th style={{ padding: "10px 14px", fontWeight: 800, color: "var(--text-primary)" }}>Khasra No</th>
                  <th style={{ padding: "10px 14px", fontWeight: 800, color: "var(--text-primary)" }}>Registered Landholder</th>
                  <th style={{ padding: "10px 14px", fontWeight: 800, color: "var(--text-primary)" }}>Calculated Area</th>
                  <th style={{ padding: "10px 14px", fontWeight: 800, color: "var(--text-primary)" }}>Bhu-Aadhaar (ULPIN)</th>
                  <th style={{ padding: "10px 14px", fontWeight: 800, color: "var(--text-primary)" }}>Spatial Status</th>
                  <th style={{ padding: "10px 14px", fontWeight: 800, color: "var(--text-primary)" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredParcels.map((parcel) => (
                  <tr key={parcel.khasra} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 800, color: "var(--text-primary)" }}>
                      Khasra {parcel.khasra}
                    </td>
                    <td style={{ padding: "12px 14px", fontWeight: 600, color: "var(--text-primary)" }}>
                      {parcel.owner}
                    </td>
                    <td style={{ padding: "12px 14px", fontWeight: 600, color: "var(--text-secondary)" }}>
                      {parcel.area}
                    </td>
                    <td style={{ padding: "12px 14px", fontFamily: "monospace", color: parcel.ulpin ? "var(--accent-primary)" : "var(--text-muted)", fontWeight: 700 }}>
                      {parcel.ulpin || "Pending Generation"}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: "var(--radius-sm)",
                          background: parcel.statusBg,
                          color: parcel.statusColor,
                          border: `1px solid ${parcel.statusBorder}`,
                        }}
                      >
                        {parcel.statusLabel}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => router.push("/patwari")}
                          className="btn-secondary"
                          style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                          title="Open in Patwari Surveyor Studio"
                        >
                          Calibrate
                        </button>
                        <button
                          onClick={() => router.push("/tehsildar")}
                          className="btn-secondary"
                          style={{ padding: "4px 8px", fontSize: "0.75rem", borderColor: "#FCD34D", color: "#92400E" }}
                          title="Open in Tehsildar Adjudication Chamber"
                        >
                          Adjudicate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════
          4-STEP CADASTRAL HARMONIZATION PIPELINE ARCHITECTURE
          ═════════════════════════════════════════════════════════════ */}
      <section id="pipeline" style={{ width: "100%", maxWidth: 1140, margin: "0 24px 54px" }}>
        <h2
          style={{
            fontSize: "1.75rem",
            fontWeight: 900,
            textAlign: "center",
            marginBottom: 28,
            color: "var(--text-primary)",
            letterSpacing: "-0.03em",
          }}
        >
          Automated Spatial Harmonization Architecture
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: 20,
            width: "100%",
          }}
        >
          {workflowSteps.map((f, i) => (
            <div
              key={i}
              className="card-elevated-hover"
              style={{
                padding: "26px 22px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                background: "#FFFFFF",
                borderRadius: "var(--radius-lg)",
                border: "1.5px solid var(--border-glass)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
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
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      padding: "4px 8px",
                      background: "var(--bg-secondary)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    {f.badge}
                  </span>
                </div>

                <h3
                  style={{
                    fontSize: "1.125rem",
                    fontWeight: 800,
                    marginBottom: 10,
                    color: "var(--text-primary)",
                  }}
                >
                  {f.title}
                </h3>
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--text-secondary)",
                    lineHeight: 1.6,
                  }}
                >
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════
          INSTITUTIONAL TRUST & FOOTER
          ═════════════════════════════════════════════════════════════ */}
      <footer
        className="animate-fade-in-up"
        style={{
          width: "100%",
          maxWidth: 1140,
          margin: "0 24px",
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: "0.8125rem",
          borderTop: "1px solid var(--border-glass)",
          paddingTop: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 6 }}>
          <Cpu size={16} style={{ color: "var(--accent-primary)" }} />
          <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>
            GeoSync SIH26013 &bull; Digital India Land Records Modernization Programme (DILRMP 3.0)
          </span>
        </div>
        <p style={{ color: "var(--text-secondary)", marginBottom: 4 }}>
          Department of Land Resources (DoLR), Ministry of Rural Development &bull; Government of India
        </p>
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          Next.js 16 &bull; React 19 &bull; Python FastAPI 0.115 &bull; PostGIS 3.4 &bull; Thin-Plate Splines &bull; Meta ViT-H AI
        </div>
      </footer>

      {/* Global Map Layers Modal Triggerable from Home */}
      <MapSourceModal
        isOpen={isSourceModalOpen}
        onClose={() => setIsSourceModalOpen(false)}
        activeBasemapId={activeBasemap.id}
        onSelectBasemap={(b) => setActiveBasemap(b)}
        activeOldMapPresetId="mohanlalganj-1974"
        onSelectOldMapPreset={() => {}}
        oldMapOpacity={80}
        onChangeOldMapOpacity={() => {}}
        oldMapStrokeColor="#D97706"
        onChangeOldMapStrokeColor={() => {}}
      />
    </main>
  );
}
