"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
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
  ChevronDown,
  ChevronUp,
  Scale,
  Search,
  LogOut,
  ChevronRight,
  SplitSquareVertical,
} from "lucide-react";
import type { FeatureCollection } from "geojson";

const MapViewer = dynamic(() => import("@/components/MapViewer"), { ssr: false });
import MapSourceModal, { BASEMAP_PRESETS, BasemapOption } from "@/components/MapSourceModal";
import RoleGuard from "@/components/RoleGuard";
import { API } from "@/lib/api";
import { generateFormIIPdf } from "@/lib/pdfGenerator";
import { formatAlignmentStatus } from "@/lib/statusHelper";
import { useAuth } from "@/lib/authContext";

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
  const router = useRouter();
  const { officer, logout } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [committedSignatures, setCommittedSignatures] = useState<Record<string, string>>({});
  const [docketFilter, setDocketFilter] = useState<"ALL" | "PENDING" | "OCCLUDED">("ALL");
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isDossierCollapsed, setIsDossierCollapsed] = useState(false);
  const [docketSearch, setDocketSearch] = useState("");
  const [isCurtainSwipeActive, setIsCurtainSwipeActive] = useState(false);

  // Old Map & New Map Source Layer Controls
  const [isMapSourceModalOpen, setIsMapSourceModalOpen] = useState(false);
  const [activeBasemap, setActiveBasemap] = useState<BasemapOption>(BASEMAP_PRESETS[0]);
  const [activeOldMapPresetId, setActiveOldMapPresetId] = useState<string>("mohanlalganj-1974");
  const [customOldMapGeojson, setCustomOldMapGeojson] = useState<FeatureCollection | null>(null);
  const [scannedMapOverlayUrl, setScannedMapOverlayUrl] = useState<string | null>(null);
  const [droneMapOverlayUrl, setDroneMapOverlayUrl] = useState<string | null>(null);
  const [isSideBySideActive, setIsSideBySideActive] = useState<boolean>(true);
  const [alignmentSession, setAlignmentSession] = useState<{
    confidence?: number;
    rmse?: number;
    keypoints?: number;
    algorithm?: string;
    parcelsCount?: number;
    transmittedAt?: string;
    transmittedBy?: string;
  } | null>(null);
  const [oldMapOpacity, setOldMapOpacity] = useState<number>(80);
  const [oldMapStrokeColor, setOldMapStrokeColor] = useState<string>("#D97706");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("geosync_alignment_session");
      if (saved) {
        const session = JSON.parse(saved);
        if (session.isAligned) {
          setDroneMapOverlayUrl(session.droneMapOverlayUrl || "/sample-drone-orthomosaic.svg");
          setScannedMapOverlayUrl(session.scannedMapOverlayUrl || "/sample-cadastral-map.svg");
          setIsSideBySideActive(true);
          setAlignmentSession(session);
        }
      } else {
        setDroneMapOverlayUrl("/sample-drone-orthomosaic.svg");
        setScannedMapOverlayUrl("/sample-cadastral-map.svg");
        setIsSideBySideActive(true);
      }
    } catch (e) {
      console.error("Session restore note:", e);
    }
  }, []);

  useEffect(() => {
    const handleOpenModal = () => setIsMapSourceModalOpen(true);
    window.addEventListener("open-map-source-modal", handleOpenModal);
    return () => window.removeEventListener("open-map-source-modal", handleOpenModal);
  }, []);

  // Smooth click-outside dismiss for profile dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("#tehsildar-profile-menu-container")) {
        setIsProfileDropdownOpen(false);
      }
    };
    if (isProfileDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isProfileDropdownOpen]);

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
      const [statsRes, approvalsRes, geojsonRes] = await Promise.all([
        fetch(`${API}/dashboard/stats`).catch(() => null),
        fetch(`${API}/approvals/pending`).catch(() => null),
        fetch(`${API}/parcels/geojson`).catch(() => null),
      ]);

      if (statsRes && statsRes.ok) {
        setStats(await statsRes.json());
      }
      if (approvalsRes && approvalsRes.ok) {
        const raw = await approvalsRes.json();
        const mapped: PendingApproval[] = raw.map((item: any) => ({
          approval_id: item.approval_id || item.id,
          parcel_id: item.parcel_id || item.parcel?.id,
          requested_by: item.requested_by,
          status: item.status,
          requested_at: item.requested_at || item.created_at,
          khasra_no: item.khasra_no || item.parcel?.khasra_no || "N/A",
          owner_name: item.owner_name || item.parcel?.owner_name || "Unknown",
          village: item.village || item.parcel?.village || "Mohanlalganj",
          tehsil: item.tehsil || item.parcel?.tehsil || "Mohanlalganj",
          district: item.district || item.parcel?.district || "Lucknow",
          ulpin: item.ulpin || item.parcel?.ulpin || null,
          area_sqm: item.area_sqm ?? item.parcel?.area_sqm ?? null,
          alignment_status: item.alignment_status || item.parcel?.alignment_status || "aligned",
          alignment_confidence: item.alignment_confidence ?? item.parcel?.alignment_confidence ?? 0.92,
        }));
        setPendingApprovals(mapped);
        if (mapped.length > 0) {
          setSelectedApproval((prev) => {
            if (!prev || prev.khasra_no === "N/A") return mapped[0];
            const match = mapped.find(
              (m) => m.parcel_id === prev.parcel_id || m.approval_id === prev.approval_id
            );
            return match || prev;
          });
        }
      }
      if (geojsonRes && geojsonRes.ok) {
        setGeojson(await geojsonRes.json());
      }
    } catch {
      toast.error("Connecting to local offline fallback database...", { duration: 2500 });
    }
  }, [selectedApproval]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleResetDemo = async () => {
    const tId = toast.loading("Resetting Tehsildar queue with 4 test dockets...");
    try {
      const res = await fetch(`${API}/v1/reset-demo`, { method: "POST" });
      if (!res.ok) throw new Error("Reset endpoint failed");
      toast.success("Demo Dockets Reset: 4 parcels queued for adjudication!", { id: tId });
      setSelectedApproval(null);
      await fetchData();
    } catch {
      toast.error("Failed to reset demo state on backend", { id: tId });
    }
  };

  // Legal HITL Approval and Database Commit
  const handleApproveAndCommit = async () => {
    if (!selectedApproval) return;
    setLoading(true);
    const tId = toast.loading(`Executing legal HITL validation for Khasra ${selectedApproval.khasra_no}...`);

    try {
      const commitRes = await fetch(`${API}/v1/commit-parcel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parcel_id: selectedApproval.parcel_id,
          ulpin: selectedApproval.ulpin,
          officer_id: officer?.officerId || "REV-TEH-3210 (Priya Sharma, PCS)",
          audit_notes: remarks || "Statutory revenue adjudication verified under DILRMP 3.0 protocol.",
        }),
      });

      if (!commitRes.ok) {
        const err = await commitRes.json();
        throw new Error(err.detail || "Commit rejected by state machine");
      }

      const commitData = await commitRes.json();
      const shaSig = commitData.sha256_hash;

      setCommittedSignatures((prev) => ({
        ...prev,
        [selectedApproval.parcel_id]: shaSig,
      }));

      if (!selectedApproval.approval_id.startsWith("preview-")) {
        await fetch(`${API}/approvals/${selectedApproval.approval_id}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reviewed_by: officer?.officerId || "REV-TEH-3210 (Priya Sharma, PCS)",
            action: "approved",
            remarks: remarks || "Boundary endorsed and officially committed.",
          }),
        });
      }

      toast.success(
        `Khasra ${selectedApproval.khasra_no} committed as 'PUBLISHED'! SHA-256 seal generated.`,
        { id: tId, duration: 4000 }
      );

      setRemarks("");
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Approval execution error", { id: tId });
    }
    setLoading(false);
  };

  const openAuditLogs = async (parcelId: string, khasraNo: string) => {
    setAuditLogsModal({
      isOpen: true,
      parcelId,
      khasraNo,
      logs: [],
      loading: true,
    });

    try {
      const res = await fetch(`${API}/v1/audit-trail/${parcelId}`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogsModal((prev) => ({
          ...prev,
          logs: data.trail || [],
          loading: false,
        }));
      } else {
        setAuditLogsModal((prev) => ({ ...prev, loading: false }));
      }
    } catch {
      setAuditLogsModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleReject = async () => {
    if (!selectedApproval) return;
    setLoading(true);
    const tId = toast.loading(`Rejecting alignment for Khasra ${selectedApproval.khasra_no}...`);

    try {
      if (!selectedApproval.approval_id.startsWith("preview-")) {
        await fetch(`${API}/approvals/${selectedApproval.approval_id}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reviewed_by: officer?.officerId || "REV-TEH-3210 (Priya Sharma, PCS)",
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
    const q = docketSearch.toLowerCase().trim();
    const matchesSearch =
      !q ||
      a.khasra_no.toLowerCase().includes(q) ||
      a.owner_name.toLowerCase().includes(q) ||
      (a.ulpin && a.ulpin.toLowerCase().includes(q));

    if (!matchesSearch) return false;
    if (docketFilter === "ALL") return true;
    if (docketFilter === "PENDING") return a.status === "pending";
    if (docketFilter === "OCCLUDED") return (a.alignment_confidence ?? 1.0) < 0.8;
    return true;
  });

  return (
    <RoleGuard requiredRole="tehsildar">
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", paddingTop: 68, overflow: "hidden", background: "var(--bg-primary)" }}>
        <main style={{ flex: 1, padding: "12px 20px", display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          
          {/* ───── Sleek Top Control Bar: Tehsildar Profile Button (Left) & Compact KPI Chips (Right) ───── */}
          <div
            id="tehsildar-profile-menu-container"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
              flexShrink: 0,
              position: "relative",
              zIndex: 600,
            }}
          >
            {/* LEFT: Tehsildar Profile Button (Matching Patwari layout) with Dropdown */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setIsProfileDropdownOpen((prev) => !prev)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 14px",
                  borderRadius: "var(--radius-sm)",
                  background: isProfileDropdownOpen ? "#DBEAFE" : "#EFF6FF",
                  border: isProfileDropdownOpen ? "1.5px solid #1E3A8A" : "1.5px solid #93C5FD",
                  cursor: "pointer",
                  transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                  whiteSpace: "nowrap",
                  boxShadow: isProfileDropdownOpen
                    ? "0 4px 14px rgba(30, 58, 138, 0.18)"
                    : "0 1px 3px rgba(30, 58, 138, 0.08)",
                }}
                title={isProfileDropdownOpen ? "Close Profile Menu" : "Open Profile Menu & Magistrate Actions"}
                aria-expanded={isProfileDropdownOpen}
              >
                {/* Avatar Badge */}
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)",
                    color: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.72rem",
                    fontWeight: 900,
                    border: "1px solid #93C5FD",
                    flexShrink: 0,
                  }}
                >
                  PS
                </div>

                {/* Name & TEHSILDAR Role Badge (Matching Patwari style) */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 800, color: "#1E3A8A" }}>
                    {officer?.name || "Smt. Priya Sharma, PCS"}
                  </span>
                  <span
                    style={{
                      fontSize: "0.625rem",
                      fontWeight: 800,
                      padding: "1px 6px",
                      borderRadius: 4,
                      background: "#1E3A8A",
                      color: "#FFFFFF",
                      letterSpacing: "0.02em",
                    }}
                  >
                    TEHSILDAR
                  </span>
                </div>

                {/* Animated Chevron */}
                <ChevronDown
                  size={15}
                  style={{
                    color: "#1E3A8A",
                    transform: isProfileDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                />
              </button>

              {/* ═══════════ PROFILE DROPDOWN MENU WITH DIRECT MAGISTRATE DOCKET (IN FRONT) ═══════════ */}
              {isProfileDropdownOpen && (
                <div
                  className="glass-card animate-fade-in-up"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    left: 0,
                    zIndex: 700,
                    width: 360,
                    maxHeight: "calc(100vh - 120px)",
                    background: "rgba(255, 255, 255, 0.98)",
                    borderRadius: "var(--radius-lg)",
                    boxShadow: "0 14px 40px rgba(15, 23, 42, 0.20), 0 4px 12px rgba(15, 23, 42, 0.08)",
                    border: "1.5px solid var(--border-glass)",
                    overflowY: "auto",
                    padding: "10px",
                    display: "flex",
                    flexDirection: "column",
                    transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                >
                  {/* Officer Information Header */}
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: "var(--radius-md)",
                      background: "linear-gradient(135deg, #EFF6FF 0%, #F8FAFC 100%)",
                      border: "1px solid #DBEAFE",
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)",
                          color: "#FFFFFF",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.75rem",
                          fontWeight: 900,
                          border: "1.5px solid #F59E0B",
                          flexShrink: 0,
                        }}
                      >
                        PS
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#1E3A8A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {officer?.name || "Smt. Priya Sharma, PCS"}
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>
                          Assistant Collector & Revenue Magistrate
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: 8, paddingTop: 6, borderTop: "1px dashed #BFDBFE", fontSize: "0.6875rem", color: "#1E3A8A", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span>Mohanlalganj Judicial Bench</span>
                      <span style={{ color: "#16A34A", fontWeight: 700 }}>● e-Sign DSC-3</span>
                    </div>
                  </div>

                  {/* DIRECT MAGISTRATE DOCKET (IN FRONT - NO SECONDARY MENU NEEDED) */}
                  <div
                    style={{
                      background: "#F8FAFC",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-subtle)",
                      padding: "8px",
                      marginBottom: 8,
                    }}
                  >
                    {/* Docket Section Title & Pending Badge */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 8,
                        padding: "2px 4px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 4,
                            background: "var(--accent-judicial)",
                            color: "#FFFFFF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Scale size={13} />
                        </div>
                        <div>
                          <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--text-primary)" }}>
                            Magistrate Docket
                          </span>
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 800,
                          padding: "2px 7px",
                          borderRadius: 12,
                          background: "var(--accent-gold-bg)",
                          color: "#92400E",
                          border: "1px solid #FDE68A",
                        }}
                      >
                        {pendingApprovals.length} Pending
                      </span>
                    </div>

                    {/* Search Bar */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "5px 8px",
                        borderRadius: "var(--radius-sm)",
                        background: "#FFFFFF",
                        border: "1px solid var(--border-glass)",
                        marginBottom: 6,
                      }}
                    >
                      <Search size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                      <input
                        type="text"
                        value={docketSearch}
                        onChange={(e) => setDocketSearch(e.target.value)}
                        placeholder="Search Khasra or Owner..."
                        style={{
                          width: "100%",
                          border: "none",
                          background: "transparent",
                          fontSize: "0.75rem",
                          outline: "none",
                          color: "var(--text-primary)",
                        }}
                      />
                      {docketSearch && (
                        <button
                          onClick={() => setDocketSearch("")}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                          title="Clear search"
                        >
                          <X size={12} style={{ color: "var(--text-muted)" }} />
                        </button>
                      )}
                    </div>

                    {/* Filter Tabs */}
                    <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
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
                            padding: "3px 4px",
                            borderRadius: "var(--radius-sm)",
                            fontSize: "0.6875rem",
                            fontWeight: 700,
                            border: docketFilter === tab.id ? "1px solid var(--accent-judicial)" : "1px solid var(--border-subtle)",
                            background: docketFilter === tab.id ? "var(--accent-judicial)" : "#FFFFFF",
                            color: docketFilter === tab.id ? "#FFFFFF" : "var(--text-secondary)",
                            cursor: "pointer",
                            textAlign: "center",
                            whiteSpace: "nowrap",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Scrollable Docket Case Cards List */}
                    <div
                      style={{
                        maxHeight: "220px",
                        overflowY: "auto",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        paddingRight: 2,
                      }}
                    >
                      {filteredApprovals.map((a) => {
                        const isSelected = selectedApproval?.approval_id === a.approval_id;
                        const isLowConf = (a.alignment_confidence ?? 1.0) < 0.8;

                        return (
                          <button
                            key={a.approval_id}
                            onClick={() => {
                              setSelectedApproval(a);
                              setIsDossierCollapsed(false);
                              setIsProfileDropdownOpen(false);
                              toast.success(`Loaded Khasra ${a.khasra_no} for Adjudication`, { icon: "⚖️" });
                            }}
                            style={{
                              width: "100%",
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 8,
                              padding: "7px 10px",
                              borderRadius: "var(--radius-sm)",
                              background: isSelected ? "var(--accent-judicial-bg)" : "#FFFFFF",
                              border: isSelected ? "1.5px solid #93C5FD" : "1px solid var(--border-subtle)",
                              cursor: "pointer",
                              textAlign: "left",
                              transition: "all 0.15s ease",
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.background = "#F1F5F9";
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.background = "#FFFFFF";
                            }}
                            title={`Select Khasra ${a.khasra_no} for Statutory Adjudication`}
                          >
                            <FileCheck
                              size={14}
                              style={{
                                color: isSelected ? "var(--accent-judicial)" : "var(--text-muted)",
                                flexShrink: 0,
                                marginTop: 2,
                              }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <strong style={{ fontSize: "0.78rem", color: "var(--text-primary)" }}>
                                  Khasra {a.khasra_no}
                                </strong>
                                {isLowConf && (
                                  <span
                                    style={{
                                      fontSize: "0.625rem",
                                      fontWeight: 800,
                                      background: "var(--accent-gold-bg)",
                                      color: "#92400E",
                                      padding: "1px 5px",
                                      borderRadius: "var(--radius-sm)",
                                      border: "1px solid #FDE68A",
                                    }}
                                  >
                                    Occluded
                                  </span>
                                )}
                              </div>
                              <div
                                style={{
                                  fontSize: "0.7rem",
                                  color: "var(--text-secondary)",
                                  marginTop: 2,
                                  fontWeight: 500,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {a.owner_name} &bull; {a.village}
                              </div>
                              <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: 1 }}>
                                Submitter: {a.requested_by}
                              </div>
                            </div>
                          </button>
                        );
                      })}

                      {filteredApprovals.length === 0 && (
                        <div style={{ padding: "16px 8px", textAlign: "center", color: "var(--text-muted)" }}>
                          <CheckCircle2 size={20} style={{ margin: "0 auto 6px", color: "var(--accent-primary)", opacity: 0.8 }} />
                          <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)" }}>No Cases Found</p>
                          <p style={{ fontSize: "0.6875rem", marginTop: 2 }}>No matching items in current filter.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Secondary Quick Actions */}
                  <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    <button
                      onClick={() => {
                        handleResetDemo();
                        setIsProfileDropdownOpen(false);
                      }}
                      className="btn-ghost"
                      style={{
                        flex: 1,
                        padding: "7px 8px",
                        fontSize: "0.72rem",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border-subtle)",
                        background: "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 5,
                        fontWeight: 600,
                      }}
                    >
                      <RefreshCw size={12} /> Reset Dockets
                    </button>
                    <button
                      onClick={() => {
                        fetchData();
                        setIsProfileDropdownOpen(false);
                      }}
                      className="btn-ghost"
                      style={{
                        flex: 1,
                        padding: "7px 8px",
                        fontSize: "0.72rem",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border-subtle)",
                        background: "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 5,
                        fontWeight: 600,
                      }}
                    >
                      <RefreshCw size={12} /> Refresh Data
                    </button>
                  </div>

                  <div style={{ height: 1, background: "var(--border-subtle)", margin: "6px 0" }} />

                  {/* SIGN OUT BUTTON (Inside Dropdown with smooth hover & clear warning style) */}
                  <button
                    onClick={() => {
                      setIsProfileDropdownOpen(false);
                      logout();
                      router.push("/");
                      toast.success("Signed out of Revenue Magistrate Session");
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      padding: "9px 12px",
                      borderRadius: "var(--radius-md)",
                      background: "#FEF2F2",
                      border: "1px solid rgba(220, 38, 38, 0.25)",
                      color: "#DC2626",
                      fontWeight: 700,
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#FEE2E2";
                      e.currentTarget.style.borderColor = "#DC2626";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#FEF2F2";
                      e.currentTarget.style.borderColor = "rgba(220, 38, 38, 0.25)";
                    }}
                    title="Terminate officer statutory session and return to National Gateway"
                  >
                    <LogOut size={14} style={{ color: "#DC2626" }} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT: Compact KPI Chips */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div
                style={{
                  padding: "4px 10px",
                  borderRadius: "var(--radius-sm)",
                  background: "#FFFFFF",
                  border: "1px solid var(--border-glass)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "0.75rem",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                }}
                title="Total Ward Parcels in Mohanlalganj"
              >
                <Layers size={14} style={{ color: "var(--accent-primary)" }} />
                <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Total:</span>
                <strong style={{ color: "var(--accent-primary)", fontSize: "0.85rem" }}>
                  {stats?.total_parcels ?? 18}
                </strong>
              </div>

              <div
                style={{
                  padding: "4px 10px",
                  borderRadius: "var(--radius-sm)",
                  background: "#FFFFFF",
                  border: "1px solid var(--border-glass)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "0.75rem",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                }}
                title="Bhu-Aadhaar ULPIN Assigned"
              >
                <Fingerprint size={14} style={{ color: "var(--accent-mint)" }} />
                <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Bhu-Aadhaar:</span>
                <strong style={{ color: "var(--accent-mint)", fontSize: "0.85rem" }}>
                  {stats?.ulpin_assigned_count ?? 12}
                </strong>
              </div>

              <div
                style={{
                  padding: "4px 10px",
                  borderRadius: "var(--radius-sm)",
                  background: "#FFFFFF",
                  border: "1px solid var(--border-glass)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "0.75rem",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                }}
                title="Pending Adjudications in Queue"
              >
                <Clock size={14} style={{ color: "var(--accent-gold)" }} />
                <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Pending:</span>
                <strong style={{ color: "var(--accent-gold)", fontSize: "0.85rem" }}>
                  {pendingApprovals.length}
                </strong>
              </div>

              <div
                style={{
                  padding: "4px 10px",
                  borderRadius: "var(--radius-sm)",
                  background: "#FFFFFF",
                  border: "1px solid var(--border-glass)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "0.75rem",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                }}
                title="Legally Committed & Published"
              >
                <CheckCircle2 size={14} style={{ color: "var(--accent-judicial)" }} />
                <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Committed:</span>
                <strong style={{ color: "var(--accent-judicial)", fontSize: "0.85rem" }}>
                  {stats?.published_count ?? stats?.approved_count ?? 5}
                </strong>
              </div>
            </div>
          </div>

          {/* Statutory Alignment Verification Bar (Bridged from Patwari) */}
          <div
            style={{
              padding: "7px 14px",
              background: "linear-gradient(90deg, #1E3A8A 0%, #1E40AF 100%)",
              color: "#FFFFFF",
              borderRadius: "var(--radius-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "0.8rem",
              fontWeight: 700,
              boxShadow: "0 2px 10px rgba(30, 58, 138, 0.15)",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "2px 9px",
                  borderRadius: 14,
                  background: "#10B981",
                  color: "#FFFFFF",
                  fontWeight: 900,
                  fontSize: "0.75rem",
                  letterSpacing: "0.02em",
                }}
              >
                <span>{alignmentSession?.confidence || 98.6}% Alignment Confidence</span>
              </div>

              <span>
                ⚖️ <strong>Docket Source:</strong> {alignmentSession?.transmittedBy || "Patwari Ramesh Kumar Sharma"} &bull; 18 Harmonized Parcels
              </span>
              <span style={{ opacity: 0.5 }}>|</span>
              <span style={{ color: "#93C5FD" }}>
                Engine: {alignmentSession?.algorithm || "OpenCV ORB + RANSAC & Meta GeoSAM ViT-B"}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.75rem", color: "#BAE6FD" }}>
              <span>Side-by-Side: 📜 Left = Old Cadastre &bull; ✨ Right = Aligned Drone Map</span>
            </div>
          </div>

          {/* ───── Full Map Canvas Container (Clean Toolbar, No Magistrate Docket on Map Box) ───── */}
          <div
            className="glass-card"
            style={{
              flex: 1,
              padding: 0,
              overflow: "hidden",
              position: "relative",
              borderRadius: "var(--radius-lg)",
              minHeight: 0,
              border: "1.5px solid var(--border-glass)",
              boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.08)",
            }}
          >
            <MapViewer
              geojsonData={geojson}
              selectedParcelId={selectedApproval?.parcel_id || null}
              onParcelClick={(id) => {
                const match = pendingApprovals.find((a) => a.parcel_id === id);
                if (match) {
                  setSelectedApproval(match);
                  setIsDossierCollapsed(false);
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
                    setIsDossierCollapsed(false);
                  }
                }
              }}
              showOcclusionAlerts={true}
              enableCurtainSwipe={isCurtainSwipeActive}
              enableSideBySide={isSideBySideActive}
              onToggleSideBySide={setIsSideBySideActive}
              suppressEmptyBanner={false}
              droneMapOverlayUrl={droneMapOverlayUrl}
              scannedMapOverlayUrl={scannedMapOverlayUrl}
              // Old Map & New Map Source Layer Controls
              basemapUrl={activeBasemap.url}
              basemapAttribution={activeBasemap.attribution}
              basemapName={activeBasemap.name}
              customOldMapGeojson={customOldMapGeojson}
              oldMapOpacity={oldMapOpacity}
              oldMapStrokeColor={oldMapStrokeColor}
              onOpenMapSourceModal={() => setIsMapSourceModalOpen(true)}
            />



            {/* ───── Right Floating Collapsible Statutory Dossier ───── */}
            <div
              className="glass-card animate-fade-in-up"
              style={{
                position: "absolute",
                top: 14,
                right: 14,
                zIndex: 400,
                width: 360,
                maxHeight: "calc(100vh - 180px)",
                overflowY: "auto",
                padding: isDossierCollapsed ? "12px 18px" : "18px 20px",
                background: "rgba(255, 255, 255, 0.98)",
                borderRadius: "var(--radius-lg)",
                boxShadow: "0 8px 30px rgba(15, 23, 42, 0.14)",
                border: "1.5px solid var(--border-glass)",
                transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              {/* Header with Title and Collapse Button */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 style={{ fontSize: "1.05rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)", margin: 0 }}>
                  <ShieldCheck size={18} style={{ color: "var(--accent-judicial)" }} /> Statutory Dossier
                </h2>

                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button
                    onClick={() => setIsDossierCollapsed(!isDossierCollapsed)}
                    className="btn-ghost"
                    style={{ padding: 6, color: "var(--text-primary)" }}
                    title={isDossierCollapsed ? "Expand Dossier" : "Minimize Dossier"}
                  >
                    {isDossierCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                  </button>
                </div>
              </div>

              {!isDossierCollapsed && (
                <div style={{ marginTop: 14 }}>
                  {selectedApproval ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ background: "var(--bg-secondary)", padding: 12, borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "95px 1fr", gap: "6px 10px", fontSize: "0.85rem" }}>
                          <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Khasra No:</span>
                          <strong style={{ color: "var(--text-primary)" }}>{selectedApproval.khasra_no}</strong>

                          <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Landholder:</span>
                          <strong style={{ color: "var(--text-primary)" }}>{selectedApproval.owner_name}</strong>

                          <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Location:</span>
                          <span style={{ color: "var(--text-secondary)" }}>{selectedApproval.village}, {selectedApproval.tehsil}</span>

                          <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Area:</span>
                          <span style={{ color: "var(--text-secondary)" }}>{selectedApproval.area_sqm ? `${Number(selectedApproval.area_sqm).toFixed(1)} m²` : "Calculated"}</span>

                          <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Confidence:</span>
                          <span style={{ fontWeight: 800, color: (selectedApproval.alignment_confidence ?? 1) >= 0.8 ? "var(--accent-mint)" : "var(--accent-gold)" }}>
                            {((selectedApproval.alignment_confidence ?? 0.88) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Occlusion Warning Alert */}
                      {(selectedApproval.alignment_confidence ?? 1) < 0.8 && (
                        <div
                          style={{
                            background: "var(--accent-gold-bg)",
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
                          <div style={{ fontFamily: "monospace", fontSize: "1.1rem", fontWeight: 800, color: "var(--accent-mint)", marginTop: 4, letterSpacing: "1.5px" }}>
                            {selectedApproval.ulpin}
                          </div>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: 4 }}>
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
                            fontSize: "0.85rem",
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
                          <div style={{ fontFamily: "monospace", fontSize: "0.7rem", wordBreak: "break-all", color: "#166534" }}>
                            {committedSignatures[selectedApproval.parcel_id]}
                          </div>
                        </div>
                      )}

                      {/* Phase 2: Split-Screen Curtain Swipe Inspection Toggle */}
                      <button
                        onClick={() => setIsCurtainSwipeActive(!isCurtainSwipeActive)}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: "var(--radius-md)",
                          border: isCurtainSwipeActive ? "1.5px solid #0D9488" : "1px solid var(--border-glass)",
                          background: isCurtainSwipeActive ? "#0D9488" : "#F0FDFA",
                          color: isCurtainSwipeActive ? "#FFFFFF" : "#0F766E",
                          fontWeight: 700,
                          fontSize: "0.8125rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        title="Toggle split-screen curtain swipe to compare cadastral parcel against 5cm drone raster"
                      >
                        <SplitSquareVertical size={15} />
                        <span>{isCurtainSwipeActive ? "Exit Curtain Swipe Inspection" : "Inspect with Curtain Swipe (Old vs Drone)"}</span>
                      </button>

                      {/* Action buttons stack */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <button
                          className="btn-primary"
                          onClick={handleApproveAndCommit}
                          disabled={loading}
                          style={{
                            width: "100%",
                            padding: "10px 16px",
                            background: "linear-gradient(135deg, #1E3A8A 0%, #172554 100%)",
                            borderColor: "#1E3A8A",
                            color: "#FFFFFF",
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                          }}
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
                            padding: "9px 16px",
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
                            padding: "8px 16px",
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
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            padding: "8px 16px",
                          }}
                        >
                          <XCircle size={16} style={{ color: "var(--accent-coral)" }} /> Return for Re-survey
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "flex", gap: 10, alignItems: "center", background: "var(--bg-secondary)", padding: 14, borderRadius: "var(--radius-md)" }}>
                      <Info size={22} style={{ color: "var(--accent-judicial)", flexShrink: 0 }} />
                      <span>Click any parcel on the map or select from Magistrate Docket to review boundaries and execute statutory sign-off.</span>
                    </div>
                  )}
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
                    <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
                      Khasra {auditLogsModal.khasraNo} — Cadastral Audit Trail
                    </h3>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2, marginBottom: 0 }}>
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
                        key={idx}
                        style={{
                          border: "1px solid var(--border-subtle)",
                          borderRadius: "var(--radius-md)",
                          padding: 14,
                          background: "var(--bg-secondary)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)" }}>
                            Action: {log.action_type || "Commit / Adjudication"}
                          </span>
                          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                            {log.timestamp ? new Date(log.timestamp).toLocaleString("en-IN") : "Just now"}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: 6 }}>
                          Officer: <strong>{log.officer_id || "REV-TEH-3210"}</strong>
                        </div>
                        {log.notes && (
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic", marginBottom: 6 }}>
                            &ldquo;{log.notes}&rdquo;
                          </div>
                        )}
                        {log.sha256_hash && (
                          <div style={{ background: "#FFFFFF", padding: "6px 8px", borderRadius: 4, border: "1px dashed var(--border-glass)", fontSize: "0.6875rem", fontFamily: "monospace", color: "var(--text-muted)", wordBreak: "break-all" }}>
                            Hash: {log.sha256_hash}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end" }}>
                <button
                  className="btn-secondary"
                  onClick={() => setAuditLogsModal((prev) => ({ ...prev, isOpen: false }))}
                  style={{ padding: "6px 14px", fontSize: "0.8125rem" }}
                >
                  Close Audit Log
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Map Source Layer Modal */}
        <MapSourceModal
          isOpen={isMapSourceModalOpen}
          onClose={() => setIsMapSourceModalOpen(false)}
          activeBasemapId={activeBasemap.id}
          onSelectBasemap={setActiveBasemap}
          activeOldMapPresetId={activeOldMapPresetId}
          onSelectOldMapPreset={setActiveOldMapPresetId}
          onUploadCustomGeojson={(geojson) => setCustomOldMapGeojson(geojson)}
          onUploadScannedMap={(url) => setScannedMapOverlayUrl(url)}
          oldMapOpacity={oldMapOpacity}
          onChangeOldMapOpacity={setOldMapOpacity}
          oldMapStrokeColor={oldMapStrokeColor}
          onChangeOldMapStrokeColor={setOldMapStrokeColor}
        />
      </div>
    </RoleGuard>
  );
}
