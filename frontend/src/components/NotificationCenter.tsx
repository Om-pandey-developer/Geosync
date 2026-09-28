"use client";

import React from "react";
import { Toaster, ToastBar, toast } from "react-hot-toast";
import { X } from "lucide-react";

export default function NotificationCenter() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 2200, // Reduced notification duration (2.2 seconds instead of 4-5s)
        style: {
          background: "#FFFFFF",
          color: "var(--text-primary)",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.16), 0 0 0 1px rgba(15, 23, 42, 0.08)",
          borderRadius: "10px",
          padding: "8px 12px",
          fontSize: "0.8125rem",
          fontWeight: 600,
          maxWidth: "380px",
        },
        success: {
          duration: 2200,
        },
        error: {
          duration: 2500,
        },
      }}
    >
      {(t) => (
        <ToastBar toast={t}>
          {({ icon, message }) => (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
              }}
            >
              {icon}
              <div style={{ flex: 1, paddingRight: 4, lineHeight: 1.35 }}>{message}</div>
              {t.type !== "loading" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toast.dismiss(t.id);
                  }}
                  style={{
                    background: "rgba(241, 245, 249, 0.9)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    padding: "3px",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s ease",
                    marginLeft: 6,
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#DC2626";
                    e.currentTarget.style.background = "#FEE2E2";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--text-muted)";
                    e.currentTarget.style.background = "rgba(241, 245, 249, 0.9)";
                  }}
                  title="Close notification (✕)"
                  aria-label="Close notification"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          )}
        </ToastBar>
      )}
    </Toaster>
  );
}
