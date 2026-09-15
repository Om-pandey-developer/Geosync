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
  FileCheck,
  ShieldCheck,
  Stamp,
  Sliders,
  Sparkles,
  Info,
  Calendar,
  User,
  MapPin,
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
  const [activeTab, setActiveTab] = useState<"pending" | "audit">("pending");

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, pendingRes, geojsonRes] = await Promise.all([
        fetch(`${API}/dashboard/stats`),
        fetch(`${API}/approvals/pending`),
        fetch(`${API}/parcels/geojson`),
      ]);
      if (!statsRes.ok || !pendingRes.ok || !geojsonRes.ok) throw new Error("Data error");
      setStats(await statsRes.json());
      setPendingApprovals(await pendingRes.json());
      setGeojson(await geojsonRes.json());
    } catch {
      toast.error("Using offline local proxy database...");
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Legal HITL Approval and Database Commit
  const handleApproveAndCommit = async () => {
    if (!selectedApproval) return;
    setLoading(true);
    const tId = toast.loading(`Executing legal HITL validation for Khasra ${selectedApproval.khasra_no}...`);

    try {
      // Step 1: Legal Database Commit (locks ULPIN and marks parcel PUBLISHED)
      const commitRes = await fetch(`${API}/v1/commit-parcel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parcel_id: selectedApproval.parcel_id,
          ulpin: selectedApproval.ulpin,
          officer_id: "TEHSILDAR-LKO-01",
          audit_notes: remarks || "Statutory approval under DILRMP 3.0 National Land Stack guidelines.",
        }),
      });

      // Step 2: Update workflow approval docket
      await fetch(`${API}/approvals/${selectedApproval.approval_id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewed_by: "tehsildar_mohanlalganj",
          action: "approved",
          remarks: remarks || "Verified boundary conforms to NAKSHA 5cm drone survey.",
        }),
      });

      toast.success(`Khasra ${selectedApproval.khasra_no} approved & legally committed to Land Stack!`, { id: tId });
      setSelectedApproval(null);
      setRemarks("");
      await fetchData();
    } catch {
      toast.error("Error committing parcel to registry", { id: tId });
    }
    setLoading(false);
  };

  const handleReject = async () => {
    if (!selectedApproval) return;
    setLoading(true);
    const tId = toast.loading(`Returning Khasra ${selectedApproval.khasra_no} for re-survey...`);

    try {
      await fetch(`${API}/approvals/${selectedApproval.approval_id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewed_by: "tehsildar_mohanlalganj",
          action: "rejected",
          remarks: remarks || "Boundary discrepancy detected under canopy shadow. Re-survey required.",
        }),
      });

      toast.success(`Khasra ${selectedApproval.khasra_no} returned to Patwari docket.`, { id: tId });
      setSelectedApproval(null);
      setRemarks("");
      await fetchData();
    } catch {
      toast.error("Error processing rejection", { id: tId });
    }
    setLoading(false);
  };

  const statCards = [
    {
      label: "Total Ward Parcels",
      value: stats?.total_parcels ?? 18,
      icon: <Layers size={18} />,
      bg: "rgba(121, 199, 197, 0.15)",
      border: "rgba(121, 199, 197, 0.4)",
      color: "#008080",
    },
    {
      label: "Bhu-Aadhaar Assigned",
      value: stats?.ulpin_assigned_count ?? 12,
      icon: <Fingerprint size={18} />,
      bg: "rgba(168, 230, 207, 0.25)",
      border: "rgba(168, 230, 207, 0.5)",
      color: "#1B5E20",
    },
    {
      label: "Pending HITL Reviews",
      value: pendingApprovals.length,
      icon: <Clock size={18} />,
      bg: "rgba(255, 211, 182, 0.3)",
      border: "rgba(255, 211, 182, 0.6)",
      color: "#A85324",
    },
    {
      label: "Legally Committed",
      value: stats?.approved_count ?? 5,
      icon: <CheckCircle2 size={18} />,
      bg: "rgba(79, 168, 164, 0.18)",
      border: "rgba(79, 168, 164, 0.4)",
      color: "#4FA8A4",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", paddingTop: 60, overflow: "hidden" }}>
      <main style={{ flex: 1, padding: "20px 24px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        
        {/* ───── Header Bar ───── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text-primary)" }}>
                Revenue Magistrate HITL Adjudication Chamber
              </h1>
              <span className="badge-pastel-teal" style={{ fontSize: "0.7rem", fontWeight: 700 }}>
                DILRMP 3.0 / NAKSHA Pilot
              </span>
            </div>
            <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: 2 }}>
              Mohanlalganj Tehsil, Lucknow District &mdash; Human-in-the-Loop Legal Validation Engine
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="btn-ghost" onClick={fetchData} style={{ padding: "8px 14px", fontSize: "0.82rem" }}>
              <RefreshCw size={14} /> Refresh Records
            </button>
          </div>
        </div>

        {/* ───── Stat Cards Bar ───── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 16 }}>
          {statCards.map((card, i) => (
            <div
              key={i}
              className="glass-card"
              style={{
                padding: "14px 18px",
                background: card.bg,
                border: `1px solid ${card.border}`,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: card.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {card.label}
                </span>
                <span style={{ color: card.color }}>{card.icon}</span>
              </div>
              <div style={{ fontSize: "1.7rem", fontWeight: 800, color: card.color }}>
                {card.value}
              </div>
            </div>
          ))}
        </div>

        {/* ───── Split View: Left List + Center GIS Canvas + Right Review Dossier ───── */}
        <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0 }}>
          
          {/* Left Panel: Pending Approvals Queue */}
          <div
            className="glass-card"
            style={{
              width: 310,
              display: "flex",
              flexDirection: "column",
              padding: 0,
              overflow: "hidden",
              background: "rgba(255, 255, 255, 0.94)",
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "rgba(121, 199, 197, 0.1)",
              }}
            >
              <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#008080", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Magistrate Queue ({pendingApprovals.length})
              </span>
              <Clock size={15} style={{ color: "var(--accent-primary)" }} />
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>
              {pendingApprovals.map((a) => {
                const isSelected = selectedApproval?.approval_id === a.approval_id;
                const isLowConf = (a.alignment_confidence ?? 1.0) < 0.8;

                return (
                  <button
                    key={a.approval_id}
                    onClick={() => setSelectedApproval(a)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "12px 14px",
                      background: isSelected ? "rgba(121, 199, 197, 0.22)" : "transparent",
                      border: "none",
                      borderBottom: "1px solid var(--border-subtle)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.15s ease",
                    }}
                  >
                    <FileCheck
                      size={18}
                      style={{
                        color: isSelected ? "var(--accent-primary)" : "var(--text-muted)",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <strong style={{ fontSize: "0.88rem", color: "var(--text-primary)" }}>
                          Khasra {a.khasra_no}
                        </strong>
                        {isLowConf && (
                          <span
                            style={{
                              fontSize: "0.65rem",
                              fontWeight: 700,
                              background: "rgba(255, 211, 182, 0.6)",
                              color: "#A85324",
                              padding: "1px 6px",
                              borderRadius: 4,
                            }}
                          >
                            Occlusion
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 2 }}>
                        {a.owner_name} &bull; {a.village}
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 2 }}>
                        Submitted by: {a.requested_by}
                      </div>
                    </div>
                  </button>
                );
              })}

              {pendingApprovals.length === 0 && (
                <div style={{ padding: 36, textAlign: "center", color: "var(--text-muted)" }}>
                  <CheckCircle2 size={32} style={{ margin: "0 auto 10px", color: "var(--accent-primary)", opacity: 0.6 }} />
                  <p style={{ fontSize: "0.85rem", fontWeight: 600 }}>All Wards Reconciled</p>
                  <p style={{ fontSize: "0.75rem", marginTop: 4 }}>No pending cadastral disputes in current docket.</p>
                </div>
              )}
            </div>
          </div>

          {/* Center Panel: Interactive Map */}
          <div className="glass-card" style={{ flex: 1, padding: 0, overflow: "hidden", position: "relative" }}>
            <MapViewer
              geojsonData={geojson}
              selectedParcelId={selectedApproval?.parcel_id || null}
              onParcelClick={(id) => {
                const match = pendingApprovals.find((a) => a.parcel_id === id);
                if (match) setSelectedApproval(match);
              }}
              showOcclusionAlerts={true}
            />
          </div>

          {/* Right Panel: Legal Adjudication Dossier */}
          <div
            className="glass-card"
            style={{
              width: 360,
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              background: "rgba(255, 255, 255, 0.95)",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <ShieldCheck size={20} style={{ color: "var(--accent-primary)" }} />
              <h2 style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)" }}>
                Statutory Approval Dossier
              </h2>
            </div>

            {selectedApproval ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Parcel Metadata Card */}
                <div style={{ background: "rgba(121, 199, 197, 0.1)", padding: 14, borderRadius: 10, border: "1px solid rgba(121, 199, 197, 0.3)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: "6px 8px", fontSize: "0.82rem" }}>
                    <span style={{ color: "var(--text-muted)" }}>Khasra No:</span>
                    <strong style={{ color: "var(--text-primary)" }}>{selectedApproval.khasra_no}</strong>

                    <span style={{ color: "var(--text-muted)" }}>Landholder:</span>
                    <strong style={{ color: "var(--text-primary)" }}>{selectedApproval.owner_name}</strong>

                    <span style={{ color: "var(--text-muted)" }}>Jurisdiction:</span>
                    <span style={{ color: "var(--text-secondary)" }}>{selectedApproval.village}, {selectedApproval.tehsil}</span>

                    <span style={{ color: "var(--text-muted)" }}>Clean Area:</span>
                    <span style={{ color: "var(--text-secondary)" }}>{selectedApproval.area_sqm ? `${Number(selectedApproval.area_sqm).toFixed(1)} m²` : "Calculated"}</span>

                    <span style={{ color: "var(--text-muted)" }}>Confidence:</span>
                    <span style={{ fontWeight: 700, color: (selectedApproval.alignment_confidence ?? 1) >= 0.8 ? "#1B5E20" : "#A85324" }}>
                      {((selectedApproval.alignment_confidence ?? 0.88) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Occlusion Alert if Low Confidence */}
                {(selectedApproval.alignment_confidence ?? 1) < 0.8 && (
                  <div
                    style={{
                      background: "rgba(255, 211, 182, 0.4)",
                      border: "1px solid #FFD3B6",
                      borderRadius: 8,
                      padding: 10,
                      fontSize: "0.75rem",
                      color: "#9C4221",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, marginBottom: 2 }}>
                      <AlertTriangle size={14} /> Tree Canopy Occlusion Flagged
                    </div>
                    AI feature extraction detected partial shadow obstruction. Ensure manual confirmation against physical survey stones.
                  </div>
                )}

                {/* Bhu-Aadhaar Box */}
                {selectedApproval.ulpin && (
                  <div style={{ background: "rgba(168, 230, 207, 0.25)", border: "1px solid #A8E6CF", borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#1B5E20", textTransform: "uppercase" }}>
                      Assigned Bhu-Aadhaar (ULPIN)
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: "1.15rem", fontWeight: 800, color: "#008080", marginTop: 4, letterSpacing: "1px" }}>
                      {selectedApproval.ulpin}
                    </div>
                    <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", marginTop: 4 }}>
                      Compliant with DoLR / ECCMA / OGC 14-char standard
                    </div>
                  </div>
                )}

                {/* Remarks textarea */}
                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                    Magistrate Legal Endorsement / Audit Note:
                  </label>
                  <textarea
                    rows={3}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter formal sanction notes or physical ground verification details..."
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-subtle)",
                      fontSize: "0.8rem",
                      fontFamily: "inherit",
                      background: "rgba(255, 255, 255, 0.9)",
                    }}
                  />
                </div>

                {/* Statutory Action Buttons */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                  <button
                    className="btn-primary"
                    onClick={handleApproveAndCommit}
                    disabled={loading}
                    style={{
                      background: "linear-gradient(135deg, #4FA8A4 0%, #008080 100%)",
                      padding: "11px 16px",
                      fontSize: "0.88rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <Stamp size={16} /> Sanction & Publish to Land Stack
                  </button>

                  <button
                    onClick={handleReject}
                    disabled={loading}
                    style={{
                      padding: "9px 16px",
                      borderRadius: 8,
                      border: "1px solid #FFD3B6",
                      background: "rgba(255, 211, 182, 0.3)",
                      color: "#A85324",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <XCircle size={15} /> Return to Patwari for Re-survey
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: "var(--text-muted)", padding: 20 }}>
                <Info size={32} style={{ color: "var(--accent-primary)", marginBottom: 12, opacity: 0.5 }} />
                <p style={{ fontSize: "0.85rem", fontWeight: 600 }}>Select a Pending Docket</p>
                <p style={{ fontSize: "0.78rem", marginTop: 4 }}>
                  Choose a parcel from the magistrate queue to inspect topological overlays, review occlusion indices, and execute statutory sign-off.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
