"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { toast } from "react-hot-toast";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Fingerprint,
  AlertTriangle,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  FileCheck,
  ShieldAlert,
  ClipboardList,
} from "lucide-react";
import type { FeatureCollection } from "geojson";

const MapViewer = dynamic(() => import("@/components/MapViewer"), { ssr: false });

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

interface DashboardStats {
  total_parcels: number;
  raw_count: number;
  aligned_count: number;
  cleaned_count: number;
  ulpin_assigned_count: number;
  pending_approvals: number;
  approved_count: number;
  rejected_count: number;
}

interface PendingApproval {
  approval_id: string;
  parcel_id: string;
  requested_by: string;
  status: string;
  requested_at: string;
  khasra_no: string;
  owner_name: string;
  village: string;
  tehsil: string;
  district: string;
  ulpin: string | null;
  area_sqm: number | null;
  alignment_status: string;
  alignment_confidence: number | null;
}

export default function TehsildarPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, pendingRes, geojsonRes] = await Promise.all([
        fetch(`${API}/dashboard/stats`),
        fetch(`${API}/approvals/pending`),
        fetch(`${API}/parcels/geojson`),
      ]);
      setStats(await statsRes.json());
      setPendingApprovals(await pendingRes.json());
      setGeojson(await geojsonRes.json());
    } catch {
      toast.error("Failed to fetch data from backend.");
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAction = async (action: "approved" | "rejected") => {
    if (!selectedApproval) return;
    setLoading(true);
    const tId = toast.loading(`Processing ${action}...`);
    try {
      const res = await fetch(`${API}/approvals/${selectedApproval.approval_id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewed_by: "tehsildar_01",
          action,
          remarks: remarks || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Khasra ${selectedApproval.khasra_no} ${action}.`, { id: tId });
        setSelectedApproval(null);
        setRemarks("");
        await fetchData();
      } else {
        toast.error(data.detail || "Action failed.", { id: tId });
      }
    } catch {
      toast.error("Network error.", { id: tId });
    }
    setLoading(false);
  };

  const statCards = stats
    ? [
        { label: "Total Parcels", value: stats.total_parcels, icon: <Layers size={20} />, cls: "stat-card-blue" },
        { label: "ULPIN Assigned", value: stats.ulpin_assigned_count, icon: <Fingerprint size={20} />, cls: "stat-card-cyan" },
        { label: "Pending Approvals", value: stats.pending_approvals, icon: <Clock size={20} />, cls: "stat-card-amber" },
        { label: "Approved", value: stats.approved_count, icon: <CheckCircle2 size={20} />, cls: "stat-card-green" },
        { label: "Rejected", value: stats.rejected_count, icon: <XCircle size={20} />, cls: "stat-card-red" },
        { label: "Raw / Unprocessed", value: stats.raw_count, icon: <AlertTriangle size={20} />, cls: "stat-card-purple" },
      ]
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", paddingTop: 60 }}>
      <main style={{ flex: 1, padding: 24, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        
        {/* ───── Header ───── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 800 }}>Approval Dashboard</h1>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: 2 }}>
              Revenue Officer — Mohanlalganj Tehsil, Lucknow
            </p>
          </div>
          <button className="btn-ghost" onClick={fetchData}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        {/* ───── Stat Cards ───── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 20 }}>
          {statCards.map((card, i) => (
            <div key={i} className={`glass-card-static stat-card ${card.cls} animate-fade-in-up`} style={{ padding: "16px", animationDelay: `${i * 0.05}s` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {card.label}
                </span>
                <span style={{ color: "var(--text-muted)", opacity: 0.5 }}>{card.icon}</span>
              </div>
              <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--text-primary)" }}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* ───── Main Content: Split View ───── */}
        <div style={{ display: "flex", gap: 20, flex: 1, minHeight: 0 }}>
          
          {/* Left: Pending List */}
          <div className="glass-card-static" style={{ width: 320, display: "flex", flexDirection: "column", padding: 0 }}>
            <div style={{ padding: "16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Pending Reviews ({pendingApprovals.length})
              </span>
              <Clock size={16} style={{ color: "var(--accent-warning)" }} />
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {pendingApprovals.map((a) => (
                <button
                  key={a.approval_id}
                  onClick={() => setSelectedApproval(a)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
                    background: selectedApproval?.approval_id === a.approval_id ? "rgba(139, 92, 246, 0.1)" : "transparent",
                    border: "none", borderBottom: "1px solid var(--border-subtle)", cursor: "pointer", textAlign: "left", transition: "background 0.15s"
                  }}
                >
                  <FileCheck size={18} style={{ color: selectedApproval?.approval_id === a.approval_id ? "var(--accent-purple)" : "var(--text-muted)", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>Khasra {a.khasra_no}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{a.owner_name} · by {a.requested_by}</div>
                  </div>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent-warning)", boxShadow: "0 0 6px var(--accent-warning)" }} />
                </button>
              ))}
              {pendingApprovals.length === 0 && (
                <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                  <CheckCircle2 size={32} style={{ marginBottom: 12, opacity: 0.3, margin: "0 auto" }} />
                  <p style={{ fontSize: "0.85rem" }}>No pending approvals.</p>
                </div>
              )}
            </div>
          </div>

          {/* Center: Map */}
          <div className="glass-card-static" style={{ flex: 1, padding: 0, overflow: "hidden", position: "relative" }}>
             <MapViewer
              geojsonData={geojson}
              selectedParcelId={selectedApproval?.parcel_id || null}
              onParcelClick={(id) => {
                const match = pendingApprovals.find((a) => a.parcel_id === id);
                if (match) setSelectedApproval(match);
              }}
            />
          </div>

          {/* Right: Selected Approval Dashboard Panel */}
          {selectedApproval && (
            <div className="glass-card-static animate-fade-in-up" style={{ width: 400, display: "flex", flexDirection: "column", padding: 20, overflowY: "auto" }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: 4 }}>Khasra {selectedApproval.khasra_no}</h2>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 20 }}>
                {selectedApproval.owner_name} · {selectedApproval.village}, {selectedApproval.tehsil}
              </p>

              {/* Confidence Badge */}
              <div style={{ background: (selectedApproval.alignment_confidence || 0) >= 0.75 ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)", border: `1px solid ${(selectedApproval.alignment_confidence || 0) >= 0.75 ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)"}`, padding: "12px", borderRadius: 8, display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <ShieldAlert size={24} style={{ color: (selectedApproval.alignment_confidence || 0) >= 0.75 ? "var(--accent-success)" : "var(--accent-warning)" }} />
                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>AI Confidence</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: (selectedApproval.alignment_confidence || 0) >= 0.75 ? "var(--accent-success)" : "var(--accent-warning)" }}>
                    {selectedApproval.alignment_confidence ? `${(selectedApproval.alignment_confidence * 100).toFixed(1)}% Match` : "N/A"}
                  </div>
                </div>
              </div>

              {/* ULPIN Card */}
              <div style={{ background: "rgba(6, 182, 212, 0.1)", border: "1px solid rgba(6, 182, 212, 0.3)", padding: 16, borderRadius: 8, marginBottom: 24 }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--accent-secondary)", textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <Fingerprint size={14} /> Draft ULPIN
                </div>
                <div style={{ fontSize: "1.4rem", fontFamily: "monospace", fontWeight: 800, color: "#fff", letterSpacing: "3px", textAlign: "center" }}>
                  {selectedApproval.ulpin || "NOT GENERATED"}
                </div>
              </div>

              {/* Audit Log */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                  <ClipboardList size={16} /> Audit Log
                </div>
                <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 8, padding: 12, fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ color: "var(--text-muted)" }}>Requested By:</span>
                    <span style={{ fontWeight: 600 }}>{selectedApproval.requested_by}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ color: "var(--text-muted)" }}>Timestamp:</span>
                    <span>{new Date(selectedApproval.requested_at).toLocaleString()}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ color: "var(--text-muted)" }}>Area (Cleaned):</span>
                    <span>{selectedApproval.area_sqm ? `${selectedApproval.area_sqm.toFixed(1)} m²` : "—"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Topology:</span>
                    <span style={{ color: "var(--accent-success)" }}>Overlaps Trimmed, Snapped</span>
                  </div>
                </div>
              </div>

              {/* Remarks Input */}
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Add tehsildar remarks (optional)..."
                className="glass-input"
                style={{ width: "100%", minHeight: 80, resize: "vertical", marginBottom: 16, fontSize: "0.85rem" }}
              />

              {/* Action Buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: "auto" }}>
                <button
                  className="btn-success"
                  onClick={() => handleAction("approved")}
                  disabled={loading}
                  style={{ width: "100%", padding: "12px", justifyContent: "center", fontSize: "0.95rem" }}
                >
                  <ThumbsUp size={18} /> Approve & Commit
                </button>
                <button
                  className="btn-danger"
                  onClick={() => handleAction("rejected")}
                  disabled={loading}
                  style={{ width: "100%", padding: "12px", justifyContent: "center", fontSize: "0.95rem", background: "rgba(239, 68, 68, 0.1)", color: "var(--accent-danger)", border: "1px solid rgba(239, 68, 68, 0.3)" }}
                >
                  <ThumbsDown size={18} /> Reject / Request Re-survey
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
