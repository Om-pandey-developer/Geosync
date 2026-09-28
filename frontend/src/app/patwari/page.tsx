"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  ScanLine,
  Layers,
  MapPin,
  RefreshCw,
  Info,
  Sparkles,
  AlertTriangle,
  Pin,
  Send,
  Sliders,
  CheckCircle2,
  Copy,
  Zap,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Move,
  RotateCcw,
  Check,
  ArrowRightLeft,
  SplitSquareVertical,
  Building2,
  Search,
  X,
  UploadCloud,
  FolderUp,
  LogOut,
  Shield,
  ChevronRight,
  Eye,
} from "lucide-react";
import type { FeatureCollection } from "geojson";
import type { GCPPoint, GCPPair } from "@/components/MapViewer";
import { formatAlignmentStatus } from "@/lib/statusHelper";
import { useAuth } from "@/lib/authContext";

const MapViewer = dynamic(() => import("@/components/MapViewer"), { ssr: false });
import MapSourceModal, { BASEMAP_PRESETS, BasemapOption } from "@/components/MapSourceModal";
import RoleGuard from "@/components/RoleGuard";
import { API } from "@/lib/api";

interface ParcelSummary {
  id: string;
  khasra_no: string;
  owner_name: string;
  village: string;
  tehsil?: string;
  alignment_status: string;
  ulpin: string | null;
  area_sqm: number | null;
  alignment_confidence?: number | null;
}

