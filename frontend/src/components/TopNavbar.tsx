"use client";

import { usePathname, useRouter } from "next/navigation";
import { Map, Settings2, Globe2 } from "lucide-react";

export default function TopNavbar() {
  const router = useRouter();
  const pathname = usePathname();
  
  if (pathname === "/") return null;

  const isPatwari = pathname.includes("patwari");
  const isTehsildar = pathname.includes("tehsildar");

  return (
    <div style={{
      height: 60,
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 24px",
      borderBottom: "1px solid var(--border-glass)",
      background: "var(--bg-glass-strong)",
      backdropFilter: "blur(24px)",
      WebkitBackdropFilter: "blur(24px)",
      position: "fixed",
      top: 0,
      left: 0,
      zIndex: 1000,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <button onClick={() => router.push("/")} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", background: "none", border: "none" }}>
          <Globe2 size={24} style={{ color: "var(--accent-primary)" }} />
          <span style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.5px" }}>
            GeoSync
          </span>
        </button>
        
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(16, 185, 129, 0.1)", padding: "4px 10px", borderRadius: 100, border: "1px solid rgba(16, 185, 129, 0.2)" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-success)", boxShadow: "0 0 8px var(--accent-success)" }} />
          <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--accent-success)", textTransform: "uppercase" }}>
            Connected to PostgreSQL/PostGIS
          </span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Map size={16} style={{ color: "var(--text-muted)" }} />
          <select className="glass-input" style={{ padding: "6px 10px", height: 32, fontSize: "0.75rem" }}>
            <option value="up">Uttar Pradesh - Lucknow (Ward 12)</option>
            <option value="mp">Madhya Pradesh - Indore</option>
            <option value="mh">Maharashtra - Pune</option>
          </select>
        </div>
        
        <div style={{ width: 1, height: 24, background: "var(--border-glass)" }} />

        <div style={{ display: "flex", background: "rgba(15, 23, 55, 0.5)", borderRadius: 8, padding: 4, border: "1px solid var(--border-glass)" }}>
          <button 
            onClick={() => router.push("/patwari")}
            style={{ 
              padding: "6px 12px", 
              fontSize: "0.75rem", 
              fontWeight: 600,
              borderRadius: 6,
              background: isPatwari ? "var(--accent-primary)" : "transparent",
              color: isPatwari ? "#fff" : "var(--text-muted)",
              border: "none",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}>
            Patwari - Surveyor
          </button>
          <button 
            onClick={() => router.push("/tehsildar")}
            style={{ 
              padding: "6px 12px", 
              fontSize: "0.75rem", 
              fontWeight: 600,
              borderRadius: 6,
              background: isTehsildar ? "var(--accent-purple)" : "transparent",
              color: isTehsildar ? "#fff" : "var(--text-muted)",
              border: "none",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}>
            Tehsildar - Approving Auth
          </button>
        </div>
        
        <button className="btn-ghost" style={{ padding: 6, height: 32, width: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Settings2 size={16} />
        </button>
      </div>
    </div>
  );
}
