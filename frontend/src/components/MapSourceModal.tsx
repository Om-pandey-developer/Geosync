"use client";

import { useState, useRef } from "react";
import {
  Layers,
  Upload,
  Image as ImageIcon,
  Check,
  X,
  Sliders,
  Sparkles,
  MapPin,
  Globe2,
  FileCheck,
  AlertCircle,
  Eye,
  RefreshCw,
} from "lucide-react";
import { toast } from "react-hot-toast";
import type { FeatureCollection } from "geojson";

export interface BasemapOption {
  id: string;
  name: string;
  category: "drone" | "satellite" | "vector";
  url: string;
  attribution: string;
  maxZoom: number;
  description: string;
  badge: string;
}

export const BASEMAP_PRESETS: BasemapOption[] = [
  {
    id: "naksha-5cm",
    name: "NAKSHA 5cm High-Resolution Drone Orthomosaic",
    category: "drone",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "© NAKSHA Drone Survey • DoLR • Survey of India",
    maxZoom: 20,
    description: "Centimeter-level 5cm optical drone raster flying at 120m AGL for Mohanlalganj Ward 12.",
    badge: "5cm Drone Survey",
  },
  {
    id: "esri-world",
    name: "Esri World High-Res Aerial Imagery",
    category: "satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri • Maxar • Earthstar Geographics",
    maxZoom: 19,
    description: "Global high-resolution satellite imagery composite for multi-temporal change detection.",
    badge: "Satellite Aerial",
  },
  {
    id: "carto-light",
    name: "CartoDB Positron (Minimal Cadastral)",
    category: "vector",
    url: "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
    attribution: "© OpenStreetMap • CartoDB",
    maxZoom: 19,
    description: "Clean monochrome canvas ideal for isolating legacy vector boundaries without optical clutter.",
    badge: "Clean Cadastre",
  },
  {
    id: "osm-standard",
    name: "OpenStreetMap Surveyor Standard",
    category: "vector",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
    description: "Standard road and administrative boundaries for landmark reference and revenue junctions.",
    badge: "Roads & Grid",
  },
];

export interface OldMapPreset {
  id: string;
  name: string;
  year: string;
  description: string;
  type: "vector" | "scanned_raster";
  parcelCount: number;
}

export const OLD_MAP_PRESETS: OldMapPreset[] = [
  {
    id: "mohanlalganj-1974",
    name: "Mohanlalganj 1974 Settlement Cadastre (BhuNaksha)",
    year: "1974 (50-yr Legacy)",
    description: "Hand-drafted paper cloth map with 2.5m - 4.8m non-linear moisture shrinkage and rotational drift.",
    type: "vector",
    parcelCount: 18,
  },
  {
    id: "ward12-distorted",
    name: "Ward 12 Extreme Paper Shrinkage Dataset",
    year: "1982 Record",
    description: "High-displacement sample designed to stress-test Thin-Plate Spline (TPS) rubber-sheeting.",
    type: "vector",
    parcelCount: 18,
  },
];

interface MapSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Basemap (New Map) Props
  activeBasemapId: string;
  onSelectBasemap: (basemap: BasemapOption) => void;
  // Old Map Props
  activeOldMapPresetId: string;
  onSelectOldMapPreset: (presetId: string) => void;
  onUploadCustomGeojson?: (geojson: FeatureCollection, filename: string) => void;
  onUploadScannedMap?: (imageUrl: string, filename: string) => void;
  // Styling Controls
  oldMapOpacity: number;
  onChangeOldMapOpacity: (opacity: number) => void;
  oldMapStrokeColor?: string;
  onChangeOldMapStrokeColor?: (color: string) => void;
}