// Geodesic Polygon Area Calculator (Shoelace metric formula)
function computePolygonAreaSqm(coords: [number, number][]): number {
  if (!coords || coords.length < 3) return 0;
  const centerLat = coords.reduce((acc, c) => acc + c[0], 0) / coords.length;
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * Math.cos((centerLat * Math.PI) / 180);

  let area = 0;
  const n = coords.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const x1 = coords[i][1] * mPerDegLon;
    const y1 = coords[i][0] * mPerDegLat;
    const x2 = coords[j][1] * mPerDegLon;
    const y2 = coords[j][0] * mPerDegLat;
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

export default function PatwariPage() {
  const { officer, logout } = useAuth();
  const router = useRouter();
  const [isCurtainSwipeActive, setIsCurtainSwipeActive] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRosterOpen, setIsRosterOpen] = useState(false);
  const [rosterSearch, setRosterSearch] = useState("");
  const [rosterFilter, setRosterFilter] = useState("ALL");

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("patwari-sidebar-state-changed", { detail: { isOpen: false } }));
    }
  }, []);

  const openSidebar = useCallback(() => {
    setIsSidebarOpen(true);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("patwari-sidebar-state-changed", { detail: { isOpen: true } }));
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsRosterOpen(false);
    setIsSidebarOpen((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("patwari-sidebar-state-changed", { detail: { isOpen: next } }));
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const handleToggle = () => toggleSidebar();
    const handleOpen = () => openSidebar();
    const handleClose = () => closeSidebar();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSidebar();
    };

    window.addEventListener("toggle-patwari-sidebar", handleToggle);
    window.addEventListener("open-patwari-sidebar", handleOpen);
    window.addEventListener("close-patwari-sidebar", handleClose);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("toggle-patwari-sidebar", handleToggle);
      window.removeEventListener("open-patwari-sidebar", handleOpen);
      window.removeEventListener("close-patwari-sidebar", handleClose);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [toggleSidebar, openSidebar, closeSidebar]);

  const [parcels, setParcels] = useState<ParcelSummary[]>([]);
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activePipelineStep, setActivePipelineStep] = useState<number>(1);
  const [isDossierCollapsed, setIsDossierCollapsed] = useState(false);


  // Old Map & New Map Source Layer Controls
  const [isMapSourceModalOpen, setIsMapSourceModalOpen] = useState(false);
  const [activeBasemap, setActiveBasemap] = useState<BasemapOption>(BASEMAP_PRESETS[0]);
  const [activeOldMapPresetId, setActiveOldMapPresetId] = useState<string>("mohanlalganj-1974");
  const [customOldMapGeojson, setCustomOldMapGeojson] = useState<FeatureCollection | null>(null);
  const [scannedMapOverlayUrl, setScannedMapOverlayUrl] = useState<string | null>(
    "/demo_datasets/mohanlalganj_1974_cadastral_cloth_map.png"
  );
  const [oldMapOpacity, setOldMapOpacity] = useState<number>(80);
  const [oldMapStrokeColor, setOldMapStrokeColor] = useState<string>("#D97706");

  useEffect(() => {
    const handleOpenModal = () => setIsMapSourceModalOpen(true);
    window.addEventListener("open-map-source-modal", handleOpenModal);
    return () => window.removeEventListener("open-map-source-modal", handleOpenModal);
  }, []);

  // Task 2.4: Paired GCP Landmark State
  const [enableGcpPlacement, setEnableGcpPlacement] = useState(false);
  const [pairedGcpMode, setPairedGcpMode] = useState(true);
  const [gcpPoints, setGcpPoints] = useState<GCPPoint[]>([
    { id: 1, lat: 26.7612, lng: 80.8998, label: "GCP-1 (Survey Pillar A)" },
    { id: 2, lat: 26.7628, lng: 80.9034, label: "GCP-2 (Road Intersection)" },
  ]);
  const [gcpPairs, setGcpPairs] = useState<GCPPair[]>([
    {
      id: 1,
      label: "Sector A (North Boundary Stone)",
      legacy: [26.761, 80.8995],
      drone: [26.7612, 80.8998],
      displacementMeters: 2.42,
      errorPixels: 48.4,
    },
    {
      id: 2,
      label: "Sector B (Chak Road Junction)",
      legacy: [26.7625, 80.903],
      drone: [26.7628, 80.9034],
      displacementMeters: 3.15,
      errorPixels: 63.0,
    },
  ]);
  const [showCalibrationDrawer, setShowCalibrationDrawer] = useState(false);

  // Task 2.2: Vertex Corner Drag Mode (HITL)
  const [isVertexEditMode, setIsVertexEditMode] = useState(false);
  const [activeVertexCoords, setActiveVertexCoords] = useState<[number, number][]>([]);
  const [originalVertexCoords, setOriginalVertexCoords] = useState<[number, number][]>([]);
  const [currentAreaSqm, setCurrentAreaSqm] = useState<number>(0);
  const [originalAreaSqm, setOriginalAreaSqm] = useState<number>(0);

  // Task 2.3: GeoSAM Bounding Box Prompt & AI Trace
  const [enableBboxPrompt, setEnableBboxPrompt] = useState(false);
  const [aiTracedFeature, setAiTracedFeature] = useState<any>(null);
  const [geosamResult, setGeosamResult] = useState<{
    confidence: number;
    isOccluded: boolean;
    reason: string | null;
    inferenceMs: number;
    shadowRatio?: number;
    canopyRatio?: number;
    modelBackbone?: string;
    deviceAccelerator?: string;
  } | null>(null);

  // Asynchronous Village Batch Alignment
  const [batchProgress, setBatchProgress] = useState<{
    isRunning: boolean;
    batchId: string | null;
    total: number;
    completed: number;
    failed: number;
    status: string;
  }>({
    isRunning: false,
    batchId: null,
    total: 0,
    completed: 0,
    failed: 0,
    status: "IDLE",
  });

  const startBatchAlignment = async () => {
    setBatchProgress({
      isRunning: true,
      batchId: null,
      total: 0,
      completed: 0,
      failed: 0,
      status: "QUEUED",
    });
    const tId = toast.loading("Queuing asynchronous batch alignment for Ward 12 Mohanlalganj...");

    try {
      const res = await fetch(`${API}/v1/align-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ village: "Mohanlalganj", max_parcels: 50 }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Batch alignment failed to initialize");
      }
      const data = await res.json();
      const batchId = data.batch_id;

      setBatchProgress({
        isRunning: true,
        batchId: batchId,
        total: data.total_parcels,
        completed: 0,
        failed: 0,
        status: "PROCESSING",
      });

      toast.success(
        `Batch job initiated for ${data.total_parcels} parcels! Running in background...`,
        { id: tId }
      );

      // Poll progress every 1.2s
      const pollInterval = setInterval(async () => {
        try {
          const pollRes = await fetch(`${API}/v1/align-batch/${batchId}`);
          if (pollRes.ok) {
            const pData = await pollRes.json();
            setBatchProgress((prev) => ({
              ...prev,
              total: pData.total,
              completed: pData.completed,
              failed: pData.failed,
              status: pData.status,
            }));

            if (pData.status === "COMPLETED" || pData.status === "FAILED") {
              clearInterval(pollInterval);
              setBatchProgress((prev) => ({ ...prev, isRunning: false }));
              await fetchData();
              toast.success(
                `Batch alignment finished! Processed ${pData.completed}/${pData.total} parcels.`
              );
            }
          }
        } catch {
          // ignore transient poll error
        }
      }, 1200);
    } catch (err: any) {
      toast.error(err.message || "Failed to start batch alignment", { id: tId });
      setBatchProgress((prev) => ({ ...prev, isRunning: false, status: "ERROR" }));
    }
  };

  const fetchData = async () => {
    try {
      const [parcelsRes, geojsonRes] = await Promise.all([
        fetch(`${API}/parcels`),
        fetch(`${API}/parcels/geojson`),
      ]);
      if (!parcelsRes.ok || !geojsonRes.ok) throw new Error("Data fetch error");
      setParcels(await parcelsRes.json());
      setGeojson(await geojsonRes.json());
    } catch {
      toast.error("Connecting to local offline fallback database...", { duration: 2500 });
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedParcel = useMemo(
    () => parcels.find((p) => p.id === selectedId),
    [parcels, selectedId]
  );

  const filteredRosterParcels = useMemo(() => {
    return parcels.filter((p) => {
      const q = rosterSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.khasra_no.toLowerCase().includes(q) ||
        p.owner_name.toLowerCase().includes(q) ||
        (p.ulpin && p.ulpin.toLowerCase().includes(q));

      if (!matchesSearch) return false;
      if (rosterFilter === "ALL") return true;
      if (rosterFilter === "DRAFT") return p.alignment_status === "raw" || p.alignment_status === "DRAFT";
      if (rosterFilter === "ALIGNED") return p.alignment_status.includes("aligned") || p.alignment_status === "ALIGNED_DRAFT";
      if (rosterFilter === "ULPIN") return Boolean(p.ulpin);
      return true;
    });
  }, [parcels, rosterSearch, rosterFilter]);

  // When parcel selection changes, initialize vertex coords
  useEffect(() => {
    if (selectedId && geojson) {
      const feat = geojson.features.find((f: any) => f.properties?.id === selectedId);
      if (feat && feat.geometry && feat.geometry.type === "Polygon") {
        const ring = (feat.geometry as any).coordinates[0] || [];
        const latLngs: [number, number][] = ring.map((pt: [number, number]) => [pt[1], pt[0]]);
        setActiveVertexCoords(latLngs);
        setOriginalVertexCoords(latLngs);
        const area = computePolygonAreaSqm(latLngs);
        setOriginalAreaSqm(area);
        setCurrentAreaSqm(area);
      }
    } else {
      setIsVertexEditMode(false);
    }
  }, [selectedId, geojson]);

  // Handle Vertex Dragging (Task 2.2)
  const handleVertexChange = (coords: [number, number][]) => {
    setActiveVertexCoords(coords);
    const newArea = computePolygonAreaSqm(coords);
    setCurrentAreaSqm(newArea);
  };

  const handleSaveVertexChanges = () => {
    if (!selectedId || !geojson) return;
    const delta = currentAreaSqm - originalAreaSqm;
    // Update local geojson feature geometry
    setGeojson((prev) => {
      if (!prev) return prev;
      const updated = { ...prev };
      updated.features = updated.features.map((f: any) => {
        if (f.properties?.id === selectedId) {
          const newRing = activeVertexCoords.map((pt) => [pt[1], pt[0]]);
          return {
            ...f,
            geometry: {
              ...f.geometry,
              coordinates: [newRing],
            },
            properties: {
              ...f.properties,
              area_sqm: Number(currentAreaSqm.toFixed(1)),
            },
          };
        }
        return f;
      });
      return updated;
    });

    setIsVertexEditMode(false);
    setOriginalAreaSqm(currentAreaSqm);
    setOriginalVertexCoords(activeVertexCoords);
    toast.success(
      `Boundary locked! New Area: ${currentAreaSqm.toFixed(1)} m² (ΔArea: ${delta >= 0 ? "+" : ""}${delta.toFixed(1)} m²)`
    );
  };

  const handleResetVertices = () => {
    setActiveVertexCoords(originalVertexCoords);
    setCurrentAreaSqm(originalAreaSqm);
    toast("Corners restored to original cadastral vertices", { icon: "↩️" });
  };

  // Handle Paired GCP Add (Task 2.4)
  const handleAddGcpPair = (pair: GCPPair) => {
    if (gcpPairs.length >= 8) {
      toast("Maximum 8 GCP landmark pairs reached for this sector.", { icon: "ℹ️" });
      return;
    }
    setGcpPairs((prev) => [...prev, pair]);
    toast.success(
      `Linked ${pair.label}: Δ ${pair.displacementMeters}m (${pair.errorPixels}px error)`
    );
  };

  // Handle Single GCP Add
  const handleAddSingleGcp = (pt: GCPPoint) => {
    if (gcpPoints.length >= 6) {
      toast("Maximum 6 Ground Control Points reached for this sector.", { icon: "ℹ️" });
      return;
    }
    setGcpPoints((prev) => [...prev, pt]);
    toast.success(`Dropped ${pt.label} at [${pt.lat}, ${pt.lng}]`);
  };

  // Task 2.3: Handle GeoSAM Bounding Box Prompt Selected
  const handleBboxSelected = async (bbox: [number, number, number, number]) => {
    setLoading(true);
    setEnableBboxPrompt(false);
    const tId = toast.loading("GeoSAM ViT-H: Zero-shot boundary segmentation inside bbox...");

    try {
      const activeFeature = geojson?.features.find((f: any) => f.properties?.id === selectedId);

      const res = await fetch(`${API}/v1/extract-boundaries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bbox: bbox,
          legacy_polygon: activeFeature?.geometry || null,
        }),
      });

      if (!res.ok) throw new Error("GeoSAM extraction failed");
      const data = await res.json();

      setAiTracedFeature(data.feature);
      setGeosamResult({
        confidence: data.confidence_score,
        isOccluded: data.is_occluded,
        reason: data.occlusion_reason,
        inferenceMs: data.inference_time_ms,
        shadowRatio: data.shadow_ratio,
        canopyRatio: data.canopy_ratio,
        modelBackbone: data.model_backbone,
        deviceAccelerator: data.device_accelerator,
      });

      if (data.is_occluded) {
        toast(
          `Occlusion Flagged! Shadow: ${(Number(data.shadow_ratio || 0) * 100).toFixed(0)}%, Canopy: ${(Number(data.canopy_ratio || 0) * 100).toFixed(0)}%. ${data.occlusion_reason}`,
          { icon: "⚠️", id: tId, duration: 2200 }
        );
      } else {
        toast.success(
          `GeoAI boundary traced in ${data.inference_time_ms.toFixed(1)}ms! Confidence: ${(data.confidence_score * 100).toFixed(1)}%`,
          { id: tId }
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Boundary extraction error", { id: tId });
    }
    setLoading(false);
  };

  // Step 2: Global ORB+RANSAC Alignment
  const runAlign = async () => {
    if (!selectedId) return toast("Select a parcel polygon on the map first", { icon: "ℹ️" });
    setLoading(true);
    setActivePipelineStep(2);
    const tId = toast.loading("Executing ORB feature detection & RANSAC homography...");
    try {
      const res = await fetch(`${API}/align/${selectedId}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Aligned! RANSAC inlier ratio: ${(data.confidence * 100).toFixed(1)}%`, { id: tId });
        await fetchData();
      } else {
        toast.error(data.detail || "Alignment failed", { id: tId });
      }
    } catch {
      toast.error("Network error executing alignment", { id: tId });
    }
    setLoading(false);
  };

  // Step 3: GeoSAM Zero-Shot Boundary Extraction (Default Center Bbox)
  const runGeoSamExtraction = async () => {
    if (!selectedId) return toast("Select a parcel polygon first", { icon: "ℹ️" });
    setLoading(true);
    setActivePipelineStep(3);
    const tId = toast.loading("GeoSAM ViT-B: Zero-shot boundary segmentation (<10ms)...");

    try {
      const activeFeature = geojson?.features.find((f: any) => f.properties?.id === selectedId);

      const res = await fetch(`${API}/v1/extract-boundaries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bbox: [80.899, 26.759, 80.903, 26.762],
          legacy_polygon: activeFeature?.geometry || null,
        }),
      });

      if (!res.ok) throw new Error("GeoSAM extraction failed");
      const data = await res.json();

      setAiTracedFeature(data.feature);
      setGeosamResult({
        confidence: data.confidence_score,
        isOccluded: data.is_occluded,
        reason: data.occlusion_reason,
        inferenceMs: data.inference_time_ms,
        shadowRatio: data.shadow_ratio,
        canopyRatio: data.canopy_ratio,
        modelBackbone: data.model_backbone,
        deviceAccelerator: data.device_accelerator,
      });

      if (data.is_occluded) {
        toast(
          `Occlusion Warning! Shadow: ${(Number(data.shadow_ratio || 0) * 100).toFixed(0)}%, Canopy: ${(Number(data.canopy_ratio || 0) * 100).toFixed(0)}%. ${data.occlusion_reason}`,
          { icon: "⚠️", id: tId, duration: 2200 }
        );
      } else {
        toast.success(
          `Boundaries extracted in ${data.inference_time_ms.toFixed(1)}ms! Confidence: ${(data.confidence_score * 100).toFixed(1)}%`,
          { id: tId }
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Boundary extraction error", { id: tId });
    }
    setLoading(false);
  };

  // Step 4 & 5: Topological Cleansing + Base-14 ULPIN Generation
  const runCleanupAndUlpin = async () => {
    if (!selectedId) return toast("Select a parcel polygon first", { icon: "ℹ️" });
    setLoading(true);
    setActivePipelineStep(4);
    const tId = toast.loading("Applying PostGIS ST_Difference & ST_Snap (0.05m)...");

    try {
      const activeFeature = geojson?.features.find((f: any) => f.properties?.id === selectedId);

      // ST_Difference + ST_Snap
      const cleanRes = await fetch(`${API}/v1/topology-cleanup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geometry_geojson: activeFeature?.geometry }),
      });
      if (!cleanRes.ok) throw new Error("Topology cleanup failed");

      // Stage 5: Base-14 ULPIN
      setActivePipelineStep(5);
      const ulpinRes = await fetch(`${API}/v1/generate-ulpin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parcel_id: selectedId }),
      });
      if (!ulpinRes.ok) throw new Error("ULPIN generation failed");
      const ulpinData = await ulpinRes.json();

      toast.success(`Cleaned & Assigned Bhu-Aadhaar: ${ulpinData.ulpin}`, { id: tId });
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Pipeline error", { id: tId });
    }
    setLoading(false);
  };

  // Submit to Tehsildar for HITL Approval
  const submitForApproval = async () => {
    if (!selectedId) return toast("Select a parcel first", { icon: "ℹ️" });
    setLoading(true);
    const tId = toast.loading("Routing parcel to Tehsildar legal approval queue...");
    try {
      const res = await fetch(`${API}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parcel_id: selectedId,
          requested_by: "patwari_mohanlalganj",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Transmitted to Magistrate docket (ID: ${data.id.slice(0, 8)}…)`, { id: tId });
        await fetchData();
      } else {
        toast.error(data.detail || "Submission failed", { id: tId });
      }
    } catch {
      toast.error("Failed to connect to approval service", { id: tId });
    }
    setLoading(false);
  };

  const copyUlpin = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Bhu-Aadhaar (ULPIN) copied to clipboard!");
  };

  // Calculate sector RMSE for paired GCPs
  const sectorRmseMeters = useMemo(() => {
    if (gcpPairs.length === 0) return 0;
    const sumSq = gcpPairs.reduce((acc, p) => acc + p.displacementMeters * p.displacementMeters, 0);
    return Math.sqrt(sumSq / gcpPairs.length);
  }, [gcpPairs]);

  const deltaArea = currentAreaSqm - originalAreaSqm;
  const deltaPercent = originalAreaSqm > 0 ? (deltaArea / originalAreaSqm) * 100 : 0;

  return (
    <RoleGuard requiredRole="patwari">
      <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }}>
        <h1 className="sr-only">Revenue Patwari Geospatial Harmonization Workspace</h1>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ────────────── CADASTRAL TOOLS DROPDOWN MENU (OPENS ON ARROW CLICK) ────────────── */}
      {isSidebarOpen && (
        <>
          {/* Transparent Backdrop to dismiss dropdown on outside click */}
          <div
            onClick={closeSidebar}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1040,
              background: "transparent",
              cursor: "default",
            }}
          />

          <div
            className="animate-dropdown"
            style={{
              position: "fixed",
              top: 118,
              left: 14,
              width: 310,
              maxHeight: "calc(100vh - 136px)",
              background: "#FFFFFF",
              border: "1.5px solid var(--border-glass)",
              borderRadius: "var(--radius-lg)",
              zIndex: 1050,
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 16px 40px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(15, 23, 42, 0.08)",
              overflowY: "auto",
            }}
          >
        {/* 1. Header: Tools Suite Title + Close Button */}
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--border-subtle)",
            background: "linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "var(--accent-primary-bg)",
                border: "1px solid #99F6E4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent-primary)",
                boxShadow: "0 1px 4px rgba(13, 148, 136, 0.15)",
              }}
            >
              <Zap size={16} />
            </div>
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                Cadastral Tools Menu
              </div>
              <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", fontWeight: 500 }}>
                Select an action to apply on map
              </div>
            </div>
          </div>

          {/* Close Button to dismiss sidebar */}
          <button
            onClick={closeSidebar}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 30,
              height: 30,
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-subtle)",
              background: "#F1F5F9",
              color: "var(--text-secondary)",
              cursor: "pointer",
              transition: "all 0.15s ease",
              flexShrink: 0,
            }}
            title="Close Sidebar (✕)"
            aria-label="Close Sidebar"
          >
            <X size={16} />
          </button>
        </div>

        {/* 2. Step 1: Uploading the Maps (Distorted Old Map & New Map) */}
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <FolderUp size={13} style={{ color: "var(--accent-primary)" }} />
            <span>Step 1: Map Uploads</span>
          </div>

          <button
            onClick={() => {
              setIsMapSourceModalOpen(true);
              closeSidebar();
            }}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "9px 12px",
              borderRadius: "var(--radius-md)",
              background: "#F0FDFA",
              border: "1.5px solid #99F6E4",
              color: "#0F766E",
              fontWeight: 700,
              fontSize: "0.8125rem",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            title="Upload Distorted Old Map (BhuNaksha Scan / GeoJSON) & New Map (Drone Orthomosaic)"
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <UploadCloud size={16} style={{ color: "#0D9488" }} />
              <div style={{ textAlign: "left" }}>
                <div>Upload Maps</div>
                <div style={{ fontSize: "0.6875rem", color: "#0D9488", fontWeight: 500 }}>
                  Distorted Old & New Map
                </div>
              </div>
            </div>
            <ChevronRight size={15} style={{ color: "#0D9488" }} />
          </button>
        </div>


        {/* 4. Core Processing Tools (In Exact Order) */}
        <div style={{ padding: "14px 16px", flex: 1 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <Zap size={13} style={{ color: "var(--accent-primary)" }} />
            <span>Step 2: Processing Tools</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {/* 1. Align (ORB) */}
            <button
              className="sidebar-tool-btn"
              onClick={() => {
                runAlign();
                closeSidebar();
              }}
              disabled={loading || !selectedId}
              title="1. Automated ORB feature detection & RANSAC homography"
            >
              <ScanLine size={15} style={{ color: "var(--accent-primary)" }} />
              <span>Align (ORB)</span>
            </button>

            {/* 2. Drop GCP */}
            <button
              className={`sidebar-tool-btn ${enableGcpPlacement ? "active" : ""}`}
              onClick={() => {
                const next = !enableGcpPlacement;
                setEnableGcpPlacement(next);
                if (next) {
                  toast(
                    pairedGcpMode
                      ? "Click 1: Legacy landmark → Click 2: Drone marker"
                      : "Click on map to drop GCP point",
                    { icon: "📍", duration: 2200 }
                  );
                }
                closeSidebar();
              }}
              title="2. Place Ground Control Points (GCPs) on landmarks"
            >
              <Pin size={15} style={{ color: enableGcpPlacement ? "#0D9488" : "var(--accent-gold)" }} />
              <span>Drop GCP {enableGcpPlacement ? "(Active)" : ""}</span>
            </button>

            {/* 3. 4-5 Clean & ULPIN */}
            <button
              className="sidebar-tool-btn"
              onClick={() => {
                runCleanupAndUlpin();
                closeSidebar();
              }}
              disabled={loading || !selectedId}
              title="3. PostGIS topology overlap removal & Base-14 ULPIN generation"
            >
              <Layers size={15} style={{ color: "var(--accent-primary)" }} />
              <span>4-5 Clean & ULPIN</span>
            </button>

            {/* 4. TPS Warping */}
            <button
              className="sidebar-tool-btn"
              onClick={() => {
                setShowCalibrationDrawer(true);
                closeSidebar();
              }}
              title="4. Thin-Plate Spline non-linear rubber sheeting for paper distortions"
            >
              <Sliders size={15} style={{ color: "var(--accent-sky)" }} />
              <span>TPS Warping ({pairedGcpMode ? `${gcpPairs.length} pairs` : `${gcpPoints.length} pts`})</span>
            </button>

            {/* 5. GEOSAM */}
            <button
              className="sidebar-tool-btn"
              onClick={() => {
                runGeoSamExtraction();
                closeSidebar();
              }}
              disabled={loading || !selectedId}
              title="5. Meta Segment Anything (GeoSAM) zero-shot boundary delineation"
            >
              <Sparkles size={15} style={{ color: "#7C3AED" }} />
              <span>GEOSAM</span>
            </button>


            {/* 7. Batch Align */}
            <button
              className="sidebar-tool-btn"
              onClick={() => {
                startBatchAlignment();
                closeSidebar();
              }}
              disabled={loading || batchProgress.isRunning}
              title="7. Asynchronously align all draft parcels in Ward 12"
            >
              <Zap size={15} className={batchProgress.isRunning ? "animate-spin" : ""} style={{ color: "#D97706" }} />
              <span>
                Batch Align {batchProgress.isRunning ? `(${batchProgress.completed}/${batchProgress.total})` : ""}
              </span>
            </button>
          </div>

          {/* 5. Special Feature: Curtain Swipe (Split-View Slider) */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <SplitSquareVertical size={13} style={{ color: "var(--accent-primary)" }} />
              <span>Step 3: Verification (Swipe)</span>
            </div>

            <div style={{ background: "var(--bg-secondary)", padding: "10px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
              <button
                onClick={() => {
                  setIsCurtainSwipeActive(!isCurtainSwipeActive);
                  closeSidebar();
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "8px 10px",
                  borderRadius: "var(--radius-sm)",
                  border: isCurtainSwipeActive ? "1.5px solid #0D9488" : "1px solid var(--border-glass)",
                  background: isCurtainSwipeActive ? "#0D9488" : "#FFFFFF",
                  color: isCurtainSwipeActive ? "#FFFFFF" : "var(--text-primary)",
                  fontWeight: 700,
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  marginBottom: 8,
                }}
              >
                <SplitSquareVertical size={14} />
                <span>{isCurtainSwipeActive ? "Curtain Swipe: ON" : "Curtain Swipe"}</span>
              </button>

              <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", lineHeight: 1.35 }}>
                ◀ <strong>Old Map</strong> | <strong>Drone Map</strong> ▶
                <br />
                Swipe slider left/right to verify aligned boundaries with Cadastre overlay.
              </div>
            </div>
          </div>
        </div>

        {/* 6. Footer: Signout Button */}
        <div style={{ padding: "14px 16px", borderTop: "1px solid var(--border-subtle)", background: "#F8FAFC" }}>
          <button
            onClick={() => {
              logout();
              router.push("/");
            }}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: "var(--radius-md)",
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              color: "#DC2626",
              fontWeight: 700,
              fontSize: "0.8125rem",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            title="Step 4: Sign out of Patwari session"
          >
            <LogOut size={15} />
            <span>Signout</span>
          </button>
        </div>
          </div>
        </>
      )}

      {/* Map Canvas - Full Width */}
      <div style={{ width: "100%", height: "calc(100vh - 68px)", position: "absolute", top: 68, left: 0, zIndex: 10 }}>
        <MapViewer
          geojsonData={geojson}
          selectedParcelId={selectedId}
          onParcelClick={(id) => {
            setSelectedId(id);
            setGeosamResult(null);
            setIsDossierCollapsed(false);
          }}
          enableGcpPlacement={enableGcpPlacement && !pairedGcpMode}
          gcpPoints={gcpPoints}
          onAddGcp={handleAddSingleGcp}
          pairedGcpMode={pairedGcpMode && enableGcpPlacement}
          gcpPairs={gcpPairs}
          onAddGcpPair={handleAddGcpPair}
          showOcclusionAlerts={true}
          enableCurtainSwipe={isCurtainSwipeActive}
          // Task 2.2: Vertex Editing
          enableVertexEdit={isVertexEditMode}
          activePolygonCoords={activeVertexCoords}
          onVertexChange={handleVertexChange}
          aiTracedFeature={aiTracedFeature}
          aiTraceConfidence={geosamResult?.confidence}
          isOccluded={geosamResult?.isOccluded}
          // Old Map & New Map Source Layer Controls
          basemapUrl={activeBasemap.url}
          basemapAttribution={activeBasemap.attribution}
          basemapName={activeBasemap.name}
          customOldMapGeojson={customOldMapGeojson}
          scannedMapOverlayUrl={scannedMapOverlayUrl}
          oldMapOpacity={oldMapOpacity}
          oldMapStrokeColor={oldMapStrokeColor}
          onOpenMapSourceModal={() => setIsMapSourceModalOpen(true)}
          leftSlot={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Patwari Name Box (Single Dropdown Arrow) */}
              <button
                onClick={toggleSidebar}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 12px",
                  borderRadius: "var(--radius-sm)",
                  background: isSidebarOpen ? "#CCFBF1" : "var(--accent-primary-bg)",
                  border: isSidebarOpen ? "1.5px solid #0D9488" : "1px solid #99F6E4",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                }}
                title={isSidebarOpen ? "Close Tools Sidebar" : "Open Tools Sidebar"}
                aria-label="Toggle Patwari Tools Sidebar"
              >
                {/* Avatar Badge */}
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #0D9488 0%, #0F766E 100%)",
                    color: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.72rem",
                    fontWeight: 900,
                    border: "1px solid #99F6E4",
                    flexShrink: 0,
                  }}
                >
                  RK
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 800, color: "#0F766E" }}>
                    {officer?.name || "Ramesh Kumar Sharma"}
                  </span>
                  <span
                    style={{
                      fontSize: "0.625rem",
                      fontWeight: 800,
                      padding: "1px 5px",
                      borderRadius: 4,
                      background: "#0D9488",
                      color: "#FFFFFF",
                    }}
                  >
                    PATWARI
                  </span>
                </div>

                {/* Only ONE single dropdown arrow */}
                <ChevronDown
                  size={15}
                  style={{
                    color: "#0D9488",
                    transform: isSidebarOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                  }}
                />
              </button>

              <div style={{ width: 1, height: 20, background: "var(--border-subtle)", flexShrink: 0 }} />

              {/* Parcel Roster Toggle */}
              <button
                onClick={() => {
                  setIsRosterOpen((prev) => {
                    const next = !prev;
                    if (next) setIsSidebarOpen(false);
                    return next;
                  });
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "5px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: isRosterOpen ? "1px solid var(--border-glass)" : "1.5px solid var(--accent-primary-light)",
                  background: isRosterOpen ? "var(--bg-secondary)" : "#F0FDFA",
                  color: isRosterOpen ? "var(--text-secondary)" : "var(--accent-primary)",
                  fontSize: "0.8125rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                }}
                title={isRosterOpen ? "Hide Halqa Mohanlalganj Parcel Roster" : "Open Halqa Mohanlalganj Parcel Roster"}
              >
                {isRosterOpen ? <X size={14} /> : <Building2 size={15} style={{ color: "var(--accent-primary)" }} />}
                <span>{isRosterOpen ? "Hide Roster" : `Parcel Roster (${parcels.length})`}</span>
              </button>
            </div>
          }
        />
      </div>

      {/* ───── Task 2.2: Floating Vertex HITL Calibration HUD (Responsive & Compact) ───── */}
      {isVertexEditMode && selectedParcel && (
        <div
          className="glass-card animate-fade-in-up"
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            padding: "8px 14px",
            background: "rgba(15, 23, 42, 0.96)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            color: "#FFFFFF",
            borderRadius: "var(--radius-lg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            boxShadow: "0 12px 35px rgba(0, 0, 0, 0.45)",
            border: "1.5px solid rgba(56, 189, 248, 0.6)",
            maxWidth: "calc(100vw - 32px)",
            width: "max-content",
            boxSizing: "border-box",
          }}
        >
          {/* Khasra Indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#38BDF8", animation: "pulse 1.5s infinite" }} />
            <span style={{ fontWeight: 800, fontSize: "0.8125rem", color: "#FFFFFF", letterSpacing: "0.01em" }}>
              Khasra {selectedParcel.khasra_no}
            </span>
            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: 700,
                padding: "1px 6px",
                borderRadius: 4,
                background: "rgba(56, 189, 248, 0.2)",
                color: "#38BDF8",
                border: "1px solid rgba(56, 189, 248, 0.4)",
              }}
            >
              Calibration
            </span>
          </div>

          <div style={{ width: 1, height: 18, background: "rgba(255, 255, 255, 0.2)", flexShrink: 0 }} />

          {/* Area Readout */}
          <div style={{ fontSize: "0.78rem", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <span style={{ color: "#94A3B8" }}>Area:</span>
            <strong style={{ color: "#FFFFFF" }}>{currentAreaSqm.toFixed(1)} m²</strong>
            <span
              style={{
                fontWeight: 700,
                fontSize: "0.72rem",
                color: Math.abs(deltaArea) < 0.1 ? "#94A3B8" : deltaArea > 0 ? "#38BDF8" : "#F59E0B",
              }}
            >
              ({deltaArea >= 0 ? "+" : ""}{deltaArea.toFixed(1)} m² / {deltaPercent >= 0 ? "+" : ""}{deltaPercent.toFixed(1)}%)
            </span>
          </div>

          <div style={{ width: 1, height: 18, background: "rgba(255, 255, 255, 0.2)", flexShrink: 0 }} />

          {/* Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <button
              onClick={handleResetVertices}
              className="btn-secondary"
              style={{
                padding: "4px 8px",
                fontSize: "0.75rem",
                background: "rgba(255, 255, 255, 0.1)",
                color: "#FFFFFF",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                cursor: "pointer",
              }}
              title="Reset corners to original shape"
            >
              <RotateCcw size={11} />
              <span>Reset</span>
            </button>
            <button
              onClick={handleSaveVertexChanges}
              className="btn-primary"
              style={{
                padding: "5px 12px",
                fontSize: "0.75rem",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                whiteSpace: "nowrap",
                flexShrink: 0,
                cursor: "pointer",
                background: "#0D9488",
                border: "1px solid #99F6E4",
              }}
              title="Lock and save calibrated boundary coordinates"
            >
              <Check size={12} />
              <span>Lock Boundary</span>
            </button>
          </div>
        </div>
      )}

      {/* ───── Top Left: Halqa Mohanlalganj Parcel Roster ───── */}
      {isRosterOpen && (
        <div
          className="glass-card animate-fade-in-up"
          style={{
            position: "absolute",
            top: 80,
            left: 20,
            zIndex: 430,
            width: 326,
            maxHeight: "calc(100vh - 160px)",
            display: "flex",
            flexDirection: "column",
            background: "rgba(255, 255, 255, 0.98)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.14)",
            border: "1.5px solid var(--border-glass)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "var(--radius-sm)",
                  background: "var(--accent-primary-bg)",
                  border: "1px solid #99F6E4",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--accent-primary)",
                }}
              >
                <Building2 size={18} />
              </div>
              <div>
                <span style={{ fontSize: "0.9375rem", fontWeight: 800, color: "var(--text-primary)" }}>
                  Halqa Parcel Roster
                </span>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>
                  Ward 12 Mohanlalganj &bull; {parcels.length} parcels
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsRosterOpen(false)}
              className="btn-ghost"
              style={{ padding: 4, color: "var(--text-primary)" }}
              title="Close Roster"
              aria-label="Close Roster"
            >
              <X size={18} />
            </button>
          </div>

          {/* Search Box & Filters */}
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)", background: "#FFFFFF" }}>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                placeholder="Search Khasra or owner..."
                style={{
                  width: "100%",
                  padding: "7px 10px 7px 32px",
                  fontSize: "0.8125rem",
                  borderRadius: "var(--radius-md)",
                  border: "1.5px solid var(--border-glass)",
                }}
              />
              <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            </div>

            {/* Filter Pills */}
            <div style={{ display: "flex", gap: 4, marginTop: 8, overflowX: "auto", paddingBottom: 2 }}>
              {[
                { id: "ALL", label: `All (${parcels.length})` },
                { id: "DRAFT", label: "Draft" },
                { id: "ALIGNED", label: "Aligned" },
                { id: "ULPIN", label: "Bhu-Aadhaar" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setRosterFilter(f.id)}
                  style={{
                    padding: "3px 8px",
                    borderRadius: 999,
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    border: rosterFilter === f.id ? "1px solid var(--accent-primary)" : "1px solid var(--border-glass)",
                    background: rosterFilter === f.id ? "var(--accent-primary)" : "#FFFFFF",
                    color: rosterFilter === f.id ? "#FFFFFF" : "var(--text-secondary)",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable Parcel List */}
          <div style={{ flex: 1, overflowY: "auto", padding: "6px" }}>
            {filteredRosterParcels.map((p) => {
              const isSelected = selectedId === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    setSelectedId(p.id);
                    setGeosamResult(null);
                    setIsDossierCollapsed(false);
                  }}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "var(--radius-md)",
                    marginBottom: 4,
                    background: isSelected ? "var(--accent-primary-bg)" : "transparent",
                    border: isSelected ? "1.5px solid #99F6E4" : "1px solid transparent",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.background = "var(--bg-secondary)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <strong style={{ fontSize: "0.875rem", color: "var(--text-primary)" }}>
                      Khasra {p.khasra_no}
                    </strong>
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: "var(--radius-sm)",
                        background: p.ulpin ? "var(--accent-mint-bg)" : "var(--bg-secondary)",
                        color: p.ulpin ? "var(--accent-mint)" : "var(--text-secondary)",
                        border: p.ulpin ? "1px solid #A7F3D0" : "1px solid var(--border-subtle)",
                      }}
                    >
                      {formatAlignmentStatus(p.alignment_status)}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 2, fontWeight: 500 }}>
                    {p.owner_name}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>
                    {p.area_sqm ? `${Number(p.area_sqm).toFixed(1)} m²` : "Area uncalculated"} &bull; {p.village}
                  </div>
                </div>
              );
            })}

            {filteredRosterParcels.length === 0 && (
              <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.8125rem" }}>
                No matching parcels in current filter.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───── Top Right: Collapsible Parcel Dossier ───── */}
      <div
        className="glass-card animate-fade-in-up"
        style={{
          position: "absolute",
          top: 80,
          right: 20,
          zIndex: 400,
          width: 350,
          maxHeight: "calc(100vh - 160px)",
          overflowY: "auto",
          padding: isDossierCollapsed ? "12px 18px" : "18px 20px",
          background: "rgba(255, 255, 255, 0.98)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 8px 30px rgba(15, 23, 42, 0.12)",
          transition: "all 0.2s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
            <MapPin size={18} style={{ color: "var(--accent-primary)" }} /> Parcel Dossier
          </h2>

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              onClick={fetchData}
              className="btn-ghost"
              style={{ padding: 6, color: "var(--text-primary)" }}
              title="Reload Cadastral Data"
              aria-label="Reload Cadastral Data"
            >
              <RefreshCw size={15} />
            </button>
            <button
              onClick={() => setIsDossierCollapsed(!isDossierCollapsed)}
              className="btn-ghost"
              style={{ padding: 6, color: "var(--text-primary)" }}
              title={isDossierCollapsed ? "Expand Dossier" : "Minimize Dossier"}
              aria-label={isDossierCollapsed ? "Expand Dossier" : "Minimize Dossier"}
            >
              {isDossierCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </button>
          </div>
        </div>

        {!isDossierCollapsed && (
          <div style={{ marginTop: 14 }}>
            {selectedParcel ? (
              <div style={{ fontSize: "0.875rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: "8px 12px", marginBottom: 12 }}>
                  <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Khasra No:</span>
                  <strong style={{ color: "var(--text-primary)" }}>{selectedParcel.khasra_no}</strong>

                  <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Landholder:</span>
                  <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{selectedParcel.owner_name}</span>

                  <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Location:</span>
                  <span style={{ color: "var(--text-secondary)" }}>{selectedParcel.village}, Mohanlalganj</span>

                  <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Status:</span>
                  <span
                    style={{
                      textTransform: "uppercase",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      padding: "3px 8px",
                      background: "var(--accent-primary-bg)",
                      color: "var(--accent-primary)",
                      borderRadius: "var(--radius-sm)",
                      width: "fit-content",
                    }}
                  >
                    {formatAlignmentStatus(selectedParcel.alignment_status)}
                  </span>

                  <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Parcel Area:</span>
                  <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                    {currentAreaSqm > 0 ? currentAreaSqm.toFixed(1) : Number(selectedParcel.area_sqm || 0).toFixed(1)} m²
                  </span>
                </div>

                {/* Task 2.2: Manual Corner Drag Handle (HITL) */}
                <div style={{ marginBottom: 12 }}>
                  <button
                    onClick={() => {
                      const next = !isVertexEditMode;
                      setIsVertexEditMode(next);
                      if (next) {
                        toast("Corner Drag Mode Active: Drag any blue corner handle to adjust boundaries", {
                          icon: "📐",
                          duration: 2200,
                        });
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                      border: isVertexEditMode ? "1.5px solid #0284C7" : "1px solid #BAE6FD",
                      background: isVertexEditMode ? "#E0F2FE" : "#F0F9FF",
                      color: isVertexEditMode ? "#0369A1" : "#0284C7",
                      fontWeight: 700,
                      fontSize: "0.8125rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    title="Manually adjust parcel corners by dragging vertex handles on map"
                  >
                    <Move size={15} />
                    <span>{isVertexEditMode ? "Exit Corner Drag Mode" : "Manual Corner Drag Handle (HITL)"}</span>
                  </button>
                </div>

                {/* Radiometric Spectral Analysis Card */}
                {geosamResult && (
                  <div
                    style={{
                      marginBottom: 12,
                      padding: "10px 12px",
                      borderRadius: "var(--radius-md)",
                      background: geosamResult.isOccluded ? "var(--accent-sun-bg)" : "var(--accent-mint-bg)",
                      border: `1px solid ${geosamResult.isOccluded ? "#FDE68A" : "#A7F3D0"}`,
                      fontSize: "0.8125rem",
                      color: geosamResult.isOccluded ? "#92400E" : "#065F46",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
                        {geosamResult.isOccluded ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                        <span>GeoSAM AI Boundary ({geosamResult.inferenceMs.toFixed(1)}ms)</span>
                      </div>
                      <span style={{ fontSize: "0.7rem", fontWeight: 700 }}>
                        {geosamResult.modelBackbone || "Meta-SAM"}
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
                      <div style={{ background: "rgba(255, 255, 255, 0.7)", padding: "4px 8px", borderRadius: 4 }}>
                        <div style={{ fontSize: "0.68rem", opacity: 0.8 }}>Ground Shadow</div>
                        <div style={{ fontSize: "0.82rem", fontWeight: 800 }}>
                          {((geosamResult.shadowRatio ?? 0) * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div style={{ background: "rgba(255, 255, 255, 0.7)", padding: "4px 8px", borderRadius: 4 }}>
                        <div style={{ fontSize: "0.68rem", opacity: 0.8 }}>Tree Canopy</div>
                        <div style={{ fontSize: "0.82rem", fontWeight: 800 }}>
                          {((geosamResult.canopyRatio ?? 0) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 6, fontSize: "0.75rem" }}>
                      Confidence: <strong>{(geosamResult.confidence * 100).toFixed(1)}%</strong>
                      {geosamResult.reason && ` • ${geosamResult.reason}`}
                    </div>
                  </div>
                )}

                {/* Bhu-Aadhaar (ULPIN) Badge */}
                {selectedParcel.ulpin && (
                  <div style={{ marginBottom: 12, padding: "12px", background: "var(--accent-primary-bg)", border: "1px solid #99F6E4", borderRadius: "var(--radius-md)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--accent-primary)", textTransform: "uppercase" }}>
                        Bhu-Aadhaar (ULPIN Base-14)
                      </span>
                      <button onClick={() => copyUlpin(selectedParcel.ulpin!)} className="btn-ghost" style={{ padding: 2 }}>
                        <Copy size={14} style={{ color: "var(--accent-primary)" }} />
                      </button>
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: "1.1rem", fontWeight: 800, color: "var(--accent-primary)", letterSpacing: "1.5px", textAlign: "center" }}>
                      {selectedParcel.ulpin}
                    </div>
                  </div>
                )}

                {/* HITL Statutory Legal Approval: Send to Tehsildar */}
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed var(--border-subtle)" }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 6, fontWeight: 600 }}>
                    Statutory Clearance Pipeline:
                  </div>
                  <button
                    className="btn-primary"
                    onClick={submitForApproval}
                    disabled={loading}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      fontSize: "0.8125rem",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      background: "linear-gradient(135deg, #1E3A8A 0%, #172554 100%)",
                      borderColor: "#1E3A8A",
                      color: "#FFFFFF",
                      boxShadow: "0 2px 8px rgba(30, 58, 138, 0.25)",
                    }}
                    title="Transmit aligned cadastral record to Tehsildar Court for final statutory decree"
                  >
                    <Send size={15} />
                    <span>Send to Tehsildar for HITL Approval</span>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)", display: "flex", gap: 10, alignItems: "center", background: "var(--bg-secondary)", padding: 14, borderRadius: "var(--radius-md)" }}>
                <Info size={22} style={{ color: "var(--accent-primary)", flexShrink: 0 }} />
                <span>Click any parcel polygon on the map to inspect records and trigger alignment pipelines.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ───── Task 2.4: Upgraded Thin-Plate Splines & Paired GCP Modal ───── */}
      {showCalibrationDrawer && (
        <div
          className="animate-fade-in-up"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(15, 23, 42, 0.5)",
            zIndex: 1050,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(6px)",
          }}
        >
          <div
            className="glass-card"
            style={{
              width: "780px",
              maxWidth: "94vw",
              background: "#FFFFFF",
              padding: "24px 28px",
              borderRadius: "var(--radius-lg)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)" }}>
                    GCP Landmark Calibration & Thin-Plate Splines (TPS)
                  </h2>
                </div>
                <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: 2 }}>
                  Dual-click landmark correspondence links legacy paper landmarks with 5cm drone features.
                </p>
              </div>
              <button onClick={() => setShowCalibrationDrawer(false)} className="btn-ghost" style={{ padding: "6px 12px" }}>
                ✕
              </button>
            </div>

            {/* Mode Switcher: Paired vs Single */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 8, background: "var(--bg-secondary)", padding: 4, borderRadius: "var(--radius-md)" }}>
                <button
                  onClick={() => setPairedGcpMode(true)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    background: pairedGcpMode ? "var(--accent-primary)" : "transparent",
                    color: pairedGcpMode ? "#FFFFFF" : "var(--text-secondary)",
                    fontWeight: 700,
                    fontSize: "0.8125rem",
                    cursor: "pointer",
                  }}
                >
                  Paired Landmarks (Click 1 → Click 2)
                </button>
                <button
                  onClick={() => setPairedGcpMode(false)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    background: !pairedGcpMode ? "var(--accent-primary)" : "transparent",
                    color: !pairedGcpMode ? "#FFFFFF" : "var(--text-secondary)",
                    fontWeight: 700,
                    fontSize: "0.8125rem",
                    cursor: "pointer",
                  }}
                >
                  Single Control Points
                </button>
              </div>

              {/* Real-time Sector RMSE Readout (Task 2.4) */}
              {pairedGcpMode && (
                <div style={{ padding: "4px 12px", background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: "6px", color: "#92400E", fontSize: "0.8125rem", fontWeight: 700 }}>
                  Sector RMSE: <strong>{sectorRmseMeters.toFixed(2)} meters</strong> ({(sectorRmseMeters / 0.05).toFixed(1)} px)
                </div>
              )}
            </div>

            {/* Paired Landmark Table */}
            {pairedGcpMode ? (
              <div style={{ maxHeight: 240, overflowY: "auto", marginBottom: 16, border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)" }}>
                <table style={{ width: "100%", fontSize: "0.8125rem", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-subtle)" }}>
                      <th style={{ padding: "8px 12px", color: "var(--text-primary)" }}>Pair</th>
                      <th style={{ padding: "8px 12px", color: "var(--text-primary)" }}>Feature Description</th>
                      <th style={{ padding: "8px 12px", color: "var(--text-primary)" }}>Legacy Cadastre (L#)</th>
                      <th style={{ padding: "8px 12px", color: "var(--text-primary)" }}>Drone Ground (D#)</th>
                      <th style={{ padding: "8px 12px", color: "var(--text-primary)" }}>Displacement</th>
                      <th style={{ padding: "8px 12px", color: "var(--text-primary)" }}>Residual Error</th>
                      <th style={{ padding: "8px 12px", color: "var(--text-primary)" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gcpPairs.map((pair) => (
                      <tr key={pair.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td style={{ padding: "8px 12px", fontWeight: 700 }}>#{pair.id}</td>
                        <td style={{ padding: "8px 12px" }}>{pair.label}</td>
                        <td style={{ padding: "8px 12px", fontFamily: "monospace", color: "#D97706" }}>
                          [{pair.legacy[0].toFixed(5)}, {pair.legacy[1].toFixed(5)}]
                        </td>
                        <td style={{ padding: "8px 12px", fontFamily: "monospace", color: "#0D9488" }}>
                          [{pair.drone[0].toFixed(5)}, {pair.drone[1].toFixed(5)}]
                        </td>
                        <td style={{ padding: "8px 12px", fontWeight: 700 }}>
                          {pair.displacementMeters} m
                        </td>
                        <td style={{ padding: "8px 12px", color: "#0284C7", fontWeight: 700 }}>
                          {pair.errorPixels} px
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <button
                            onClick={() => setGcpPairs(gcpPairs.filter((p) => p.id !== pair.id))}
                            style={{ border: "none", background: "none", color: "var(--accent-coral)", cursor: "pointer", fontWeight: 700 }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ maxHeight: 220, overflowY: "auto", marginBottom: 16, border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)" }}>
                <table style={{ width: "100%", fontSize: "0.875rem", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-subtle)" }}>
                      <th style={{ padding: "10px 14px", color: "var(--text-primary)" }}>ID</th>
                      <th style={{ padding: "10px 14px", color: "var(--text-primary)" }}>Landmark Label</th>
                      <th style={{ padding: "10px 14px", color: "var(--text-primary)" }}>Drone Latitude</th>
                      <th style={{ padding: "10px 14px", color: "var(--text-primary)" }}>Drone Longitude</th>
                      <th style={{ padding: "10px 14px", color: "var(--text-primary)" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gcpPoints.map((gcp) => (
                      <tr key={gcp.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 700 }}>#{gcp.id}</td>
                        <td style={{ padding: "10px 14px" }}>{gcp.label}</td>
                        <td style={{ padding: "10px 14px", fontFamily: "monospace" }}>{gcp.lat.toFixed(6)}</td>
                        <td style={{ padding: "10px 14px", fontFamily: "monospace" }}>{gcp.lng.toFixed(6)}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <button
                            onClick={() => setGcpPoints(gcpPoints.filter((p) => p.id !== gcp.id))}
                            style={{ border: "none", background: "none", color: "var(--accent-coral)", cursor: "pointer", fontWeight: 700 }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  setEnableGcpPlacement(true);
                  setShowCalibrationDrawer(false);
                  toast(
                    pairedGcpMode
                      ? "Click 1 on old cadastre landmark, then Click 2 on drone marker"
                      : "Click on map to drop GCP points",
                    { icon: "📍", duration: 2200 }
                  );
                }}
              >
                + Place Landmarks on Map
              </button>

              <button
                className="btn-primary"
                onClick={async () => {
                  setLoading(true);
                  const tId = toast.loading("Computing Thin-Plate Spline non-linear surface...");
                  try {
                    const formattedGcps = pairedGcpMode
                      ? gcpPairs.map((p) => ({
                          source_lon: p.legacy[1],
                          source_lat: p.legacy[0],
                          target_lon: p.drone[1],
                          target_lat: p.drone[0],
                        }))
                      : gcpPoints.map((p) => ({
                          source_lon: p.lng - 0.0003,
                          source_lat: p.lat - 0.0002,
                          target_lon: p.lng,
                          target_lat: p.lat,
                        }));

                    const activeFeature = geojson?.features.find((f: any) => f.properties?.id === selectedId);
                    const parcelCoords = (activeFeature?.geometry as any)?.coordinates || [
                      [[80.899, 26.76], [80.902, 26.76], [80.902, 26.762], [80.899, 26.762], [80.899, 26.76]],
                    ];

                    const res = await fetch(`${API}/v1/align-map`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        legacy_coordinates: parcelCoords,
                        gcps: formattedGcps,
                      }),
                    });
                    if (!res.ok) {
                      const errData = await res.json().catch(() => ({}));
                      throw new Error(errData.detail || "TPS calculation error");
                    }
                    const data = await res.json();
                    toast.success(
                      `TPS Warping complete! Confidence: ${data.confidence_score}% (Method: ${data.diagnostics?.gcp_method || "TPS"})`,
                      { id: tId }
                    );

                    // Update selected parcel boundary in local view if available
                    if (selectedId && data.aligned_geojson) {
                      setGeojson((prev) => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          features: prev.features.map((f: any) =>
                            f.properties?.id === selectedId
                              ? { ...f, geometry: data.aligned_geojson }
                              : f
                          ),
                        };
                      });
                    }

                    setShowCalibrationDrawer(false);
                    await fetchData();
                  } catch (err: any) {
                    toast.error(err.message || "TPS computation failed", { id: tId });
                  }
                  setLoading(false);
                }}
              >
                Apply TPS Warping ({pairedGcpMode ? `${gcpPairs.length} Pairs` : `${gcpPoints.length} Points`})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Old Map & New Map Source Layer Configuration Modal */}
      <MapSourceModal
        isOpen={isMapSourceModalOpen}
        onClose={() => setIsMapSourceModalOpen(false)}
        activeBasemapId={activeBasemap.id}
        onSelectBasemap={(b) => setActiveBasemap(b)}
        activeOldMapPresetId={activeOldMapPresetId}
        onSelectOldMapPreset={(presetId) => {
          setActiveOldMapPresetId(presetId);
        }}
        onUploadCustomGeojson={(customData) => {
          setCustomOldMapGeojson(customData);
        }}
        onUploadScannedMap={(imageUrl) => {
          setScannedMapOverlayUrl(imageUrl);
        }}
        oldMapOpacity={oldMapOpacity}
        onChangeOldMapOpacity={setOldMapOpacity}
        oldMapStrokeColor={oldMapStrokeColor}
        onChangeOldMapStrokeColor={setOldMapStrokeColor}
      />
    </div>
    </RoleGuard>
  );
}
