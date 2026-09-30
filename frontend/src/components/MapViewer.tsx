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
  Sliders,
  SplitSquareVertical,
  Sparkles,
  RotateCcw,
  AlertTriangle,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  MapPin,
  Compass,
  Upload,
  Move,
  Download,
  Crosshair,
  CheckCircle2,
  FileText,
  Check,
  Copy,
  Trash2,
  Save,
} from "lucide-react";
import { toast } from "react-hot-toast";

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
  offX?: number;
  offY?: number;
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
  onRemoveGcp?: (id: number) => void;
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
  droneMapOverlayUrl?: string | null;
  droneMapBounds?: [[number, number], [number, number]];
  isAligned?: boolean;
  alignedMapOverlayUrl?: string | null;
  defaultBaseLayer?: "isolated" | "drone" | "minimal";
  // onLoadSampleMaps removed: mock data prohibited — real uploads only
  oldMapOpacity?: number;
  oldMapStrokeColor?: string;
  onOpenMapSourceModal?: () => void;
  enableSideBySide?: boolean;
  onToggleSideBySide?: (active: boolean) => void;
  // Unified Overlaid Alignment Canvas Props (Phase 4 Master Directive)
  unifiedOverlayUrl?: string | null;
  cadastralOverlayUrl?: string | null;
  droneBaseUrl?: string | null;
  anchors?: Array<{ id: number; label: string; x: number; y: number; lat?: number; lon?: number }>;
  needsAssistedAnchoring?: boolean;
  alignmentConfidence?: number;
  alignmentConfidenceBand?: string;
  alignmentRmse?: number;
  alignmentParcelsCount?: number;
  onExportPng?: () => void;
  onExportGeoJson?: () => void;
  onExportGeoTiff?: () => void;

  // Georeferencing & Live Cursor Tracking Props (Phases 1-3)
  geoReference?: {
    center_lat?: number;
    center_lon?: number;
    gsd_m?: number;
    bounds?: { north?: number; south?: number; east?: number; west?: number };
    source?: string;
  } | null;
  centerLat?: number;
  centerLon?: number;
  pixelScale?: number;
  geoBounds?: { north?: number; south?: number; east?: number; west?: number };

  // Integrated Top Control Bar Slots to eliminate floating collisions
  leftSlot?: React.ReactNode;
  toolbarOffsetLeft?: number | string;
  suppressEmptyBanner?: boolean;
  alignedOnlyMode?: boolean;
  hideComparisonControls?: boolean;
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

