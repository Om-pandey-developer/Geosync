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
  Info,
  History,
  Copy,
  Lock,
  X,
} from "lucide-react";
import type { FeatureCollection } from "geojson";

const MapViewer = dynamic(() => import("@/components/MapViewer"), { ssr: false });
import MapSourceModal, { BASEMAP_PRESETS, BasemapOption } from "@/components/MapSourceModal";
import RoleGuard from "@/components/RoleGuard";
import { API } from "@/lib/api";
import { generateFormIIPdf } from "@/lib/pdfGenerator";
import { formatAlignmentStatus } from "@/lib/statusHelper";

interface DashboardStats {
  total_parcels: number;
  raw_count: number;
  aligned_count: number;
  cleaned_count: number;
  ulpin_assigned_count: number;
  published_count?: number;
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
  const [committedSignatures, setCommittedSignatures] = useState<Record<string, string>>({});
  const [docketFilter, setDocketFilter] = useState<"ALL" | "PENDING" | "OCCLUDED">("ALL");

  // Old Map & New Map Source Layer Controls
  const [isMapSourceModalOpen, setIsMapSourceModalOpen] = useState(false);
  const [activeBasemap, setActiveBasemap] = useState<BasemapOption>(BASEMAP_PRESETS[0]);
  const [activeOldMapPresetId, setActiveOldMapPresetId] = useState<string>("mohanlalganj-1974");
  const [customOldMapGeojson, setCustomOldMapGeojson] = useState<FeatureCollection | null>(null);
  const [scannedMapOverlayUrl, setScannedMapOverlayUrl] = useState<string | null>(null);
  const [oldMapOpacity, setOldMapOpacity] = useState<number>(80);
  const [oldMapStrokeColor, setOldMapStrokeColor] = useState<string>("#D97706");

