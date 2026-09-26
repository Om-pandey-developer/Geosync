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
} from "lucide-react";

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

import { API } from "@/lib/api";

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
    // If a digit 0-9 is typed, physically block it
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

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(4, 10, 12, 0.72)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        className="glass-modal animate-fade-in-up"
        style={{
          width: "100%",
          maxWidth: "540px",
          padding: "32px",
          position: "relative",
          border: "1px solid rgba(121, 199, 197, 0.35)",
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            background: "rgba(121, 199, 197, 0.1)",
            border: "none",
            borderRadius: "50%",
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              background: "rgba(121, 199, 197, 0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent-primary)",
            }}
          >
            <ShieldCheck size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)" }}>
              Revenue Governance & Record Entry
            </h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Strict client-side & server-side validation enforced
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
            background: "rgba(121, 199, 197, 0.08)",
            padding: "4px",
            borderRadius: "12px",
            marginBottom: "24px",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("officer")}
            style={{
              padding: "8px",
              borderRadius: "8px",
              border: "none",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
              background: activeTab === "officer" ? "rgba(121, 199, 197, 0.25)" : "transparent",
              color: activeTab === "officer" ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            Officer Authorization
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("parcel")}
            style={{
              padding: "8px",
              borderRadius: "8px",
              border: "none",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
              background: activeTab === "parcel" ? "rgba(121, 199, 197, 0.25)" : "transparent",
              color: activeTab === "parcel" ? "var(--text-primary)" : "var(--text-muted)",
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
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    marginBottom: "6px",
                  }}
                >
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
                      color: "var(--text-muted)",
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
                      width: "100%",
                      padding: "10px 14px 10px 40px",
                      borderRadius: "10px",
                      background: "rgba(12, 22, 25, 0.85)",
                      border: "1px solid var(--border-glass)",
                      color: "var(--text-primary)",
                      fontSize: "0.88rem",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    marginBottom: "6px",
                  }}
                >
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
                      color: "var(--text-muted)",
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
                      width: "100%",
                      padding: "10px 14px 10px 40px",
                      borderRadius: "10px",
                      background: "rgba(12, 22, 25, 0.85)",
                      border: "1px solid var(--border-glass)",
                      color: "var(--text-primary)",
                      fontSize: "0.88rem",
                      fontFamily: "monospace",
                      outline: "none",
                    }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                    Numeric only. Special characters and alphabets blocked.
                  </span>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      color: officerPhone.length === 10 ? "#A8E6CF" : "var(--text-muted)",
                    }}
                  >
                    {officerPhone.length}/10 digits
                  </span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      marginBottom: "6px",
                    }}
                  >
                    Designation
                  </label>
                  <select
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      background: "rgba(12, 22, 25, 0.85)",
                      border: "1px solid var(--border-glass)",
                      color: "var(--text-primary)",
                      fontSize: "0.88rem",
                      outline: "none",
                    }}
                  >
                    <option value="Patwari">Patwari (Surveyor)</option>
                    <option value="Tehsildar">Tehsildar (Executive)</option>
                    <option value="Naib Tehsildar">Naib Tehsildar</option>
                    <option value="Revenue Inspector">Revenue Inspector</option>
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      marginBottom: "6px",
                    }}
                  >
                    Jurisdiction Ward
                  </label>
                  <input
                    type="text"
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      background: "rgba(12, 22, 25, 0.85)",
                      border: "1px solid var(--border-glass)",
                      color: "var(--text-primary)",
                      fontSize: "0.88rem",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-pastel-primary"
                style={{ marginTop: "12px", width: "100%", padding: "12px" }}
              >
                {loading ? "Validating Credentials..." : "Authenticate & Verify Officer"}
              </button>
            </div>
          </form>
        ) : (
          /* ───── New Land Parcel Form ───── */
          <form onSubmit={handleParcelSubmit}>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      marginBottom: "6px",
                    }}
                  >
                    Khasra Number (e.g. 117 or 117/1)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="117"
                    value={khasraNo}
                    onChange={(e) => setKhasraNo(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      background: "rgba(12, 22, 25, 0.85)",
                      border: "1px solid var(--border-glass)",
                      color: "var(--text-primary)",
                      fontSize: "0.88rem",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      marginBottom: "6px",
                    }}
                  >
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
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      background: "rgba(12, 22, 25, 0.85)",
                      border: "1px solid var(--border-glass)",
                      color: "var(--text-primary)",
                      fontSize: "0.88rem",
                      fontFamily: "monospace",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    marginBottom: "6px",
                  }}
                >
                  Owner Full Name (Alphabetic only)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Santosh Chandra Shukla"
                  value={ownerName}
                  onKeyDown={handleAlphabeticKeyDown}
                  onChange={(e) => setOwnerName(e.target.value.replace(/[0-9]/g, ""))}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    background: "rgba(12, 22, 25, 0.85)",
                    border: "1px solid var(--border-glass)",
                    color: "var(--text-primary)",
                    fontSize: "0.88rem",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      marginBottom: "6px",
                    }}
                  >
                    Village
                  </label>
                  <input
                    type="text"
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      background: "rgba(12, 22, 25, 0.85)",
                      border: "1px solid var(--border-glass)",
                      color: "var(--text-primary)",
                      fontSize: "0.88rem",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      marginBottom: "6px",
                    }}
                  >
                    Tehsil
                  </label>
                  <input
                    type="text"
                    value={tehsil}
                    onChange={(e) => setTehsil(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      background: "rgba(12, 22, 25, 0.85)",
                      border: "1px solid var(--border-glass)",
                      color: "var(--text-primary)",
                      fontSize: "0.88rem",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-pastel-primary"
                style={{ marginTop: "12px", width: "100%", padding: "12px" }}
              >
                {loading ? "Registering Parcel..." : "Create Cadastral Record"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
