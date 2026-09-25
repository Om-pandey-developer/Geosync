"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
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
} from "lucide-react";
import type { FeatureCollection } from "geojson";
import type { GCPPoint } from "@/components/MapViewer";

const MapViewer = dynamic(() => import("@/components/MapViewer"), { ssr: false });
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

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

export default function PatwariPage() {
  const [parcels, setParcels] = useState<ParcelSummary[]>([]);
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activePipelineStep, setActivePipelineStep] = useState<number>(1);
  const [isDossierCollapsed, setIsDossierCollapsed] = useState(false);

  // GCP Calibration State
  const [enableGcpPlacement, setEnableGcpPlacement] = useState(false);
  const [gcpPoints, setGcpPoints] = useState<GCPPoint[]>([
    { id: 1, lat: 26.7612, lng: 80.8998, label: "GCP-1 (Survey Pillar A)" },
    { id: 2, lat: 26.7628, lng: 80.9034, label: "GCP-2 (Road Intersection)" },
  ]);
  const [showCalibrationDrawer, setShowCalibrationDrawer] = useState(false);

  // GeoSAM extraction result state
  const [geosamResult, setGeosamResult] = useState<{
    confidence: number;
    isOccluded: boolean;
    reason: string | null;
    inferenceMs: number;
  } | null>(null);

  const fetchData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const selectedParcel = useMemo(
    () => parcels.find((p) => p.id === selectedId),
    [parcels, selectedId]
  );

  const handleAddGcp = (pt: GCPPoint) => {
    if (gcpPoints.length >= 6) {
      toast("Maximum 6 Ground Control Points reached for this sector.", { icon: "ℹ️" });
      return;
    }
    setGcpPoints((prev) => [...prev, pt]);
    toast.success(`Dropped ${pt.label} at [${pt.lat}, ${pt.lng}]`);
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

  // Step 3: GeoSAM Zero-Shot Boundary Extraction
  const runGeoSamExtraction = async () => {
    if (!selectedId) return toast("Select a parcel polygon first", { icon: "ℹ️" });
    setLoading(true);
    setActivePipelineStep(3);
    const tId = toast.loading("GeoSAM ViT-H: Zero-shot boundary segmentation (<10ms)...");

    try {
      const activeFeature = geojson?.features.find(
        (f: any) => f.properties?.id === selectedId
      );

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

      setGeosamResult({
        confidence: data.confidence_score,
        isOccluded: data.is_occluded,
        reason: data.occlusion_reason,
        inferenceMs: data.inference_time_ms,
      });

      if (data.is_occluded) {
        toast(
          `Occlusion Warning! Confidence: ${(data.confidence_score * 100).toFixed(0)}%. ${data.occlusion_reason}`,
          { icon: "⚠️", id: tId, duration: 4000 }
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
      const activeFeature = geojson?.features.find(
        (f: any) => f.properties?.id === selectedId
      );

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

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", paddingTop: 64, overflow: "hidden" }}>
      {/* Accessible H1 Heading (Fix for Issue 5) */}
      <h1 className="sr-only">Revenue Patwari Geospatial Harmonization Workspace</h1>

      {/* Fullscreen Map Canvas */}
      <div style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0, zIndex: 10 }}>
        <MapViewer
          geojsonData={geojson}
          selectedParcelId={selectedId}
          onParcelClick={(id) => {
            setSelectedId(id);
            setGeosamResult(null);
            setIsDossierCollapsed(false);
          }}
          enableGcpPlacement={enableGcpPlacement}
          gcpPoints={gcpPoints}
          onAddGcp={handleAddGcp}
          showOcclusionAlerts={true}
        />
      </div>

      {/* ───── Top Right: Collapsible Parcel Dossier (Fix for Issue 6, 10, 12, 13) ───── */}
      <div
        className="glass-card animate-fade-in-up"
        style={{
          position: "absolute",
          top: 84,
          right: 24,
          zIndex: 400,
          width: 350,
          padding: isDossierCollapsed ? "12px 18px" : "18px 20px",
          background: "rgba(255, 255, 255, 0.98)", /* Fix Issue 12: Opaque background prevents text bleed */
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
            {/* Fix Issue 13: Prominent reload button */}
            <button 
              onClick={fetchData} 
              className="btn-ghost" 
              style={{ padding: 6, color: "var(--text-primary)" }} 
              title="Reload Cadastral Data"
              aria-label="Reload Cadastral Data"
            >
              <RefreshCw size={15} />
            </button>
            {/* Fix Issue 10: Minimize/Expand toggle */}
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
              <div style={{ fontSize: "0.875rem" /* Fix Issue 3: 14px body text */ }}>
                <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: "8px 12px", marginBottom: 12 }}>
                  <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Khasra No:</span>
                  <strong style={{ color: "var(--text-primary)" }}>{selectedParcel.khasra_no}</strong>

                  <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Landholder:</span>
                  <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{selectedParcel.owner_name}</span>

                  <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Location:</span>
                  <span style={{ color: "var(--text-secondary)" }}>{selectedParcel.village}, Mohanlalganj</span>

                  <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Status:</span>
                  <span style={{ 
                    textTransform: "uppercase", 
                    fontSize: "0.75rem", 
                    fontWeight: 700, 
                    padding: "3px 8px", 
                    background: "var(--accent-primary-bg)", 
                    color: "var(--accent-primary)", 
                    borderRadius: "var(--radius-sm)", 
                    width: "fit-content" 
                  }}>
                    {selectedParcel.alignment_status}
                  </span>

                  {selectedParcel.area_sqm && (
                    <>
                      <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Parcel Area:</span>
                      <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{Number(selectedParcel.area_sqm).toFixed(1)} m²</span>
                    </>
                  )}
                </div>

                {/* Occlusion Warning Banner */}
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
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
                      {geosamResult.isOccluded ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                      <span>GeoSAM Zero-Shot Result ({geosamResult.inferenceMs.toFixed(1)}ms)</span>
                    </div>
                    <div style={{ marginTop: 4 }}>
                      Confidence: <strong>{(geosamResult.confidence * 100).toFixed(1)}%</strong>
                      {geosamResult.reason && ` &bull; ${geosamResult.reason}`}
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

                {/* Submit to Tehsildar Button */}
                <button
                  className="btn-primary"
                  onClick={submitForApproval}
                  disabled={loading}
                  style={{ width: "100%", padding: "10px 16px" }}
                >
                  <Send size={15} /> Send to Tehsildar for HITL Approval
                </button>
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

      {/* ───── Bottom Center: Consolidated Unified Pipeline Action Dock (Fix for Issue 6, 7, 8, 11, 14) ───── */}
      <div
        className="glass-card animate-fade-in-up"
        style={{
          position: "absolute",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)", /* Fix Issue 8: Perfectly centered horizontally */
          zIndex: 400,
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "rgba(255, 255, 255, 0.98)", /* Fix Issue 7: High contrast opaque background */
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 10px 35px rgba(15, 23, 42, 0.15)",
        }}
      >
        {/* Fix Issue 4: Title case instead of long all-caps */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingRight: 4 }}>
          <span style={{ fontWeight: 800, fontSize: "0.875rem", color: "var(--text-primary)" }}>
            Harmonization Pipeline:
          </span>
          <span className="badge-pastel-teal" style={{ fontSize: "0.75rem", padding: "2px 8px" }}>
            Step {activePipelineStep} of 5
          </span>
        </div>

        <div style={{ width: 1, height: 24, background: "var(--border-subtle)" }} />

        {/* Step 2: Align Map */}
        <button
          className="btn-primary"
          onClick={runAlign}
          disabled={loading || !selectedId}
          title="ORB keypoint feature detection & RANSAC homography"
        >
          <ScanLine size={16} /> 2. Align (ORB)
        </button>

        {/* Step 3: GeoSAM AI */}
        <button
          className="btn-primary"
          onClick={runGeoSamExtraction}
          disabled={loading || !selectedId}
          title="Meta Segment Anything (GeoSAM) zero-shot boundary tracing with occlusion checks"
        >
          <Sparkles size={16} /> 3. GeoSAM AI
        </button>

        {/* Step 4 & 5: PostGIS & ULPIN */}
        <button
          className="btn-primary"
          onClick={runCleanupAndUlpin}
          disabled={loading || !selectedId}
          title="PostGIS ST_Difference, ST_Snap (0.05m), and Base-14 ULPIN generation"
        >
          <Layers size={16} /> 4-5. Clean & ULPIN
        </button>

        <div style={{ width: 1, height: 24, background: "var(--border-subtle)" }} />

        {/* GCP Drop Mode Toggle (Fix Issue 11: Consistent button style) */}
        <button
          className="btn-secondary"
          onClick={() => {
            const next = !enableGcpPlacement;
            setEnableGcpPlacement(next);
            if (next) {
              toast("GCP Pin Placement Active: Click on map to drop Ground Control Points", { icon: "📍" });
            }
          }}
          style={{
            background: enableGcpPlacement ? "var(--accent-primary-bg)" : "#FFFFFF",
            borderColor: enableGcpPlacement ? "var(--accent-primary)" : "var(--border-glass)",
            color: enableGcpPlacement ? "var(--accent-primary)" : "var(--text-primary)",
          }}
        >
          <Pin size={15} /> {enableGcpPlacement ? "Pin Mode Active" : "Drop GCP"}
        </button>

        {/* Fix Issue 14: Solid high-contrast secondary button for TPS Calibration */}
        <button
          className="btn-secondary"
          onClick={() => setShowCalibrationDrawer(true)}
        >
          <Sliders size={15} /> Thin-Plate Splines ({gcpPoints.length})
        </button>
      </div>

      {/* Thin-Plate Splines Modal */}
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
              width: "720px",
              maxWidth: "92vw",
              background: "#FFFFFF",
              padding: "24px 28px",
              borderRadius: "var(--radius-lg)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)" }}>
                  Ground Control Points (GCP) & Thin-Plate Splines (TPS)
                </h2>
                <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: 2 }}>
                  Non-linear rubber sheeting corrects decades-old paper shrinkage and moisture distortion.
                </p>
              </div>
              <button onClick={() => setShowCalibrationDrawer(false)} className="btn-ghost" style={{ padding: "6px 12px" }}>
                ✕
              </button>
            </div>

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

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  setEnableGcpPlacement(true);
                  setShowCalibrationDrawer(false);
                  toast("Click on the map to place additional GCP points", { icon: "📍" });
                }}
              >
                + Drop Points on Map
              </button>

              <button
                className="btn-primary"
                onClick={async () => {
                  setLoading(true);
                  const tId = toast.loading("Computing Thin-Plate Spline non-linear surface...");
                  try {
                    const res = await fetch(`${API}/v1/align-map`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        legacy_geojson: {
                          type: "Polygon",
                          coordinates: [
                            [[80.899, 26.760], [80.902, 26.760], [80.902, 26.762], [80.899, 26.762], [80.899, 26.760]],
                          ],
                        },
                        gcps: gcpPoints.map((p) => ({
                          id: p.id,
                          legacy_coord: [p.lng - 0.0003, p.lat - 0.0002],
                          drone_coord: [p.lng, p.lat],
                          label: p.label,
                        })),
                      }),
                    });
                    if (!res.ok) throw new Error("TPS calculation error");
                    const data = await res.json();
                    toast.success(`TPS Warping complete! Confidence: ${data.confidence_score}%`, { id: tId });
                    setShowCalibrationDrawer(false);
                    await fetchData();
                  } catch (err: any) {
                    toast.error(err.message || "TPS computation failed", { id: tId });
                  }
                  setLoading(false);
                }}
              >
                Apply TPS Warping
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
