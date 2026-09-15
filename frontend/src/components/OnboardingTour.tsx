"use client";

import { useState, useEffect } from "react";
import {
  Compass,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  Layers,
  ScanLine,
  ShieldCheck,
  Fingerprint,
  RotateCcw,
} from "lucide-react";

export interface TourStep {
  title: string;
  description: string;
  targetId?: string;
  badge: string;
  icon: any;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to Project GeoSync",
    description:
      "Intelligent spatial middleware aligning 50-year-old legacy cadastral maps (BhuNaksha) with high-precision 5cm NAKSHA drone orthomosaics. Designed for the Department of Land Resources (DoLR).",
    badge: "DILRMP 3.0 Standard",
    icon: Compass,
  },
  {
    title: "Dual-Layer Map & Drone Orthomosaics",
    description:
      "Toggle between centimeter-level drone imagery and digitized paper map contours. View parcels, road intersections, and permanent ground stones in true-ground coordinates.",
    badge: "5cm Ground Sampling",
    icon: Layers,
  },
  {
    title: "ORB + RANSAC + TPS Alignment",
    description:
      "Global alignment computes a 3x3 Homography matrix. For rubber-sheeted paper maps, drop manual Ground Control Points (GCPs) to calculate smooth Thin-Plate Spline warps.",
    badge: "Computer Vision Engine",
    icon: ScanLine,
  },
  {
    title: "GeoSAM Zero-Shot Boundary Tracing",
    description:
      "Meta's SAM (ViT-H backbone) delineates physical boundaries (compound walls, bunds). The AI flags tree canopies and deep shadows for mandatory Human-in-the-Loop inspection.",
    badge: "1024-d Latent Tensors",
    icon: Sparkles,
  },
  {
    title: "PostGIS Topological Cleansing",
    description:
      "Automated spatial SQL runs ST_Difference to trim overlapping territories with adjacent legal plots, and ST_Snap to close sliver gaps within a strict 0.05m (5cm) tolerance.",
    badge: "Pure Cadastral Fabric",
    icon: ShieldCheck,
  },
  {
    title: "14-Character Bhu-Aadhaar (ULPIN)",
    description:
      "Extracts the WGS84 parcel centroid and encodes it into a 14-digit Base-14 alphanumeric ID compliant with ECCMA/OGC standards, stripping confusing characters ('I','O','1','0').",
    badge: "National Land Stack",
    icon: Fingerprint,
  },
  {
    title: "Human-in-the-Loop (HITL) Governance",
    description:
      "Under Indian revenue laws, AI cannot legally adjudicate land boundaries. Every proposal requires explicit Tehsildar inspection and 'Approve & Commit' authorization.",
    badge: "Legal Compliance",
    icon: ShieldCheck,
  },
];

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OnboardingTour({ isOpen, onClose }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];
  const Icon = step.icon;

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(4, 10, 12, 0.72)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        className="glass-modal animate-fade-in-up"
        style={{
          width: "100%",
          maxWidth: "520px",
          padding: "32px",
          position: "relative",
          border: "1px solid rgba(121, 199, 197, 0.35)",
        }}
      >
        {/* Close / Skip button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            background: "rgba(121, 199, 197, 0.1)",
            border: "none",
            borderRadius: "50%",
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-secondary)",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          title="Skip Tour"
        >
          <X size={16} />
        </button>

        {/* Step Indicator & Badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <span
            className="badge-pastel-teal"
            style={{
              padding: "4px 12px",
              borderRadius: "100px",
              fontSize: "0.75rem",
              fontWeight: 600,
              letterSpacing: "0.03em",
              textTransform: "uppercase",
            }}
          >
            {step.badge}
          </span>
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            Step {currentStep + 1} of {TOUR_STEPS.length}
          </span>
        </div>

        {/* Icon & Title */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "14px",
              background: "rgba(121, 199, 197, 0.16)",
              border: "1px solid rgba(121, 199, 197, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent-primary)",
              flexShrink: 0,
            }}
          >
            <Icon size={24} />
          </div>
          <h3
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "var(--text-primary)",
              lineHeight: 1.25,
            }}
          >
            {step.title}
          </h3>
        </div>

        {/* Description */}
        <p
          style={{
            fontSize: "0.92rem",
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            marginBottom: "28px",
          }}
        >
          {step.description}
        </p>

        {/* Progress Bar */}
        <div
          style={{
            width: "100%",
            height: "4px",
            background: "rgba(121, 199, 197, 0.12)",
            borderRadius: "4px",
            marginBottom: "24px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${((currentStep + 1) / TOUR_STEPS.length) * 100}%`,
              background: "linear-gradient(90deg, #79C7C5, #B4ECE7)",
              transition: "width 0.3s ease",
            }}
          />
        </div>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="btn-pastel-secondary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              fontSize: "0.85rem",
              opacity: currentStep === 0 ? 0.35 : 1,
              cursor: currentStep === 0 ? "not-allowed" : "pointer",
            }}
          >
            <ChevronLeft size={16} /> Back
          </button>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                fontSize: "0.85rem",
                padding: "8px 12px",
                cursor: "pointer",
              }}
            >
              Skip All
            </button>
            <button
              onClick={handleNext}
              className="btn-pastel-primary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 20px",
                fontSize: "0.85rem",
              }}
            >
              {currentStep === TOUR_STEPS.length - 1 ? (
                "Get Started"
              ) : (
                <>
                  Next <ChevronRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
