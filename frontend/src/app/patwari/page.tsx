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
  Maximize2
} from "lucide-react";
import type { FeatureCollection } from "geojson";

const MapViewer = dynamic(() => import("@/components/MapViewer"), { ssr: false });
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

interface ParcelSummary {
  id: string;
  khasra_no: string;
  owner_name: string;
  village: string;
  alignment_status: string;
  ulpin: string | null;
  area_sqm: number | null;
}

export default function PatwariPage() {
  const [parcels, setParcels] = useState<ParcelSummary[]>([]);
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [parcelsRes, geojsonRes] = await Promise.all([
        fetch(`${API}/parcels`),
        fetch(`${API}/parcels/geojson`),
      ]);
      setParcels(await parcelsRes.json());
      setGeojson(await geojsonRes.json());
    } catch {
      toast.error("Failed to fetch data. Is the backend running?");
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const selectedParcel = useMemo(
    () => parcels.find((p) => p.id === selectedId),
    [parcels, selectedId]
  );

  const runAlign = async () => {
    if (!selectedId) return toast("Select a parcel first", { icon: "ℹ️" });
    setLoading(true);
    const tId = toast.loading("Aligning raster map to drone imagery...");
    try {
      const res = await fetch(`${API}/align/${selectedId}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Alignment successful (Conf: ${data.confidence.toFixed(2)})`, { id: tId });
        await fetchData();
      } else {
        toast.error(data.detail || "Alignment failed.", { id: tId });
      }
    } catch {
      toast.error("Network error.", { id: tId });
    }
    setLoading(false);
  };

  const runCleanupAndUlpin = async () => {
    if (!selectedId) return toast("Select a parcel first", { icon: "ℹ️" });
    setLoading(true);
    const tId = toast.loading("Cleaning topology and generating ULPIN...");
    try {
      const cleanRes = await fetch(`${API}/v1/topology-cleanup`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geometry_geojson: geojson?.features.find((f: any) => f.properties.id === selectedId)?.geometry })
      });
      if (!cleanRes.ok) throw new Error("Cleanup failed");
      
      const ulpinRes = await fetch(`${API}/v1/generate-ulpin`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parcel_id: selectedId })
      });
      if (!ulpinRes.ok) throw new Error("ULPIN generation failed");
      
      const ulpinData = await ulpinRes.json();
      toast.success(`Generated ULPIN: ${ulpinData.ulpin}`, { id: tId });
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed in pipeline.", { id: tId });
    }
    setLoading(false);
  };

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", paddingTop: 60 }}>
      {/* Fullscreen Map */}
      <div style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0, zIndex: 10 }}>
        <MapViewer
          geojsonData={geojson}
          selectedParcelId={selectedId}
          onParcelClick={(id) => setSelectedId(id)}
        />
      </div>

      {/* Floating Panel Top Right - Parcel Info */}
      <div 
        className="glass-card animate-fade-in-up" 
        style={{ 
          position: "absolute", 
          top: 80, 
          right: 24, 
          zIndex: 20, 
          width: 320, 
          padding: 20 
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <MapPin size={18} style={{ color: "var(--accent-primary)" }} /> Selected Parcel
          </h2>
          <button onClick={fetchData} className="btn-ghost" style={{ padding: 6 }}>
            <RefreshCw size={14} />
          </button>
        </div>
        
        {selectedParcel ? (
          <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 8, marginBottom: 8 }}>
              <span style={{ color: "var(--text-muted)" }}>Khasra:</span> 
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{selectedParcel.khasra_no}</span>
              
              <span style={{ color: "var(--text-muted)" }}>Owner:</span> 
              <span style={{ color: "var(--text-primary)" }}>{selectedParcel.owner_name}</span>
              
              <span style={{ color: "var(--text-muted)" }}>Status:</span> 
              <span style={{ color: "var(--text-primary)", textTransform: "uppercase", fontSize: "0.8rem", fontWeight: 700, padding: "2px 8px", background: "rgba(255,255,255,0.1)", borderRadius: 4, display: "inline-block", width: "fit-content" }}>
                {selectedParcel.alignment_status}
              </span>
            </div>
            
            {selectedParcel.ulpin && (
              <div style={{ marginTop: 16, padding: 12, background: "rgba(6, 182, 212, 0.15)", border: "1px solid rgba(6, 182, 212, 0.3)", borderRadius: 8, color: "var(--accent-secondary)", fontFamily: "monospace", fontSize: "1.1rem", fontWeight: 700, textAlign: "center", letterSpacing: "2px" }}>
                {selectedParcel.ulpin}
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", display: "flex", gap: 12, alignItems: "center", background: "rgba(0,0,0,0.2)", padding: 12, borderRadius: 8 }}>
            <Info size={24} style={{ color: "var(--accent-primary)", flexShrink: 0 }} />
            Click on a parcel polygon on the map to view details and run alignment pipelines.
          </div>
        )}
      </div>

      {/* Floating Action Toolbar Bottom Left */}
      <div 
        className="glass-card animate-fade-in-up animate-delay-2" 
        style={{ 
          position: "absolute", 
          bottom: 24, 
          left: 24, 
          zIndex: 20, 
          padding: 12,
          display: "flex",
          gap: 12,
          boxShadow: "0 10px 40px rgba(0,0,0,0.5)"
        }}
      >
        <button 
          className="btn-primary" 
          onClick={runAlign} 
          disabled={loading || !selectedId}
          style={{ opacity: (!selectedId || loading) ? 0.5 : 1, padding: "12px 24px", fontSize: "0.95rem" }}
        >
          <ScanLine size={20} /> Align Map
        </button>
        <button 
          className="btn-success" 
          onClick={runCleanupAndUlpin} 
          disabled={loading || !selectedId}
          style={{ opacity: (!selectedId || loading) ? 0.5 : 1, background: "linear-gradient(135deg, var(--accent-purple), #6b21a8)", padding: "12px 24px", fontSize: "0.95rem" }}
        >
          <Layers size={20} /> Clean Topology & ULPIN
        </button>
        <div style={{ width: 1, background: "var(--border-glass)", margin: "0 4px" }} />
        <button 
          className="btn-ghost" 
          onClick={() => setShowCalibration(true)}
          style={{ padding: "12px 24px" }}
        >
          <Maximize2 size={20} /> GCP Calibration
        </button>
      </div>

      {/* GCP Calibration Slider Modal (UI Only for Simulation) */}
      {showCalibration && (
        <div className="animate-fade-in-up" style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%", 
          background: "rgba(0,0,0,0.8)", zIndex: 1050, display: "flex", 
          alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)"
        }}>
          <div className="glass-card" style={{ width: "85%", height: "85%", display: "flex", flexDirection: "column", background: "var(--bg-secondary)" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-glass)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 800 }}>GCP Calibration</h2>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: 4 }}>Drag to align Ground Control Points between Legacy Scan and Drone Imagery.</p>
              </div>
              <button onClick={() => setShowCalibration(false)} className="btn-ghost" style={{ padding: "8px 16px" }}>Close</button>
            </div>
            
            <div style={{ flex: 1, display: "flex", position: "relative", overflow: "hidden", background: "#000" }}>
              <div style={{ flex: 1, borderRight: "2px solid var(--accent-primary)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                <div style={{ position: "absolute", top: 16, left: 16, background: "rgba(0,0,0,0.7)", padding: "6px 12px", borderRadius: 4, color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600, border: "1px solid var(--border-glass)", backdropFilter: "blur(8px)" }}>
                  Legacy Scanned Map
                </div>
                <div style={{ width: "80%", height: "80%", backgroundImage: "linear-gradient(45deg, #111 25%, transparent 25%), linear-gradient(-45deg, #111 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #111 75%), linear-gradient(-45deg, transparent 75%, #111 75%)", backgroundSize: "20px 20px", backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px", opacity: 0.5, border: "1px dashed #333" }} />
              </div>
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                <div style={{ position: "absolute", top: 16, right: 16, background: "rgba(0,0,0,0.7)", padding: "6px 12px", borderRadius: 4, color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600, border: "1px solid var(--border-glass)", backdropFilter: "blur(8px)" }}>
                  High-Res Drone Imagery
                </div>
                <div style={{ width: "80%", height: "80%", backgroundImage: "linear-gradient(45deg, #0a2e12 25%, transparent 25%), linear-gradient(-45deg, #0a2e12 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #0a2e12 75%), linear-gradient(-45deg, transparent 75%, #0a2e12 75%)", backgroundSize: "20px 20px", backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px", opacity: 0.5, border: "1px dashed #333" }} />
              </div>
              
              <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: 56, height: 56, borderRadius: 28, background: "var(--bg-glass-strong)", border: "2px solid var(--accent-primary)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "ew-resize", boxShadow: "0 0 30px rgba(59,130,246,0.5)", backdropFilter: "blur(12px)" }}>
                <Maximize2 size={24} color="var(--accent-primary)" />
              </div>
            </div>
            
            <div style={{ padding: "20px 24px", borderTop: "1px solid var(--border-glass)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", display: "flex", gap: 8, alignItems: "center" }}>
                <Info size={16} /> 4/4 Ground Control Points identified automatically.
              </div>
              <button className="btn-primary" onClick={() => { toast.success("GCP points saved successfully!"); setShowCalibration(false); }}>
                Save Match Points
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
