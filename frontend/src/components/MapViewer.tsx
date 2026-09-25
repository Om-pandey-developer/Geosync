"use client";

import { useEffect, useState } from "react";
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
import { Layers, Eye, Pin } from "lucide-react";

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

// Custom GCP Marker icon with 44px interactive hit-area (Fix for Issue 15)
const GcpIcon = L.divIcon({
  className: "custom-gcp-pin-container",
  html: `
    <div style="
      width: 44px; 
      height: 44px; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      cursor: pointer;
    ">
      <div style="
        width: 32px; 
        height: 32px; 
        background: #0D9488; 
        border: 3px solid #FFFFFF; 
        border-radius: 50%; 
        box-shadow: 0 4px 16px rgba(13, 148, 136, 0.5), 0 0 0 2px rgba(15, 23, 42, 0.4); 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        color: #FFFFFF; 
        font-weight: 800; 
        font-size: 11px;
        font-family: system-ui, sans-serif;
      ">
        GCP
      </div>
    </div>
  `,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

// Vibrant Cheerful Pastel parcel colors with high-contrast outlines
const STATUS_COLORS: Record<string, { fill: string; stroke: string }> = {
  raw: { fill: "#E2E8F0", stroke: "#475569" },          // High-contrast slate boundary
  aligned: { fill: "#CCFBF1", stroke: "#0D9488" },      // Vibrant Pastel Mint
  cleaned: { fill: "#E0F2FE", stroke: "#0284C7" },      // Vibrant Pastel Sky Blue
  ulpin_assigned: { fill: "#D1FAE5", stroke: "#059669" }, // Fresh Spring Green
  occluded: { fill: "#FEF3C7", stroke: "#D97706" },     // Warm Sunshine Amber
  published: { fill: "#F3E8FF", stroke: "#7C3AED" },    // Luminous Violet
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
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
        }
      } catch (e) {
        console.warn("Bounds fitting note:", e);
      }
    }
  }, [geojsonData, map]);

  return null;
}

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
  const [baseLayer, setBaseLayer] = useState<"drone" | "minimal">("drone");
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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-secondary)",
          fontSize: "0.9375rem",
          fontWeight: 600,
        }}
      >
        Initializing NAKSHA High-Resolution Drone GIS Canvas…
      </div>
    );
  }

  const styleFeature = (feature: Feature | undefined) => {
    if (!feature) return {};
    const status = feature.properties?.alignment_status || "raw";
    const confidence = feature.properties?.alignment_confidence ?? 1.0;
    const isOccluded = showOcclusionAlerts && confidence < 0.8;
    const isSelected = feature.properties?.id === selectedParcelId;

    const palette = isOccluded
      ? STATUS_COLORS.occluded
      : STATUS_COLORS[status] || STATUS_COLORS.raw;

    return {
      // Fix for Issue 7: Increased stroke weight (3px) and high-contrast styling
      color: isSelected ? "#0F172A" : palette.stroke,
      weight: isSelected ? 3.5 : 2.75,
      opacity: 1.0,
      fillColor: isSelected ? "#38BDF8" : palette.fill,
      fillOpacity: isSelected ? 0.65 : 0.4,
      dashArray: isOccluded ? "5, 5" : status === "raw" ? "6, 6" : undefined,
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
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-width: 230px; padding: 4px; color: #0F172A;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <span style="font-weight: 800; font-size: 1.05rem; color: #0F172A;">
            Khasra ${props.khasra_no}
          </span>
          <span style="
            background: #CCFBF1;
            color: #0D9488;
            border: 1px solid #99F6E4;
            font-size: 0.72rem;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 6px;
            text-transform: uppercase;
          ">
            ${props.alignment_status || 'raw'}
          </span>
        </div>

        ${isOccluded ? `
        <div style="
          background: #FEF3C7; 
          border: 1px solid #FDE68A; 
          border-radius: 6px; 
          padding: 6px 8px; 
          margin-bottom: 8px; 
          font-size: 0.75rem; 
          color: #92400E;
          font-weight: 600;
        ">
          ⚠️ <strong>Occlusion Alert:</strong> Low confidence (${Math.round((props.alignment_confidence || 0.65) * 100)}%). Tree canopy / shadow detected.
        </div>` : ''}

        <div style="display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; font-size: 0.8125rem;">
          <span style="color: #64748B; font-weight: 600;">Owner:</span>
          <strong style="color: #0F172A;">${props.owner_name}</strong>

          <span style="color: #64748B; font-weight: 600;">Village:</span>
          <span>${props.village}</span>

          ${props.ulpin ? `
          <span style="color: #64748B; font-weight: 600;">Bhu-Aadhaar:</span>
          <code style="background: #E0F2FE; color: #0284C7; font-weight: 800; padding: 2px 6px; border-radius: 4px; font-size: 0.8125rem;">
            ${props.ulpin}
          </code>` : ''}

          ${props.area_sqm ? `
          <span style="color: #64748B; font-weight: 600;">Area:</span>
          <span>${Number(props.area_sqm).toFixed(1)} m²</span>` : ''}
        </div>
      </div>
    `;

    layer.bindPopup(popupContent, {
      className: "custom-bright-popup",
      maxWidth: 300,
    });
  };

  const tileUrls = {
    drone: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    minimal: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ width: "100%", height: "100%" }}
        scrollWheelZoom={true}
        zoomControl={false}
      >
        <TileLayer
          url={tileUrls[baseLayer]}
          attribution='&copy; NAKSHA Drone Survey &copy; Esri &copy; DoLR'
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

        {/* Render Manual Ground Control Points (GCPs) with 44px hit-area */}
        {gcpPoints.map((gcp) => (
          <Marker key={gcp.id} position={[gcp.lat, gcp.lng]} icon={GcpIcon}>
            <Popup>
              <div style={{ padding: 4, fontSize: "0.85rem", color: "#0F172A" }}>
                <strong>{gcp.label || `GCP Point #${gcp.id}`}</strong>
                <div style={{ color: "#475569", marginTop: 2, fontSize: "0.78rem" }}>
                  Lat: {gcp.lat.toFixed(6)}, Lng: {gcp.lng.toFixed(6)}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#0D9488", fontWeight: 700, marginTop: 4 }}>
                  ✓ Locked for Thin-Plate Spline Warping
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        <MapClickHandler
          enabled={enableGcpPlacement}
          onAddGcp={onAddGcp}
          currentCount={gcpPoints.length}
        />
      </MapContainer>

      {/* Layer Control Bar (Fix for Issue 9: Added 24px vertical breathing room below top navbar) */}
      <div
        className="glass-card animate-fade-in-up"
        style={{
          position: "absolute",
          top: 24, /* Fix for Issue 9: ample clearance */
          left: 24,
          zIndex: 400,
          padding: "8px 14px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "rgba(255, 255, 255, 0.98)",
          borderRadius: "var(--radius-md)",
          boxShadow: "0 4px 14px rgba(15, 23, 42, 0.12)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-secondary)" }}>
          <Layers size={16} style={{ color: "var(--accent-primary)" }} />
          <span style={{ fontWeight: 700, fontSize: "0.875rem" }}>Map Layer:</span>
        </div>

        {/* Fix for Issue 8: High contrast & affordance for both active and inactive buttons */}
        <div style={{ display: "flex", gap: 6, background: "var(--bg-secondary)", padding: 3, borderRadius: "var(--radius-sm)" }}>
          <button
            onClick={() => setBaseLayer("drone")}
            style={{
              padding: "5px 12px",
              borderRadius: "var(--radius-sm)",
              border: baseLayer === "drone" ? "1px solid var(--accent-primary)" : "1px solid var(--border-glass)",
              fontSize: "0.8125rem", /* 13px */
              fontWeight: 700,
              cursor: "pointer",
              background: baseLayer === "drone" ? "var(--accent-primary)" : "#FFFFFF",
              color: baseLayer === "drone" ? "#FFFFFF" : "var(--text-secondary)",
              transition: "all 0.15s ease",
            }}
          >
            5cm Drone
          </button>
          <button
            onClick={() => setBaseLayer("minimal")}
            style={{
              padding: "5px 12px",
              borderRadius: "var(--radius-sm)",
              border: baseLayer === "minimal" ? "1px solid var(--accent-primary)" : "1px solid var(--border-glass)",
              fontSize: "0.8125rem",
              fontWeight: 700,
              cursor: "pointer",
              background: baseLayer === "minimal" ? "var(--accent-primary)" : "#FFFFFF",
              color: baseLayer === "minimal" ? "#FFFFFF" : "var(--text-secondary)",
              transition: "all 0.15s ease",
            }}
          >
            Light Cadastral
          </button>
        </div>

        <div style={{ width: 1, height: 20, background: "var(--border-subtle)" }} />

        <button
          onClick={() => setShowVectors(!showVectors)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 12px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-glass)",
            background: showVectors ? "var(--accent-primary-bg)" : "#FFFFFF",
            color: showVectors ? "var(--accent-primary)" : "var(--text-secondary)",
            fontSize: "0.8125rem",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <Eye size={14} />
          {showVectors ? "Cadastre Layer ON" : "Cadastre Layer OFF"}
        </button>

        {enableGcpPlacement && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              background: "#FEF3C7",
              border: "1px solid #FDE68A",
              color: "#92400E",
              borderRadius: "var(--radius-sm)",
              fontWeight: 700,
              fontSize: "0.78rem",
            }}
          >
            <Pin size={13} /> Click map to place GCP ({gcpPoints.length}/6)
          </div>
        )}
      </div>
    </div>
  );
}
