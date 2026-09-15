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
  Maximize2,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Pin,
  Send,
  Sliders,
  CheckCircle2,
  Copy,
  Zap,
} from "lucide-react";
import type { FeatureCollection } from "geojson";
import type { GCPPoint } from "@/components/MapViewer";

// Dynamically import MapViewer with Leaflet (SSR false)
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
  const [activePipelineStep, setActivePipelineStep] = useState<number>(0);

  // GCP Calibration State
  const [enableGcpPlacement, setEnableGcpPlacement] = useState(false);
  const [gcpPoints, setGcpPoints] = useState<GCPPoint[]>([
    { id: 1, lat: 26.7612, lng: 80.8998, label: "GCP-1 (Survey Pillar A)" },
    { id: 2, lat: 26.7628, lng: 80.9034, label: "GCP-2 (Road Intersection)" },
  ]);
  const [showCalibrationDrawer, setShowCalibrationDrawer] = useState(false);

  // Occlusion & GeoSAM extraction state
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
      toast.error("Connecting to local offline fallback...", { duration: 2500 });
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
      toast("Maximum 6 GCP control points reached for this sector.", { icon: "ℹ️" });
      return;
    }
    setGcpPoints((prev) => [...prev, pt]);
    toast.success(`Dropped ${pt.label} at [${pt.lat}, ${pt.lng}]`);
  };

  // Stage 2: Global ORB+RANSAC & TPS Alignment
  const runAlign = async () => {
    if (!selectedId) return toast("Select a parcel polygon on the map first", { icon: "ℹ️" });
    setLoading(true);
    setActivePipelineStep(2);
    const tId = toast.loading("Executing ORB keypoint detection & RANSAC homography...");
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

  // Stage 3: GeoSAM Zero-Shot Boundary Extraction (with 1024-d pre-cached embeddings)
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
          `Occlusion Warning! Conf: ${(data.confidence_score * 100).toFixed(0)}%. ${data.occlusion_reason}`,
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

  // Stage 4 & 5: Topological Cleansing + 14-char ULPIN Generation
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
    <div style={{ width: "100vw", height: "100vh", position: "relative", paddingTop: 60, overflow: "hidden" }}>
      {/* ───── Fullscreen Map with GIS Canvas ───── */}
      <div style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0, zIndex: 10 }}>
        <MapViewer
          geojsonData={geojson}
          selectedParcelId={selectedId}
          onParcelClick={(id) => {
            setSelectedId(id);
            setGeosamResult(null);
          }}
          enableGcpPlacement={enableGcpPlacement}
          gcpPoints={gcpPoints}
          onAddGcp={handleAddGcp}
          showOcclusionAlerts={true}
        />
      </div>

      {/* ───── Top Center: 5-Stage Pipeline Status Tracker ───── */}
      <div
        className="glass-card animate-fade-in-up"
        style={{
          position: "absolute",
          top: 76,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 400,
          padding: "6px 16px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          fontSize: "0.78rem",
          background: "rgba(255, 255, 255, 0.88)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontWeight: 700, color: "var(--accent-primary)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            NAKSHA Pipeline:
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {[
            { step: 1, name: "1. Ingest (EPSG:3857)" },
            { step: 2, name: "2. ORB/TPS Warp" },
            { step: 3, name: "3. GeoSAM AI" },
            { step: 4, name: "4. PostGIS Clean" },
            { step: 5, name: "5. Base-14 ULPIN" },
          ].map((s) => {
            const isActive = activePipelineStep === s.step;
            return (
              <span
                key={s.step}
                style={{
                  padding: "2px 8px",
                  borderRadius: 6,
                  fontWeight: 600,
                  background: isActive ? "var(--accent-primary)" : "rgba(121, 199, 197, 0.12)",
                  color: isActive ? "#FFFFFF" : "var(--text-secondary)",
                  transition: "all 0.2s ease",
                }}
              >
                {s.name}
              </span>
            );
          })}
        </div>

        <div style={{ width: 1, height: 16, background: "var(--border-subtle)" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#4FA8A4", fontWeight: 700 }}>
          <Zap size={13} />
          <span>&lt;10ms Air-Gapped</span>
        </div>
      </div>

      {/* ───── Top Right: Selected Parcel HUD ───── */}
      <div
        className="glass-card animate-fade-in-up"
        style={{
          position: "absolute",
          top: 76,
          right: 20,
          zIndex: 400,
          width: 340,
          padding: "18px 20px",
          background: "rgba(255, 255, 255, 0.92)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
            <MapPin size={17} style={{ color: "var(--accent-primary)" }} /> Parcel Dossier
          </h2>
          <button onClick={fetchData} className="btn-ghost" style={{ padding: 6 }} title="Reload Cadastral Layers">
            <RefreshCw size={13} />
          </button>
        </div>

        {selectedParcel ? (
          <div style={{ fontSize: "0.85rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "85px 1fr", gap: "6px 10px", marginBottom: 10 }}>
              <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>Khasra No:</span>
              <strong style={{ color: "var(--text-primary)" }}>{selectedParcel.khasra_no}</strong>

              <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>Landholder:</span>
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{selectedParcel.owner_name}</span>

              <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>Location:</span>
              <span style={{ color: "var(--text-secondary)" }}>{selectedParcel.village}, Mohanlalganj</span>

              <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>State:</span>
              <span style={{ textTransform: "uppercase", fontSize: "0.72rem", fontWeight: 700, padding: "2px 8px", background: "rgba(121,199,197,0.2)", color: "#008080", borderRadius: 4, width: "fit-content" }}>
                {selectedParcel.alignment_status}
              </span>

              {selectedParcel.area_sqm && (
                <>
                  <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>Parcel Area:</span>
                  <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{Number(selectedParcel.area_sqm).toFixed(1)} m²</span>
                </>
              )}
            </div>

            {/* Occlusion Warning Banner if GeoSAM detected low confidence */}
            {geosamResult && (
              <div
                style={{
                  marginTop: 10,
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: geosamResult.isOccluded ? "rgba(255, 211, 182, 0.45)" : "rgba(168, 230, 207, 0.35)",
                  border: `1px solid ${geosamResult.isOccluded ? "#FFD3B6" : "#A8E6CF"}`,
                  fontSize: "0.78rem",
                  color: geosamResult.isOccluded ? "#9C4221" : "#1B5E20",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
                  {geosamResult.isOccluded ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                  <span>GeoSAM Zero-Shot Inference ({geosamResult.inferenceMs.toFixed(1)}ms)</span>
                </div>
                <div style={{ marginTop: 3 }}>
                  Confidence: <strong>{(geosamResult.confidence * 100).toFixed(1)}%</strong>
                  {geosamResult.reason && ` · ${geosamResult.reason}`}
                </div>
                {geosamResult.isOccluded && (
                  <div style={{ marginTop: 4, fontSize: "0.72rem", fontStyle: "italic" }}>
                    Recommendation: Revenue Patwari physical boundary inspection recommended before commitment.
                  </div>
                )}
              </div>
            )}

            {/* Bhu-Aadhaar (ULPIN) Badge */}
            {selectedParcel.ulpin && (
              <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(121, 199, 197, 0.15)", border: "1px solid rgba(121, 199, 197, 0.4)", borderRadius: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--accent-primary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Bhu-Aadhaar (ULPIN Base-14)
                  </span>
                  <button onClick={() => copyUlpin(selectedParcel.ulpin!)} className="btn-ghost" style={{ padding: 2 }}>
                    <Copy size={13} style={{ color: "var(--accent-primary)" }} />
                  </button>
                </div>
                <div style={{ fontFamily: "monospace", fontSize: "1.05rem", fontWeight: 800, color: "#008080", letterSpacing: "1.5px", textAlign: "center" }}>
                  {selectedParcel.ulpin}
                </div>
              </div>
            )}

            {/* Submit to Tehsildar Button */}
            <button
              className="btn-primary"
              onClick={submitForApproval}
              disabled={loading}
              style={{ width: "100%", marginTop: 14, padding: "8px 12px", fontSize: "0.82rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              <Send size={14} /> Send to Tehsildar for HITL Legal Approval
            </button>
          </div>
        ) : (
          <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", display: "flex", gap: 10, alignItems: "center", background: "rgba(121, 199, 197, 0.08)", padding: 12, borderRadius: 8 }}>
            <Info size={22} style={{ color: "var(--accent-primary)", flexShrink: 0 }} />
            <span>Click any parcel polygon on the map canvas to inspect properties and run the 5-stage GeoSync pipeline.</span>
          </div>
        )}
      </div>

      {/* ───── Floating Bottom Toolbar: 5-Stage Harmonization Actions ───── */}
      <div
        className="glass-card animate-fade-in-up"
        style={{
          position: "absolute",
          bottom: 24,
          left: 24,
          zIndex: 400,
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "rgba(255, 255, 255, 0.92)",
        }}
      >
        {/* Stage 2 Button: Alignment */}
        <button
          className="btn-primary"
          onClick={runAlign}
          disabled={loading || !selectedId}
          style={{ opacity: !selectedId || loading ? 0.5 : 1, padding: "9px 16px", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 6 }}
          title="ORB keypoint feature detection & RANSAC homography"
        >
          <ScanLine size={16} /> 2. Align (ORB)
        </button>

        {/* Stage 3 Button: GeoSAM Boundary Extraction */}
        <button
          className="btn-primary"
          onClick={runGeoSamExtraction}
          disabled={loading || !selectedId}
          style={{
            opacity: !selectedId || loading ? 0.5 : 1,
            background: "linear-gradient(135deg, #4FA8A4 0%, #008080 100%)",
            padding: "9px 16px",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
          title="Meta Segment Anything (GeoSAM) zero-shot boundary tracing with occlusion checks"
        >
          <Sparkles size={16} /> 3. GeoSAM AI
        </button>

        {/* Stage 4 & 5 Button: PostGIS Clean & ULPIN */}
        <button
          className="btn-primary"
          onClick={runCleanupAndUlpin}
          disabled={loading || !selectedId}
          style={{
            opacity: !selectedId || loading ? 0.5 : 1,
            background: "linear-gradient(135deg, #79C7C5 0%, #4FA8A4 100%)",
            padding: "9px 16px",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
          title="PostGIS ST_Difference, ST_Snap (0.05m), and Base-14 ULPIN generation"
        >
          <Layers size={16} /> 4-5. PostGIS & ULPIN
        </button>

        <div style={{ width: 1, height: 24, background: "var(--border-subtle)", margin: "0 2px" }} />

        {/* GCP Drop Mode Toggle */}
        <button
          onClick={() => {
            const next = !enableGcpPlacement;
            setEnableGcpPlacement(next);
            if (next) {
              toast("GCP placement active: Click on map to add Ground Control Points", { icon: "📍" });
            }
          }}
          style={{
            padding: "9px 14px",
            borderRadius: 8,
            border: "1px solid var(--border-glass)",
            fontSize: "0.82rem",
            fontWeight: 600,
            cursor: "pointer",
            background: enableGcpPlacement ? "rgba(79, 168, 164, 0.2)" : "rgba(255,255,255,0.7)",
            color: enableGcpPlacement ? "#008080" : "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Pin size={15} /> {enableGcpPlacement ? "Pin Mode ON" : "Drop GCP"}
        </button>

        {/* Calibration Drawer Trigger */}
        <button
          className="btn-ghost"
          onClick={() => setShowCalibrationDrawer(true)}
          style={{ padding: "9px 14px", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: 6 }}
        >
          <Sliders size={15} /> Thin-Plate Splines ({gcpPoints.length})
        </button>
      </div>

      {/* ───── Thin-Plate Splines (TPS) Calibration Modal / Drawer ───── */}
      {showCalibrationDrawer && (
        <div
          className="animate-fade-in-up"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.45)",
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
              background: "rgba(255, 255, 255, 0.96)",
              padding: "24px 28px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text-primary)" }}>
                  Ground Control Points (GCP) & Thin-Plate Splines (TPS)
                </h2>
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: 2 }}>
                  Non-linear rubber sheeting corrects decades-old paper shrinkage and moisture distortion.
                </p>
              </div>
              <button onClick={() => setShowCalibrationDrawer(false)} className="btn-ghost" style={{ padding: "6px 12px" }}>
                ✕
              </button>
            </div>

            {/* GCP Coordinate Table */}
            <div style={{ maxHeight: 220, overflowY: "auto", marginBottom: 16, border: "1px solid var(--border-subtle)", borderRadius: 8 }}>
              <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "rgba(121, 199, 197, 0.15)", borderBottom: "1px solid var(--border-subtle)" }}>
                    <th style={{ padding: "8px 12px", color: "#008080" }}>ID</th>
                    <th style={{ padding: "8px 12px", color: "#008080" }}>Landmark Label</th>
                    <th style={{ padding: "8px 12px", color: "#008080" }}>Drone Latitude</th>
                    <th style={{ padding: "8px 12px", color: "#008080" }}>Drone Longitude</th>
                    <th style={{ padding: "8px 12px", color: "#008080" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {gcpPoints.map((gcp) => (
                    <tr key={gcp.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td style={{ padding: "8px 12px", fontWeight: 700 }}>#{gcp.id}</td>
                      <td style={{ padding: "8px 12px" }}>{gcp.label}</td>
                      <td style={{ padding: "8px 12px", fontFamily: "monospace" }}>{gcp.lat.toFixed(6)}</td>
                      <td style={{ padding: "8px 12px", fontFamily: "monospace" }}>{gcp.lng.toFixed(6)}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <button
                          onClick={() => setGcpPoints(gcpPoints.filter((p) => p.id !== gcp.id))}
                          style={{ border: "none", background: "none", color: "#EF4444", cursor: "pointer", fontWeight: 700 }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ background: "rgba(121, 199, 197, 0.1)", padding: 12, borderRadius: 8, fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: 18 }}>
              💡 <strong>TPS Formula:</strong> Minimizes bending energy <em>E<sub>tps</sub>(f) = Σ ||y<sub>i</sub> - f(x<sub>i</sub>)||² + λ ∬ (∇²f)² dx</em> to anchor paper coordinates to 5cm drone landmarks without shear distortion.
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                className="btn-ghost"
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
                    toast.success(`TPS Non-Linear Warping complete! Confidence: ${data.confidence_score}%`, { id: tId });
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