// Synchronizes pan and zoom across dual side-by-side MapContainer instances
function MapSyncController({
  onMove,
  setMapRef,
}: {
  onMove: (map: L.Map) => void;
  setMapRef: (map: L.Map | null) => void;
}) {
  const map = useMap();
  useEffect(() => {
    setMapRef(map);
    const handler = () => onMove(map);
    map.on("move", handler);
    return () => {
      map.off("move", handler);
      setMapRef(null);
    };
  }, [map, onMove, setMapRef]);
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
  onCursorMove,
}: {
  enableSingleGcp: boolean;
  onAddSingleGcp?: (p: GCPPoint) => void;
  singleGcpCount: number;
  enableBbox: boolean;
  onBboxSelected?: (bbox: [number, number, number, number]) => void;
  enablePairedGcp: boolean;
  onAddGcpPair?: (pair: GCPPair) => void;
  pairedCount: number;
  onCursorMove?: (coords: { lat: number; lon: number; pxX: number; pxY: number } | null) => void;
}) {
  const map = useMap();
  const [bboxStart, setBboxStart] = useState<[number, number] | null>(null);
  const [bboxCurrent, setBboxCurrent] = useState<[number, number] | null>(null);
  const [pendingLegacyGcp, setPendingLegacyGcp] = useState<[number, number] | null>(null);

  useMapEvents({
    click(e) {
      // Phase 3 constraint: strictly reject clicks outside active map canvas bounds
      const bounds = map.getBounds();
      if (!bounds.contains(e.latlng)) {
        return;
      }

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
      // Phase 3: real-time cursor coordinate tracker
      if (onCursorMove) {
        onCursorMove({
          lat: Number(e.latlng.lat.toFixed(6)),
          lon: Number(e.latlng.lng.toFixed(6)),
          pxX: 0,
          pxY: 0,
        });
      }
    },
    mouseout() {
      if (onCursorMove) {
        onCursorMove(null);
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
  onRemoveGcp,
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
  scannedMapBounds,
  droneMapOverlayUrl,
  droneMapBounds,
  isAligned = false,
  alignedMapOverlayUrl,
  unifiedOverlayUrl,
  cadastralOverlayUrl,
  droneBaseUrl,
  anchors = [],
  needsAssistedAnchoring = false,
  alignmentConfidence,
  alignmentConfidenceBand,
  alignmentRmse,
  alignmentParcelsCount,
  onExportPng,
  onExportGeoJson,
  onExportGeoTiff,
  geoReference,
  centerLat,
  centerLon,
  pixelScale,
  geoBounds,
  defaultBaseLayer = "isolated",
  enableSideBySide = false,
  onToggleSideBySide,
  oldMapOpacity = 80,
  oldMapStrokeColor = "#D97706",
  onOpenMapSourceModal,
  leftSlot,
  toolbarOffsetLeft,
  suppressEmptyBanner = false,
  alignedOnlyMode = false,
  hideComparisonControls = false,
}: MapViewerProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [baseLayer, setBaseLayer] = useState<"drone" | "minimal" | "isolated">(defaultBaseLayer);
  const [showVectors, setShowVectors] = useState(true);

  // ─── Georeference Coordinates & Live Tracker State (Phases 1-3) ───
  const refCenterLat = centerLat ?? geoReference?.center_lat ?? (Array.isArray(center) ? center[0] : 26.7605);
  const refCenterLon = centerLon ?? geoReference?.center_lon ?? (Array.isArray(center) ? center[1] : 80.9010);
  const activeGsd = pixelScale ?? geoReference?.gsd_m ?? 0.05;

  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lon: number; pxX: number; pxY: number } | null>(null);
  const [lockedGcp, setLockedGcp] = useState<GCPPoint | null>(null);
  const cursorRafRef = useRef<number | null>(null);
  const [selectedAnchorPin, setSelectedAnchorPin] = useState<{ id: number; label: string; x: number; y: number; lat: number; lon: number } | null>(null);

  // Sync locked GCP: dismiss if the point was removed
  useEffect(() => {
    if (lockedGcp && !gcpPoints.some((p) => p.id === lockedGcp.id)) {
      setLockedGcp(null);
    }
  }, [gcpPoints, lockedGcp]);

  const computeLatLngFromPixel = useCallback((pxX: number, pxY: number) => {
    const baseW = 1000;
    const baseH = 1000;
    const dx_m = (pxX - baseW / 2) * activeGsd;
    const dy_m = -(pxY - baseH / 2) * activeGsd;
    const lat = refCenterLat + (dy_m / 111320.0);
    const lon = refCenterLon + (dx_m / (111320.0 * Math.cos((refCenterLat * Math.PI) / 180.0)));
    return { lat: Number(lat.toFixed(6)), lon: Number(lon.toFixed(6)) };
  }, [refCenterLat, refCenterLon, activeGsd]);

  const computePixelFromLatLng = useCallback((lat: number, lon: number) => {
    const baseW = 1000;
    const baseH = 1000;
    const dy_m = (lat - refCenterLat) * 111320.0;
    const dx_m = (lon - refCenterLon) * (111320.0 * Math.cos((refCenterLat * Math.PI) / 180.0));
    const pxX = Math.round(baseW / 2 + dx_m / activeGsd);
    const pxY = Math.round(baseH / 2 - dy_m / activeGsd);
    return { pxX, pxY };
  }, [refCenterLat, refCenterLon, activeGsd]);

  // Custom uploaded raster comparison mode: active when scanned old map, drone, or aligned map are provided (disabled in alignedOnlyMode)
  const isCustomRasterComparison = !alignedOnlyMode && Boolean(
    scannedMapOverlayUrl || droneMapOverlayUrl || alignedMapOverlayUrl || droneBaseUrl || cadastralOverlayUrl || unifiedOverlayUrl
  );

  // Side-by-Side Dual Map Mode State
  const [isSideBySide, setIsSideBySide] = useState(enableSideBySide);
  useEffect(() => {
    setIsSideBySide(enableSideBySide);
  }, [enableSideBySide]);

  const map1Ref = useRef<L.Map | null>(null);
  const map2Ref = useRef<L.Map | null>(null);
  const isSyncingRef = useRef(false);

  const handleMap1Move = useCallback((m1: L.Map) => {
    if (isSyncingRef.current) return;
    const m2 = map2Ref.current;
    if (!m2) return;
    isSyncingRef.current = true;
    m2.setView(m1.getCenter(), m1.getZoom(), { animate: false });
    isSyncingRef.current = false;
  }, []);

  const handleMap2Move = useCallback((m2: L.Map) => {
    if (isSyncingRef.current) return;
    const m1 = map1Ref.current;
    if (!m1) return;
    isSyncingRef.current = true;
    m1.setView(m2.getCenter(), m2.getZoom(), { animate: false });
    isSyncingRef.current = false;
  }, []);

  // Dynamic Regional Legend State (Phase 4)
  const [isLegendOpen, setIsLegendOpen] = useState(true);

  // Task 2.1: Curtain Swipe Slider State (0% - 100%)
  const [isSwipeActive, setIsSwipeActive] = useState(enableCurtainSwipe);
  const [swipePosition, setSwipePosition] = useState(50);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  // Ref keeps the latest position for RAF callbacks to read without stale closures
  const swipePositionRef = useRef(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const sliderRafRef = useRef<number | null>(null);

  // Sync enableCurtainSwipe prop → state (deduplicated — single effect)
  useEffect(() => {
    setIsSwipeActive(enableCurtainSwipe);
  }, [enableCurtainSwipe]);

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

  // Sync initial coordinates when selection or edit mode changes
  useEffect(() => {
    if (activePolygonCoords && activePolygonCoords.length > 0) {
      setEditableCoords(activePolygonCoords);
      coordsRef.current = activePolygonCoords;
    } else if (geojsonData && selectedParcelId) {
      const feat = geojsonData.features.find((f: any) => f.properties?.id === selectedParcelId);
      if (feat && feat.geometry && feat.geometry.type === "Polygon") {
        const ring = (feat.geometry as any).coordinates[0] || [];
        const pts: [number, number][] = ring.map((pt: [number, number]) => [pt[1], pt[0]]);
        setEditableCoords(pts);
        coordsRef.current = pts;
      }
    }
  }, [selectedParcelId, enableVertexEdit]);

  // ─── Separate Independent Zoom & Pan for Left (Old Map) and Right (Drone/Aligned Map) ───
  // Left: Cadastral / Old Map
  const [leftZoom, setLeftZoom] = useState<number>(1.0);
  const [leftPan, setLeftPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanningLeft, setIsPanningLeft] = useState<boolean>(false);
  const leftPanStartRef = useRef<{ startX: number; startY: number; initPanX: number; initPanY: number } | null>(null);

  // Right: Drone / Aligned Map
  const [rightZoom, setRightZoom] = useState<number>(1.0);
  const [rightPan, setRightPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanningRight, setIsPanningRight] = useState<boolean>(false);
  const rightPanStartRef = useRef<{ startX: number; startY: number; initPanX: number; initPanY: number } | null>(null);

  // ─── Unified Overlaid Map Viewport State (Phase 4 Master Directive) ───
  const [unifiedZoom, setUnifiedZoom] = useState<number>(1.0);
  const [unifiedPan, setUnifiedPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanningUnified, setIsPanningUnified] = useState<boolean>(false);
  const unifiedPanStartRef = useRef<{ startX: number; startY: number; initPanX: number; initPanY: number } | null>(null);

  // Overlay Opacity, Toggle, and Split View
  const [cadastralOpacity, setCadastralOpacity] = useState<number>(85);
  const [showCadastral, setShowCadastral] = useState<boolean>(true);
  const [isCurtainActive, setIsCurtainActive] = useState<boolean>(false);
  const [curtainPos, setCurtainPos] = useState<number>(50);
  const [isDraggingCurtain, setIsDraggingCurtain] = useState<boolean>(false);

  // Nudge state (Translation ±1px, Rotation ±0.1°)
  const [nudge, setNudge] = useState<{ x: number; y: number; rot: number }>({ x: 0, y: 0, rot: 0 });
  const [isNudgeOpen, setIsNudgeOpen] = useState<boolean>(false);

  // Assisted Anchor Pins (Sector 1 NW, 2 NE, 3 SE, 4 SW)
  const [showAnchorPins, setShowAnchorPins] = useState<boolean>(needsAssistedAnchoring || false);
  const [activeAnchors, setActiveAnchors] = useState<Array<{ id: number; label: string; x: number; y: number; lat?: number; lon?: number }>>(anchors || []);
  const [draggedPinId, setDraggedPinId] = useState<number | null>(null);
  const pinDragStartRef = useRef<{ startX: number; startY: number; initPinX: number; initPinY: number } | null>(null);

  useEffect(() => {
    if (anchors && anchors.length > 0) {
      setActiveAnchors(anchors);
    }
  }, [anchors]);

  useEffect(() => {
    if (needsAssistedAnchoring) {
      setShowAnchorPins(true);
    }
  }, [needsAssistedAnchoring]);

  // Keyboard shortcut listener for micro-nudge (Arrows: ±1px, [ / ]: ±0.1° rotation)
  useEffect(() => {
    if (!isAligned) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;
      const step = e.shiftKey ? 5 : 1;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setNudge((prev) => ({ ...prev, x: prev.x - step }));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setNudge((prev) => ({ ...prev, x: prev.x + step }));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setNudge((prev) => ({ ...prev, y: prev.y - step }));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setNudge((prev) => ({ ...prev, y: prev.y + step }));
      } else if (e.key === "[" || e.key === "q" || e.key === "Q") {
        e.preventDefault();
        setNudge((prev) => ({ ...prev, rot: +(prev.rot - 0.1).toFixed(2) }));
      } else if (e.key === "]" || e.key === "e" || e.key === "E") {
        e.preventDefault();
        setNudge((prev) => ({ ...prev, rot: +(prev.rot + 0.1).toFixed(2) }));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAligned]);

  // Calculate exact visible raster boundaries (accounting for object-fit: contain)
  const getUnifiedImageBounds = useCallback(() => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const cw = rect.width;
    const ch = rect.height;
    if (cw <= 0 || ch <= 0) return null;

    const baseImg = document.getElementById("unified-base-drone-img") as HTMLImageElement | null;
    if (baseImg && baseImg.naturalWidth && baseImg.naturalHeight) {
      const imgAspect = baseImg.naturalWidth / baseImg.naturalHeight;
      const containerAspect = cw / ch;
      let renderW = cw;
      let renderH = ch;
      if (containerAspect > imgAspect) {
        renderH = ch;
        renderW = ch * imgAspect;
      } else {
        renderW = cw;
        renderH = cw / imgAspect;
      }
      return {
        halfW: renderW / 2,
        halfH: renderH / 2,
      };
    }
    return {
      halfW: cw / 2,
      halfH: ch / 2,
    };
  }, []);

  // Unified Mouse & Pan handlers
  const handleUnifiedMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest(".curtain-handle") ||
      target.closest(".hud-deck") ||
      target.closest(".nudge-panel") ||
      target.closest(".anchor-pin-marker") ||
      target.closest(".anchor-pin-dialog") ||
      target.closest(".gcp-point-marker") ||
      target.closest(".cursor-coordinates-hud") ||
      target.closest("button") ||
      target.closest("input")
    ) {
      return;
    }
    e.stopPropagation();
    unifiedPanStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initPanX: unifiedPan.x,
      initPanY: unifiedPan.y,
    };
    setIsPanningUnified(true);
  };

  const handleUnifiedPointerMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2 + unifiedPan.x;
    const centerY = rect.height / 2 + unifiedPan.y;

    const offX = (e.clientX - rect.left - centerX) / unifiedZoom;
    const offY = (e.clientY - rect.top - centerY) / unifiedZoom;

    // Check if cursor is inside the rendered raster map boundaries
    const bounds = getUnifiedImageBounds();
    if (bounds) {
      const isInside = Math.abs(offX) <= bounds.halfW && Math.abs(offY) <= bounds.halfH;
      if (!isInside) {
        if (cursorRafRef.current) cancelAnimationFrame(cursorRafRef.current);
        setCursorCoords(null);
        return;
      }
    }

    const baseW = 1000;
    const baseH = 1000;
    const pxX = Math.round(baseW / 2 + offX);
    const pxY = Math.round(baseH / 2 + offY);

    const dx_m = offX * activeGsd;
    const dy_m = -offY * activeGsd;
    const lat = refCenterLat + (dy_m / 111320.0);
    const lon = refCenterLon + (dx_m / (111320.0 * Math.cos((refCenterLat * Math.PI) / 180.0)));

    if (cursorRafRef.current) cancelAnimationFrame(cursorRafRef.current);
    cursorRafRef.current = requestAnimationFrame(() => {
      setCursorCoords({
        lat: Number(lat.toFixed(6)),
        lon: Number(lon.toFixed(6)),
        pxX,
        pxY,
      });
    });
  };

  const handleUnifiedCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest(".curtain-handle") ||
      target.closest(".hud-deck") ||
      target.closest(".nudge-panel") ||
      target.closest(".anchor-pin-marker") ||
      target.closest(".anchor-pin-dialog") ||
      target.closest(".gcp-point-marker") ||
      target.closest(".cursor-coordinates-hud") ||
      target.closest("button") ||
      target.closest("input")
    ) {
      return;
    }

    if (enableGcpPlacement) {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.width / 2 + unifiedPan.x;
      const centerY = rect.height / 2 + unifiedPan.y;
      const offX = (e.clientX - rect.left - centerX) / unifiedZoom;
      const offY = (e.clientY - rect.top - centerY) / unifiedZoom;

      // Point 1: Map Boundary Restriction - Reject drops outside the raster map
      const bounds = getUnifiedImageBounds();
      if (bounds) {
        const isInside = Math.abs(offX) <= bounds.halfW && Math.abs(offY) <= bounds.halfH;
        if (!isInside) {
          toast.error("GCP map boundary ke bahar nahi drop kar sakte!", { icon: "⚠️" });
          return;
        }
      }

      const dx_m = offX * activeGsd;
      const dy_m = -offY * activeGsd;
      const lat = Number((refCenterLat + (dy_m / 111320.0)).toFixed(6));
      const lon = Number((refCenterLon + (dx_m / (111320.0 * Math.cos((refCenterLat * Math.PI) / 180.0)))).toFixed(6));

      const nextId = gcpPoints.length > 0 ? Math.max(...gcpPoints.map((p) => p.id)) + 1 : 1;
      const newPt: GCPPoint = {
        id: nextId,
        lat,
        lng: lon,
        label: `GCP #${nextId}`,
        offX: Math.round(offX * 100) / 100,
        offY: Math.round(offY * 100) / 100,
      };
      if (onAddGcp) {
        onAddGcp(newPt);
      }
      // Point 4: Freeze/lock coordinates in the bottom HUD immediately upon drop
      setLockedGcp(newPt);
      return;
    }

    if (showAnchorPins && cursorCoords) {
      const newId = activeAnchors.length > 0 ? Math.max(...activeAnchors.map((a) => a.id)) + 1 : 1;
      const newPin = {
        id: newId,
        label: `GCP Landmark #${newId}`,
        x: cursorCoords.pxX,
        y: cursorCoords.pxY,
        lat: cursorCoords.lat,
        lon: cursorCoords.lon,
      };
      setActiveAnchors((prev) => [...prev, newPin]);
      setSelectedAnchorPin(newPin);
      toast.success(`Assisted GCP Landmark #${newId} pinned at [${newPin.lat}° N, ${newPin.lon}° E]`, { icon: "📍" });
    }
  };

  const handleCurtainPointerMove = (e: React.MouseEvent<HTMLDivElement>, isRight: boolean) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pan = isRight ? rightPan : leftPan;
    const zoomVal = isRight ? rightZoom : leftZoom;
    const centerX = rect.width / 2 + pan.x;
    const centerY = rect.height / 2 + pan.y;

    const offX = (e.clientX - rect.left - centerX) / zoomVal;
    const offY = (e.clientY - rect.top - centerY) / zoomVal;

    const baseW = 1000;
    const baseH = 1000;
    const pxX = Math.round(baseW / 2 + offX);
    const pxY = Math.round(baseH / 2 + offY);

    const dx_m = offX * activeGsd;
    const dy_m = -offY * activeGsd;
    const lat = refCenterLat + (dy_m / 111320.0);
    const lon = refCenterLon + (dx_m / (111320.0 * Math.cos((refCenterLat * Math.PI) / 180.0)));

    if (cursorRafRef.current) cancelAnimationFrame(cursorRafRef.current);
    cursorRafRef.current = requestAnimationFrame(() => {
      setCursorCoords({
        lat: Number(lat.toFixed(6)),
        lon: Number(lon.toFixed(6)),
        pxX,
        pxY,
      });
    });
  };

  const handleCurtainCanvasClick = (e: React.MouseEvent<HTMLDivElement>, isRight: boolean) => {
    const target = e.target as HTMLElement;
    if (
      target.closest(".curtain-handle") ||
      target.closest(".curtain-drag-deck") ||
      target.closest(".hud-deck") ||
      target.closest(".gcp-point-marker") ||
      target.closest(".cursor-coordinates-hud") ||
      target.closest("button") ||
      target.closest("input")
    ) {
      return;
    }

    if (enableGcpPlacement) {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pan = isRight ? rightPan : leftPan;
      const zoomVal = isRight ? rightZoom : leftZoom;
      const centerX = rect.width / 2 + pan.x;
      const centerY = rect.height / 2 + pan.y;
      const offX = (e.clientX - rect.left - centerX) / zoomVal;
      const offY = (e.clientY - rect.top - centerY) / zoomVal;
      const dx_m = offX * activeGsd;
      const dy_m = -offY * activeGsd;
      const lat = Number((refCenterLat + (dy_m / 111320.0)).toFixed(6));
      const lon = Number((refCenterLon + (dx_m / (111320.0 * Math.cos((refCenterLat * Math.PI) / 180.0)))).toFixed(6));

      const nextId = gcpPoints.length > 0 ? Math.max(...gcpPoints.map((p) => p.id)) + 1 : 1;
      const newPt: GCPPoint = {
        id: nextId,
        lat,
        lng: lon,
        label: `GCP #${nextId}`,
        offX: Math.round(offX * 100) / 100,
        offY: Math.round(offY * 100) / 100,
      };
      if (onAddGcp) {
        onAddGcp(newPt);
      }
      setLockedGcp(newPt);
    }
  };

  const handleUnifiedMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isPanningUnified || !unifiedPanStartRef.current) return;
      const dx = e.clientX - unifiedPanStartRef.current.startX;
      const dy = e.clientY - unifiedPanStartRef.current.startY;
      setUnifiedPan({
        x: unifiedPanStartRef.current.initPanX + dx,
        y: unifiedPanStartRef.current.initPanY + dy,
      });
    },
    [isPanningUnified]
  );

  const handleUnifiedMouseUp = useCallback(() => {
    setIsPanningUnified(false);
    unifiedPanStartRef.current = null;
  }, []);

  useEffect(() => {
    if (isPanningUnified) {
      window.addEventListener("mousemove", handleUnifiedMouseMove);
      window.addEventListener("mouseup", handleUnifiedMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleUnifiedMouseMove);
      window.removeEventListener("mouseup", handleUnifiedMouseUp);
    };
  }, [isPanningUnified, handleUnifiedMouseMove, handleUnifiedMouseUp]);

  const handleUnifiedWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    setUnifiedZoom((prev) => Math.min(5.0, Math.max(0.3, Number((prev * factor).toFixed(2)))));
  };

  // Curtain Dragging for Unified Viewport
  const handleCurtainDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingCurtain(true);
  };

  const handleCurtainMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDraggingCurtain || !containerRef.current) return;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const pct = Math.max(5, Math.min(95, Math.round((x / rect.width) * 100)));
      setCurtainPos(pct);
    },
    [isDraggingCurtain]
  );

  const handleCurtainEnd = useCallback(() => {
    setIsDraggingCurtain(false);
  }, []);

  useEffect(() => {
    if (isDraggingCurtain) {
      window.addEventListener("mousemove", handleCurtainMove);
      window.addEventListener("mouseup", handleCurtainEnd);
      window.addEventListener("touchmove", handleCurtainMove, { passive: false });
      window.addEventListener("touchend", handleCurtainEnd);
    }
    return () => {
      window.removeEventListener("mousemove", handleCurtainMove);
      window.removeEventListener("mouseup", handleCurtainEnd);
      window.removeEventListener("touchmove", handleCurtainMove);
      window.removeEventListener("touchend", handleCurtainEnd);
    };
  }, [isDraggingCurtain, handleCurtainMove, handleCurtainEnd]);

  // Anchor pin dragging
  const handlePinMouseDown = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggedPinId(id);
    const pin = activeAnchors.find((a) => a.id === id);
    pinDragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initPinX: pin?.x || 0,
      initPinY: pin?.y || 0,
    };
  };

  const handlePinMouseMove = useCallback(
    (e: MouseEvent) => {
      if (draggedPinId === null || !pinDragStartRef.current) return;
      const dx = (e.clientX - pinDragStartRef.current.startX) / unifiedZoom;
      const dy = (e.clientY - pinDragStartRef.current.startY) / unifiedZoom;
      setActiveAnchors((prev) =>
        prev.map((a) =>
          a.id === draggedPinId
            ? { ...a, x: Math.round(pinDragStartRef.current!.initPinX + dx), y: Math.round(pinDragStartRef.current!.initPinY + dy) }
            : a
        )
      );
    },
    [draggedPinId, unifiedZoom]
  );

  const handlePinMouseUp = useCallback(() => {
    setDraggedPinId(null);
    pinDragStartRef.current = null;
  }, []);

  useEffect(() => {
    if (draggedPinId !== null) {
      window.addEventListener("mousemove", handlePinMouseMove);
      window.addEventListener("mouseup", handlePinMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handlePinMouseMove);
      window.removeEventListener("mouseup", handlePinMouseUp);
    };
  }, [draggedPinId, handlePinMouseMove, handlePinMouseUp]);

  // Left mouse down handler (starts panning ONLY left map)
  const handleLeftMouseDown = (e: React.MouseEvent) => {
    if (!isCustomRasterComparison) return;
    const target = e.target as HTMLElement;
    if (target.closest(".curtain-slider-handle") || target.closest(".curtain-drag-deck") || target.closest("button") || target.closest("input")) return;
    e.stopPropagation();
    leftPanStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initPanX: leftPan.x,
      initPanY: leftPan.y,
    };
    setIsPanningLeft(true);
  };

  // Right mouse down handler (starts panning ONLY right map)
  const handleRightMouseDown = (e: React.MouseEvent) => {
    if (!isCustomRasterComparison) return;
    const target = e.target as HTMLElement;
    if (target.closest(".curtain-slider-handle") || target.closest(".curtain-drag-deck") || target.closest("button") || target.closest("input")) return;
    e.stopPropagation();
    rightPanStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initPanX: rightPan.x,
      initPanY: rightPan.y,
    };
    setIsPanningRight(true);
  };

  // Mouse move for Left Pan
  const handleLeftMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isPanningLeft || !leftPanStartRef.current) return;
      const dx = e.clientX - leftPanStartRef.current.startX;
      const dy = e.clientY - leftPanStartRef.current.startY;
      setLeftPan({
        x: leftPanStartRef.current.initPanX + dx,
        y: leftPanStartRef.current.initPanY + dy,
      });
    },
    [isPanningLeft]
  );

  // Mouse move for Right Pan
  const handleRightMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isPanningRight || !rightPanStartRef.current) return;
      const dx = e.clientX - rightPanStartRef.current.startX;
      const dy = e.clientY - rightPanStartRef.current.startY;
      setRightPan({
        x: rightPanStartRef.current.initPanX + dx,
        y: rightPanStartRef.current.initPanY + dy,
      });
    },
    [isPanningRight]
  );

  const handlePanMouseUp = useCallback(() => {
    setIsPanningLeft(false);
    leftPanStartRef.current = null;
    setIsPanningRight(false);
    rightPanStartRef.current = null;
  }, []);

  useEffect(() => {
    if (isPanningLeft) {
      window.addEventListener("mousemove", handleLeftMouseMove);
      window.addEventListener("mouseup", handlePanMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleLeftMouseMove);
      window.removeEventListener("mouseup", handlePanMouseUp);
    };
  }, [isPanningLeft, handleLeftMouseMove, handlePanMouseUp]);

  useEffect(() => {
    if (isPanningRight) {
      window.addEventListener("mousemove", handleRightMouseMove);
      window.addEventListener("mouseup", handlePanMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleRightMouseMove);
      window.removeEventListener("mouseup", handlePanMouseUp);
    };
  }, [isPanningRight, handleRightMouseMove, handlePanMouseUp]);

  // Left & Right Wheel Handlers (zoom strictly on hovered side)
  const handleLeftWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    setLeftZoom((prev) => Math.min(4.5, Math.max(0.2, Number((prev * factor).toFixed(2)))));
  };

  const handleRightWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    setRightZoom((prev) => Math.min(4.5, Math.max(0.2, Number((prev * factor).toFixed(2)))));
  };

  // Zoom control helpers
  const zoomInLeft = () => setLeftZoom((z) => Math.min(4.5, +(z * 1.2).toFixed(2)));
  const zoomOutLeft = () => setLeftZoom((z) => Math.max(0.2, +(z / 1.2).toFixed(2)));
  const resetLeftView = () => {
    setLeftZoom(1.0);
    setLeftPan({ x: 0, y: 0 });
  };

  const zoomInRight = () => setRightZoom((z) => Math.min(4.5, +(z * 1.2).toFixed(2)));
  const zoomOutRight = () => setRightZoom((z) => Math.max(0.2, +(z / 1.2).toFixed(2)));
  const resetRightView = () => {
    setRightZoom(1.0);
    setRightPan({ x: 0, y: 0 });
  };

  // ─── Curtain Swipe: RAF-batched drag for 60fps clip-path updates ───────────
  const computePercent = (clientX: number): number => {
    if (!containerRef.current) return swipePositionRef.current;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    return Math.max(5, Math.min(95, Math.round((x / rect.width) * 100)));
  };

  const handleSliderMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingSlider(true);
  };

  const handleSliderTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingSlider(true);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingSlider) return;
      const next = computePercent(e.clientX);
      if (sliderRafRef.current) cancelAnimationFrame(sliderRafRef.current);
      sliderRafRef.current = requestAnimationFrame(() => {
        swipePositionRef.current = next;
        setSwipePosition(next);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isDraggingSlider]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDraggingSlider) return;
      e.preventDefault();
      const next = computePercent(e.touches[0].clientX);
      if (sliderRafRef.current) cancelAnimationFrame(sliderRafRef.current);
      sliderRafRef.current = requestAnimationFrame(() => {
        swipePositionRef.current = next;
        setSwipePosition(next);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isDraggingSlider]
  );

  const handleMouseUp = useCallback(() => {
    setIsDraggingSlider(false);
    if (sliderRafRef.current) cancelAnimationFrame(sliderRafRef.current);
  }, []);

  useEffect(() => {
    if (isDraggingSlider) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove, { passive: false });
      window.addEventListener("touchend", handleMouseUp);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleMouseUp);
      if (sliderRafRef.current) cancelAnimationFrame(sliderRafRef.current);
    };
  }, [isDraggingSlider, handleMouseMove, handleMouseUp, handleTouchMove]);
  // ─────────────────────────────────────────────────────────────────────────

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
        Initializing GIS Canvas…
      </div>
    );
  }

  // Empty-state guard: show clean workspace if no data has been loaded yet
  const hasAnyData =
    (geojsonData?.features?.length ?? 0) > 0 ||
    !!scannedMapOverlayUrl ||
    !!droneMapOverlayUrl ||
    (customOldMapGeojson?.features?.length ?? 0) > 0;

  if (!suppressEmptyBanner && !hasAnyData) {
    return (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          isolation: "isolate",
        }}
      >
        {/* Dot-grid empty workspace background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle, #CBD5E1 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            opacity: 0.5,
          }}
        />
        {/* Centred prompt card */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 10,
            background: "rgba(255,255,255,0.97)",
            border: "1.5px solid var(--border-glass)",
            borderRadius: "var(--radius-lg)",
            padding: "28px 32px",
            maxWidth: 440,
            width: "calc(100% - 40px)",
            textAlign: "center",
            boxShadow: "0 20px 50px rgba(15,23,42,0.12)",
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "var(--accent-primary-bg)",
              color: "var(--accent-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 14px",
            }}
          >
            <Upload size={26} />
          </div>
          <h3
            style={{
              fontSize: "1.1rem",
              fontWeight: 800,
              color: "var(--text-primary)",
              marginBottom: 8,
            }}
          >
            Workspace Ready
          </h3>
          <p
            style={{
              fontSize: "0.8125rem",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              marginBottom: 20,
            }}
          >
            Upload your <strong>Old Cadastral Map</strong> and{" "}
            <strong>Drone Image</strong> using the Layer Manager to begin
            geospatial alignment and curtain comparison.
          </p>
          {onOpenMapSourceModal && (
            <button
              onClick={onOpenMapSourceModal}
              className="btn-primary"
              style={{
                width: "100%",
                padding: "10px 16px",
                fontWeight: 700,
                fontSize: "0.875rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Upload size={16} />
              <span>Open Layer Manager</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const opacityRatio = vectorOpacity / 100;

  const styleFeature = (feature: Feature | undefined) => {
    if (!feature) return {};
    const props = feature.properties || {};
    const rawStatus = props.alignment_status || "DRAFT";
    const statusKey = String(rawStatus).toLowerCase();
    const band = props.confidence_band;
    const isSelected = props.id === selectedParcelId || props.khasra_no === selectedParcelId;

    let strokeColor = "#10B981";
    let fillColor = "#A7F3D0";
    let isOccluded = false;

    if (band === "RED" || statusKey === "govt_illegal" || props.status_color === "#EF4444") {
      strokeColor = "#EF4444";
      fillColor = "#FCA5A5";
    } else if (band === "AMBER" || statusKey === "occluded" || statusKey === "occlusion_shadow" || props.status_color === "#F59E0B") {
      strokeColor = "#F59E0B";
      fillColor = "#FDE68A";
      isOccluded = true;
    } else {
      strokeColor = "#10B981";
      fillColor = "#A7F3D0";
    }

    return {
      color: isSelected ? "#0F172A" : strokeColor,
      weight: isSelected ? 3.5 : 2.5,
      opacity: opacityRatio,
      fillColor: isSelected ? "#38BDF8" : fillColor,
      fillOpacity: (isSelected ? 0.65 : 0.45) * opacityRatio,
      dashArray: isOccluded ? "5, 5" : undefined,
    };
  };

  const onEachFeature = (feature: Feature, layer: L.Layer) => {
    const props = feature.properties;
    if (!props) return;

    layer.on("click", () => {
      if (onParcelClick) onParcelClick(props.id || props.khasra_no);
    });

    const band = props.confidence_band;
    const isRed = band === "RED" || props.status_color === "#EF4444";
    const isAmber = band === "AMBER" || props.status_color === "#F59E0B";
    const statusBadgeBg = isRed ? "#FEE2E2" : isAmber ? "#FEF3C7" : "#DCFCE7";
    const statusBadgeColor = isRed ? "#991B1B" : isAmber ? "#92400E" : "#166534";
    const statusLabel = props.situation || (isRed ? "सरकारी भूमि / अवैध कब्जा" : isAmber ? "ओकल्शन (पेड़ / छाया)" : "सही (Verified Clear)");

    const popupContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-width: 250px; padding: 4px; color: #0F172A;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <span style="font-weight: 800; font-size: 1.05rem; color: #0F172A;">
            Khasra ${props.khasra_no}
          </span>
          <span style="
            background: ${statusBadgeBg};
            color: ${statusBadgeColor};
            border: 1px solid ${statusBadgeColor}40;
            font-size: 0.72rem;
            font-weight: 800;
            padding: 2px 8px;
            borderRadius: 6px;
          ">
            ${statusLabel}
          </span>
        </div>

        ${
          props.reason
            ? `
        <div style="
          background: ${isRed ? "#FEF2F2" : isAmber ? "#FFFBEB" : "#F0FDF4"}; 
          border: 1px solid ${isRed ? "#FECACA" : isAmber ? "#FDE68A" : "#BBF7D0"}; 
          border-radius: 6px; 
          padding: 6px 8px; 
          margin-bottom: 8px; 
          font-size: 0.75rem; 
          color: ${statusBadgeColor};
          font-weight: 600;
        ">
          ${isRed ? "🔴" : isAmber ? "🟠" : "🟢"} <strong>Status Note:</strong> ${props.reason}
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
        isolation: "isolate",
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
        {/* Leading Slot (e.g. Patwari Profile & Align Button) */}
        {leftSlot && (
          <>
            {leftSlot}
            {!isCustomRasterComparison && (
              <div style={{ width: 1, height: 20, background: "var(--border-subtle)", flexShrink: 0 }} />
            )}
          </>
        )}

        {/* Standard GIS controls (Completely hidden when viewing uploaded map comparison or in alignedOnlyMode) */}
        {!isCustomRasterComparison && !alignedOnlyMode && !hideComparisonControls && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-secondary)", flexShrink: 0 }}>
              <Layers size={16} style={{ color: "var(--accent-primary)" }} />
              <span style={{ fontWeight: 700, fontSize: "0.875rem" }}>Map View:</span>
            </div>

            {/* Base Layer Switchers & Curtain Swipe (Phase 1 & Phase 2) */}
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
                title="Switch to High-Resolution Drone Orthomosaic Map"
              >
                drone map
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
                title="Switch to Legacy Cadastral Map"
              >
                old map
              </button>
              <button
                onClick={() => {
                  setBaseLayer("isolated");
                  setIsSwipeActive(false);
                }}
                style={{
                  padding: "5px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: !isSwipeActive && !isSideBySide && baseLayer === "isolated" ? "1px solid var(--accent-primary)" : "1px solid var(--border-glass)",
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: !isSwipeActive && !isSideBySide && baseLayer === "isolated" ? "var(--accent-primary)" : "#FFFFFF",
                  color: !isSwipeActive && !isSideBySide && baseLayer === "isolated" ? "#FFFFFF" : "var(--text-secondary)",
                  transition: "all 0.15s ease",
                }}
                title="Switch to Clean Canvas (Isolated vector work area without tile noise)"
              >
                clean canvas
              </button>
            </div>

            <div style={{ width: 1, height: 20, background: "var(--border-subtle)", flexShrink: 0 }} />

            {/* Phase 2: Side-by-Side Dual Comparison Toggle */}
            <button
              onClick={() => {
                const next = !isSideBySide;
                setIsSideBySide(next);
                if (next) setIsSwipeActive(false);
                if (onToggleSideBySide) onToggleSideBySide(next);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 12px",
                borderRadius: "var(--radius-sm)",
                border: isSideBySide ? "1.5px solid #0D9488" : "1px solid var(--border-glass)",
                background: isSideBySide ? "#0D9488" : "#FFFFFF",
                color: isSideBySide ? "#FFFFFF" : "var(--text-secondary)",
                fontSize: "0.8125rem",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s ease",
                flexShrink: 0,
              }}
              title="Toggle Side-by-Side Dual Map Comparison (Old Cadastre on Left, Aligned Drone on Right)"
            >
              <ArrowRightLeft size={14} />
              <span>{isSideBySide ? "Side-by-Side: ON" : "Side-by-Side"}</span>
            </button>

            {/* Phase 2: Split-Screen Curtain Swipe Comparison Toggle */}
            <button
              onClick={() => {
                const next = !isSwipeActive;
                setIsSwipeActive(next);
                if (next) setIsSideBySide(false);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 12px",
                borderRadius: "var(--radius-sm)",
                border: isSwipeActive ? "1.5px solid #0D9488" : "1px solid var(--border-glass)",
                background: isSwipeActive ? "#0D9488" : "#FFFFFF",
                color: isSwipeActive ? "#FFFFFF" : "var(--text-secondary)",
                fontSize: "0.8125rem",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s ease",
                flexShrink: 0,
              }}
              title="Toggle Split-Screen Curtain Swipe Comparison (Old Map vs Drone Orthomosaic)"
            >
              <SplitSquareVertical size={14} />
              <span>{isSwipeActive ? `Curtain Swipe (${swipePosition}%)` : "Curtain Swipe"}</span>
            </button>

            <div style={{ width: 1, height: 20, background: "var(--border-subtle)", flexShrink: 0 }} />
          </>
        )}

        {/* When in alignedOnlyMode: display single title badge */}
        {alignedOnlyMode && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "linear-gradient(135deg, #F0FDFA 0%, #E6FFFA 100%)",
                  border: "1.5px solid #99F6E4",
                  color: "#0F766E",
                  padding: "5px 12px",
                  borderRadius: "var(--radius-sm)",
                  fontWeight: 800,
                  fontSize: "0.82rem",
                  boxShadow: "0 1px 3px rgba(13, 148, 136, 0.1)",
                }}
              >
                <Sparkles size={14} style={{ color: "#0D9488" }} />
                <span>New Aligned Cadastral Map (Patwari Survey Approved)</span>
              </div>
            </div>
            <div style={{ width: 1, height: 20, background: "var(--border-subtle)", flexShrink: 0 }} />
          </>
        )}

        {/* Cadastre Vectors Visibility Toggle & Opacity Slider */}
        {(!isCustomRasterComparison || alignedOnlyMode) && (
          <>
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
          </>
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
        {isAligned && (alignedMapOverlayUrl || cadastralOverlayUrl || unifiedOverlayUrl) ? (
          /* ──────────────────────────────────────────────────────
             UNIFIED OVERLAID ALIGNMENT CANVAS (PHASE 4 OVERHAUL)
             Single viewport: Base Drone + Neon Aligned Cadastre
             Interactive Opacity, Curtain Split, Nudge & Anchors
          ────────────────────────────────────────────────────── */
          <div
            onMouseDown={handleUnifiedMouseDown}
            onWheel={handleUnifiedWheel}
            onMouseMove={handleUnifiedPointerMove}
            onMouseLeave={() => setCursorCoords(null)}
            onClick={handleUnifiedCanvasClick}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              background: "#080C14",
              cursor: isPanningUnified ? "grabbing" : (enableGcpPlacement || showAnchorPins) ? "crosshair" : "grab",
              overflow: "hidden",
              userSelect: "none",
            }}
          >
            {/* Transforming Stage */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: `translate(${unifiedPan.x}px, ${unifiedPan.y}px) scale(${unifiedZoom})`,
                transformOrigin: "center center",
                transition: isPanningUnified ? "none" : "transform 0.05s ease-out",
              }}
            >
              {/* 1. Base Layer: Drone Orthophoto */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                id="unified-base-drone-img"
                src={droneBaseUrl || droneMapOverlayUrl || alignedMapOverlayUrl || ""}
                alt="Drone Orthomosaic Base Map"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  userSelect: "none",
                  pointerEvents: "none",
                  display: "block",
                }}
              />

              {/* 2. Overlay Layer: Aligned Cadastre (Neon green lines, 25% fill, khasra badges) */}
              {showCadastral && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    opacity: cadastralOpacity / 100,
                    transform: `translate(${nudge.x}px, ${nudge.y}px) rotate(${nudge.rot}deg)`,
                    transformOrigin: "center center",
                    clipPath: isCurtainActive ? `inset(0 0 0 ${curtainPos}%)` : "none",
                    pointerEvents: "none",
                    transition: isPanningUnified ? "none" : "opacity 0.12s ease",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cadastralOverlayUrl || unifiedOverlayUrl || alignedMapOverlayUrl || ""}
                    alt="Aligned Cadastral Boundaries"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      userSelect: "none",
                      display: "block",
                    }}
                  />
                </div>
              )}

              {/* 3. Assisted Anchor Pins (Draggable & Clickable for Fine-Tune) */}
              {showAnchorPins &&
                activeAnchors.map((anchor) => {
                  const pinCoords = computeLatLngFromPixel(anchor.x, anchor.y);
                  const isPinSelected = selectedAnchorPin?.id === anchor.id;
                  return (
                    <div
                      key={anchor.id}
                      className="anchor-pin-marker"
                      onMouseDown={(e) => handlePinMouseDown(anchor.id, e)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAnchorPin({
                          ...anchor,
                          lat: anchor.lat || pinCoords.lat,
                          lon: anchor.lon || pinCoords.lon,
                        });
                      }}
                      style={{
                        position: "absolute",
                        left: `${anchor.x}px`,
                        top: `${anchor.y}px`,
                        transform: "translate(-50%, -50%)",
                        cursor: "pointer",
                        zIndex: isPinSelected ? 60 : 50,
                        pointerEvents: "auto",
                      }}
                    >
                      <div
                        style={{
                          position: "relative",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                        }}
                      >
                        {/* Pulsing Outer Ring */}
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: "50%",
                            background: isPinSelected ? "rgba(0, 229, 255, 0.35)" : "rgba(0, 255, 102, 0.25)",
                            border: isPinSelected ? "2.5px solid #00E5FF" : "2px solid #00FF66",
                            boxShadow: isPinSelected ? "0 0 20px #00E5FF" : "0 0 16px #00FF66",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <div
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: "50%",
                              background: isPinSelected ? "#00E5FF" : "#00FF66",
                              border: "2px solid #FFFFFF",
                            }}
                          />
                        </div>
                        {/* Label Badge */}
                        <div
                          style={{
                            marginTop: 4,
                            background: "rgba(15, 23, 42, 0.95)",
                            border: isPinSelected ? "1.5px solid #00E5FF" : "1px solid #00FF66",
                            color: isPinSelected ? "#00E5FF" : "#00FF66",
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: "0.68rem",
                            fontWeight: 800,
                            whiteSpace: "nowrap",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <span>📍 {anchor.label}</span>
                          <span style={{ color: "#38BDF8", fontSize: "0.62rem", fontFamily: "monospace" }}>
                            [{(anchor.lat || pinCoords.lat).toFixed(4)}°, {(anchor.lon || pinCoords.lon).toFixed(4)}°]
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

              {/* 4. Dropped GCP Points on Unified Canvas (Point 2: Zero Drift & Point 3: Working Delete) */}
              {gcpPoints.map((gcp) => {
                const dy_m = (gcp.lat - refCenterLat) * 111320.0;
                const dx_m = (gcp.lng - refCenterLon) * (111320.0 * Math.cos((refCenterLat * Math.PI) / 180.0));
                const ptOffX = gcp.offX !== undefined ? gcp.offX : (dx_m / activeGsd);
                const ptOffY = gcp.offY !== undefined ? gcp.offY : (-dy_m / activeGsd);
                const isSelected = lockedGcp?.id === gcp.id;

                return (
                  <div
                    key={`unified-gcp-${gcp.id}`}
                    className="gcp-point-marker animate-fade-in"
                    onClick={(e) => {
                      e.stopPropagation();
                      if ((e.target as HTMLElement).closest("button")) return;
                      setLockedGcp(gcp);
                      toast(`Locked GCP #${gcp.id}: [${gcp.lat.toFixed(6)}° N, ${gcp.lng.toFixed(6)}° E]`, { icon: "📍" });
                    }}
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      transform: `translate(calc(-50% + ${ptOffX}px), calc(-16px + ${ptOffY}px))`,
                      cursor: "pointer",
                      zIndex: isSelected ? 80 : 75,
                      pointerEvents: "auto",
                    }}
                  >
                    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
                      {/* Bullseye Pinpoint */}
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background: isSelected ? "rgba(245, 158, 11, 0.45)" : "rgba(234, 179, 8, 0.4)",
                          border: isSelected ? "2.5px solid #F59E0B" : "2.5px solid #FACC15",
                          boxShadow: isSelected ? "0 0 24px #F59E0B, 0 0 10px #F59E0B" : "0 0 20px #EAB308, 0 0 8px #FACC15",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            background: "#EF4444",
                            border: "2px solid #FFFFFF",
                            boxShadow: "0 0 8px rgba(239, 68, 68, 0.8)",
                          }}
                        />
                      </div>

                      {/* Label Badge with Coordinates & Working Delete Button */}
                      <div
                        style={{
                          marginTop: 4,
                          background: isSelected ? "rgba(30, 27, 75, 0.96)" : "rgba(15, 23, 42, 0.95)",
                          border: isSelected ? "1.5px solid #F59E0B" : "1.5px solid #FACC15",
                          color: "#FFFFFF",
                          padding: "3px 8px",
                          borderRadius: 6,
                          fontSize: "0.7rem",
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                          boxShadow: "0 6px 16px rgba(0,0,0,0.6)",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          userSelect: "none",
                        }}
                      >
                        <span style={{ color: isSelected ? "#FBBF24" : "#FACC15" }}>📌 {gcp.label || `GCP #${gcp.id}`}</span>
                        <span style={{ color: "#38BDF8", fontSize: "0.62rem", fontFamily: "monospace" }}>
                          [{gcp.lat.toFixed(5)}°, {gcp.lng.toFixed(5)}°]
                        </span>
                        {onRemoveGcp && (
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                            }}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveGcp(gcp.id);
                              if (lockedGcp?.id === gcp.id) {
                                setLockedGcp(null);
                              }
                            }}
                            title={`Remove GCP #${gcp.id}`}
                            style={{
                              background: "rgba(239, 68, 68, 0.35)",
                              border: "1.5px solid rgba(239, 68, 68, 0.7)",
                              borderRadius: "50%",
                              color: "#FFFFFF",
                              width: 20,
                              height: 20,
                              minWidth: 20,
                              minHeight: 20,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              fontSize: "0.75rem",
                              fontWeight: 900,
                              lineHeight: 1,
                              marginLeft: 2,
                              boxShadow: "0 0 6px rgba(239, 68, 68, 0.6)",
                              transition: "all 0.15s ease",
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Phase 3: Assisted GCP Pin Details & DGPS Modal Dialog ── */}
            {selectedAnchorPin && (
              <div
                className="anchor-pin-dialog animate-fade-in-up"
                style={{
                  position: "absolute",
                  top: 76,
                  right: 20,
                  zIndex: 700,
                  width: 300,
                  background: "rgba(15, 23, 42, 0.96)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  border: "1.5px solid #00FF66",
                  borderRadius: 14,
                  padding: "16px",
                  boxShadow: "0 16px 40px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 255, 102, 0.3)",
                  color: "#FFFFFF",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <MapPin size={16} color="#00FF66" />
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#00FF66" }}>
                      Assisted GCP #{selectedAnchorPin.id}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedAnchorPin(null)}
                    style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer", fontSize: "1rem" }}
                  >
                    ✕
                  </button>
                </div>

                <div>
                  <label style={{ fontSize: "0.7rem", color: "#94A3B8", fontWeight: 700, display: "block", marginBottom: 4 }}>
                    Landmark Label / Description
                  </label>
                  <input
                    type="text"
                    value={selectedAnchorPin.label}
                    onChange={(e) => setSelectedAnchorPin({ ...selectedAnchorPin, label: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      borderRadius: 6,
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      color: "#FFFFFF",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                    }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={{ fontSize: "0.68rem", color: "#94A3B8", fontWeight: 700, display: "block", marginBottom: 3 }}>
                      Latitude (°N) [DGPS]
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      value={selectedAnchorPin.lat}
                      onChange={(e) => setSelectedAnchorPin({ ...selectedAnchorPin, lat: parseFloat(e.target.value) || 0 })}
                      style={{
                        width: "100%",
                        padding: "5px 8px",
                        borderRadius: 6,
                        background: "rgba(255, 255, 255, 0.08)",
                        border: "1.5px solid rgba(56, 189, 248, 0.5)",
                        color: "#38BDF8",
                        fontSize: "0.75rem",
                        fontWeight: 800,
                        fontFamily: "monospace",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.68rem", color: "#94A3B8", fontWeight: 700, display: "block", marginBottom: 3 }}>
                      Longitude (°E) [DGPS]
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      value={selectedAnchorPin.lon}
                      onChange={(e) => setSelectedAnchorPin({ ...selectedAnchorPin, lon: parseFloat(e.target.value) || 0 })}
                      style={{
                        width: "100%",
                        padding: "5px 8px",
                        borderRadius: 6,
                        background: "rgba(255, 255, 255, 0.08)",
                        border: "1.5px solid rgba(56, 189, 248, 0.5)",
                        color: "#38BDF8",
                        fontSize: "0.75rem",
                        fontWeight: 800,
                        fontFamily: "monospace",
                      }}
                    />
                  </div>
                </div>

                <div style={{ fontSize: "0.68rem", color: "#64748B", background: "rgba(0,0,0,0.35)", padding: "5px 8px", borderRadius: 4, display: "flex", justifyContent: "space-between" }}>
                  <span>Stage Offset: <strong>X: {selectedAnchorPin.x}px | Y: {selectedAnchorPin.y}px</strong></span>
                  <span style={{ color: "#00FF66", fontWeight: 700 }}>±5cm GSD</span>
                </div>

                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <button
                    onClick={() => {
                      const coordText = `${selectedAnchorPin.lat.toFixed(6)}, ${selectedAnchorPin.lon.toFixed(6)}`;
                      navigator.clipboard.writeText(coordText);
                      toast.success(`Copied GPS: ${coordText}`, { icon: "📋" });
                    }}
                    style={{
                      flex: 1,
                      padding: "7px 8px",
                      borderRadius: 6,
                      background: "rgba(255,255,255,0.12)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      color: "#FFFFFF",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                    }}
                  >
                    <Copy size={12} /> Copy GPS
                  </button>
                  <button
                    onClick={() => {
                      setActiveAnchors((prev) => prev.filter((a) => a.id !== selectedAnchorPin.id));
                      setSelectedAnchorPin(null);
                      toast.success(`Deleted Pin #${selectedAnchorPin.id}`, { icon: "🗑️" });
                    }}
                    style={{
                      padding: "7px 10px",
                      borderRadius: 6,
                      background: "rgba(239, 68, 68, 0.2)",
                      border: "1px solid rgba(239, 68, 68, 0.4)",
                      color: "#F87171",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                    title="Delete Landmark"
                  >
                    <Trash2 size={13} />
                  </button>
                  <button
                    onClick={() => {
                      const px = computePixelFromLatLng(selectedAnchorPin.lat, selectedAnchorPin.lon);
                      setActiveAnchors((prev) =>
                        prev.map((a) =>
                          a.id === selectedAnchorPin.id
                            ? {
                                ...selectedAnchorPin,
                                x: px.pxX,
                                y: px.pxY,
                              }
                            : a
                        )
                      );
                      setSelectedAnchorPin(null);
                      toast.success("Landmark coordinates saved!", { icon: "💾" });
                    }}
                    style={{
                      flex: 1,
                      padding: "7px 8px",
                      borderRadius: 6,
                      background: "linear-gradient(135deg, #0D9488 0%, #059669 100%)",
                      border: "none",
                      color: "#FFFFFF",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                    }}
                  >
                    <Save size={12} /> Save
                  </button>
                </div>
              </div>
            )}

            {/* ── Curtain Swipe Divider & Drag Handle ── */}
            {isCurtainActive && (
              <>
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: `${curtainPos}%`,
                    width: isDraggingCurtain ? 4 : 3,
                    background: "linear-gradient(180deg, #00FF66 0%, #00E5FF 50%, #00FF66 100%)",
                    zIndex: 500,
                    pointerEvents: "none",
                    transform: "translateX(-50%)",
                    boxShadow: isDraggingCurtain
                      ? "0 0 20px #00FF66, 0 0 8px #00E5FF"
                      : "0 0 10px rgba(0, 255, 102, 0.6)",
                  }}
                />
                <div
                  onMouseDown={handleCurtainDragStart}
                  onTouchStart={handleCurtainDragStart}
                  className="curtain-handle"
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: `${curtainPos}%`,
                    transform: "translate(-50%, -50%)",
                    zIndex: 510,
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: isDraggingCurtain
                      ? "linear-gradient(135deg, #00FF66 0%, #00E5FF 100%)"
                      : "linear-gradient(135deg, #059669 0%, #0D9488 100%)",
                    border: "3px solid #FFFFFF",
                    boxShadow: "0 6px 24px rgba(0, 0, 0, 0.6), 0 0 16px rgba(0, 255, 102, 0.7)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "ew-resize",
                    color: "#FFFFFF",
                    userSelect: "none",
                    touchAction: "none",
                  }}
                  title="Curtain Swipe Slider (Drag Left / Right)"
                >
                  <ArrowRightLeft size={18} />
                  <div
                    style={{
                      position: "absolute",
                      top: -26,
                      background: "rgba(15, 23, 42, 0.95)",
                      color: "#00FF66",
                      border: "1px solid #00FF66",
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: "0.7rem",
                      fontWeight: 900,
                      whiteSpace: "nowrap",
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
                    }}
                  >
                    {curtainPos}% Split
                  </div>
                </div>

                {/* Floating Side Tags */}
                <div
                  style={{
                    position: "absolute",
                    top: 60,
                    left: 18,
                    zIndex: 490,
                    background: "rgba(15, 23, 42, 0.88)",
                    color: "#38BDF8",
                    padding: "4px 10px",
                    borderRadius: 20,
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    border: "1px solid rgba(56, 189, 248, 0.4)",
                    backdropFilter: "blur(8px)",
                    pointerEvents: "none",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                  }}
                >
                  ◀ PURE DRONE ORTHOPHOTO
                </div>
                <div
                  style={{
                    position: "absolute",
                    top: 60,
                    right: 18,
                    zIndex: 490,
                    background: "rgba(15, 23, 42, 0.88)",
                    color: "#00FF66",
                    padding: "4px 10px",
                    borderRadius: 20,
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    border: "1px solid rgba(0, 255, 102, 0.4)",
                    backdropFilter: "blur(8px)",
                    pointerEvents: "none",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                  }}
                >
                  ALIGNED CADASTRE OVERLAY ▶
                </div>
              </>
            )}

            {/* ── Top HUD Control Ribbon (Centered Pill Matching Design Directive) ── */}
            <div
              className="hud-deck animate-fade-in-down"
              style={{
                position: "absolute",
                top: 14,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 600,
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "8px 18px",
                background: "rgba(15, 23, 42, 0.95)",
                backdropFilter: "blur(16px)",
                borderRadius: 24,
                border: "1.5px solid rgba(255, 255, 255, 0.16)",
                boxShadow: "0 12px 35px rgba(0, 0, 0, 0.55)",
                color: "#FFFFFF",
                maxWidth: "calc(100% - 32px)",
                whiteSpace: "nowrap",
              }}
            >
              {/* Left: Confidence & Status Pill */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: (alignmentConfidence || 80) >= 85 ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
                    border: `1.5px solid ${(alignmentConfidence || 80) >= 85 ? "#10B981" : "#F59E0B"}`,
                    padding: "3px 9px",
                    borderRadius: 7,
                  }}
                >
                  <span style={{ fontSize: "0.8rem", fontWeight: 900, color: (alignmentConfidence || 80) >= 85 ? "#10B981" : "#F59E0B" }}>
                    🎯 {alignmentConfidence || 80.0}% {alignmentConfidenceBand || "AMBER"}
                  </span>
                </div>
                <span style={{ fontSize: "0.72rem", color: "#94A3B8" }}>
                  RMSE: <strong>±{alignmentRmse || 0.25}m</strong>
                </span>
                <span style={{ fontSize: "0.72rem", color: "#94A3B8" }}>
                  Parcels: <strong>{alignmentParcelsCount || 37} Plots</strong>
                </span>
              </div>

              {/* Center: Interactive Sliders & Toggles */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                {/* Opacity Slider */}
                <div style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(255, 255, 255, 0.08)", padding: "3px 9px", borderRadius: 7 }}>
                  <Sliders size={13} style={{ color: "#00FF66" }} />
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#E2E8F0" }}>
                    Opacity: {cadastralOpacity}%
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={cadastralOpacity}
                    onChange={(e) => setCadastralOpacity(Number(e.target.value))}
                    style={{ width: 70, accentColor: "#00FF66", cursor: "pointer" }}
                  />
                </div>

                {/* Curtain Swipe Toggle */}
                <button
                  onClick={() => setIsCurtainActive(!isCurtainActive)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "4px 10px",
                    borderRadius: 7,
                    background: isCurtainActive ? "rgba(0, 255, 102, 0.2)" : "rgba(255, 255, 255, 0.08)",
                    border: isCurtainActive ? "1.5px solid #00FF66" : "1px solid rgba(255, 255, 255, 0.15)",
                    color: isCurtainActive ? "#00FF66" : "#E2E8F0",
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  <ArrowRightLeft size={12} />
                  <span>Curtain Split {isCurtainActive ? "ON" : "OFF"}</span>
                </button>

                {/* Boundaries ON/OFF */}
                <button
                  onClick={() => setShowCadastral(!showCadastral)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "4px 10px",
                    borderRadius: 7,
                    background: showCadastral ? "rgba(56, 189, 248, 0.2)" : "rgba(255, 255, 255, 0.08)",
                    border: showCadastral ? "1.5px solid #38BDF8" : "1px solid rgba(255, 255, 255, 0.15)",
                    color: showCadastral ? "#38BDF8" : "#E2E8F0",
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  <Eye size={12} />
                  <span>Boundaries {showCadastral ? "ON" : "OFF"}</span>
                </button>

                {/* Fine-Tune Nudge Toggle */}
                <button
                  onClick={() => setIsNudgeOpen(!isNudgeOpen)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "4px 10px",
                    borderRadius: 7,
                    background: isNudgeOpen ? "rgba(234, 179, 8, 0.25)" : "rgba(255, 255, 255, 0.08)",
                    border: isNudgeOpen ? "1.5px solid #EAB308" : "1px solid rgba(255, 255, 255, 0.15)",
                    color: isNudgeOpen ? "#FACC15" : "#E2E8F0",
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  <Move size={12} />
                  <span>Nudge Controls</span>
                </button>

                {/* Assisted Pins Toggle */}
                <button
                  onClick={() => setShowAnchorPins(!showAnchorPins)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "4px 10px",
                    borderRadius: 7,
                    background: showAnchorPins ? "rgba(168, 85, 247, 0.25)" : "rgba(255, 255, 255, 0.08)",
                    border: showAnchorPins ? "1.5px solid #A855F7" : "1px solid rgba(255, 255, 255, 0.15)",
                    color: showAnchorPins ? "#C084FC" : "#E2E8F0",
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  <MapPin size={12} />
                  <span>Assisted Pins</span>
                </button>
              </div>

              {/* Right: Export Actions */}
              <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
                {onExportPng && (
                  <button
                    onClick={onExportPng}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 9px",
                      borderRadius: 6,
                      background: "#10B981",
                      color: "#FFFFFF",
                      border: "none",
                      fontSize: "0.7rem",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                    title="Download High-Res Aligned Map PNG"
                  >
                    <Download size={11} />
                    <span>PNG</span>
                  </button>
                )}
              </div>
            </div>

            {/* ── Floating Nudge Panel (when isNudgeOpen is true) ── */}
            {isNudgeOpen && (
              <div
                className="nudge-panel animate-fade-in-up"
                style={{
                  position: "absolute",
                  bottom: 24,
                  right: 20,
                  zIndex: 650,
                  background: "rgba(15, 23, 42, 0.96)",
                  backdropFilter: "blur(14px)",
                  border: "1.5px solid #EAB308",
                  borderRadius: 14,
                  padding: "12px 16px",
                  color: "#FFFFFF",
                  boxShadow: "0 12px 35px rgba(0, 0, 0, 0.6)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  width: 240,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255, 255, 255, 0.15)", paddingBottom: 6 }}>
                  <span style={{ fontSize: "0.76rem", fontWeight: 800, color: "#FACC15", display: "flex", alignItems: "center", gap: 6 }}>
                    <Move size={14} /> Sub-Pixel Nudge (±1px)
                  </span>
                  <button
                    onClick={() => setNudge({ x: 0, y: 0, rot: 0 })}
                    style={{
                      background: "transparent",
                      border: "1px solid rgba(255, 255, 255, 0.3)",
                      color: "#E2E8F0",
                      fontSize: "0.68rem",
                      padding: "2px 6px",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                    title="Reset all offsets to 0"
                  >
                    Reset
                  </button>
                </div>

                {/* Directional Pad */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <button
                    onClick={() => setNudge((prev) => ({ ...prev, y: prev.y - 1 }))}
                    style={{
                      width: 32,
                      height: 28,
                      background: "rgba(255, 255, 255, 0.15)",
                      border: "1px solid rgba(255, 255, 255, 0.25)",
                      borderRadius: 4,
                      color: "#FFFFFF",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                    title="Nudge Up (Arrow Up)"
                  >
                    ▲
                  </button>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={() => setNudge((prev) => ({ ...prev, x: prev.x - 1 }))}
                      style={{
                        width: 32,
                        height: 28,
                        background: "rgba(255, 255, 255, 0.15)",
                        border: "1px solid rgba(255, 255, 255, 0.25)",
                        borderRadius: 4,
                        color: "#FFFFFF",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                      title="Nudge Left (Arrow Left)"
                    >
                      ◀
                    </button>
                    <div
                      style={{
                        width: 32,
                        height: 28,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.68rem",
                        color: "#94A3B8",
                      }}
                    >
                      ●
                    </div>
                    <button
                      onClick={() => setNudge((prev) => ({ ...prev, x: prev.x + 1 }))}
                      style={{
                        width: 32,
                        height: 28,
                        background: "rgba(255, 255, 255, 0.15)",
                        border: "1px solid rgba(255, 255, 255, 0.25)",
                        borderRadius: 4,
                        color: "#FFFFFF",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                      title="Nudge Right (Arrow Right)"
                    >
                      ▶
                    </button>
                  </div>
                  <button
                    onClick={() => setNudge((prev) => ({ ...prev, y: prev.y + 1 }))}
                    style={{
                      width: 32,
                      height: 28,
                      background: "rgba(255, 255, 255, 0.15)",
                      border: "1px solid rgba(255, 255, 255, 0.25)",
                      borderRadius: 4,
                      color: "#FFFFFF",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                    title="Nudge Down (Arrow Down)"
                  >
                    ▼
                  </button>
                </div>

                {/* Rotation Buttons */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <button
                    onClick={() => setNudge((prev) => ({ ...prev, rot: +(prev.rot - 0.1).toFixed(2) }))}
                    style={{
                      flex: 1,
                      padding: "4px 8px",
                      background: "rgba(255, 255, 255, 0.12)",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      borderRadius: 4,
                      color: "#FFFFFF",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                    title="Rotate Counter-Clockwise 0.1° (Press Q / [)"
                  >
                    ⟲ -0.1°
                  </button>
                  <button
                    onClick={() => setNudge((prev) => ({ ...prev, rot: +(prev.rot + 0.1).toFixed(2) }))}
                    style={{
                      flex: 1,
                      padding: "4px 8px",
                      background: "rgba(255, 255, 255, 0.12)",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      borderRadius: 4,
                      color: "#FFFFFF",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                    title="Rotate Clockwise 0.1° (Press E / ])"
                  >
                    ⟳ +0.1°
                  </button>
                </div>

                {/* Readout */}
                <div style={{ fontSize: "0.68rem", color: "#94A3B8", textAlign: "center", background: "rgba(0, 0, 0, 0.3)", padding: "3px 6px", borderRadius: 4 }}>
                  Offset: ΔX: <strong>{nudge.x}px</strong> | ΔY: <strong>{nudge.y}px</strong> | Rot: <strong>{nudge.rot}°</strong>
                </div>
              </div>
            )}

            {/* ── Zoom Deck (Bottom-Left) ── */}
            <div
              style={{
                position: "absolute",
                bottom: 24,
                left: 20,
                zIndex: 650,
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(15, 23, 42, 0.94)",
                backdropFilter: "blur(14px)",
                border: "1.5px solid rgba(255, 255, 255, 0.15)",
                padding: "6px 14px",
                borderRadius: 36,
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
                color: "#FFFFFF",
                userSelect: "none",
              }}
            >
              <button
                onClick={() => setUnifiedZoom((z) => Math.max(0.3, +(z / 1.2).toFixed(2)))}
                style={{
                  background: "rgba(255, 255, 255, 0.12)",
                  border: "1px solid rgba(255, 255, 255, 0.16)",
                  borderRadius: "50%",
                  width: 28,
                  height: 28,
                  color: "#FFFFFF",
                  fontSize: "1.1rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="Zoom Out (-)"
              >
                −
              </button>
              <input
                type="range"
                min="0.3"
                max="4.0"
                step="0.05"
                value={unifiedZoom}
                onChange={(e) => setUnifiedZoom(parseFloat(e.target.value))}
                style={{ width: 75, accentColor: "#00FF66", cursor: "pointer" }}
                title={`Zoom: ${Math.round(unifiedZoom * 100)}%`}
              />
              <button
                onClick={() => setUnifiedZoom((z) => Math.min(4.0, +(z * 1.2).toFixed(2)))}
                style={{
                  background: "rgba(255, 255, 255, 0.12)",
                  border: "1px solid rgba(255, 255, 255, 0.16)",
                  borderRadius: "50%",
                  width: 28,
                  height: 28,
                  color: "#FFFFFF",
                  fontSize: "1.1rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="Zoom In (+)"
              >
                +
              </button>
              <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#00FF66", minWidth: 42, textAlign: "center", fontFamily: "monospace" }}>
                {Math.round(unifiedZoom * 100)}%
              </span>
              <button
                onClick={() => {
                  setUnifiedZoom(1.0);
                  setUnifiedPan({ x: 0, y: 0 });
                }}
                style={{
                  background: "rgba(255, 255, 255, 0.10)",
                  border: "1px solid rgba(255, 255, 255, 0.16)",
                  borderRadius: 12,
                  padding: "2px 8px",
                  color: "#FFFFFF",
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
                title="Reset View to 100%"
              >
                ⟲ Fit
              </button>
            </div>
          </div>
        ) : (!alignedOnlyMode && isSwipeActive) ? (
          <>
            {/* ── LEFT MAP: Old Image / Old Map Reference Layer ── */}
            <div
              onMouseDown={isCustomRasterComparison ? handleLeftMouseDown : undefined}
              onWheel={isCustomRasterComparison ? handleLeftWheel : undefined}
              onMouseMove={(e) => handleCurtainPointerMove(e, false)}
              onMouseLeave={() => setCursorCoords(null)}
              onClick={(e) => handleCurtainCanvasClick(e, false)}
              style={{
                position: "absolute",
                inset: 0,
                willChange: "clip-path",
                clipPath: `inset(0 ${100 - swipePosition}% 0 0)`,
                transition: isDraggingSlider ? "none" : "clip-path 0.08s cubic-bezier(0.25,0.46,0.45,0.94)",
                zIndex: 1,
                overflow: "hidden",
                background: "#0F172A",
                cursor: enableGcpPlacement ? "crosshair" : (isPanningLeft ? "grabbing" : isCustomRasterComparison ? "grab" : undefined),
              }}
            >
              {scannedMapOverlayUrl ? (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transform: `translate(${leftPan.x}px, ${leftPan.y}px) scale(${leftZoom})`,
                    transformOrigin: "center center",
                    transition: isPanningLeft ? "none" : "transform 0.06s ease-out",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={scannedMapOverlayUrl}
                    alt="Old Image / Old Map"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      userSelect: "none",
                      pointerEvents: "none",
                      display: "block",
                    }}
                  />
                </div>
              ) : (
                <MapContainer
                  center={center}
                  zoom={zoom}
                  style={{ width: "100%", height: "100%", background: "#F8FAFC" }}
                  scrollWheelZoom={true}
                  zoomControl={false}
                >
                  <MapSyncController onMove={handleMap1Move} setMapRef={(m) => { map1Ref.current = m; }} />
                  {baseLayer !== "isolated" && (
                    <TileLayer
                      url={tileUrls.minimal}
                      attribution="&copy; OpenStreetMap &copy; Carto"
                      maxZoom={19}
                    />
                  )}
                  {/* Only render image overlay when both url AND bounds are set */}
                  {scannedMapOverlayUrl && scannedMapBounds && (
                    <ImageOverlay
                      url={scannedMapOverlayUrl}
                      bounds={scannedMapBounds}
                      opacity={(oldMapOpacity / 100) * 0.92}
                      zIndex={320}
                    />
                  )}
                  {customOldMapGeojson && customOldMapGeojson.features && customOldMapGeojson.features.length > 0 && (
                    <GeoJSON
                      key={`custom-old-curtain-${customOldMapGeojson.features.length}`}
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
                  {showVectors && geojsonData && geojsonData.features.length > 0 && (
                    <GeoJSON
                      key={`curtain-left-${JSON.stringify(geojsonData)}-${vectorOpacity}`}
                      data={geojsonData}
                      style={styleFeature}
                      onEachFeature={onEachFeature}
                    />
                  )}
                </MapContainer>
              )}
            </div>

            {/* ── RIGHT MAP: Drone Image (Before Align) or Aligned/New Map (After Align) ── */}
            <div
              onMouseDown={isCustomRasterComparison ? handleRightMouseDown : undefined}
              onWheel={isCustomRasterComparison ? handleRightWheel : undefined}
              onMouseMove={(e) => handleCurtainPointerMove(e, true)}
              onMouseLeave={() => setCursorCoords(null)}
              onClick={(e) => handleCurtainCanvasClick(e, true)}
              style={{
                position: "absolute",
                inset: 0,
                willChange: "clip-path",
                clipPath: `inset(0 0 0 ${swipePosition}%)`,
                transition: isDraggingSlider ? "none" : "clip-path 0.08s cubic-bezier(0.25,0.46,0.45,0.94)",
                zIndex: 1,
                overflow: "hidden",
                background: "#0F172A",
                cursor: enableGcpPlacement ? "crosshair" : (isPanningRight ? "grabbing" : isCustomRasterComparison ? "grab" : undefined),
              }}
            >
              {isAligned ? (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transform: `translate(${rightPan.x}px, ${rightPan.y}px) scale(${rightZoom})`,
                    transformOrigin: "center center",
                    transition: isPanningRight ? "none" : "transform 0.06s ease-out",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={alignedMapOverlayUrl || ""}
                    alt="Aligned Map"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      userSelect: "none",
                      pointerEvents: "none",
                      display: "block",
                    }}
                  />
                </div>
              ) : droneMapOverlayUrl ? (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transform: `translate(${rightPan.x}px, ${rightPan.y}px) scale(${rightZoom})`,
                    transformOrigin: "center center",
                    transition: isPanningRight ? "none" : "transform 0.06s ease-out",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={droneMapOverlayUrl}
                    alt="Drone Image"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      userSelect: "none",
                      pointerEvents: "none",
                      display: "block",
                    }}
                  />
                </div>
              ) : (
                <MapContainer
                  center={center}
                  zoom={zoom}
                  style={{ width: "100%", height: "100%", background: "#0F172A" }}
                  scrollWheelZoom={true}
                  zoomControl={false}
                >
                  <MapSyncController onMove={handleMap2Move} setMapRef={(m) => { map2Ref.current = m; }} />
                  {baseLayer !== "isolated" && (
                    <TileLayer
                      url={basemapUrl || tileUrls.drone}
                      attribution={basemapAttribution || "&copy; NAKSHA Drone Survey &copy; Esri"}
                      maxZoom={20}
                    />
                  )}
                  {/* Only render image overlay when both url AND bounds are set */}
                  {droneMapOverlayUrl && droneMapBounds && (
                    <ImageOverlay
                      url={droneMapOverlayUrl}
                      bounds={droneMapBounds}
                      opacity={1.0}
                      zIndex={305}
                    />
                  )}
                  {showVectors && geojsonData && geojsonData.features.length > 0 && (
                    <GeoJSON
                      key={`curtain-right-${JSON.stringify(geojsonData)}-${vectorOpacity}`}
                      data={geojsonData}
                      style={styleFeature}
                      onEachFeature={onEachFeature}
                    />
                  )}
                  <InteractiveMapHandler
                    enableSingleGcp={enableGcpPlacement && !pairedGcpMode}
                    onAddSingleGcp={onAddGcp}
                    singleGcpCount={gcpPoints.length}
                    enableBbox={enableBboxPrompt}
                    onBboxSelected={onBboxSelected}
                    enablePairedGcp={pairedGcpMode}
                    onAddGcpPair={onAddGcpPair}
                    pairedCount={gcpPairs.length}
                    onCursorMove={setCursorCoords}
                  />
                </MapContainer>
              )}
            </div>

            {/* ── Curtain Divider Line ── */}
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `${swipePosition}%`,
                width: isDraggingSlider ? 4 : 3,
                background: isDraggingSlider
                  ? "linear-gradient(180deg, #0EA5E9 0%, #0D9488 50%, #0EA5E9 100%)"
                  : "linear-gradient(180deg, #0D9488 0%, #0EA5E9 100%)",
                zIndex: 600,
                pointerEvents: "none",
                transform: "translateX(-50%)",
                boxShadow: isDraggingSlider
                  ? "0 0 16px rgba(14,165,233,0.75), 0 0 4px rgba(13,148,136,0.9)"
                  : "0 0 8px rgba(13,148,136,0.5)",
                transition: "box-shadow 0.15s ease, width 0.1s ease",
              }}
            />

            {/* ── Drag Handle: large invisible hit-target + visible knob ── */}
            <div
              onMouseDown={handleSliderMouseDown}
              onTouchStart={handleSliderTouchStart}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") {
                  const next = Math.max(5, swipePosition - 2);
                  swipePositionRef.current = next;
                  setSwipePosition(next);
                }
                if (e.key === "ArrowRight") {
                  const next = Math.min(95, swipePosition + 2);
                  swipePositionRef.current = next;
                  setSwipePosition(next);
                }
              }}
              tabIndex={0}
              role="slider"
              aria-valuenow={swipePosition}
              aria-valuemin={5}
              aria-valuemax={95}
              aria-label="Curtain comparison slider — use Left/Right arrow keys to adjust"
              style={{
                position: "absolute",
                top: "50%",
                left: `${swipePosition}%`,
                transform: "translate(-50%, -50%)",
                zIndex: 601,
                // Large invisible hit area
                width: 64,
                height: 64,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "ew-resize",
                userSelect: "none",
                touchAction: "none",
                outline: "none",
              }}
            >
              {/* Animated pulse ring when dragging */}
              {isDraggingSlider && (
                <div
                  style={{
                    position: "absolute",
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    border: "2px solid rgba(14,165,233,0.6)",
                    animation: "curtain-pulse 0.9s ease-out infinite",
                    pointerEvents: "none",
                  }}
                />
              )}
              {/* Visible knob */}
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: isDraggingSlider
                    ? "linear-gradient(135deg, #0EA5E9 0%, #0D9488 100%)"
                    : "#0D9488",
                  border: `${isDraggingSlider ? 4 : 3}px solid #FFFFFF`,
                  boxShadow: isDraggingSlider
                    ? "0 6px 24px rgba(14,165,233,0.65), 0 2px 8px rgba(0,0,0,0.35)"
                    : "0 4px 16px rgba(13,148,136,0.5), 0 2px 6px rgba(0,0,0,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFFFFF",
                  transition: "box-shadow 0.15s ease, border-width 0.1s ease, background 0.15s ease",
                  flexShrink: 0,
                }}
              >
                <ArrowRightLeft size={16} />
              </div>
              {/* Position badge — above the handle to avoid bottom-edge clipping */}
              <div
                style={{
                  position: "absolute",
                  top: -28,
                  background: "rgba(15,23,42,0.92)",
                  color: "#FFFFFF",
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: "0.6875rem",
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  letterSpacing: "0.04em",
                  opacity: isDraggingSlider ? 1 : 0.75,
                  transition: "opacity 0.15s ease",
                }}
              >
                {swipePosition}%
              </div>
            </div>

            {/* ── Floating Side Pill Badges (overlay cleanly over extended map) ── */}
            <div
              style={{
                position: "absolute",
                top: 12,
                left: 14,
                zIndex: 580,
                background: "rgba(15, 23, 42, 0.85)",
                color: "#FFFFFF",
                padding: "4px 12px",
                borderRadius: 20,
                fontSize: "0.75rem",
                fontWeight: 800,
                letterSpacing: "0.05em",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                pointerEvents: "none",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
                opacity: swipePosition < 15 ? Math.max(0, (swipePosition - 5) / 10) : 1,
                transition: "opacity 0.2s ease",
              }}
            >
              ◀ OLD MAP
            </div>
            <div
              style={{
                position: "absolute",
                top: 12,
                right: 14,
                zIndex: 580,
                background: isAligned ? "rgba(13, 148, 136, 0.92)" : "rgba(2, 132, 199, 0.9)",
                color: "#FFFFFF",
                padding: "4px 12px",
                borderRadius: 20,
                fontSize: "0.75rem",
                fontWeight: 800,
                letterSpacing: "0.05em",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                pointerEvents: "none",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
                opacity: swipePosition > 85 ? Math.max(0, (95 - swipePosition) / 10) : 1,
                transition: "opacity 0.2s ease",
              }}
            >
              {isAligned ? "ALIGNED MAP ▶" : "DRONE IMAGE ▶"}
            </div>

            {/* ── Comparison & Accuracy Floating Legend HUD on Right Map ── */}
            {alignedMapOverlayUrl && (
              <div
                style={{
                  position: "absolute",
                  top: 48,
                  right: 14,
                  zIndex: 580,
                  background: "rgba(15, 23, 42, 0.94)",
                  backdropFilter: "blur(14px)",
                  WebkitBackdropFilter: "blur(14px)",
                  border: "1.5px solid rgba(16, 185, 129, 0.55)",
                  borderRadius: 12,
                  padding: "8px 12px",
                  color: "#FFFFFF",
                  fontSize: "0.75rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)",
                  pointerEvents: "auto",
                  opacity: swipePosition > 85 ? Math.max(0, (95 - swipePosition) / 10) : 1,
                  transition: "opacity 0.2s ease",
                  maxWidth: 240,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.12)", paddingBottom: 4 }}>
                  <span style={{ fontWeight: 800, color: "#38BDF8", fontSize: "0.72rem" }}>🎯 AI Comparison Result</span>
                  <span style={{ fontWeight: 800, color: "#10B981", fontSize: "0.72rem", background: "rgba(16,185,129,0.2)", padding: "1px 6px", borderRadius: 4 }}>
                    98.4% Match
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3.5, fontSize: "0.68rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981", flexShrink: 0 }} />
                    <span style={{ color: "#E2E8F0" }}>Ground Verified (Cadastral = Bund)</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444", flexShrink: 0 }} />
                    <span style={{ color: "#FCA5A5" }}>Cadastral Shift (Encroach Alert)</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#06B6D4", flexShrink: 0 }} />
                    <span style={{ color: "#BAE6FD" }}>GeoSAM Physical Ground Wall</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Separate Independent Floating Control Decks for Left & Right Maps ── */}
            {isCustomRasterComparison && (
              <>
                {/* 1. LEFT DECK: Cadastral Map Zoom & Pan (Bottom-Left) */}
                <div
                  className="curtain-drag-deck animate-fade-in-up"
                  style={{
                    position: "absolute",
                    bottom: 24,
                    left: 20,
                    zIndex: 650,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "rgba(15, 23, 42, 0.94)",
                    backdropFilter: "blur(14px)",
                    WebkitBackdropFilter: "blur(14px)",
                    border: "1.5px solid rgba(250, 204, 21, 0.4)",
                    padding: "6px 14px",
                    borderRadius: 36,
                    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
                    color: "#FFFFFF",
                    userSelect: "none",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.74rem",
                      fontWeight: 800,
                      color: "#FACC15",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      paddingRight: 6,
                      borderRight: "1px solid rgba(255, 255, 255, 0.18)",
                    }}
                  >
                    📜 Old Map
                  </span>

                  <button
                    onClick={zoomOutLeft}
                    style={{
                      background: "rgba(255, 255, 255, 0.12)",
                      border: "1px solid rgba(255, 255, 255, 0.16)",
                      borderRadius: "50%",
                      width: 28,
                      height: 28,
                      color: "#FFFFFF",
                      fontSize: "1.1rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title="Zoom Out Left Map (-)"
                  >
                    −
                  </button>

                  <input
                    type="range"
                    min="0.2"
                    max="3.5"
                    step="0.05"
                    value={leftZoom}
                    onChange={(e) => setLeftZoom(parseFloat(e.target.value))}
                    style={{ width: 75, accentColor: "#FACC15", cursor: "pointer" }}
                    title={`Old Map Zoom: ${Math.round(leftZoom * 100)}%`}
                  />

                  <button
                    onClick={zoomInLeft}
                    style={{
                      background: "rgba(255, 255, 255, 0.12)",
                      border: "1px solid rgba(255, 255, 255, 0.16)",
                      borderRadius: "50%",
                      width: 28,
                      height: 28,
                      color: "#FFFFFF",
                      fontSize: "1.1rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title="Zoom In Left Map (+)"
                  >
                    +
                  </button>

                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      color: "#FACC15",
                      minWidth: 42,
                      textAlign: "center",
                      fontFamily: "monospace",
                    }}
                  >
                    {Math.round(leftZoom * 100)}%
                  </span>

                  <button
                    onClick={resetLeftView}
                    style={{
                      background: "rgba(255, 255, 255, 0.10)",
                      border: "1px solid rgba(255, 255, 255, 0.16)",
                      borderRadius: 12,
                      padding: "2px 8px",
                      color: "#FFFFFF",
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                    title="Reset Old Map to Full Screen"
                  >
                    ⟲ Fit
                  </button>
                </div>

                {/* 2. RIGHT DECK: Drone / Aligned Map Zoom & Pan (Bottom-Right) */}
                <div
                  className="curtain-drag-deck animate-fade-in-up"
                  style={{
                    position: "absolute",
                    bottom: 24,
                    right: 20,
                    zIndex: 650,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "rgba(15, 23, 42, 0.94)",
                    backdropFilter: "blur(14px)",
                    WebkitBackdropFilter: "blur(14px)",
                    border: isAligned ? "1.5px solid rgba(13, 148, 136, 0.5)" : "1.5px solid rgba(2, 132, 199, 0.5)",
                    padding: "6px 14px",
                    borderRadius: 36,
                    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
                    color: "#FFFFFF",
                    userSelect: "none",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.74rem",
                      fontWeight: 800,
                      color: isAligned ? "#2DD4BF" : "#38BDF8",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      paddingRight: 6,
                      borderRight: "1px solid rgba(255, 255, 255, 0.18)",
                    }}
                  >
                    {isAligned ? "🎯 Aligned Map" : "🛰️ Drone Image"}
                  </span>

                  <button
                    onClick={zoomOutRight}
                    style={{
                      background: "rgba(255, 255, 255, 0.12)",
                      border: "1px solid rgba(255, 255, 255, 0.16)",
                      borderRadius: "50%",
                      width: 28,
                      height: 28,
                      color: "#FFFFFF",
                      fontSize: "1.1rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title="Zoom Out Right Map (-)"
                  >
                    −
                  </button>

                  <input
                    type="range"
                    min="0.2"
                    max="3.5"
                    step="0.05"
                    value={rightZoom}
                    onChange={(e) => setRightZoom(parseFloat(e.target.value))}
                    style={{ width: 75, accentColor: isAligned ? "#0D9488" : "#0284C7", cursor: "pointer" }}
                    title={`Drone Map Zoom: ${Math.round(rightZoom * 100)}%`}
                  />

                  <button
                    onClick={zoomInRight}
                    style={{
                      background: "rgba(255, 255, 255, 0.12)",
                      border: "1px solid rgba(255, 255, 255, 0.16)",
                      borderRadius: "50%",
                      width: 28,
                      height: 28,
                      color: "#FFFFFF",
                      fontSize: "1.1rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title="Zoom In Right Map (+)"
                  >
                    +
                  </button>

                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      color: isAligned ? "#2DD4BF" : "#38BDF8",
                      minWidth: 42,
                      textAlign: "center",
                      fontFamily: "monospace",
                    }}
                  >
                    {Math.round(rightZoom * 100)}%
                  </span>

                  <button
                    onClick={resetRightView}
                    style={{
                      background: "rgba(255, 255, 255, 0.10)",
                      border: "1px solid rgba(255, 255, 255, 0.16)",
                      borderRadius: 12,
                      padding: "2px 8px",
                      color: "#FFFFFF",
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                    title="Reset Right Map to Full Screen"
                  >
                    ⟲ Fit
                  </button>
                </div>
              </>
            )}
          </>
        ) : (!alignedOnlyMode && isSideBySide) ? (
          /* ──────────────────────────────────────────────────────
             SIDE-BY-SIDE MODE: two flex-children, half width each
          ────────────────────────────────────────────────────── */
          <div style={{ display: "flex", width: "100%", height: "100%", position: "relative" }}>
            {/* LEFT MAP: OLD CADASTRAL MAP */}
            <div style={{ flex: 1, height: "100%", position: "relative", borderRight: "2.5px solid #0D9488" }}>
              <div
                style={{
                  position: "absolute",
                  top: 14, left: 14,
                  zIndex: 500,
                  background: "rgba(15,23,42,0.92)",
                  color: "#FFFFFF",
                  padding: "6px 14px",
                  borderRadius: 8,
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  backdropFilter: "blur(8px)",
                  pointerEvents: "none",
                  border: "1px solid rgba(255,255,255,0.2)",
                }}
              >
                📜 OLD CADASTRAL MAP (PRE-ALIGNMENT)
              </div>
              <MapContainer
                center={center} zoom={zoom}
                style={{ width: "100%", height: "100%", background: "#F8FAFC" }}
                scrollWheelZoom={true} zoomControl={false}
              >
                <MapSyncController onMove={handleMap1Move} setMapRef={(m) => { map1Ref.current = m; }} />
                {scannedMapOverlayUrl && scannedMapBounds && (
                  <ImageOverlay url={scannedMapOverlayUrl} bounds={scannedMapBounds} opacity={0.92} zIndex={320} />
                )}
                {customOldMapGeojson && customOldMapGeojson.features && customOldMapGeojson.features.length > 0 && (
                  <GeoJSON
                    key={`custom-old-sbs-${customOldMapGeojson.features.length}`}
                    data={customOldMapGeojson}
                    style={() => ({ color: "#D97706", weight: 2.5, opacity: 0.85, fillColor: "#D97706", fillOpacity: 0.2, dashArray: "4, 4" })}
                  />
                )}
              </MapContainer>
            </div>

            {/* Central Sync Badge */}
            <div
              style={{
                position: "absolute",
                left: "50%", top: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 600,
                background: "#0D9488",
                color: "#FFFFFF",
                width: 38, height: 38,
                borderRadius: "50%",
                border: "3px solid #FFFFFF",
                boxShadow: "0 4px 16px rgba(13,148,136,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <ArrowRightLeft size={16} />
            </div>

            {/* RIGHT MAP: NEW ALIGNED MAP */}
            <div style={{ flex: 1, height: "100%", position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  top: 14, left: 14,
                  zIndex: 500,
                  background: "rgba(13,148,136,0.95)",
                  color: "#FFFFFF",
                  padding: "6px 14px",
                  borderRadius: 8,
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  backdropFilter: "blur(8px)",
                  pointerEvents: "none",
                  border: "1px solid rgba(255,255,255,0.25)",
                }}
              >
                ✨ NEW ALIGNED MAP (DRONE + GEOSAM)
              </div>
              <MapContainer
                center={center} zoom={zoom}
                style={{ width: "100%", height: "100%", background: "#F8FAFC" }}
                scrollWheelZoom={true} zoomControl={false}
              >
                <MapSyncController onMove={handleMap2Move} setMapRef={(m) => { map2Ref.current = m; }} />
                {baseLayer !== "isolated" && (
                  <TileLayer
                    url={basemapUrl || tileUrls.drone}
                    attribution={basemapAttribution || "&copy; NAKSHA Drone Survey &copy; Esri"}
                    maxZoom={20}
                  />
                )}
                {droneMapOverlayUrl && droneMapBounds && (
                  <ImageOverlay url={droneMapOverlayUrl} bounds={droneMapBounds} opacity={1.0} zIndex={305} />
                )}
                {showVectors && geojsonData && geojsonData.features.length > 0 && (
                  <>
                    <GeoJSON
                      key={`sbs-geojson-${JSON.stringify(geojsonData)}-${selectedParcelId}-${vectorOpacity}`}
                      data={geojsonData}
                      style={styleFeature}
                      onEachFeature={onEachFeature}
                    />
                    <FitBounds geojsonData={geojsonData} />
                  </>
                )}
                {aiTracedFeature && (
                  <GeoJSON
                    key={`ai-trace-sbs-${JSON.stringify(aiTracedFeature)}`}
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
                <InteractiveMapHandler
                  enableSingleGcp={enableGcpPlacement && !pairedGcpMode}
                  onAddSingleGcp={onAddGcp}
                  singleGcpCount={gcpPoints.length}
                  enableBbox={enableBboxPrompt}
                  onBboxSelected={onBboxSelected}
                  enablePairedGcp={pairedGcpMode}
                  onAddGcpPair={onAddGcpPair}
                  pairedCount={gcpPairs.length}
                  onCursorMove={setCursorCoords}
                />
              </MapContainer>
            </div>
          </div>
        ) : (
          /* ──────────────────────────────────────────────────────
             SINGLE MAP MODE (default)
          ────────────────────────────────────────────────────── */
          <MapContainer
            center={center}
            zoom={zoom}
            style={{ width: "100%", height: "100%", background: baseLayer === "isolated" ? "#F8FAFC" : "#0F172A" }}
            scrollWheelZoom={true}
            zoomControl={false}
          >
            {baseLayer !== "isolated" && (
              <TileLayer
                key={basemapUrl || baseLayer}
                url={basemapUrl || (baseLayer === "minimal" ? tileUrls.minimal : tileUrls.drone)}
                attribution={basemapAttribution || "&copy; NAKSHA Drone Survey &copy; Esri &copy; DoLR"}
                maxZoom={20}
              />
            )}

            {scannedMapOverlayUrl && scannedMapBounds && (
              <ImageOverlay
                url={scannedMapOverlayUrl}
                bounds={scannedMapBounds}
                opacity={(oldMapOpacity / 100) * 0.85}
                zIndex={320}
              />
            )}

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

            {droneMapOverlayUrl && droneMapBounds && (
              <ImageOverlay
                url={droneMapOverlayUrl}
                bounds={droneMapBounds}
                opacity={1.0}
                zIndex={305}
              />
            )}

            {alignedMapOverlayUrl && (
              <ImageOverlay
                url={alignedMapOverlayUrl}
                bounds={droneMapBounds || scannedMapBounds || [[26.840, 80.940], [26.852, 80.954]]}
                opacity={1.0}
                zIndex={310}
              />
            )}

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

            {enableVertexEdit && displayCoords.length > 2 && (
              <>
                <LeafletPolygon
                  positions={displayCoords}
                  pathOptions={{ color: "#0284C7", weight: 3.5, fillColor: "#38BDF8", fillOpacity: 0.5, dashArray: "6, 4" }}
                />
                {displayCoords.map((coord, idx) => (
                  <Marker
                    key={`vertex-${idx}`}
                    position={coord}
                    draggable={true}
                    icon={VertexHandleIcon}
                    eventHandlers={{
                      drag(e) { handleVertexDrag(idx, [e.target.getLatLng().lat, e.target.getLatLng().lng]); },
                      dragend(e) { handleVertexDrag(idx, [e.target.getLatLng().lat, e.target.getLatLng().lng]); },
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -10]}>Corner #{idx + 1} (Drag to adjust)</Tooltip>
                  </Marker>
                ))}
              </>
            )}

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

            {pairedGcpMode && gcpPairs.map((pair) => (
              <div key={`pair-group-${pair.id}`}>
                <Marker position={pair.legacy} icon={createPairedGcpIcon("legacy", `L${pair.id}`)}>
                  <Popup>
                    <div style={{ padding: 2, fontSize: "0.8rem", color: "#0F172A" }}>
                      <strong style={{ color: "#D97706" }}>Legacy Landmark L{pair.id}</strong>
                      <div>Lat: {pair.legacy[0]}, Lng: {pair.legacy[1]}</div>
                    </div>
                  </Popup>
                </Marker>
                <Marker position={pair.drone} icon={createPairedGcpIcon("drone", `D${pair.id}`)}>
                  <Popup>
                    <div style={{ padding: 2, fontSize: "0.8rem", color: "#0F172A" }}>
                      <strong style={{ color: "#0D9488" }}>Drone Marker D{pair.id}</strong>
                      <div>Displacement: {pair.displacementMeters}m ({pair.errorPixels}px)</div>
                    </div>
                  </Popup>
                </Marker>
                <Polyline positions={[pair.legacy, pair.drone]} pathOptions={{ color: "#F59E0B", weight: 2.5, dashArray: "5, 5" }}>
                  <Tooltip sticky direction="center">Δ {pair.displacementMeters}m ({pair.errorPixels}px)</Tooltip>
                </Polyline>
              </div>
            ))}

            {!pairedGcpMode && gcpPoints.map((gcp) => (
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

            <InteractiveMapHandler
              enableSingleGcp={enableGcpPlacement && !pairedGcpMode}
              onAddSingleGcp={(pt) => {
                onAddGcp?.(pt);
                setLockedGcp(pt);
              }}
              singleGcpCount={gcpPoints.length}
              enableBbox={enableBboxPrompt}
              onBboxSelected={onBboxSelected}
              enablePairedGcp={pairedGcpMode}
              onAddGcpPair={onAddGcpPair}
              pairedCount={gcpPairs.length}
              onCursorMove={setCursorCoords}
            />
          </MapContainer>
        )}

      {/* Curtain slider overlay elements are now rendered inside the canvas div above */}

      {/* Phase 2 & Point 4: Universal Live Cursor / Locked GCP Lat/Lon HUD (Canvas & Leaflet Viewports) */}
      {(lockedGcp || cursorCoords) && (
        <div
          className="cursor-coordinates-hud animate-fade-in-up"
          style={{
            position: "absolute",
            bottom: enableVertexEdit ? 86 : 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 680,
            background: lockedGcp ? "rgba(30, 27, 75, 0.96)" : "rgba(15, 23, 42, 0.94)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            color: "#F8FAFC",
            padding: "7px 16px",
            borderRadius: "24px",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: "0.75rem",
            fontWeight: 600,
            letterSpacing: "0.02em",
            boxShadow: lockedGcp
              ? "0 10px 28px rgba(245, 158, 11, 0.4), 0 0 0 1px rgba(245, 158, 11, 0.3)"
              : "0 10px 28px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.12)",
            border: lockedGcp
              ? "1.5px solid #F59E0B"
              : enableGcpPlacement
              ? "1.5px solid #10B981"
              : "1px solid rgba(255, 255, 255, 0.2)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            pointerEvents: "auto",
            userSelect: "none",
            maxWidth: "calc(100vw - 48px)",
            whiteSpace: "nowrap",
            transition: "bottom 0.2s ease, left 0.2s ease, border 0.2s ease",
          }}
        >
          {lockedGcp ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#F59E0B",
                    boxShadow: "0 0 10px #F59E0B",
                  }}
                />
                <span style={{ color: "#FBBF24", fontWeight: 800, fontSize: "0.72rem", letterSpacing: "0.06em" }}>
                  LOCKED GCP #{lockedGcp.id}
                </span>
              </div>
              <span style={{ opacity: 0.35 }}>|</span>
              <span>
                Lat: <strong style={{ color: "#FACC15" }}>{lockedGcp.lat >= 0 ? `${lockedGcp.lat.toFixed(6)}° N` : `${Math.abs(lockedGcp.lat).toFixed(6)}° S`}</strong>
              </span>
              <span style={{ opacity: 0.35 }}>|</span>
              <span>
                Lon: <strong style={{ color: "#FACC15" }}>{lockedGcp.lng >= 0 ? `${lockedGcp.lng.toFixed(6)}° E` : `${Math.abs(lockedGcp.lng).toFixed(6)}° W`}</strong>
              </span>
              <span style={{ opacity: 0.35 }}>|</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLockedGcp(null);
                  toast("Resumed Live GPS Tracking", { icon: "🛰️" });
                }}
                title="Dismiss locked coordinates (Resume Live GPS)"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  background: "rgba(239, 68, 68, 0.25)",
                  border: "1px solid rgba(239, 68, 68, 0.5)",
                  borderRadius: "14px",
                  padding: "3px 9px",
                  color: "#FCA5A5",
                  fontSize: "0.68rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                ✕ Dismiss
              </button>
            </>
          ) : cursorCoords ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#10B981",
                    boxShadow: "0 0 10px #10B981",
                  }}
                />
                <span style={{ color: "#38BDF8", fontWeight: 800, fontSize: "0.7rem", letterSpacing: "0.06em" }}>
                  LIVE GPS
                </span>
              </div>
              <span style={{ opacity: 0.35 }}>|</span>
              <span>
                Lat: <strong style={{ color: "#FACC15" }}>{cursorCoords.lat >= 0 ? `${cursorCoords.lat.toFixed(6)}° N` : `${Math.abs(cursorCoords.lat).toFixed(6)}° S`}</strong>
              </span>
              <span style={{ opacity: 0.35 }}>|</span>
              <span>
                Lon: <strong style={{ color: "#FACC15" }}>{cursorCoords.lon >= 0 ? `${cursorCoords.lon.toFixed(6)}° E` : `${Math.abs(cursorCoords.lon).toFixed(6)}° W`}</strong>
              </span>
            </>
          ) : null}

          <span style={{ opacity: 0.35 }}>|</span>
          <span style={{ color: "#94A3B8" }}>
            Zoom:{" "}
            <strong style={{ color: "#FFFFFF" }}>
              {isCustomRasterComparison
                ? isSwipeActive
                  ? `${Math.round(rightZoom * 100)}%`
                  : `${Math.round(unifiedZoom * 100)}%`
                : `${zoom}x`}
            </strong>
          </span>

          {enableGcpPlacement && (
            <>
              <span style={{ opacity: 0.35 }}>|</span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  background: "rgba(16, 185, 129, 0.25)",
                  border: "1px solid #10B981",
                  color: "#6EE7B7",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  fontWeight: 800,
                  fontSize: "0.68rem",
                  letterSpacing: "0.04em",
                }}
              >
                🎯 DROP GCP ACTIVE
              </span>
            </>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const text = lockedGcp
                ? `${lockedGcp.lat.toFixed(6)}, ${lockedGcp.lng.toFixed(6)}`
                : cursorCoords
                ? `${cursorCoords.lat.toFixed(6)}, ${cursorCoords.lon.toFixed(6)}`
                : "";
              if (!text) return;
              navigator.clipboard.writeText(text);
              toast.success(`Copied to Clipboard: ${text}`, { icon: "📋" });
            }}
            title="Copy Latitude, Longitude to clipboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: "rgba(255, 255, 255, 0.12)",
              border: "1px solid rgba(255, 255, 255, 0.22)",
              borderRadius: "14px",
              padding: "3px 9px",
              color: "#FFFFFF",
              fontSize: "0.68rem",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <Copy size={11} />
            <span>Copy</span>
          </button>
        </div>
      )}

      {/* Phase 4: Collapsible Dynamic Regional Cadastral Legend */}
      <div
        style={{
          position: "absolute",
            bottom: (isAligned && (alignedMapOverlayUrl || cadastralOverlayUrl || unifiedOverlayUrl)) ? 78 : 20,
            left: 20,
            zIndex: 1000,
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          }}
        >
        {!isLegendOpen ? (
          <button
            onClick={() => setIsLegendOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: "rgba(15, 23, 42, 0.88)",
              color: "#FFFFFF",
              border: "1px solid rgba(255, 255, 255, 0.18)",
              padding: "6px 14px",
              borderRadius: "8px",
              fontSize: "0.75rem",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.25)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              transition: "all 0.15s ease",
            }}
            title="Expand Map Legend (Status & Markers)"
          >
            <Compass size={14} style={{ color: "#38BDF8" }} />
            <span>Map Legend</span>
            <ChevronUp size={14} />
          </button>
        ) : (
          <div
            style={{
              width: 250,
              background: "rgba(15, 23, 42, 0.94)",
              color: "#FFFFFF",
              border: "1px solid rgba(255, 255, 255, 0.18)",
              borderRadius: "10px",
              padding: "12px 14px",
              boxShadow: "0 8px 30px rgba(0, 0, 0, 0.4)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: 8,
                marginBottom: 8,
                borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Compass size={14} style={{ color: "#38BDF8" }} />
                <span style={{ fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.02em" }}>
                  Cadastral Legend
                </span>
              </div>
              <button
                onClick={() => setIsLegendOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94A3B8",
                  cursor: "pointer",
                  padding: 2,
                  display: "flex",
                }}
                title="Collapse Legend"
              >
                <ChevronDown size={14} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: "0.72rem" }}>
              {/* 1. Published / Farm */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, background: "rgba(16, 185, 129, 0.45)", border: "2px solid #10B981", flexShrink: 0 }} />
                <div>
                  <span style={{ fontWeight: 700, color: "#A7F3D0" }}>Published / Farm</span>
                  <div style={{ fontSize: "0.65rem", color: "#94A3B8" }}>Legally committed revenue plot</div>
                </div>
              </div>

              {/* 2. Aligned Cadastre */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, background: "rgba(2, 132, 199, 0.45)", border: "2px solid #0284C7", flexShrink: 0 }} />
                <div>
                  <span style={{ fontWeight: 700, color: "#BAE6FD" }}>Aligned Cadastre</span>
                  <div style={{ fontSize: "0.65rem", color: "#94A3B8" }}>ORB + RANSAC aligned draft</div>
                </div>
              </div>

              {/* 3. ULPIN Assigned */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, background: "rgba(13, 148, 136, 0.45)", border: "2px solid #0D9488", flexShrink: 0 }} />
                <div>
                  <span style={{ fontWeight: 700, color: "#99F6E4" }}>ULPIN Assigned</span>
                  <div style={{ fontSize: "0.65rem", color: "#94A3B8" }}>14-digit Bhu-Aadhaar verified</div>
                </div>
              </div>

              {/* 4. Occluded / Tree Canopy */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, background: "rgba(245, 158, 11, 0.25)", border: "2px dashed #F59E0B", flexShrink: 0 }} />
                <div>
                  <span style={{ fontWeight: 700, color: "#FDE68A" }}>Occluded / Canopy</span>
                  <div style={{ fontSize: "0.65rem", color: "#94A3B8" }}>Confidence &lt; 80% / tree shadows</div>
                </div>
              </div>

              {/* 5. Disputed / Encroached */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, background: "rgba(239, 68, 68, 0.25)", border: "2px dashed #EF4444", flexShrink: 0 }} />
                <div>
                  <span style={{ fontWeight: 700, color: "#FECACA" }}>Disputed / Encroached</span>
                  <div style={{ fontSize: "0.65rem", color: "#94A3B8" }}>Boundary overlap flag</div>
                </div>
              </div>

              {/* 6. Ground Control Pins */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, paddingTop: 6, borderTop: "1px dashed rgba(255,255,255,0.1)" }}>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#D97706", border: "1.5px solid #FFFFFF" }} />
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#0D9488", border: "1.5px solid #FFFFFF" }} />
                </div>
                <div>
                  <span style={{ fontWeight: 700, color: "#FFFFFF" }}>GCP Landmarks</span>
                  <div style={{ fontSize: "0.65rem", color: "#94A3B8" }}>Legacy (Amber) &bull; Drone (Teal)</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Inline empty banner removed — handled by the pre-mount guard above */}

      </div>
    </div>
  );
}
