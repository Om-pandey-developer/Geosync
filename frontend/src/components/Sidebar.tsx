"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  MapPin,
  Shield,
  Home,
  Layers,
  Fingerprint,
  CheckCircle2,
  BarChart3,
  LogOut,
  Globe2,
} from "lucide-react";

interface SidebarProps {
  role: "patwari" | "tehsildar";
}

export default function Sidebar({ role }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const patwariLinks = [
    { href: "/patwari", label: "Workspace", icon: <Layers size={18} /> },
  ];

  const tehsildarLinks = [
    { href: "/tehsildar", label: "Dashboard", icon: <BarChart3 size={18} /> },
  ];

  const links = role === "patwari" ? patwariLinks : tehsildarLinks;
  const roleColor = role === "patwari" ? "var(--accent-primary)" : "var(--accent-purple)";
  const roleIcon = role === "patwari" ? <MapPin size={22} /> : <Shield size={22} />;
  const roleLabel = role === "patwari" ? "Patwari" : "Tehsildar";
  const roleSubtitle = role === "patwari" ? "Surveyor Workspace" : "Approval Dashboard";

  return (
    <aside
      className="glass-sidebar"
      style={{
        width: 260,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: "0",
        position: "fixed",
        left: 0,
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Logo / Brand */}
      <div
        style={{
          padding: "24px 20px 20px",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <button
          onClick={() => router.push("/")}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 4,
          }}
        >
          <Globe2 size={24} style={{ color: "var(--accent-primary)" }} />
          <span
            style={{
              fontSize: "1.25rem",
              fontWeight: 800,
              background: "linear-gradient(135deg, #f0f4ff, #3b82f6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            GeoSync
          </span>
        </button>
      </div>

      {/* Role Badge */}
      <div
        style={{
          padding: "20px",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 14px",
            borderRadius: "var(--radius-md)",
            background: `${roleColor}10`,
            border: `1px solid ${roleColor}25`,
          }}
        >
          <div style={{ color: roleColor }}>{roleIcon}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-primary)" }}>
              {roleLabel}
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
              {roleSubtitle}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav style={{ padding: "16px 12px", flex: 1 }}>
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <button
              key={link.href}
              onClick={() => router.push(link.href)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "11px 14px",
                borderRadius: "var(--radius-sm)",
                background: isActive ? "rgba(59, 130, 246, 0.1)" : "transparent",
                border: isActive
                  ? "1px solid rgba(59, 130, 246, 0.2)"
                  : "1px solid transparent",
                color: isActive ? "var(--accent-primary)" : "var(--text-secondary)",
                fontSize: "0.875rem",
                fontWeight: isActive ? 600 : 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
                marginBottom: 4,
              }}
            >
              {link.icon}
              {link.label}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: "16px 12px",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <button
          onClick={() => router.push("/")}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "11px 14px",
            borderRadius: "var(--radius-sm)",
            background: "transparent",
            border: "1px solid transparent",
            color: "var(--text-muted)",
            fontSize: "0.85rem",
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <LogOut size={18} />
          Switch Role
        </button>
      </div>
    </aside>
  );
}