  useEffect(() => {
    const handleOpenModal = () => setIsMapSourceModalOpen(true);
    window.addEventListener("open-map-source-modal", handleOpenModal);
    return () => window.removeEventListener("open-map-source-modal", handleOpenModal);
  }, []);
  const [auditLogsModal, setAuditLogsModal] = useState<{
    isOpen: boolean;
    parcelId: string;
    khasraNo: string;
    logs: any[];
    loading: boolean;
  }>({
    isOpen: false,
    parcelId: "",
    khasraNo: "",
    logs: [],
    loading: false,
  });

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, pendingRes, geojsonRes] = await Promise.all([
        fetch(`${API}/dashboard/stats`),
        fetch(`${API}/approvals/pending`),
        fetch(`${API}/parcels/geojson`),
      ]);
      if (!statsRes.ok || !pendingRes.ok || !geojsonRes.ok) throw new Error("Data error");
      const statsData = await statsRes.json();
      const pendingData = await pendingRes.json();
      const geojsonData = await geojsonRes.json();

      setStats(statsData);
      setPendingApprovals(pendingData);
      setGeojson(geojsonData);

      // Auto-select first docket if none selected
      setSelectedApproval((prev) => {
        if (prev && pendingData.some((a: PendingApproval) => a.approval_id === prev.approval_id)) {
          return prev;
        }
        return pendingData.length > 0 ? pendingData[0] : null;
      });
    } catch {
      toast.error("Using offline local proxy database...");
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open Audit Log Modal
  const openAuditLogs = async (parcelId: string, khasraNo: string) => {
    setAuditLogsModal({ isOpen: true, parcelId, khasraNo, logs: [], loading: true });
    try {
      const res = await fetch(`${API}/v1/parcels/${parcelId}/audit-logs`);
      if (res.ok) {
        const logs = await res.json();
        setAuditLogsModal({ isOpen: true, parcelId, khasraNo, logs, loading: false });
      } else {
        setAuditLogsModal((prev) => ({ ...prev, loading: false }));
        toast.error("No audit logs found for this parcel");
      }
    } catch {
      setAuditLogsModal((prev) => ({ ...prev, loading: false }));
      toast.error("Failed to load audit logs");
    }
  };

  // Legal HITL Approval and Database Commit
  const handleApproveAndCommit = async () => {
    if (!selectedApproval) return;
    setLoading(true);
    const tId = toast.loading(`Executing legal HITL validation for Khasra ${selectedApproval.khasra_no}...`);

    try {
      // 1. Legal Database Commit with SHA-256 signature
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

      let signature = "";
      if (commitRes.ok) {
        const commitData = await commitRes.json();
        signature = commitData.digital_signature || "";
        if (signature) {
          setCommittedSignatures((prev) => ({
            ...prev,
            [selectedApproval.parcel_id]: signature,
          }));
        }
      }

      // Step 2: Update workflow approval docket
      if (!selectedApproval.approval_id.startsWith("preview-")) {
        await fetch(`${API}/approvals/${selectedApproval.approval_id}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reviewed_by: "tehsildar_mohanlalganj",
            action: "approved",
            remarks: remarks || "Verified boundary conforms to NAKSHA 5cm drone survey.",
          }),
        });
      }

      toast.success(
        `Khasra ${selectedApproval.khasra_no} approved & published! SHA-256 seal: ${signature ? signature.slice(0, 12) + "…" : "Generated"}`,
        { id: tId, duration: 4000 }
      );
      setSelectedApproval(null);
      setRemarks("");
      await fetchData();
    } catch {
      toast.error("Error committing parcel to registry", { id: tId });
    }
    setLoading(false);
  };

  const handleResetDemo = async () => {
    try {
      const tId = toast.loading("Restoring demo dockets...");
      await fetch(`${API}/approvals/seed-demo`, { method: "POST" });
      await fetchData();
      toast.success("Loaded 4 demo approval dockets!", { id: tId });
    } catch {
      toast.error("Failed to seed demo dockets");
    }
  };

  const handleReject = async () => {
    if (!selectedApproval) return;
    setLoading(true);
    const tId = toast.loading(`Returning Khasra ${selectedApproval.khasra_no} for re-survey...`);

    try {
      if (!selectedApproval.approval_id.startsWith("preview-")) {
        await fetch(`${API}/approvals/${selectedApproval.approval_id}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reviewed_by: "tehsildar_mohanlalganj",
            action: "rejected",
            remarks: remarks || "Boundary discrepancy detected against 5cm drone raster.",
          }),
        });
      }
      toast.success(`Khasra ${selectedApproval.khasra_no} returned to Patwari field queue`, { id: tId });
      setSelectedApproval(null);
      setRemarks("");
      await fetchData();
    } catch {
      toast.error("Error returning parcel to queue", { id: tId });
    }
    setLoading(false);
  };

  const filteredApprovals = pendingApprovals.filter((a) => {
    if (docketFilter === "ALL") return true;
    if (docketFilter === "PENDING") return a.status === "pending";
    if (docketFilter === "OCCLUDED") return (a.alignment_confidence ?? 1.0) < 0.8;
    return true;
  });

  const statCards = [
    {
      label: "Total Ward Parcels",
      value: stats?.total_parcels ?? 18,
      icon: <Layers size={20} />,
      accent: "var(--accent-primary)",
      sub: "Ward 12 Mohanlalganj",
    },
    {
      label: "Bhu-Aadhaar Assigned",
      value: stats?.ulpin_assigned_count ?? 12,
      icon: <Fingerprint size={20} />,
      accent: "var(--accent-mint)",
      sub: "14-digit DoLR ULPIN",
    },
    {
      label: "Pending Adjudications",
      value: pendingApprovals.length,
      icon: <Clock size={20} />,
      accent: "var(--accent-gold)",
      sub: "Active Bench Docket",
    },
    {
      label: "Legally Committed",
      value: stats?.published_count ?? stats?.approved_count ?? 5,
      icon: <CheckCircle2 size={20} />,
      accent: "var(--accent-judicial)",
      sub: "SHA-256 e-Sign Form-II",
    },
  ];

  return (
    <RoleGuard requiredRole="tehsildar">
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", paddingTop: 64, overflow: "hidden" }}>
      <main style={{ flex: 1, padding: "20px 24px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        
        {/* ───── Header Bar ───── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h1 style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--text-primary)" }}>
                Revenue Magistrate HITL Adjudication Chamber
              </h1>
              <span className="badge-pastel-teal">
                DILRMP 3.0 / NAKSHA Pilot
              </span>
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: 3 }}>
              Mohanlalganj Tehsil, Lucknow District &mdash; Human-in-the-Loop Legal Validation Engine
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="btn-secondary" onClick={handleResetDemo} style={{ padding: "8px 14px", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: 6 }}>
              <RefreshCw size={14} /> Reset Demo Dockets
            </button>
            <button className="btn-ghost" onClick={fetchData} style={{ padding: "8px 14px", fontSize: "0.82rem" }}>
              <RefreshCw size={14} /> Refresh Records
            </button>
          </div>
        </div>

        {/* ───── Stat Cards Bar ───── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 16 }}>
          {statCards.map((card, i) => (
            <div
              key={i}
              className="stats-counter-card"
            >
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: card.accent }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                  {card.label}
                </span>
                <span style={{ color: card.accent }}>{card.icon}</span>
              </div>
              <div style={{ fontSize: "1.85rem", fontWeight: 900, color: card.accent }}>
                {card.value}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2, fontWeight: 500 }}>
                {card.sub}
              </div>
            </div>
          ))}
        </div>

        {/* ───── Split View: Left List + Center Map + Right Dossier ───── */}
        <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0 }}>
          
          {/* Left Panel: Pending Approvals Queue */}
          <div
            className="glass-card"
            style={{
              width: 320,
              display: "flex",
              flexDirection: "column",
              padding: 0,
              overflow: "hidden",
              background: "#FFFFFF",
              borderRadius: "var(--radius-lg)",
              border: "1.5px solid var(--border-glass)",
            }}
          >
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
              <div>
                <span style={{ fontSize: "0.9375rem", fontWeight: 800, color: "var(--text-primary)" }}>
                  Magistrate Docket
                </span>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>
                  {pendingApprovals.length} cases awaiting decree
                </div>
              </div>
              <Clock size={18} style={{ color: "var(--accent-gold)" }} />
            </div>

            {/* Filter tabs */}
            <div style={{ display: "flex", gap: 4, padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-secondary)" }}>
              {[
                { id: "ALL", label: `All (${pendingApprovals.length})` },
                { id: "PENDING", label: `Pending (${pendingApprovals.filter(a => a.status === 'pending').length})` },
                { id: "OCCLUDED", label: `Occluded (${pendingApprovals.filter(a => (a.alignment_confidence ?? 1.0) < 0.8).length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setDocketFilter(tab.id as any)}
                  style={{
                    flex: 1,
                    padding: "4px 6px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    border: docketFilter === tab.id ? "1px solid var(--accent-judicial)" : "1px solid var(--border-glass)",
                    background: docketFilter === tab.id ? "var(--accent-judicial)" : "#FFFFFF",
                    color: docketFilter === tab.id ? "#FFFFFF" : "var(--text-secondary)",
                    cursor: "pointer",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "6px" }}>
              {filteredApprovals.map((a) => {
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
                      gap: 12,
                      padding: "12px 14px",
                      borderRadius: "var(--radius-md)",
                      marginBottom: 4,
                      background: isSelected ? "var(--accent-judicial-bg)" : "transparent",
                      border: isSelected ? "1.5px solid #93C5FD" : "1px solid transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.15s ease",
                    }}
                  >
                    <FileCheck
                      size={18}
                      style={{
                        color: isSelected ? "var(--accent-judicial)" : "var(--text-muted)",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <strong style={{ fontSize: "0.875rem", color: "var(--text-primary)" }}>
                          Khasra {a.khasra_no}
                        </strong>
                        {isLowConf && (
                          <span
                            style={{
                              fontSize: "0.6875rem",
                              fontWeight: 800,
                              background: "var(--accent-gold-bg)",
                              color: "#92400E",
                              padding: "2px 6px",
                              borderRadius: "var(--radius-sm)",
                              border: "1px solid #FDE68A",
                            }}
                          >
                            Occluded
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 2, fontWeight: 500 }}>
                        {a.owner_name} &bull; {a.village}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>
                        Submitted by: {a.requested_by}
                      </div>
                    </div>
                  </button>
                );
              })}

              {filteredApprovals.length === 0 && (
                <div style={{ padding: 36, textAlign: "center", color: "var(--text-muted)" }}>
                  <CheckCircle2 size={32} style={{ margin: "0 auto 10px", color: "var(--accent-primary)", opacity: 0.8 }} />
                  <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)" }}>All Wards Reconciled</p>
                  <p style={{ fontSize: "0.8125rem", marginTop: 4, marginBottom: 12 }}>No pending cadastral disputes in current docket.</p>
                  <button onClick={handleResetDemo} className="btn-primary" style={{ padding: "6px 14px", fontSize: "0.78rem" }}>
                    Load Demo Dockets
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Center Panel: Map Canvas */}
          <div className="glass-card" style={{ flex: 1, padding: 0, overflow: "hidden", position: "relative", borderRadius: "var(--radius-lg)" }}>
            <MapViewer
              geojsonData={geojson}
              selectedParcelId={selectedApproval?.parcel_id || null}
              onParcelClick={(id) => {
                const match = pendingApprovals.find((a) => a.parcel_id === id);
                if (match) {
                  setSelectedApproval(match);
                } else if (geojson) {
                  const feat = geojson.features.find((f: any) => f.properties?.id === id);
                  if (feat?.properties) {
                    setSelectedApproval({
                      approval_id: "preview-" + id,
                      parcel_id: id,
                      requested_by: "patwari_mohanlalganj",
                      status: "pending",
                      requested_at: new Date().toISOString(),
                      khasra_no: feat.properties.khasra_no || "N/A",
                      owner_name: feat.properties.owner_name || "Unknown",
                      village: feat.properties.village || "Mohanlalganj",
                      tehsil: feat.properties.tehsil || "Mohanlalganj",
                      district: "Lucknow",
                      ulpin: feat.properties.ulpin || "2601A4B7C9D2E3",
                      area_sqm: feat.properties.area_sqm || 1420.5,
                      alignment_status: feat.properties.alignment_status || "aligned",
                      alignment_confidence: feat.properties.alignment_confidence ?? 0.94,
                    });
                  }
                }
              }}
              showOcclusionAlerts={true}
              // Old Map & New Map Source Layer Controls
              basemapUrl={activeBasemap.url}
              basemapAttribution={activeBasemap.attribution}
              basemapName={activeBasemap.name}
              customOldMapGeojson={customOldMapGeojson}
              scannedMapOverlayUrl={scannedMapOverlayUrl}
              oldMapOpacity={oldMapOpacity}
              oldMapStrokeColor={oldMapStrokeColor}
              onOpenMapSourceModal={() => setIsMapSourceModalOpen(true)}
            />
          </div>

          {/* Right Panel: Dossier (Fix Issue 9: Heading and icon prominent, matching visual hierarchy) */}
          <div
            className="glass-card"
            style={{
              width: 360,
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              background: "#FFFFFF",
              borderRadius: "var(--radius-lg)",
              overflowY: "auto",
            }}
          >
            {/* Fix Issue 9: Prominent, high-contrast heading matching left panel */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 34, height: 34, borderRadius: "var(--radius-sm)", background: "var(--accent-primary-bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-primary)" }}>
                <ShieldCheck size={20} />
              </div>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text-primary)" }}>
                Statutory Approval Dossier
              </h2>
            </div>

            {selectedApproval ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ background: "var(--bg-secondary)", padding: 14, borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "95px 1fr", gap: "8px 10px", fontSize: "0.875rem" }}>
                    <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Khasra No:</span>
                    <strong style={{ color: "var(--text-primary)" }}>{selectedApproval.khasra_no}</strong>

                    <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Landholder:</span>
                    <strong style={{ color: "var(--text-primary)" }}>{selectedApproval.owner_name}</strong>

                    <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Location:</span>
                    <span style={{ color: "var(--text-secondary)" }}>{selectedApproval.village}, {selectedApproval.tehsil}</span>

                    <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Area:</span>
                    <span style={{ color: "var(--text-secondary)" }}>{selectedApproval.area_sqm ? `${Number(selectedApproval.area_sqm).toFixed(1)} m²` : "Calculated"}</span>

                    <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Confidence:</span>
                    <span style={{ fontWeight: 800, color: (selectedApproval.alignment_confidence ?? 1) >= 0.8 ? "var(--accent-mint)" : "var(--accent-sun)" }}>
                      {((selectedApproval.alignment_confidence ?? 0.88) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Occlusion Warning Alert */}
                {(selectedApproval.alignment_confidence ?? 1) < 0.8 && (
                  <div
                    style={{
                      background: "var(--accent-sun-bg)",
                      border: "1px solid #FDE68A",
                      borderRadius: "var(--radius-md)",
                      padding: "10px 12px",
                      fontSize: "0.8125rem",
                      color: "#92400E",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, marginBottom: 2 }}>
                      <AlertTriangle size={15} /> Tree Canopy Occlusion Flagged
                    </div>
                    AI feature extraction detected partial shadow obstruction. Ensure physical survey stone verification before signing.
                  </div>
                )}

                {/* Bhu-Aadhaar Box */}
                {selectedApproval.ulpin && (
                  <div style={{ background: "var(--accent-mint-bg)", border: "1px solid #A7F3D0", borderRadius: "var(--radius-md)", padding: 12 }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--accent-mint)", textTransform: "uppercase" }}>
                      Assigned Bhu-Aadhaar (ULPIN)
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: "1.15rem", fontWeight: 800, color: "var(--accent-mint)", marginTop: 4, letterSpacing: "1.5px" }}>
                      {selectedApproval.ulpin}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 4 }}>
                      Compliant with DoLR / ECCMA / OGC standards
                    </div>
                  </div>
                )}

                {/* Endorsement textarea */}
                <div>
                  <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
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
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-glass)",
                      fontSize: "0.875rem",
                      fontFamily: "inherit",
                      background: "#FFFFFF",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>

                {/* Cryptographic SHA-256 Seal Banner if committed */}
                {committedSignatures[selectedApproval.parcel_id] && (
                  <div
                    style={{
                      background: "#F0FDF4",
                      border: "1px solid #86EFAC",
                      borderRadius: "var(--radius-md)",
                      padding: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#15803D", display: "flex", alignItems: "center", gap: 5 }}>
                        <Lock size={13} /> Authoritative SHA-256 Seal
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(committedSignatures[selectedApproval.parcel_id]);
                          toast.success("SHA-256 signature copied!");
                        }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#15803D", display: "flex", alignItems: "center", gap: 3, fontSize: "0.7rem", fontWeight: 700 }}
                      >
                        <Copy size={12} /> Copy
                      </button>
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "#166534", wordBreak: "break-all", background: "#DCFCE7", padding: "4px 8px", borderRadius: 4 }}>
                      {committedSignatures[selectedApproval.parcel_id]}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button
                    className="btn-primary"
                    onClick={handleApproveAndCommit}
                    disabled={loading}
                    style={{ width: "100%", padding: "11px 16px" }}
                  >
                    <Stamp size={16} /> Sanction & Publish to Land Stack
                  </button>

                  {/* Task 2.6: Form-II Survey Certificate PDF Export */}
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      generateFormIIPdf({
                        khasraNo: selectedApproval.khasra_no,
                        ownerName: selectedApproval.owner_name,
                        village: selectedApproval.village,
                        tehsil: selectedApproval.tehsil,
                        district: selectedApproval.district,
                        ulpin: selectedApproval.ulpin || "9YYD56AA2Z9Y3A",
                        areaSqm: selectedApproval.area_sqm || 5714.41,
                        alignmentConfidence: selectedApproval.alignment_confidence ?? 0.96,
                        officerId: "REV-TEH-3210 (Mohanlalganj)",
                        approvalDate: new Date().toLocaleDateString("en-IN"),
                        endorsementNote: remarks || "Statutory survey adjudication verified under DILRMP 3.0 protocol.",
                        isOccluded: (selectedApproval.alignment_confidence ?? 1) < 0.8,
                        digitalSignature: committedSignatures[selectedApproval.parcel_id],
                      });
                      toast.success(`Form-II Certificate for Khasra ${selectedApproval.khasra_no} generated!`);
                    }}
                    style={{
                      width: "100%",
                      background: "#F0FDFA",
                      borderColor: "#99F6E4",
                      color: "#0D9488",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      padding: "10px 16px",
                      fontWeight: 700,
                    }}
                  >
                    <FileCheck size={16} /> Download Form-II Survey Certificate (PDF)
                  </button>

                  <button
                    className="btn-secondary"
                    onClick={() => openAuditLogs(selectedApproval.parcel_id, selectedApproval.khasra_no)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      padding: "9px 16px",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                    }}
                  >
                    <History size={15} /> View Cadastral Audit Trail
                  </button>

                  <button
                    className="btn-secondary"
                    onClick={handleReject}
                    disabled={loading}
                    style={{
                      width: "100%",
                      color: "var(--accent-coral) !important",
                      borderColor: "#FECDD3",
                    }}
                  >
                    <XCircle size={16} style={{ color: "var(--accent-coral)" }} /> Return for Re-survey
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: "var(--text-muted)", padding: 20 }}>
                <Info size={32} style={{ color: "var(--accent-primary)", marginBottom: 12, opacity: 0.7 }} />
                <p style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)" }}>Select a Pending Docket</p>
                <p style={{ fontSize: "0.8125rem", marginTop: 4, color: "var(--text-secondary)" }}>
                  Choose a parcel from the queue to inspect boundaries, check occlusion indices, and execute statutory sign-off.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Cadastral Audit Log Modal */}
      {auditLogsModal.isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            className="glass-card animate-fade-in-up"
            style={{
              width: "100%",
              maxWidth: 620,
              background: "#FFFFFF",
              borderRadius: "var(--radius-lg)",
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: "var(--accent-primary-bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-primary)" }}>
                  <History size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)" }}>
                    Khasra {auditLogsModal.khasraNo} — Cadastral Audit Trail
                  </h3>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Authoritative DILRMP 3.0 immutable legal ledger with SHA-256 cryptographic proofs
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAuditLogsModal((prev) => ({ ...prev, isOpen: false }))}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ overflowY: "auto", flex: 1, paddingRight: 4 }}>
              {auditLogsModal.loading ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-muted)" }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 8px" }} />
                  <p style={{ fontSize: "0.875rem" }}>Verifying cryptographic signatures in audit ledger…</p>
                </div>
              ) : auditLogsModal.logs.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 16px", color: "var(--text-muted)", background: "var(--bg-glass-subtle)", borderRadius: "var(--radius-md)" }}>
                  <Lock size={28} style={{ margin: "0 auto 8px", color: "var(--accent-primary)" }} />
                  <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)" }}>No Audit Records Yet</p>
                  <p style={{ fontSize: "0.75rem", marginTop: 4 }}>
                    Audit entries with SHA-256 digital signatures are recorded whenever a parcel is committed or undergoes statutory adjudication.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {auditLogsModal.logs.map((log: any, idx: number) => (
                    <div
                      key={log.id || idx}
                      style={{
                        padding: 14,
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-glass)",
                        background: "#F8FAFC",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <span
                          style={{
                            fontSize: "0.7rem",
                            fontWeight: 800,
                            padding: "2px 8px",
                            borderRadius: 4,
                            background: log.action === "COMMITTED" ? "#DCFCE7" : "var(--accent-primary-bg)",
                            color: log.action === "COMMITTED" ? "#15803D" : "var(--accent-primary)",
                            textTransform: "uppercase",
                          }}
                        >
                          {log.action}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {new Date(log.timestamp).toLocaleString("en-IN")}
                        </span>
                      </div>

                      <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: 8 }}>
                        Officer: <strong style={{ color: "var(--text-primary)" }}>{log.officer_id}</strong> ({log.officer_role})
                      </div>

                      {/* Cryptographic SHA-256 Box */}
                      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 4, padding: "6px 8px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                          <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                            SHA-256 Signature Hash
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(log.digital_signature);
                              toast.success("Signature hash copied!");
                            }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent-primary)", fontSize: "0.7rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}
                          >
                            <Copy size={11} /> Copy
                          </button>
                        </div>
                        <div style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "#0F172A", wordBreak: "break-all" }}>
                          {log.digital_signature}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
              <button
                className="btn-primary"
                onClick={() => setAuditLogsModal((prev) => ({ ...prev, isOpen: false }))}
                style={{ padding: "8px 18px", fontSize: "0.875rem" }}
              >
                Close Audit View
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
