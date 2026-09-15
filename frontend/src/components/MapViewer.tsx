"use client";

import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { Feature, FeatureCollection } from "geojson";

// Fix for Leaflet default marker icons in Next.js
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

// Color mapping for parcel statuses
const STATUS_COLORS: Record<string, string> = {
  raw: "#64748b",
  aligned: "#3b82f6",
  cleaned: "#8b5cf6",
  ulpin_assigned: "#06b6d4",
};

interface MapViewerProps {
  geojsonData?: FeatureCollection | null;
  selectedParcelId?: string | null;
  onParcelClick?: (parcelId: string) => void;
  center?: [number, number];
  zoom?: number;
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
        console.warn("Could not fit bounds:", e);
      }
    }
  }, [geojsonData, map]);

  return null;
}

export default function MapViewer({
  geojsonData,
  selectedParcelId,
  onParcelClick,
  center = [26.7605, 80.901],
  zoom = 15,
}: MapViewerProps) {
  const [isMounted, setIsMounted] = useState(false);

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
        Loading map…
      </div>
    );
  }

  const styleFeature = (feature: Feature | undefined) => {
    if (!feature) return {};
    const status = feature.properties?.alignment_status || "raw";
    const isSelected = feature.properties?.id === selectedParcelId;

    return {
      color: isSelected ? "#fbbf24" : STATUS_COLORS[status] || "#64748b",
      weight: isSelected ? 3 : 1.5,
      opacity: 0.9,
      fillColor: STATUS_COLORS[status] || "#64748b",
      fillOpacity: isSelected ? 0.35 : 0.15,
      dashArray: status === "raw" ? "5, 5" : undefined,
    };
  };

  const onEachFeature = (feature: Feature, layer: L.Layer) => {
    const props = feature.properties;
    if (!props) return;

    layer.on("click", () => {
      if (onParcelClick) onParcelClick(props.id);
    });

    const popupContent = `
      <div style="font-family: Inter, sans-serif; min-width: 200px;">
        <div style="font-weight: 700; font-size: 1rem; margin-bottom: 8px; color: #f0f4ff;">
          Khasra ${props.khasra_no}
        </div>
        <div style="display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 0.8rem;">
          <span style="color: #64748b;">Owner:</span>
          <span style="color: #94a3b8;">${props.owner_name}</span>
          <span style="color: #64748b;">Village:</span>
          <span style="color: #94a3b8;">${props.village}</span>
          <span style="color: #64748b;">Status:</span>
          <span style="color: ${STATUS_COLORS[props.alignment_status] || '#94a3b8'}; font-weight: 600; text-transform: uppercase; font-size: 0.7rem;">
            ${props.alignment_status}
          </span>
          ${props.ulpin ? `
          <span style="color: #64748b;">ULPIN:</span>
          <span style="color: #22d3ee; font-family: monospace; font-size: 0.75rem;">${props.ulpin}</span>
          ` : ""}
          ${props.area_sqm ? `
          <span style="color: #64748b;">Area:</span>
          <span style="color: #94a3b8;">${Number(props.area_sqm).toFixed(1)} m²</span>
          ` : ""}
        </div>
      </div>
    `;

    layer.bindPopup(popupContent, {
      className: "custom-popup",
      maxWidth: 280,
    });
  };

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ width: "100%", height: "100%", borderRadius: "var(--radius-md)" }}
      scrollWheelZoom={true}
      zoomControl={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
      />

      {geojsonData && geojsonData.features.length > 0 && (
        <>
          <GeoJSON
            key={JSON.stringify(geojsonData)}
            data={geojsonData}
            style={styleFeature}
            onEachFeature={onEachFeature}
          />
          <FitBounds geojsonData={geojsonData} />
        </>
      )}
    </MapContainer>
  );
}
