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
  oldMapStrokeColor: string;
  onChangeOldMapStrokeColor: (color: string) => void;
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
  oldMapStrokeColor,
  onChangeOldMapStrokeColor,
}: MapSourceModalProps) {
  const [activeTab, setActiveTab] = useState<"old" | "new">("old");
  const [customTileUrl, setCustomTileUrl] = useState("");
  const [customTileName, setCustomTileName] = useState("Custom Drone WMS/XYZ");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const geojsonInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle Custom GeoJSON Upload (Old Map)
  const handleGeoJsonFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed || parsed.type !== "FeatureCollection" || !Array.isArray(parsed.features)) {
          throw new Error("File must be a valid GeoJSON FeatureCollection with polygons.");
        }

        setUploadedFileName(file.name);
        if (onUploadCustomGeojson) {
          onUploadCustomGeojson(parsed, file.name);
        }
        toast.success(`Loaded custom old map: ${file.name} (${parsed.features.length} parcels)`);
      } catch (err: any) {
        toast.error(err.message || "Failed to parse GeoJSON file");
      }
    };
    reader.readAsText(file);
  };

  // Handle Scanned Map Image Upload (Old Map)
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (onUploadScannedMap) {
        onUploadScannedMap(dataUrl, file.name);
      }
      setUploadedFileName(file.name);
      toast.success(`Loaded paper cadastre scan overlay: ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  // Handle Custom Tile URL Submit (New Map)
  const handleApplyCustomTile = () => {
    if (!customTileUrl.includes("{z}") || !customTileUrl.includes("{x}") || !customTileUrl.includes("{y}")) {
      toast.error("Tile URL must contain standard {z}/{x}/{y} parameters.");
      return;
    }

    const customOption: BasemapOption = {
      id: "custom-drone-service",
      name: customTileName || "Custom Drone Orthomosaic",
      category: "drone",
      url: customTileUrl.trim(),
      attribution: "Custom Drone Survey Layer",
      maxZoom: 22,
      description: "User-defined XYZ/WMS drone orthomosaic tile stream.",
      badge: "Custom XYZ Tile",
    };

    onSelectBasemap(customOption);
    toast.success(`Switched to custom drone layer: ${customOption.name}`);
  };

  const STROKE_COLORS = [
    { label: "Vintage Amber", hex: "#D97706" },
    { label: "Radiant Teal", hex: "#0D9488" },
    { label: "Sky Blue", hex: "#0284C7" },
    { label: "Cadastral Gold", hex: "#F59E0B" },
    { label: "High-Contrast Coral", hex: "#E11D48" },
    { label: "Pure White", hex: "#FFFFFF" },
  ];

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
              {/* Presets Grid */}
              <div>
                <label style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)", display: "block", marginBottom: 8 }}>
                  Select Built-in Legacy Cadastre Dataset:
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {OLD_MAP_PRESETS.map((p) => {
                    const isSelected = activeOldMapPresetId === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          onSelectOldMapPreset(p.id);
                          toast.success(`Active Old Map: ${p.name}`);
                        }}
                        style={{
                          padding: "12px 14px",
                          borderRadius: "var(--radius-md)",
                          border: isSelected ? "2px solid var(--accent-primary)" : "1px solid var(--border-glass)",
                          background: isSelected ? "var(--accent-primary-bg)" : "#FFFFFF",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <strong style={{ fontSize: "0.875rem", color: "var(--text-primary)" }}>{p.name}</strong>
                            <span
                              style={{
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                padding: "2px 6px",
                                borderRadius: 4,
                                background: "#FEF3C7",
                                color: "#B45309",
                              }}
                            >
                              {p.year}
                            </span>
                          </div>
                          <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 4 }}>
                            {p.description}
                          </p>
                        </div>
                        {isSelected && (
                          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--accent-primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "#FFF", flexShrink: 0 }}>
                            <Check size={14} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Upload Custom Old Map Files */}
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px dashed #CBD5E1",
                  borderRadius: "var(--radius-md)",
                  padding: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Upload size={18} style={{ color: "var(--accent-primary)" }} />
                  <strong style={{ fontSize: "0.875rem", color: "var(--text-primary)" }}>
                    Upload Custom Old Map File
                  </strong>
                </div>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 12 }}>
                  Import your own historical village boundaries (GeoJSON vector) or upload a scanned paper map image overlay.
                </p>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <input
                    type="file"
                    ref={geojsonInputRef}
                    accept=".geojson,.json"
                    style={{ display: "none" }}
                    onChange={handleGeoJsonFileChange}
                  />
                  <button
                    className="btn-secondary"
                    onClick={() => geojsonInputRef.current?.click()}
                    style={{ fontSize: "0.8125rem", padding: "8px 14px" }}
                  >
                    <FileCheck size={15} /> Upload GeoJSON (.json / .geojson)
                  </button>

                  <input
                    type="file"
                    ref={imageInputRef}
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleImageFileChange}
                  />
                  <button
                    className="btn-secondary"
                    onClick={() => imageInputRef.current?.click()}
                    style={{ fontSize: "0.8125rem", padding: "8px 14px" }}
                  >
                    <ImageIcon size={15} /> Upload Scanned Map Scan (PNG/JPG)
                  </button>
                </div>

                {uploadedFileName && (
                  <div style={{ marginTop: 10, fontSize: "0.75rem", color: "var(--accent-primary)", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                    <Check size={14} /> Loaded active source: {uploadedFileName}
                  </div>
                )}
              </div>

              {/* Visual Styling Controls for Old Map */}
              <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 14 }}>
                <label style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)", display: "block", marginBottom: 8 }}>
                  Old Map Vector Styling:
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
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

                  {/* Stroke Color Palette */}
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, display: "block", marginBottom: 6 }}>
                      Boundary Outline Color
                    </span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {STROKE_COLORS.map((c) => (
                        <div
                          key={c.hex}
                          onClick={() => onChangeOldMapStrokeColor(c.hex)}
                          title={c.label}
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            background: c.hex,
                            border: oldMapStrokeColor === c.hex ? "3px solid #0F172A" : "1.5px solid #CBD5E1",
                            cursor: "pointer",
                            transition: "all 0.1s ease",
                            transform: oldMapStrokeColor === c.hex ? "scale(1.15)" : "scale(1)",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ TAB 2: NEW MAP (DRONE / SATELLITE) ═══════════ */}
          {activeTab === "new" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)", display: "block", marginBottom: 8 }}>
                  Select Drone Orthomosaic / High-Resolution Basemap:
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {BASEMAP_PRESETS.map((b) => {
                    const isSelected = activeBasemapId === b.id;
                    return (
                      <div
                        key={b.id}
                        onClick={() => {
                          onSelectBasemap(b);
                          toast.success(`Switched New Map to: ${b.name}`);
                        }}
                        style={{
                          padding: "12px 14px",
                          borderRadius: "var(--radius-md)",
                          border: isSelected ? "2px solid var(--accent-primary)" : "1px solid var(--border-glass)",
                          background: isSelected ? "var(--accent-primary-bg)" : "#FFFFFF",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <strong style={{ fontSize: "0.875rem", color: "var(--text-primary)" }}>{b.name}</strong>
                            <span
                              style={{
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                padding: "2px 6px",
                                borderRadius: 4,
                                background: b.category === "drone" ? "#CCFBF1" : b.category === "satellite" ? "#E0F2FE" : "#F1F5F9",
                                color: b.category === "drone" ? "#0F766E" : b.category === "satellite" ? "#0369A1" : "#475569",
                              }}
                            >
                              {b.badge}
                            </span>
                          </div>
                          <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 4 }}>
                            {b.description}
                          </p>
                        </div>
                        {isSelected && (
                          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--accent-primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "#FFF", flexShrink: 0 }}>
                            <Check size={14} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom Drone Tile URL Stream (XYZ / WMS) */}
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Globe2 size={18} style={{ color: "var(--accent-primary)" }} />
                  <strong style={{ fontSize: "0.875rem", color: "var(--text-primary)" }}>
                    Connect Custom Drone Orthomosaic Tile Stream
                  </strong>
                </div>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 10 }}>
                  Enter an XYZ tile service or local GeoServer tile endpoint generated from WebODM / Agisoft.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input
                    type="text"
                    value={customTileName}
                    onChange={(e) => setCustomTileName(e.target.value)}
                    placeholder="Layer Name (e.g. Ward 12 5cm Orthomosaic)"
                    style={{
                      padding: "8px 12px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-glass)",
                      fontSize: "0.8125rem",
                    }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      value={customTileUrl}
                      onChange={(e) => setCustomTileUrl(e.target.value)}
                      placeholder="https://your-tile-server/{z}/{x}/{y}.png"
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border-glass)",
                        fontSize: "0.8125rem",
                        fontFamily: "monospace",
                      }}
                    />
                    <button
                      className="btn-primary"
                      onClick={handleApplyCustomTile}
                      style={{ padding: "8px 14px", fontSize: "0.8125rem" }}
                    >
                      Connect Stream
                    </button>
                  </div>
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
            Standardized to <strong>EPSG:3857 (Ground Meters)</strong> & WGS84 for DILRMP 3.0 compliance.
          </span>
          <button className="btn-primary" onClick={onClose} style={{ padding: "8px 18px" }}>
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
}
