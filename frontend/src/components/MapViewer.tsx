"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
  Marker,
  Popup,
  Tooltip,
  useMapEvents,
  Pane,
  Rectangle,
  Polygon as LeafletPolygon,
  Polyline,
  ImageOverlay,
} from "react-leaflet";
import L from "leaflet";
import type { Feature, FeatureCollection } from "geojson";
import {
  Layers,
  Eye,
  Pin,
  Sliders,
  SplitSquareVertical,
  Crosshair,
  Sparkles,
  Move,
  RotateCcw,
  AlertTriangle,
  ArrowRightLeft,
} from "lucide-react";

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

// Custom GCP Marker icon with 44px interactive hit-area
const GcpIcon = L.divIcon({
  className: "custom-gcp-pin-container",
  html: `
    <div style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
      <div style="width: 32px; height: 32px; background: #0D9488; border: 3px solid #FFFFFF; border-radius: 50%; box-shadow: 0 4px 16px rgba(13, 148, 136, 0.5), 0 0 0 2px rgba(15, 23, 42, 0.4); display: flex; align-items: center; justify-content: center; color: #FFFFFF; font-weight: 800; font-size: 11px; font-family: system-ui, sans-serif;">
        GCP
      </div>
    </div>
  `,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

// Paired GCP Marker Icons (Legacy vs Drone)
const createPairedGcpIcon = (type: "legacy" | "drone", label: string) =>
  L.divIcon({
    className: "paired-gcp-pin",
    html: `
    <div style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
      <div style="
        width: 30px; 
        height: 30px; 
        background: ${type === "legacy" ? "#D97706" : "#0D9488"}; 
        border: 2.5px solid #FFFFFF; 
        border-radius: 50%; 
        box-shadow: 0 4px 14px ${type === "legacy" ? "rgba(217, 119, 6, 0.5)" : "rgba(13, 148, 136, 0.5)"}; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        color: #FFFFFF; 
        font-weight: 800; 
        font-size: 10px; 
        font-family: system-ui, sans-serif;
      ">
        ${label}
      </div>
    </div>
  `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

// Draggable Vertex Handle Icon (Task 2.2)
const VertexHandleIcon = L.divIcon({
  className: "vertex-drag-handle",
  html: `
    <div style="width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: grab;">
      <div style="
        width: 16px; 
        height: 16px; 
        background: #0284C7; 
        border: 2.5px solid #FFFFFF; 
        border-radius: 50%; 
        box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.4), 0 3px 8px rgba(0, 0, 0, 0.3);
        transition: transform 0.15s ease;
      "></div>
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

import { STATUS_COLORS, formatAlignmentStatus } from "@/lib/statusHelper";
export { STATUS_COLORS, formatAlignmentStatus };

export interface GCPPoint {
  id: number;
  lat: number;
  lng: number;
  label?: string;
}

export interface GCPPair {
  id: number;
  label: string;
  legacy: [number, number]; // [lat, lng]
  drone: [number, number];  // [lat, lng]
  displacementMeters: number;
  errorPixels: number;
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

  // Task 2.1: Split-screen Curtain Swipe Slider
  enableCurtainSwipe?: boolean;

  // Task 2.2: Manual Polygon Corner (Vertex) Drag Handles
  enableVertexEdit?: boolean;
  activePolygonCoords?: [number, number][]; // [lat, lng][]
  onVertexChange?: (coords: [number, number][]) => void;

  // Task 2.3: GeoSAM Prompt Bounding Box & GeoAI Trace
  enableBboxPrompt?: boolean;
  onBboxSelected?: (bbox: [number, number, number, number]) => void; // [minLon, minLat, maxLon, maxLat]
  aiTracedFeature?: any;
  aiTraceConfidence?: number;
  isOccluded?: boolean;

  // Task 2.4: Paired GCP Selection
  pairedGcpMode?: boolean;
  gcpPairs?: GCPPair[];
  onAddGcpPair?: (pair: GCPPair) => void;

  // Old Map & New Map Custom Sources & Overlays
  basemapUrl?: string;
  basemapAttribution?: string;
  basemapName?: string;
  customOldMapGeojson?: FeatureCollection | null;
  scannedMapOverlayUrl?: string | null;
  scannedMapBounds?: [[number, number], [number, number]];
  oldMapOpacity?: number;
  oldMapStrokeColor?: string;
  onOpenMapSourceModal?: () => void;

  // Integrated Top Control Bar Slots to eliminate floating collisions
  leftSlot?: React.ReactNode;
  toolbarOffsetLeft?: number | string;
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

// Map Click & Interaction Orchestrator (GCPs, BBox, Paired GCPs)
function InteractiveMapHandler({
  enableSingleGcp,
  onAddSingleGcp,
  singleGcpCount,
  enableBbox,
  onBboxSelected,
  enablePairedGcp,
  onAddGcpPair,
  pairedCount,
}: {
  enableSingleGcp: boolean;
  onAddSingleGcp?: (p: GCPPoint) => void;
  singleGcpCount: number;
  enableBbox: boolean;
  onBboxSelected?: (bbox: [number, number, number, number]) => void;
  enablePairedGcp: boolean;
  onAddGcpPair?: (pair: GCPPair) => void;
  pairedCount: number;
}) {
  const [bboxStart, setBboxStart] = useState<[number, number] | null>(null);
  const [bboxCurrent, setBboxCurrent] = useState<[number, number] | null>(null);
  const [pendingLegacyGcp, setPendingLegacyGcp] = useState<[number, number] | null>(null);

  useMapEvents({
    click(e) {
      // 1. Paired GCP dual-click handler
      if (enablePairedGcp && onAddGcpPair) {
        const clickedPos: [number, number] = [
          Number(e.latlng.lat.toFixed(6)),
          Number(e.latlng.lng.toFixed(6)),
        ];

        if (!pendingLegacyGcp) {
          setPendingLegacyGcp(clickedPos);
        } else {
          // Completed pair: Legacy -> Drone
          const lat1 = pendingLegacyGcp[0];
          const lon1 = pendingLegacyGcp[1];
          const lat2 = clickedPos[0];
          const lon2 = clickedPos[1];

          // Compute Euclidean meter displacement
          const dy = (lat2 - lat1) * 111320;
          const dx = (lon2 - lon1) * 111320 * Math.cos((lat1 * Math.PI) / 180);
          const dispM = Math.sqrt(dx * dx + dy * dy);
          const errPx = dispM / 0.05; // 5cm resolution

          onAddGcpPair({
            id: pairedCount + 1,
            label: `GCP Pair #${pairedCount + 1}`,
            legacy: pendingLegacyGcp,
            drone: clickedPos,
            displacementMeters: Number(dispM.toFixed(2)),
            errorPixels: Number(errPx.toFixed(1)),
          });
          setPendingLegacyGcp(null);
        }
        return;
      }

      // 2. Bounding Box Prompt (Two-corner click)
      if (enableBbox && onBboxSelected) {
        const clicked: [number, number] = [e.latlng.lat, e.latlng.lng];
        if (!bboxStart) {
          setBboxStart(clicked);
          setBboxCurrent(clicked);
        } else {
          const minLat = Math.min(bboxStart[0], clicked[0]);
          const maxLat = Math.max(bboxStart[0], clicked[0]);
          const minLon = Math.min(bboxStart[1], clicked[1]);
          const maxLon = Math.max(bboxStart[1], clicked[1]);
          onBboxSelected([minLon, minLat, maxLon, maxLat]);
          setBboxStart(null);
          setBboxCurrent(null);
        }
        return;
      }

      // 3. Single GCP Placement
      if (enableSingleGcp && onAddSingleGcp) {
        onAddSingleGcp({
          id: singleGcpCount + 1,
          lat: Number(e.latlng.lat.toFixed(6)),
          lng: Number(e.latlng.lng.toFixed(6)),
          label: `GCP-${singleGcpCount + 1}`,
        });
      }
    },
    mousemove(e) {
      if (enableBbox && bboxStart) {
        setBboxCurrent([e.latlng.lat, e.latlng.lng]);
      }
    },
  });

  return (
    <>
      {/* Live Drawing Bounding Box */}
      {bboxStart && bboxCurrent && (
        <Rectangle
          bounds={[bboxStart, bboxCurrent]}
          pathOptions={{
            color: "#0D9488",
            weight: 2,
            dashArray: "5, 5",
            fillColor: "#14B8A6",
            fillOpacity: 0.2,
          }}
        />
      )}

      {/* Pending Legacy GCP Marker (waiting for drone click) */}
      {pendingLegacyGcp && (
        <Marker position={pendingLegacyGcp} icon={createPairedGcpIcon("legacy", `L${pairedCount + 1}?`)}>
          <Tooltip permanent direction="top" offset={[0, -10]}>
            Step 2: Now click corresponding Drone Landmark
          </Tooltip>
        </Marker>
      )}
    </>
  );
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
  enableCurtainSwipe = false,
  enableVertexEdit = false,
  activePolygonCoords,
  onVertexChange,
  enableBboxPrompt = false,
  onBboxSelected,
  aiTracedFeature,
  aiTraceConfidence,
  isOccluded = false,
  pairedGcpMode = false,
  gcpPairs = [],
  onAddGcpPair,
  basemapUrl,
  basemapAttribution,
  basemapName,
  customOldMapGeojson,
  scannedMapOverlayUrl,
  scannedMapBounds = [
    [26.758, 80.898],
    [26.764, 80.905],
  ],
  oldMapOpacity = 80,
  oldMapStrokeColor = "#D97706",
  onOpenMapSourceModal,
  leftSlot,
  toolbarOffsetLeft,
}: MapViewerProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [baseLayer, setBaseLayer] = useState<"drone" | "minimal">("drone");
  const [showVectors, setShowVectors] = useState(true);

  // Task 2.1: Curtain Swipe Slider State (0% - 100%)
  const [isSwipeActive, setIsSwipeActive] = useState(enableCurtainSwipe);
  const [swipePosition, setSwipePosition] = useState(50);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Task 2.5: Layer Opacity Slider State (0% - 100%)
  const [vectorOpacity, setVectorOpacity] = useState(80);

  // Task 2.2: Local editable vertex coordinates & refs for smooth 60fps drag
  const [editableCoords, setEditableCoords] = useState<[number, number][]>([]);
  const coordsRef = useRef<[number, number][]>([]);
  const dragRafRef = useRef<number | null>(null);

  // Derive coordinates to render (parent activePolygonCoords takes precedence)
  const displayCoords = activePolygonCoords && activePolygonCoords.length > 0 ? activePolygonCoords : editableCoords;

  useEffect(() => {
    coordsRef.current = displayCoords;
  }, [displayCoords]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setIsSwipeActive(enableCurtainSwipe);
  }, [enableCurtainSwipe]);

  // Sync initial coordinates when selection or edit mode changes
  useEffect(() => {
    if (activePolygonCoords && activePolygonCoords.length > 0) {
      setEditableCoords(activePolygonCoords);
      coordsRef.current = activePolygonCoords;
    } else if (geojsonData && selectedParcelId) {
      const feat = geojsonData.features.find((f: any) => f.properties?.id === selectedParcelId);
      if (feat && feat.geometry && feat.geometry.type === "Polygon") {
        const ring = (feat.geometry as any).coordinates[0] || [];
        // Convert [lon, lat] -> [lat, lon]
        const pts: [number, number][] = ring.map((pt: [number, number]) => [pt[1], pt[0]]);
        setEditableCoords(pts);
        coordsRef.current = pts;
      }
    }
  }, [selectedParcelId, enableVertexEdit]);

  // Curtain Swipe Mouse Drag Handling
  const handleSliderMouseDown = () => {
    setIsDraggingSlider(true);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingSlider || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const percent = Math.round((x / rect.width) * 100);
      setSwipePosition(percent);
    },
    [isDraggingSlider]
  );

  const handleMouseUp = useCallback(() => {
    setIsDraggingSlider(false);
  }, []);

  useEffect(() => {
    if (isDraggingSlider) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingSlider, handleMouseMove, handleMouseUp]);

  // Vertex Drag Handler (Task 2.2) - decoupled from state updater to prevent cross-component setState during render
  const handleVertexDrag = useCallback(
    (index: number, newPos: [number, number]) => {
      const current = coordsRef.current;
      if (!current || current.length === 0) return;
      const updated = [...current];
      updated[index] = newPos;
      // If it's a closed ring and we drag the first point, sync the last point
      if (index === 0 && updated.length > 1) {
        updated[updated.length - 1] = newPos;
      }
      coordsRef.current = updated;

      // Update local state if parent is not controlling coordinates directly
      if (!activePolygonCoords || activePolygonCoords.length === 0) {
        setEditableCoords(updated);
      }

      // Schedule parent notification asynchronously to avoid calling setState during render/reconciliation
      if (onVertexChange) {
        if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = requestAnimationFrame(() => {
          onVertexChange(updated);
        });
      }
    },
    [activePolygonCoords, onVertexChange]
  );

  useEffect(() => {
    return () => {
      if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
    };
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

  const opacityRatio = vectorOpacity / 100;

  const styleFeature = (feature: Feature | undefined) => {
    if (!feature) return {};
    const rawStatus = feature.properties?.alignment_status || "DRAFT";
    const statusKey = String(rawStatus).toLowerCase();
    const confidence = feature.properties?.alignment_confidence ?? 1.0;
    const occluded = showOcclusionAlerts && confidence < 0.8;
    const isSelected = feature.properties?.id === selectedParcelId;

    const palette = occluded ? STATUS_COLORS.occluded : STATUS_COLORS[statusKey] || STATUS_COLORS.draft;
    const isDraft = statusKey === "raw" || statusKey === "draft";

    return {
      color: isSelected ? "#0F172A" : palette.stroke,
      weight: isSelected ? 3.5 : 2.75,
      opacity: opacityRatio,
      fillColor: isSelected ? "#38BDF8" : palette.fill,
      fillOpacity: (isSelected ? 0.65 : 0.4) * opacityRatio,
      dashArray: occluded ? "5, 5" : isDraft ? "6, 6" : undefined,
    };
  };

  const onEachFeature = (feature: Feature, layer: L.Layer) => {
    const props = feature.properties;
    if (!props) return;

    layer.on("click", () => {
      if (onParcelClick) onParcelClick(props.id);
    });

    const occluded = showOcclusionAlerts && (props.alignment_confidence ?? 1.0) < 0.8;
    const statusKey = String(props.alignment_status || "DRAFT").toLowerCase();
    const palette = occluded ? STATUS_COLORS.occluded : STATUS_COLORS[statusKey] || STATUS_COLORS.draft;

    const popupContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-width: 230px; padding: 4px; color: #0F172A;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <span style="font-weight: 800; font-size: 1.05rem; color: #0F172A;">
            Khasra ${props.khasra_no}
          </span>
          <span style="
            background: ${palette.fill};
            color: ${palette.stroke};
            border: 1px solid ${palette.stroke}40;
            font-size: 0.72rem;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 6px;
            text-transform: uppercase;
          ">
            ${formatAlignmentStatus(props.alignment_status)}
          </span>
        </div>

        ${
          occluded
            ? `
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
        </div>`
            : ""
        }

        <div style="display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; font-size: 0.8125rem;">
          <span style="color: #64748B; font-weight: 600;">Owner:</span>
          <strong style="color: #0F172A;">${props.owner_name}</strong>

          <span style="color: #64748B; font-weight: 600;">Village:</span>
          <span>${props.village}</span>

          ${
            props.ulpin
              ? `
          <span style="color: #64748B; font-weight: 600;">Bhu-Aadhaar:</span>
          <code style="background: #E0F2FE; color: #0284C7; font-weight: 800; padding: 2px 6px; border-radius: 4px; font-size: 0.8125rem;">
            ${props.ulpin}
          </code>`
              : ""
          }

          ${
            props.area_sqm
              ? `
          <span style="color: #64748B; font-weight: 600;">Area:</span>
          <span>${Number(props.area_sqm).toFixed(1)} m²</span>`
              : ""
          }
        </div>
      </div>
    `;

    layer.bindPopup(popupContent, {
      className: "custom-bright-popup",
      maxWidth: 320,
      autoPan: true,
      autoPanPaddingTopLeft: L.point(40, 95),
      autoPanPaddingBottomRight: L.point(40, 40),
    });
  };

  const tileUrls = {
    drone: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    minimal: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* ───── Integrated GIS Studio Ribbon Bar (Fixed Top Row in Normal Flow) ───── */}
      <div
        style={{
          height: 46,
          background: "#FFFFFF",
          borderBottom: "1.5px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          padding: "0 14px",
          gap: 8,
          zIndex: 40,
          boxShadow: "0 1px 4px rgba(15, 23, 42, 0.05)",
          flexShrink: 0,
          overflowX: "auto",
        }}
      >
        {/* Leading Slot (e.g. Halqa Parcel Roster trigger button) */}
        {leftSlot && (
          <>
            {leftSlot}
            <div style={{ width: 1, height: 20, background: "var(--border-subtle)", flexShrink: 0 }} />
          </>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-secondary)", flexShrink: 0 }}>
          <Layers size={16} style={{ color: "var(--accent-primary)" }} />
          <span style={{ fontWeight: 700, fontSize: "0.875rem" }}>Map View:</span>
        </div>

        {/* Old & New Map Layer & Source Manager Trigger */}
        {onOpenMapSourceModal && (
          <button
            onClick={onOpenMapSourceModal}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--accent-primary-light)",
              background: "#F0FDFA",
              color: "var(--accent-primary)",
              fontSize: "0.8125rem",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s ease",
              flexShrink: 0,
            }}
            title="Configure or upload Old Map (BhuNaksha/Scans) & New Map (Drone/Satellite)"
          >
            <Layers size={14} style={{ color: "var(--accent-primary)" }} />
            <span>Map Layers (Old & New)</span>
          </button>
        )}

        {/* Base Layer Switchers */}
        <div style={{ display: "flex", gap: 6, background: "var(--bg-secondary)", padding: 3, borderRadius: "var(--radius-sm)", flexShrink: 0 }}>
          <button
            onClick={() => {
              setBaseLayer("drone");
              setIsSwipeActive(false);
            }}
            style={{
              padding: "5px 12px",
              borderRadius: "var(--radius-sm)",
              border: !isSwipeActive && baseLayer === "drone" ? "1px solid var(--accent-primary)" : "1px solid var(--border-glass)",
              fontSize: "0.8125rem",
              fontWeight: 700,
              cursor: "pointer",
              background: !isSwipeActive && baseLayer === "drone" ? "var(--accent-primary)" : "#FFFFFF",
              color: !isSwipeActive && baseLayer === "drone" ? "#FFFFFF" : "var(--text-secondary)",
              transition: "all 0.15s ease",
            }}
          >
            5cm Drone
          </button>
          <button
            onClick={() => {
              setBaseLayer("minimal");
              setIsSwipeActive(false);
            }}
            style={{
              padding: "5px 12px",
              borderRadius: "var(--radius-sm)",
              border: !isSwipeActive && baseLayer === "minimal" ? "1px solid var(--accent-primary)" : "1px solid var(--border-glass)",
              fontSize: "0.8125rem",
              fontWeight: 700,
              cursor: "pointer",
              background: !isSwipeActive && baseLayer === "minimal" ? "var(--accent-primary)" : "#FFFFFF",
              color: !isSwipeActive && baseLayer === "minimal" ? "#FFFFFF" : "var(--text-secondary)",
              transition: "all 0.15s ease",
            }}
          >
            Light Cadastral
          </button>
        </div>

        {/* Task 2.1: Split-Screen Curtain Swipe Toggle */}
        <button
          onClick={() => setIsSwipeActive(!isSwipeActive)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 12px",
            borderRadius: "var(--radius-sm)",
            border: isSwipeActive ? "1px solid #0D9488" : "1px solid var(--border-glass)",
            background: isSwipeActive ? "#CCFBF1" : "#FFFFFF",
            color: isSwipeActive ? "#0D9488" : "var(--text-secondary)",
            fontSize: "0.8125rem",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.15s ease",
            flexShrink: 0,
          }}
        >
          <SplitSquareVertical size={14} />
          <span>{isSwipeActive ? "Swipe Mode (ON)" : "Curtain Swipe"}</span>
        </button>

        <div style={{ width: 1, height: 20, background: "var(--border-subtle)", flexShrink: 0 }} />

        {/* Vectors Visibility Toggle */}
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
            flexShrink: 0,
          }}
        >
          <Eye size={14} />
          <span>{showVectors ? "Cadastre ON" : "Cadastre OFF"}</span>
        </button>

        {/* Task 2.5: Glassmorphic Vector Opacity Slider */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 8px", background: "var(--bg-secondary)", borderRadius: "var(--radius-sm)", flexShrink: 0 }}>
          <Sliders size={13} style={{ color: "var(--text-secondary)" }} />
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)" }}>
            Opacity: {vectorOpacity}%
          </span>
          <input
            type="range"
            min="10"
            max="100"
            value={vectorOpacity}
            onChange={(e) => setVectorOpacity(Number(e.target.value))}
            style={{
              width: 70,
              height: 4,
              cursor: "pointer",
              accentColor: "var(--accent-primary)",
            }}
          />
        </div>

        {/* Active Mode Badges */}
        {enableBboxPrompt && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              background: "#CCFBF1",
              border: "1px solid #99F6E4",
              color: "#0D9488",
              borderRadius: "var(--radius-sm)",
              fontWeight: 800,
              fontSize: "0.78rem",
              flexShrink: 0,
            }}
          >
            <Crosshair size={13} /> Click 2 corners for GeoSAM AI Bounding Box
          </div>
        )}

        {pairedGcpMode && (
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
              fontWeight: 800,
              fontSize: "0.78rem",
              flexShrink: 0,
            }}
          >
            <Pin size={13} /> Click 1: Legacy landmark → Click 2: Drone marker
          </div>
        )}

        {enableVertexEdit && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              background: "#E0F2FE",
              border: "1px solid #BAE6FD",
              color: "#0369A1",
              borderRadius: "var(--radius-sm)",
              fontWeight: 800,
              fontSize: "0.78rem",
              flexShrink: 0,
            }}
          >
            <Move size={13} /> Corner Drag Mode Active (HITL)
          </div>
        )}
      </div>

      {/* ───── Pure Leaflet Map Canvas (Fills Remaining Height) ───── */}
      <div
        ref={containerRef}
        style={{
          position: "relative",
          flex: 1,
          width: "100%",
          overflow: "hidden",
          cursor: isDraggingSlider ? "ew-resize" : undefined,
        }}
      >
        <MapContainer
        center={center}
        zoom={zoom}
        style={{ width: "100%", height: "100%" }}
        scrollWheelZoom={true}
        zoomControl={false}
      >
        {/* Base Layer: Dynamic 5cm Drone Orthomosaic / User Selected Basemap */}
        <TileLayer
          key={basemapUrl || baseLayer}
          url={basemapUrl || (baseLayer === "minimal" && !isSwipeActive ? tileUrls.minimal : tileUrls.drone)}
          attribution={basemapAttribution || "&copy; NAKSHA Drone Survey &copy; Esri &copy; DoLR"}
          maxZoom={20}
        />

        {/* Scanned Historical Cadastral Paper Map Overlay */}
        {scannedMapOverlayUrl && (
          <ImageOverlay
            url={scannedMapOverlayUrl}
            bounds={scannedMapBounds}
            opacity={(oldMapOpacity / 100) * 0.85}
            zIndex={320}
          />
        )}

        {/* Custom Old Map GeoJSON Vector Overlay */}
        {customOldMapGeojson && customOldMapGeojson.features && customOldMapGeojson.features.length > 0 && (
          <GeoJSON
            key={`custom-old-${customOldMapGeojson.features.length}-${oldMapStrokeColor}-${oldMapOpacity}`}
            data={customOldMapGeojson}
            style={() => ({
              color: oldMapStrokeColor || "#D97706",
              weight: 2.5,
              opacity: oldMapOpacity / 100,
              fillColor: oldMapStrokeColor || "#D97706",
              fillOpacity: (oldMapOpacity / 100) * 0.25,
              dashArray: "4, 4",
            })}
          />
        )}

        {/* Task 2.1: Split-screen Curtain Swipe Pane (BhuNaksha Legacy Map on Left) */}
        {isSwipeActive && (
          <Pane
            name="bhuNakshaSwipePane"
            style={{
              zIndex: 350,
              clipPath: `polygon(0 0, ${swipePosition}% 0, ${swipePosition}% 100%, 0 100%)`,
            }}
          >
            <TileLayer
              url={tileUrls.minimal}
              attribution="&copy; BhuNaksha Legacy Cadastral &copy; Carto"
              maxZoom={19}
            />
          </Pane>
        )}

        {/* Normal Minimal layer if selected and swipe is disabled */}
        {!isSwipeActive && baseLayer === "minimal" && !basemapUrl && (
          <TileLayer
            url={tileUrls.minimal}
            attribution="&copy; OpenStreetMap &copy; Carto"
            maxZoom={19}
          />
        )}

        {/* Cadastral Parcels Vector Layer */}
        {showVectors && geojsonData && geojsonData.features.length > 0 && (
          <>
            <GeoJSON
              key={`${JSON.stringify(geojsonData)}-${selectedParcelId}-${vectorOpacity}`}
              data={geojsonData}
              style={styleFeature}
              onEachFeature={onEachFeature}
            />
            <FitBounds geojsonData={geojsonData} />
          </>
        )}

        {/* Task 2.2: Live Editable Polygon with Drag Handles (HITL Vertex Calibration) */}
        {enableVertexEdit && displayCoords.length > 2 && (
          <>
            <LeafletPolygon
              positions={displayCoords}
              pathOptions={{
                color: "#0284C7",
                weight: 3.5,
                fillColor: "#38BDF8",
                fillOpacity: 0.5,
                dashArray: "6, 4",
              }}
            />
            {displayCoords.map((coord, idx) => (
              <Marker
                key={`vertex-${idx}`}
                position={coord}
                draggable={true}
                icon={VertexHandleIcon}
                eventHandlers={{
                  drag(e) {
                    const latlng = e.target.getLatLng();
                    handleVertexDrag(idx, [latlng.lat, latlng.lng]);
                  },
                  dragend(e) {
                    const latlng = e.target.getLatLng();
                    handleVertexDrag(idx, [latlng.lat, latlng.lng]);
                  },
                }}
              >
                <Tooltip direction="top" offset={[0, -10]}>
                  Corner #{idx + 1} (Drag to adjust)
                </Tooltip>
              </Marker>
            ))}
          </>
        )}

        {/* Task 2.3: GeoSAM AI Traced Polygon Overlay */}
        {aiTracedFeature && (
          <GeoJSON
            key={`ai-trace-${JSON.stringify(aiTracedFeature)}`}
            data={aiTracedFeature}
            style={() => ({
              color: isOccluded ? "#EF4444" : "#0D9488",
              weight: 3.5,
              dashArray: isOccluded ? "6, 6" : undefined,
              fillColor: isOccluded ? "#FEF3C7" : "#14B8A6",
              fillOpacity: 0.55 * opacityRatio,
            })}
          />
        )}

        {/* Task 2.4: Render Paired GCP Landmarks & Displacement Vectors */}
        {pairedGcpMode &&
          gcpPairs.map((pair) => (
            <div key={`pair-group-${pair.id}`}>
              {/* Legacy Map Landmark Marker (Amber) */}
              <Marker position={pair.legacy} icon={createPairedGcpIcon("legacy", `L${pair.id}`)}>
                <Popup>
                  <div style={{ padding: 2, fontSize: "0.8rem", color: "#0F172A" }}>
                    <strong style={{ color: "#D97706" }}>Legacy Cadastral Landmark L{pair.id}</strong>
                    <div>Lat: {pair.legacy[0]}, Lng: {pair.legacy[1]}</div>
                  </div>
                </Popup>
              </Marker>

              {/* Drone Photo Ground Marker (Teal) */}
              <Marker position={pair.drone} icon={createPairedGcpIcon("drone", `D${pair.id}`)}>
                <Popup>
                  <div style={{ padding: 2, fontSize: "0.8rem", color: "#0F172A" }}>
                    <strong style={{ color: "#0D9488" }}>Drone Ground Marker D{pair.id}</strong>
                    <div>Lat: {pair.drone[0]}, Lng: {pair.drone[1]}</div>
                    <div style={{ marginTop: 4, fontWeight: 700, color: "#0284C7" }}>
                      Displacement: {pair.displacementMeters} m ({pair.errorPixels} px error)
                    </div>
                  </div>
                </Popup>
              </Marker>

              {/* Vector Connecting Line with displacement */}
              <Polyline
                positions={[pair.legacy, pair.drone]}
                pathOptions={{
                  color: "#F59E0B",
                  weight: 2.5,
                  dashArray: "5, 5",
                }}
              >
                <Tooltip sticky direction="center">
                  Δ {pair.displacementMeters}m ({pair.errorPixels}px)
                </Tooltip>
              </Polyline>
            </div>
          ))}

        {/* Single GCP Markers (Legacy Mode) */}
        {!pairedGcpMode &&
          gcpPoints.map((gcp) => (
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

        {/* Map Click Handler for GCPs & Prompt Box */}
        <InteractiveMapHandler
          enableSingleGcp={enableGcpPlacement && !pairedGcpMode}
          onAddSingleGcp={onAddGcp}
          singleGcpCount={gcpPoints.length}
          enableBbox={enableBboxPrompt}
          onBboxSelected={onBboxSelected}
          enablePairedGcp={pairedGcpMode}
          onAddGcpPair={onAddGcpPair}
          pairedCount={gcpPairs.length}
        />
      </MapContainer>

      {/* Task 2.1: Curtain Swipe Interactive Divider Bar */}
      {isSwipeActive && (
        <>
          <div
            onMouseDown={handleSliderMouseDown}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${swipePosition}%`,
              width: 4,
              background: "#FFFFFF",
              boxShadow: "0 0 12px rgba(0, 0, 0, 0.4)",
              zIndex: 400,
              cursor: "ew-resize",
              transform: "translateX(-50%)",
            }}
          >
            {/* Grab Handle Bubble */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: 36,
                height: 36,
                background: "#0D9488",
                border: "3px solid #FFFFFF",
                borderRadius: "50%",
                boxShadow: "0 4px 14px rgba(13, 148, 136, 0.6), 0 2px 6px rgba(0,0,0,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                cursor: "ew-resize",
              }}
            >
              <ArrowRightLeft size={16} />
            </div>
          </div>

          {/* Swipe Badges */}
          <div
            style={{
              position: "absolute",
              top: 72,
              left: 16,
              zIndex: 380,
              background: "rgba(15, 23, 42, 0.8)",
              color: "#FFFFFF",
              padding: "4px 12px",
              borderRadius: "6px",
              fontSize: "0.75rem",
              fontWeight: 800,
              letterSpacing: "0.05em",
              backdropFilter: "blur(6px)",
              pointerEvents: "none",
            }}
          >
            ◀ LEGACY BHUNAKSHA MAP
          </div>
          <div
            style={{
              position: "absolute",
              top: 72,
              right: 16,
              zIndex: 380,
              background: "rgba(13, 148, 136, 0.9)",
              color: "#FFFFFF",
              padding: "4px 12px",
              borderRadius: "6px",
              fontSize: "0.75rem",
              fontWeight: 800,
              letterSpacing: "0.05em",
              backdropFilter: "blur(6px)",
              pointerEvents: "none",
            }}
          >
            5cm DRONE ORTHOMOSAIC ▶
          </div>
        </>
      )}

      </div>
    </div>
  );
}
