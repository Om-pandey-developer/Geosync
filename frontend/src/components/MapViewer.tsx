"use client";

import { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
  Marker,
  Popup,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import type { Feature, FeatureCollection } from "geojson";
import { Layers, Eye, AlertTriangle, Pin } from "lucide-react";

// Fix Leaflet marker icon URLs for Next.js client rendering
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom GCP Marker icon in Pastel Teal
const GcpIcon = L.divIcon({
  className: "custom-gcp-pin",
  html: `<div style="
    width: 28px; 
    height: 28px; 
    background: #4FA8A4; 
    border: 2.5px solid #FFFFFF; 
    border-radius: 50%; 
    box-shadow: 0 4px 14px rgba(79,168,164,0.6); 
    display: flex; 
    align-items: center; 
    justify-content: center; 
    color: white; 
    font-weight: 800; 
    font-size: 11px;
    font-family: sans-serif;
  ">GCP</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// Pastel status colors strictly compliant with Apple-grade aesthetic
const STATUS_COLORS: Record<string, string> = {
  raw: "#A0AEC0",          // Soft muted slate
  aligned: "#79C7C5",      // Pastel Teal
  cleaned: "#98D8D6",      // Pastel Aqua
  ulpin_assigned: "#A8E6CF", // Pastel Mint
  occluded: "#FFD3B6",     // Soft Pastel Peach / Amber for occlusion warning
  published: "#4FA8A4",    // Deep Pastel Teal
};

export interface GCPPoint {
  id: number;
  lat: number;
  lng: number;
  label?: string;
}

interface MapViewerProps {
  geojsonData?: FeatureCollection | null;
  selectedParcelId?: string | null;
  onParcelClick?: (parcelId: string) => void;
  center?: [number, number];
  zoom?: number;
  enableGcpPlacement?: boolean;
  gcpPoints?: GCPPoint[];
  onAddGcp?: (point: GCPPoint) => void;
  showOcclusionAlerts?: boolean;
}

function FitBounds({ geojsonData }: { geojsonData: FeatureCollection }) {
  const map = useMap();

  useEffect(() => {
    if (geojsonData && geojsonData.features.length > 0) {
      try {
        const geoJsonLayer = L.geoJSON(geojsonData as GeoJSON.GeoJsonObject);
        const bounds = geoJsonLayer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
        }
      } catch (e) {
        console.warn("Bounds fitting note:", e);
      }
    }
  }, [geojsonData, map]);

  return null;
}

// Click handler for dropping manual Ground Control Points
function MapClickHandler({
  enabled,
  onAddGcp,
  currentCount,
}: {
  enabled: boolean;
  onAddGcp?: (p: GCPPoint) => void;
  currentCount: number;
}) {
  useMapEvents({
    click(e) {
      if (!enabled || !onAddGcp) return;
      onAddGcp({
        id: currentCount + 1,
        lat: Number(e.latlng.lat.toFixed(6)),
        lng: Number(e.latlng.lng.toFixed(6)),
        label: `GCP-${currentCount + 1}`,
      });
    },
  });
  return null;
}

export default function MapViewer({
  geojsonData,
  selectedParcelId,
  onParcelClick,
  center = [26.7605, 80.901],
  zoom = 15,
  enableGcpPlacement = false,
  gcpPoints = [],
  onAddGcp,
  showOcclusionAlerts = true,
}: MapViewerProps) {
  const [isMounted, setIsMounted] = useState(false);
  // Base layers: "drone" (Esri World Imagery simulation) | "carto_light" | "osm"
  const [baseLayer, setBaseLayer] = useState<"drone" | "satellite" | "minimal">("drone");
  const [showVectors, setShowVectors] = useState(true);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "var(--bg-secondary)",
          borderRadius: "var(--radius-md)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          fontSize: "0.9rem",
        }}
      >
        Initializing 5cm NAKSHA Drone Map Canvas…
      </div>
    );
  }

  const styleFeature = (feature: Feature | undefined) => {
    if (!feature) return {};
    const status = feature.properties?.alignment_status || "raw";
    const confidence = feature.properties?.alignment_confidence ?? 1.0;
    const isOccluded = showOcclusionAlerts && confidence < 0.8;
    const isSelected = feature.properties?.id === selectedParcelId;

    const baseColor = isOccluded
      ? STATUS_COLORS.occluded
      : STATUS_COLORS[status] || STATUS_COLORS.raw;

    return {
      color: isSelected ? "#FFFFFF" : baseColor,
      weight: isSelected ? 3.5 : isOccluded ? 2.5 : 2,
      opacity: 0.95,
      fillColor: baseColor,
      fillOpacity: isSelected ? 0.45 : isOccluded ? 0.35 : 0.22,
      dashArray: isOccluded ? "4, 4" : status === "raw" ? "6, 6" : undefined,
    };
  };

  const onEachFeature = (feature: Feature, layer: L.Layer) => {
    const props = feature.properties;
    if (!props) return;

    layer.on("click", () => {
      if (onParcelClick) onParcelClick(props.id);
    });

    const isOccluded = showOcclusionAlerts && (props.alignment_confidence ?? 1.0) < 0.8;

    const popupContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-width: 220px; padding: 4px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <span style="font-weight: 800; font-size: 1.05rem; color: #1E293B;">
            Khasra ${props.khasra_no}
          </span>
          <span style="
            background: ${props.alignment_status === 'published' ? '#4FA8A4' : '#79C7C5'};
            color: white;
            font-size: 0.65rem;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 9999px;
            text-transform: uppercase;
          ">
            ${props.alignment_status || 'raw'}
          </span>
        </div>

        ${isOccluded ? `
        <div style="
          background: rgba(255, 211, 182, 0.35); 
          border: 1px solid #FFD3B6; 
          border-radius: 6px; 
          padding: 6px 8px; 
          margin-bottom: 8px; 
          font-size: 0.72rem; 
          color: #9C4221;
          display: flex; 
          align-items: center; 
          gap: 6px;
        ">
          ⚠️ <strong>Occlusion Alert:</strong> Low confidence (${Math.round((props.alignment_confidence || 0.65) * 100)}%). Tree canopy / shadow detected.
        </div>` : ''}

        <div style="display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; font-size: 0.8rem; color: #475569;">
          <span style="color: #64748B; font-weight: 500;">Owner:</span>
          <strong style="color: #0F172A;">${props.owner_name}</strong>

          <span style="color: #64748B; font-weight: 500;">Village:</span>
          <span>${props.village} (${props.tehsil || 'Mohanlalganj'})</span>

          ${props.ulpin ? `
          <span style="color: #64748B; font-weight: 500;">Bhu-Aadhaar:</span>
          <code style="background: rgba(121, 199, 197, 0.15); color: #008080; font-weight: 700; padding: 1px 6px; border-radius: 4px; font-size: 0.78rem;">
            ${props.ulpin}
          </code>` : ''}

          ${props.area_sqm ? `
          <span style="color: #64748B; font-weight: 500;">Area:</span>
          <span>${Number(props.area_sqm).toFixed(1)} m²</span>` : ''}
        </div>
      </div>
    `;

    layer.bindPopup(popupContent, {
      className: "custom-pastel-popup",
      maxWidth: 290,
    });
  };

  const tileUrls = {
    // 5cm NAKSHA high-res drone orthomosaic simulation via Esri Clarity / World Imagery
    drone: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    // Standard Satellite
    satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    // Minimalist clean light basemap for overlay inspection
    minimal: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ width: "100%", height: "100%", borderRadius: "var(--radius-md)" }}
        scrollWheelZoom={true}
        zoomControl={false}
      >
        <TileLayer
          url={tileUrls[baseLayer]}
          attribution='&copy; NAKSHA Pilot Drone Survey (5cm GSD) &copy; Esri &copy; DoLR'
          maxZoom={19}
        />

        {showVectors && geojsonData && geojsonData.features.length > 0 && (
          <>
            <GeoJSON
              key={`${JSON.stringify(geojsonData)}-${selectedParcelId}`}
              data={geojsonData}
              style={styleFeature}
              onEachFeature={onEachFeature}
            />
            <FitBounds geojsonData={geojsonData} />
          </>
        )}

        {/* Render Manual Ground Control Points (GCPs) */}
        {gcpPoints.map((gcp) => (
          <Marker key={gcp.id} position={[gcp.lat, gcp.lng]} icon={GcpIcon}>
            <Popup>
              <div style={{ padding: 4, fontSize: "0.8rem" }}>
                <strong>{gcp.label || `GCP Point #${gcp.id}`}</strong>
                <div style={{ color: "#64748B", marginTop: 2 }}>
                  Lat: {gcp.lat.toFixed(6)}, Lng: {gcp.lng.toFixed(6)}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#4FA8A4", marginTop: 4 }}>
                  Locked for Thin-Plate Spline Warping
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Click listener for GCP placement */}
        <MapClickHandler
          enabled={enableGcpPlacement}
          onAddGcp={onAddGcp}
          currentCount={gcpPoints.length}
        />
      </MapContainer>

      {/* Layer Control Bar & Occlusion Legend (Top Left Glassmorphic Container) */}
      <div
        className="glass-card animate-fade-in-up"
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 400,
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontSize: "0.8rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-secondary)" }}>
          <Layers size={14} style={{ color: "var(--accent-primary)" }} />
          <span style={{ fontWeight: 600 }}>Layer:</span>
        </div>

        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.5)", padding: 2, borderRadius: 8 }}>
          <button
            onClick={() => setBaseLayer("drone")}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "none",
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
              background: baseLayer === "drone" ? "var(--accent-primary)" : "transparent",
              color: baseLayer === "drone" ? "#FFFFFF" : "var(--text-secondary)",
              transition: "all 0.2s ease",
            }}
          >
            5cm Drone
          </button>
          <button
            onClick={() => setBaseLayer("minimal")}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "none",
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
              background: baseLayer === "minimal" ? "var(--accent-primary)" : "transparent",
              color: baseLayer === "minimal" ? "#FFFFFF" : "var(--text-secondary)",
              transition: "all 0.2s ease",
            }}
          >
            Light Cadastral
          </button>
        </div>

        <div style={{ width: 1, height: 18, background: "var(--border-subtle)" }} />

        <button
          onClick={() => setShowVectors(!showVectors)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 8px",
            borderRadius: 6,
            border: "1px solid var(--border-glass)",
            background: showVectors ? "rgba(121, 199, 197, 0.2)" : "rgba(255,255,255,0.4)",
            color: showVectors ? "var(--accent-primary)" : "var(--text-muted)",
            fontSize: "0.75rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Eye size={13} />
          {showVectors ? "Cadastre On" : "Cadastre Off"}
        </button>

        {enableGcpPlacement && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 8px",
              background: "rgba(79, 168, 164, 0.15)",
              color: "#008080",
              borderRadius: 6,
              fontWeight: 700,
              fontSize: "0.72rem",
            }}
          >
            <Pin size={12} /> Click map to drop GCP ({gcpPoints.length}/4)
          </div>
        )}
      </div>

      {/* Occlusion Warning Badge (Bottom Center when low confidence exists) */}
      {showOcclusionAlerts && (
        <div
          className="glass-card"
          style={{
            position: "absolute",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 400,
            padding: "6px 14px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: "0.75rem",
            background: "rgba(255, 255, 255, 0.85)",
            border: "1px solid #FFD3B6",
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FFD3B6", border: "1.5px solid #E28743" }} />
          <span style={{ color: "var(--text-secondary)" }}>
            <strong>Peach/Amber Outlines:</strong> Canopy/Shadow Occlusion (&lt;80% Conf) &mdash; Requires Patwari HITL Verification
          </span>
        </div>
      )}
    </div>
  );
}
