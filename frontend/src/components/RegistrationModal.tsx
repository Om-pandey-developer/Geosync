"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import {
  ShieldCheck,
  UserCheck,
  MapPin,
  X,
  Phone,
  User,
  Building,
  CheckCircle2,
  AlertCircle,
  FilePlus2,
} from "lucide-react";
import { API } from "@/lib/api";

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function RegistrationModal({
  isOpen,
  onClose,
  onSuccess,
}: RegistrationModalProps) {
  const [activeTab, setActiveTab] = useState<"officer" | "parcel">("officer");
  const [loading, setLoading] = useState(false);

  // Officer Form State
  const [officerName, setOfficerName] = useState("");
  const [officerPhone, setOfficerPhone] = useState("");
  const [designation, setDesignation] = useState("Patwari");
  const [ward, setWard] = useState("Ward 12, Mohanlalganj");

  // Parcel Form State
  const [khasraNo, setKhasraNo] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [village, setVillage] = useState("Mohanlalganj");
  const [tehsil, setTehsil] = useState("Mohanlalganj");

  if (!isOpen) return null;

  /* ───────────────── Strict Keystroke Handlers ───────────────── */

  // Strictly allow only numbers (0-9) and navigation keys
  const handleNumericKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowedKeys = [
      "Backspace",
      "Delete",
      "Tab",
      "Escape",
      "Enter",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
    ];
    if (allowedKeys.includes(e.key)) return;

    // Check if ctrl/cmd+A, C, V, X
    if ((e.ctrlKey || e.metaKey) && ["a", "c", "v", "x"].includes(e.key.toLowerCase())) {
      return;
    }

    // Physically block any non-digit character
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      toast.error("Only numeric digits allowed in this field", { id: "numeric-block", duration: 1500 });
    }
  };

  // Strictly block numbers in name fields
  const handleAlphabeticKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      toast.error("Numbers are not permitted in name fields", { id: "name-block", duration: 1500 });
    }
  };

  // Sanitize pasted content for 10-digit phone
  const handlePhonePaste = (e: React.ClipboardEvent<HTMLInputElement>, setter: (val: string) => void) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text");
    const cleanNumbers = pasteData.replace(/\D/g, "").slice(0, 10);
    setter(cleanNumbers);
  };

  /* ───────────────── Submission Handlers ───────────────── */

  const handleOfficerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officerName.trim()) {
      return toast.error("Officer name is required.");
    }
    if (officerPhone.length !== 10) {
      return toast.error("Phone number must be exactly 10 digits.");
    }

    setLoading(true);
    const tId = toast.loading("Verifying officer credentials with DoLR gateway...");
    try {
      const res = await fetch(`${API}/v1/validate-officer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          officer_name: officerName.trim(),
          phone_number: officerPhone,
          designation,
          jurisdiction_ward: ward,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Verified: Officer ID ${data.officer_id}`, { id: tId });
        if (onSuccess) onSuccess();
        setTimeout(onClose, 800);
      } else {
        toast.error(data.detail?.[0]?.msg || data.detail || "Validation failed.", { id: tId });
      }
    } catch {
      toast.error("Network error validating officer.", { id: tId });
    } finally {
      setLoading(false);
    }
  };

  const handleParcelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!khasraNo.trim() || !ownerName.trim()) {
      return toast.error("Khasra number and owner name are required.");
    }
    if (ownerPhone.length !== 10) {
      return toast.error("Owner phone must be exactly 10 digits.");
    }

    setLoading(true);
    const tId = toast.loading("Registering new cadastral parcel...");

    // Generate a default polygon near Mohanlalganj base
    const baseLon = 80.9015 + Math.random() * 0.003;
    const baseLat = 26.7610 + Math.random() * 0.003;
    const s = 0.0008;
    const defaultGeom = {
      type: "Polygon",
      coordinates: [
        [
          [baseLon, baseLat],
          [baseLon + s, baseLat],
          [baseLon + s, baseLat + s],
          [baseLon, baseLat + s],
          [baseLon, baseLat],
        ],
      ],
    };

    try {
      const res = await fetch(`${API}/v1/register-parcel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          khasra_no: khasraNo.trim(),
          owner_name: ownerName.trim(),
          owner_phone: ownerPhone,
          village,
          tehsil,
          district: "Lucknow",
          state: "Uttar Pradesh",
          geometry_geojson: defaultGeom,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Parcel Khasra ${khasraNo} successfully added!`, { id: tId });
        if (onSuccess) onSuccess();
        setTimeout(onClose, 800);
      } else {
        toast.error(data.detail?.[0]?.msg || data.detail || "Registration failed.", { id: tId });
      }
    } catch {
      toast.error("Network error registering parcel.", { id: tId });
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "var(--radius-md)",
    background: "#FFFFFF",
    border: "1.5px solid #CBD5E1",
    color: "#0F172A",
    fontSize: "0.875rem",
    fontWeight: 600,
    outline: "none",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.8125rem",
    fontWeight: 700,
    color: "#0F172A",
    marginBottom: "6px",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="animate-fade-in-up"
        style={{
          width: "100%",
          maxWidth: "540px",
          padding: "32px",
          position: "relative",
          background: "#FFFFFF",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            background: "var(--bg-secondary)",
            border: "none",
            borderRadius: "50%",
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-secondary)",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "22px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "var(--radius-md)",
              background: "var(--accent-primary-bg)",
              border: "1px solid #99F6E4",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent-primary)",
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0F172A", letterSpacing: "-0.01em" }}>
              Revenue Governance & Record Entry
            </h3>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: 2 }}>
              DILRMP 3.0 KYC verification & authoritative parcel intake
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6px",
            background: "var(--bg-secondary)",
            padding: "4px",
            borderRadius: "var(--radius-md)",
            marginBottom: "24px",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("officer")}
            style={{
              padding: "9px 14px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              fontSize: "0.875rem",
              fontWeight: activeTab === "officer" ? 800 : 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
              background: activeTab === "officer" ? "#FFFFFF" : "transparent",
              color: activeTab === "officer" ? "var(--accent-primary)" : "var(--text-secondary)",
              boxShadow: activeTab === "officer" ? "0 2px 4px rgba(0,0,0,0.06)" : "none",
            }}
          >
            Officer Authorization
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("parcel")}
            style={{
              padding: "9px 14px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              fontSize: "0.875rem",
              fontWeight: activeTab === "parcel" ? 800 : 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
              background: activeTab === "parcel" ? "#FFFFFF" : "transparent",
              color: activeTab === "parcel" ? "var(--accent-primary)" : "var(--text-secondary)",
              boxShadow: activeTab === "parcel" ? "0 2px 4px rgba(0,0,0,0.06)" : "none",
            }}
          >
            New Land Parcel
          </button>
        </div>

        {/* ───── Officer Authorization Form ───── */}
        {activeTab === "officer" ? (
          <form onSubmit={handleOfficerSubmit}>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={labelStyle}>
                  Officer Full Name (Alphabetic only)
                </label>
                <div style={{ position: "relative" }}>
                  <User
                    size={16}
                    style={{
                      position: "absolute",
                      left: "14px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#64748B",
                    }}
                  />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar Sharma"
                    value={officerName}
                    onKeyDown={handleAlphabeticKeyDown}
                    onChange={(e) => setOfficerName(e.target.value.replace(/[0-9]/g, ""))}
                    style={{
                      ...inputStyle,
                      paddingLeft: "40px",
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>
                  Mobile Number (Strictly 10 digits numeric)
                </label>
                <div style={{ position: "relative" }}>
                  <Phone
                    size={16}
                    style={{
                      position: "absolute",
                      left: "14px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#64748B",
                    }}
                  />
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="10-digit mobile number"
                    value={officerPhone}
                    onKeyDown={handleNumericKeyDown}
                    onPaste={(e) => handlePhonePaste(e, setOfficerPhone)}
                    onChange={(e) => setOfficerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    style={{
                      ...inputStyle,
                      paddingLeft: "40px",
                      fontFamily: "monospace",
                      letterSpacing: "0.5px",
                    }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Numeric only. Special characters and alphabets blocked.
                  </span>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: officerPhone.length === 10 ? "var(--accent-mint)" : "var(--text-muted)",
                    }}
                  >
                    {officerPhone.length}/10 digits
                  </span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>
                    Designation
                  </label>
                  <select
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="Patwari">Patwari (Surveyor)</option>
                    <option value="Tehsildar">Tehsildar (Executive)</option>
                    <option value="Naib Tehsildar">Naib Tehsildar</option>
                    <option value="Revenue Inspector">Revenue Inspector</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>
                    Jurisdiction Ward
                  </label>
                  <input
                    type="text"
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{ marginTop: "8px", width: "100%", padding: "12px 18px", fontSize: "0.9375rem" }}
              >
                <UserCheck size={18} />
                <span>{loading ? "Validating Credentials..." : "Authenticate & Verify Officer"}</span>
              </button>
            </div>
          </form>
        ) : (
          /* ───── New Land Parcel Form ───── */
          <form onSubmit={handleParcelSubmit}>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>
                    Khasra Number (e.g. 117 or 117/1)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="117"
                    value={khasraNo}
                    onChange={(e) => setKhasraNo(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Owner Mobile (10 Digits)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="9876543210"
                    value={ownerPhone}
                    onKeyDown={handleNumericKeyDown}
                    onPaste={(e) => handlePhonePaste(e, setOwnerPhone)}
                    onChange={(e) => setOwnerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    style={{
                      ...inputStyle,
                      fontFamily: "monospace",
                      letterSpacing: "0.5px",
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>
                  Owner Full Name (Alphabetic only)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Santosh Chandra Shukla"
                  value={ownerName}
                  onKeyDown={handleAlphabeticKeyDown}
                  onChange={(e) => setOwnerName(e.target.value.replace(/[0-9]/g, ""))}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>
                    Village
                  </label>
                  <input
                    type="text"
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Tehsil
                  </label>
                  <input
                    type="text"
                    value={tehsil}
                    onChange={(e) => setTehsil(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{ marginTop: "8px", width: "100%", padding: "12px 18px", fontSize: "0.9375rem" }}
              >
                <FilePlus2 size={18} />
                <span>{loading ? "Registering Parcel..." : "Create Cadastral Record"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
