"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Globe2,
  Compass,
  Scale,
  LogOut,
  ChevronDown,
  Layers,
  RefreshCw,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  X,
  ExternalLink,
} from "lucide-react";
import { toast } from "react-hot-toast";
import OnboardingTour from "@/components/OnboardingTour";
import { useAuth } from "@/lib/authContext";
import { API } from "@/lib/api";

export default function TopNavbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { officer, logout } = useAuth();
  const [tourOpen, setTourOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [guidelinesModalOpen, setGuidelinesModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (pathname === "/") return null;

  const isLogin = pathname.includes("login");
  const isTehsildar = pathname.includes("tehsildar") && !isLogin;
  const isPatwari = pathname.includes("patwari") && !isLogin;

  const handleResetDemo = async () => {
    setDropdownOpen(false);
    const tId = toast.loading("Resetting demo dockets in queue...");
    try {
      const res = await fetch(`${API}/v1/reset-demo`, { method: "POST" });
      if (!res.ok) throw new Error("Reset endpoint failed");
      toast.success("Demo Dockets Reset: 4 parcels queued!", { id: tId });
      window.dispatchEvent(new Event("geosync-approval-submitted"));
      window.dispatchEvent(new Event("storage"));
    } catch {
      toast.error("Failed to reset demo state", { id: tId });
    }
  };

  const handleForceSync = () => {
    setDropdownOpen(false);
    window.dispatchEvent(new Event("geosync-approval-submitted"));
    window.dispatchEvent(new Event("storage"));
    toast.success("Force Sync complete. Local and remote cache refreshed!", { icon: "🔄" });
  };

  const handleSignOut = () => {
    setDropdownOpen(false);
    logout();
    router.push("/login");
    toast.success("Signed out of GeoSync Session", { icon: "👋" });
  };

  // Profile data
  const initials = isTehsildar ? "PS" : "RK";
  const officerName = officer?.name || (isTehsildar ? "Smt. Priya Sharma, PCS" : "Ramesh Kumar Sharma");
  const roleLabel = isTehsildar ? "TEHSILDAR" : "PATWARI";
  const designation = officer?.designation || (isTehsildar ? "Sub-Divisional Magistrate & Tehsildar" : "Halqa Patwari (Lekhpal)");
  const officerId = officer?.officerId || (isTehsildar ? "SDM-UP-LKO-081" : "PAT-UP-LKO-442");

  return (
    <>
      <header
        style={{
          height: 68,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          borderBottom: isTehsildar ? "1.5px solid #1E3A8A30" : "1px solid var(--border-subtle)",
          background: isTehsildar
            ? "linear-gradient(90deg, rgba(255, 255, 255, 0.98) 0%, rgba(240, 249, 255, 0.96) 100%)"
            : "var(--bg-glass-strong)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 1000,
          boxShadow: isTehsildar
            ? "0 4px 20px -2px rgba(30, 58, 138, 0.08)"
            : "0 1px 4px 0 rgba(0, 0, 0, 0.05)",
        }}
      >
        {/* ═══════════ LEFT: IDENTITY & JURISDICTION ═══════════ */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={() => router.push("/")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              background: "none",
              border: "none",
              padding: 0,
            }}
            title="Return to National Land Governance Gateway"
            aria-label="GeoSync Home"
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "var(--radius-md)",
                background: isTehsildar
                  ? "linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%)"
                  : "linear-gradient(135deg, #0D9488 0%, #0F766E 100%)",
                border: isTehsildar ? "1.5px solid #F59E0B" : "1.5px solid #99F6E4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                boxShadow: isTehsildar
                  ? "0 2px 8px rgba(30, 58, 138, 0.3)"
                  : "0 2px 8px rgba(13, 148, 136, 0.3)",
              }}
            >
              {isTehsildar ? <Scale size={20} /> : <Globe2 size={20} />}
            </div>

            <div style={{ textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: 900,
                    color: "var(--text-primary)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  GeoSync
                </span>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 800,
                    padding: "1px 6px",
                    borderRadius: 4,
                    background: isTehsildar ? "#EFF6FF" : isLogin ? "#F1F5F9" : "var(--accent-primary-bg)",
                    color: isTehsildar ? "#1E3A8A" : isLogin ? "var(--text-secondary)" : "var(--accent-primary)",
                    border: isTehsildar ? "1px solid #BFDBFE" : isLogin ? "1px solid var(--border-subtle)" : "1px solid #99F6E4",
                    textTransform: "uppercase",
                  }}
                >
                  {isTehsildar ? "Judicial" : isLogin ? "Auth Portal" : "Field GIS"}
                </span>
              </div>
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "var(--text-muted)",
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                }}
              >
                DILRMP 3.0 • NAKSHA Pilot
              </div>
            </div>
          </button>
        </div>

        {/* ═══════════ RIGHT: TOOLS & PROFILE DROPDOWN MENU ═══════════ */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Quick Tour Button */}
          {!isLogin && (
            <button
              onClick={() => setTourOpen(true)}
              className="btn-ghost"
              style={{
                padding: "6px 12px",
                fontSize: "0.8125rem",
                display: "flex",
                alignItems: "center",
                gap: 6,
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-glass)",
                background: "rgba(255, 255, 255, 0.7)",
                cursor: "pointer",
                fontWeight: 600,
              }}
              title="Start Guided System Tour"
            >
              <Compass size={15} style={{ color: isTehsildar ? "#1E3A8A" : "var(--accent-primary)" }} />
              <span>Tour</span>
            </button>
          )}

          {/* User Profile Dropdown Menu Trigger */}
          {!isLogin && (
            <div ref={dropdownRef} style={{ position: "relative" }}>
              <button
                onClick={() => setDropdownOpen((prev) => !prev)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "5px 12px 5px 6px",
                  borderRadius: "9999px",
                  border: isTehsildar
                    ? "1.5px solid #BFDBFE"
                    : "1.5px solid #99F6E4",
                  background: isTehsildar
                    ? "linear-gradient(180deg, #FFFFFF 0%, #EFF6FF 100%)"
                    : "linear-gradient(180deg, #FFFFFF 0%, #F0FDFA 100%)",
                  cursor: "pointer",
                  boxShadow: dropdownOpen
                    ? "0 0 0 3px rgba(30, 58, 138, 0.15)"
                    : "0 1px 4px rgba(0, 0, 0, 0.05)",
                  transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
                title="Account & Portal Options Menu"
              >
                {/* Initials Badge */}
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: isTehsildar
                      ? "linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)"
                      : "linear-gradient(135deg, #0D9488 0%, #0F766E 100%)",
                    color: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.72rem",
                    fontWeight: 900,
                    border: isTehsildar ? "1px solid #F59E0B" : "1px solid #99F6E4",
                  }}
                >
                  {initials}
                </div>

                {/* Name & Badge */}
                <div style={{ textAlign: "left", lineHeight: 1.2 }}>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 800,
                      color: isTehsildar ? "#1E3A8A" : "#0F766E",
                      maxWidth: 140,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {officerName}
                  </div>
                  <div
                    style={{
                      fontSize: "0.62rem",
                      fontWeight: 800,
                      color: isTehsildar ? "#2563EB" : "#0D9488",
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                    }}
                  >
                    {roleLabel}
                  </div>
                </div>

                {/* Animated Dropdown Chevron */}
                <ChevronDown
                  size={15}
                  style={{
                    color: isTehsildar ? "#1E3A8A" : "#0F766E",
                    transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                />
              </button>

              {/* ────────────── FLOATING DROPDOWN MENU ────────────── */}
              {dropdownOpen && (
                <div
                  className="animate-dropdown"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    right: 0,
                    width: 310,
                    background: "#FFFFFF",
                    borderRadius: "var(--radius-lg)",
                    border: "1.5px solid var(--border-subtle)",
                    boxShadow: "0 14px 38px -6px rgba(15, 23, 42, 0.18), 0 4px 12px rgba(15, 23, 42, 0.08)",
                    zIndex: 2000,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {/* Officer Header Card */}
                  <div
                    style={{
                      padding: "14px 16px",
                      background: isTehsildar
                        ? "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)"
                        : "linear-gradient(135deg, #F0FDFA 0%, #CCFBF1 100%)",
                      borderBottom: "1px solid var(--border-subtle)",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: isTehsildar
                          ? "linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)"
                          : "linear-gradient(135deg, #0D9488 0%, #0F766E 100%)",
                        color: "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.9rem",
                        fontWeight: 900,
                        border: isTehsildar ? "2px solid #F59E0B" : "2px solid #99F6E4",
                        flexShrink: 0,
                        boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                      }}
                    >
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: 800,
                          color: "var(--text-primary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {officerName}
                      </div>
                      <div
                        style={{
                          fontSize: "0.72rem",
                          color: isTehsildar ? "#1E3A8A" : "#0D9488",
                          fontWeight: 700,
                          marginTop: 1,
                        }}
                      >
                        {designation}
                      </div>
                      <div
                        style={{
                          fontSize: "0.68rem",
                          color: "var(--text-muted)",
                          marginTop: 2,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span>ID: {officerId}</span>
                        <span>•</span>
                        <span style={{ color: "#16A34A", fontWeight: 700 }}>● Active</span>
                      </div>
                    </div>
                  </div>

                  {/* Section: Other Options */}
                  <div style={{ padding: "8px" }}>
                    <div
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "var(--text-muted)",
                        padding: "6px 10px 4px",
                      }}
                    >
                      Other Options & Portals
                    </div>

                    {/* Switch Workspace */}
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        router.push(isTehsildar ? "/patwari" : "/tehsildar");
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 10px",
                        borderRadius: "var(--radius-sm)",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        color: "var(--text-primary)",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        textAlign: "left",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#F1F5F9"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      {isTehsildar ? (
                        <Layers size={16} style={{ color: "var(--accent-primary)", flexShrink: 0 }} />
                      ) : (
                        <Scale size={16} style={{ color: "#1E3A8A", flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1 }}>
                        <div>{isTehsildar ? "Switch to Patwari Field Canvas" : "Switch to Tehsildar Court"}</div>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 500 }}>
                          {isTehsildar ? "Affine & GeoSAM calibration tools" : "Statutory review & approval docket"}
                        </div>
                      </div>
                    </button>

                    {/* Interactive Tour */}
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        setTourOpen(true);
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 10px",
                        borderRadius: "var(--radius-sm)",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        color: "var(--text-primary)",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        textAlign: "left",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#F1F5F9"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <Compass size={16} style={{ color: "#F59E0B", flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div>Guided System Tour</div>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 500 }}>
                          Step-by-step walkthrough of features
                        </div>
                      </div>
                    </button>

                    {/* Reset Demo Dockets */}
                    <button
                      onClick={handleResetDemo}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 10px",
                        borderRadius: "var(--radius-sm)",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        color: "var(--text-primary)",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        textAlign: "left",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#F1F5F9"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <RefreshCw size={16} style={{ color: "#3B82F6", flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div>Reset Demo Dockets</div>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 500 }}>
                          Reload 4 test adjudication cases
                        </div>
                      </div>
                    </button>

                    {/* Force Sync */}
                    <button
                      onClick={handleForceSync}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 10px",
                        borderRadius: "var(--radius-sm)",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        color: "var(--text-primary)",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        textAlign: "left",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#F1F5F9"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <ShieldCheck size={16} style={{ color: "#10B981", flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div>Force Data Sync</div>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 500 }}>
                          Synchronize local cache & backend
                        </div>
                      </div>
                    </button>

                    {/* Statutory Guidelines */}
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        setGuidelinesModalOpen(true);
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 10px",
                        borderRadius: "var(--radius-sm)",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        color: "var(--text-primary)",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        textAlign: "left",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#F1F5F9"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <FileText size={16} style={{ color: "#6366F1", flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div>Statutory Guidelines</div>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 500 }}>
                          DILRMP 3.0 & UP Revenue Code
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: "var(--border-subtle)" }} />

                  {/* Section: Sign Out */}
                  <div style={{ padding: "8px" }}>
                    <button
                      onClick={handleSignOut}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "9px 12px",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid #FECDD3",
                        background: "#FEF2F2",
                        cursor: "pointer",
                        color: "#DC2626",
                        fontSize: "0.8125rem",
                        fontWeight: 700,
                        textAlign: "left",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#FEE2E2";
                        e.currentTarget.style.borderColor = "#FDA4AF";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "#FEF2F2";
                        e.currentTarget.style.borderColor = "#FECDD3";
                      }}
                      title="End your authenticated session and sign out"
                    >
                      <LogOut size={16} style={{ color: "#DC2626", flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div>Sign Out</div>
                        <div style={{ fontSize: "0.68rem", color: "#EF4444", fontWeight: 500 }}>
                          Safely terminate officer session
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Global Modals */}
      <OnboardingTour isOpen={tourOpen} onClose={() => setTourOpen(false)} />

      {/* Statutory Guidelines Modal */}
      {guidelinesModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
          onClick={() => setGuidelinesModalOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 580,
              background: "#FFFFFF",
              borderRadius: "var(--radius-xl)",
              border: "1.5px solid var(--border-subtle)",
              boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.3)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: "16px 20px",
                background: "linear-gradient(135deg, #1E3A8A 0%, #172554 100%)",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Scale size={20} style={{ color: "#F59E0B" }} />
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 800, margin: 0 }}>
                    Statutory Revenue Protocol
                  </h3>
                  <div style={{ fontSize: "0.72rem", color: "#BFDBFE" }}>
                    DILRMP 3.0 • UP Revenue Code 2006 (Sections 30 & 38)
                  </div>
                </div>
              </div>
              <button
                onClick={() => setGuidelinesModalOpen(false)}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "none",
                  borderRadius: "50%",
                  color: "#FFFFFF",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14, fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              <div style={{ padding: "10px 14px", background: "#EFF6FF", borderRadius: "var(--radius-md)", border: "1px solid #BFDBFE", color: "#1E3A8A" }}>
                <strong>Statutory Adjudication Gate (HITL):</strong> Under DILRMP 3.0 mandates, AI-aligned cadastre vectors remain in provisional status until signed off by the Tehsildar Revenue Court.
              </div>

              <div>
                <h4 style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
                  1. Affine & GeoSAM Precision Standards
                </h4>
                <p style={{ margin: 0 }}>
                  RMSE ground displacement must remain under 0.15m. Occluded parcel edges (tree canopy / shadow) require stone verification note before issuing final Form-II decree.
                </p>
              </div>

              <div>
                <h4 style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
                  2. 14-Digit Bhu-Aadhaar (ULPIN) Integrity
                </h4>
                <p style={{ margin: 0 }}>
                  Each committed parcel generates an immutable SHA-256 cryptographic seal compliant with OGC and ISO 19152 LADM standards.
                </p>
              </div>

              <div>
                <h4 style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
                  3. Field Discrepancies & Return Workflow
                </h4>
                <p style={{ margin: 0 }}>
                  If visual discrepancy exceeds statutory tolerance, click &quot;Return for Re-survey&quot; to push the parcel back to Patwari field calibration queue with audit remarks.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "12px 20px",
                background: "#F8FAFC",
                borderTop: "1px solid var(--border-subtle)",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setGuidelinesModalOpen(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "var(--radius-sm)",
                  background: "#1E3A8A",
                  color: "#FFFFFF",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  cursor: "pointer",
                }}
              >
                Understood & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