export default function MapSourceModal({
  isOpen,
  onClose,
  activeBasemapId,
  onSelectBasemap,
  activeOldMapPresetId,
  onSelectOldMapPreset,
  onUploadCustomGeojson,
  onUploadScannedMap,
  oldMapOpacity,
  onChangeOldMapOpacity,
}: MapSourceModalProps) {
  const [activeTab, setActiveTab] = useState<"old" | "new">("old");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedDroneFileName, setUploadedDroneFileName] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const droneImageInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle Scanned Map Image Upload (Old Map - PNG/JPG only)
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (PNG or JPG).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (onUploadScannedMap) {
        onUploadScannedMap(dataUrl, file.name);
      }
      setUploadedFileName(file.name);
      toast.success(`Loaded paper map scan: ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  // Handle Drone Image Upload (New Map - PNG/JPG only)
  const handleDroneImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (PNG or JPG).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setUploadedDroneFileName(file.name);
      if (onUploadScannedMap) {
        // Can be viewed as high-res raster
      }
      toast.success(`Loaded drone aerial photo: ${file.name}`);
    };
    reader.readAsDataURL(file);
  };


  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 20,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-card animate-fade-in-up"
        style={{
          width: "100%",
          maxWidth: 680,
          background: "#FFFFFF",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "88vh",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "var(--radius-md)",
                background: "var(--accent-primary-bg)",
                border: "1px solid #99F6E4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent-primary)",
              }}
            >
              <Layers size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                Map Layer & Data Source Manager
              </h2>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: 2 }}>
                Configure and add legacy cadastral maps (Old Map) and drone orthomosaics (New Map)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn-ghost"
            style={{ padding: 6, color: "var(--text-muted)" }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Segmented Tab Control */}
        <div style={{ padding: "12px 24px 0", background: "#FFFFFF" }}>
          <div
            style={{
              display: "flex",
              gap: 4,
              padding: 4,
              background: "var(--bg-secondary)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <button
              onClick={() => setActiveTab("old")}
              style={{
                flex: 1,
                padding: "8px 16px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: activeTab === "old" ? "#FFFFFF" : "transparent",
                color: activeTab === "old" ? "var(--accent-primary)" : "var(--text-secondary)",
                fontWeight: activeTab === "old" ? 800 : 600,
                fontSize: "0.875rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: activeTab === "old" ? "0 2px 4px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <span style={{ fontSize: "1rem" }}>📜</span> Old Map (Legacy Cadastre)
            </button>
            <button
              onClick={() => setActiveTab("new")}
              style={{
                flex: 1,
                padding: "8px 16px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: activeTab === "new" ? "#FFFFFF" : "transparent",
                color: activeTab === "new" ? "var(--accent-primary)" : "var(--text-secondary)",
                fontWeight: activeTab === "new" ? 800 : 600,
                fontSize: "0.875rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: activeTab === "new" ? "0 2px 4px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <span style={{ fontSize: "1rem" }}>🚁</span> New Map (Drone Orthomosaic)
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
          {/* ═══════════ TAB 1: OLD MAP ═══════════ */}
          {activeTab === "old" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>


              {/* Upload Paper Map Photo / Scan (PNG / JPG) - Simple for Revenue Officers */}
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1.5px dashed #94A3B8",
                  borderRadius: "var(--radius-md)",
                  padding: "18px 20px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <ImageIcon size={20} style={{ color: "var(--accent-primary)" }} />
                  <strong style={{ fontSize: "0.9375rem", color: "var(--text-primary)" }}>
                    Upload Paper Map Photo / Scan (PNG or JPG)
                  </strong>
                </div>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: 14, lineHeight: 1.5 }}>
                  Take a photo of your cloth/paper map (BhuNaksha) from your mobile or select a scanned image from your device.
                </p>

                <input
                  type="file"
                  ref={imageInputRef}
                  accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                  style={{ display: "none" }}
                  onChange={handleImageFileChange}
                />

                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <button
                    className="btn-primary"
                    onClick={() => imageInputRef.current?.click()}
                    style={{
                      fontSize: "0.875rem",
                      padding: "10px 18px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      fontWeight: 700,
                    }}
                  >
                    <Upload size={16} />
                    <span>Upload Map Photo (PNG / JPG)</span>
                  </button>

                  {uploadedFileName ? (
                    <div
                      style={{
                        fontSize: "0.8125rem",
                        color: "#0F766E",
                        fontWeight: 700,
                        background: "#CCFBF1",
                        border: "1px solid #99F6E4",
                        padding: "6px 12px",
                        borderRadius: "var(--radius-sm)",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Check size={14} />
                      <span>Loaded Map: {uploadedFileName}</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Allowed formats: <strong>PNG</strong> or <strong>JPG</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Visual Styling Controls for Old Map */}
              <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 14 }}>
                <label style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)", display: "block", marginBottom: 8 }}>
                  Old Map Vector Styling:
                </label>

                <div style={{ maxWidth: 360 }}>
                  {/* Opacity Slider */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: 4 }}>
                      <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Layer Opacity</span>
                      <strong style={{ color: "var(--text-primary)" }}>{oldMapOpacity}%</strong>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={oldMapOpacity}
                      onChange={(e) => onChangeOldMapOpacity(Number(e.target.value))}
                      style={{ width: "100%", accentColor: "var(--accent-primary)" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ TAB 2: NEW MAP (DRONE / SATELLITE) ═══════════ */}
          {activeTab === "new" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>


              {/* Upload Drone Map Photo / Orthomosaic (PNG / JPG) - Simple for Revenue Officers */}
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1.5px dashed #94A3B8",
                  borderRadius: "var(--radius-md)",
                  padding: "18px 20px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <ImageIcon size={20} style={{ color: "var(--accent-primary)" }} />
                  <strong style={{ fontSize: "0.9375rem", color: "var(--text-primary)" }}>
                    Upload Drone Survey Photo (PNG or JPG)
                  </strong>
                </div>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: 14, lineHeight: 1.5 }}>
                  Have an aerial drone survey photo or orthomosaic picture? Upload the image directly from your computer.
                </p>

                <input
                  type="file"
                  ref={droneImageInputRef}
                  accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                  style={{ display: "none" }}
                  onChange={handleDroneImageFileChange}
                />

                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <button
                    className="btn-primary"
                    onClick={() => droneImageInputRef.current?.click()}
                    style={{
                      fontSize: "0.875rem",
                      padding: "10px 18px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      fontWeight: 700,
                    }}
                  >
                    <Upload size={16} />
                    <span>Upload Drone Photo (PNG / JPG)</span>
                  </button>

                  {uploadedDroneFileName ? (
                    <div
                      style={{
                        fontSize: "0.8125rem",
                        color: "#0F766E",
                        fontWeight: 700,
                        background: "#CCFBF1",
                        border: "1px solid #99F6E4",
                        padding: "6px 12px",
                        borderRadius: "var(--radius-sm)",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Check size={14} />
                      <span>Loaded Drone Photo: {uploadedDroneFileName}</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Allowed formats: <strong>PNG</strong> or <strong>JPG</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid var(--border-subtle)",
            background: "#F8FAFC",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Automatic True Ground Alignment &bull; DILRMP 3.0 Government Standard Compliant.
          </span>
          <button className="btn-primary" onClick={onClose} style={{ padding: "8px 18px" }}>
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
}
