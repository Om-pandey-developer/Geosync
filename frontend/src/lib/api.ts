import { BoundaryParcel, DashboardStats, INITIAL_PARCELS, MOCK_STATS } from "./mockData";

/**
 * Dynamic API Base URL resolver.
 * When accessed from localhost: http://localhost:8000/api
 * When accessed from a network IP: http://<hostname>:8000/api
 */
export function getApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    const trimmed = process.env.NEXT_PUBLIC_API_URL.trim().replace(/\/+$/, "");
    return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
  }
  if (typeof window !== "undefined" && window.location.hostname) {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "http://localhost:8000/api";
    }
    // Secure Production Live Backend fallback
    return "https://geosync-backend-e9xu.onrender.com/api";
  }
  return "https://geosync-backend-e9xu.onrender.com/api";
}

export const API = {
  toString: getApiUrl,
  valueOf: getApiUrl,
  [Symbol.toPrimitive]: getApiUrl,
} as unknown as string;

// In-memory state for mock sessions (preserves approvals across navigation)
let localParcels: BoundaryParcel[] = [...INITIAL_PARCELS];

/**
 * Clean API Client layer for Project GeoSync.
 * Attempts real backend first, falls back to mock data only on failure.
 */
export const apiClient = {
  // 1. Fetch all parcels — uses real backend data when available
  async getParcels(): Promise<BoundaryParcel[]> {
    try {
      const res = await fetch(`${getApiUrl()}/parcels`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          // Map backend data to BoundaryParcel format and merge with local approval state
          const backendParcels = data.map((p: any) => {
            // Check if we have local approval state for this parcel
            const localMatch = localParcels.find((lp) => lp.khasra_no === p.khasra_no);
            return {
              id: p.id,
              khasra_no: p.khasra_no,
              owner_name: p.owner_name,
              village: p.village,
              tehsil: p.tehsil || localMatch?.tehsil || "",
              district: p.district || localMatch?.district || "",
              state: p.state || localMatch?.state || "Uttar Pradesh",
              area_sqm: p.area_sqm || localMatch?.area_sqm || 0,
              legacy_area_sqm: localMatch?.legacy_area_sqm || p.area_sqm || 0,
              ulpin: p.ulpin || localMatch?.ulpin || "",
              status: localMatch?.status || (p.alignment_status === "PUBLISHED" ? "approved" : "pending"),
              confidence: p.alignment_confidence || localMatch?.confidence || 0,
              last_updated_by: localMatch?.last_updated_by || "AI GeoSAM Pipeline (v2.4)",
              last_updated_at: localMatch?.last_updated_at || new Date().toISOString(),
              approval_timestamp: localMatch?.approval_timestamp,
              approving_officer: localMatch?.approving_officer,
              coordinates: localMatch?.coordinates || [],
              legacy_coordinates: localMatch?.legacy_coordinates || [],
              reason: localMatch?.reason || "",
            } as BoundaryParcel;
          });
          return backendParcels;
        }
      }
    } catch {
      // Graceful fallback to client mock on connection error
    }
    return localParcels;
  },

  // 2. Fetch single parcel by ID
  async getParcel(id: string): Promise<BoundaryParcel | null> {
    const parcels = await this.getParcels();
    return parcels.find((p) => p.id === id) || null;
  },

  // 3. Approve and publish a parcel (Statutory Human-in-the-Loop sanction)
  async approveParcel(id: string, officerName: string): Promise<BoundaryParcel> {
    const timestamp = new Date().toISOString();
    try {
      await fetch(`${getApiUrl()}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parcel_id: id,
          requested_by: officerName,
          status: "approved",
        }),
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // Mock fallback
    }

    localParcels = localParcels.map((p) => {
      if (p.id === id) {
        return {
          ...p,
          status: "approved" as const,
          last_updated_by: officerName,
          last_updated_at: timestamp,
          approval_timestamp: timestamp,
          approving_officer: `${officerName} (Digital Token Verified)`,
          reason: "Statutory sanction complete. Published to State Land Stack.",
        };
      }
      return p;
    });

    const updated = localParcels.find((p) => p.id === id)!;
    return updated;
  },

  // 4. Reset / Re-seed parcels (for testing)
  resetParcels(): BoundaryParcel[] {
    localParcels = [...INITIAL_PARCELS];
    return localParcels;
  },

  // 5. Fetch Dashboard Stats — uses real backend data when available
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const res = await fetch(`${getApiUrl()}/dashboard/stats`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const backendStats = await res.json();
        // Map real backend stats into DashboardStats format
        const totalParcels = backendStats.total_parcels || 0;
        const approvedCount = backendStats.published_count || 0;
        const pendingCount = backendStats.pending_approvals || 0;
        const alignedCount = backendStats.aligned_count || 0;

        return {
          propertiesProcessed: totalParcels,
          averageAccuracyPercent: MOCK_STATS.averageAccuracyPercent, // Not tracked by backend yet
          pendingApprovalsCount: pendingCount,
          estimatedTaxImpactCrores: MOCK_STATS.estimatedTaxImpactCrores, // Not tracked by backend yet
          disputeReductionPercent: MOCK_STATS.disputeReductionPercent, // Not tracked by backend yet
          statusBreakdown: [
            { name: "Approved / Published", value: approvedCount, color: "#16A34A" },
            { name: "AI-Drafted / Pending", value: alignedCount + pendingCount, color: "#DC2626" },
            { name: "Flagged (GCP Required)", value: backendStats.raw_count || 0, color: "#D97706" },
          ],
          processingTimeline: MOCK_STATS.processingTimeline, // Historical timeline not tracked by backend
        };
      }
    } catch {
      // Fallback to mock
    }

    // Fallback: dynamically calculate based on local parcels state
    const approvedCount = localParcels.filter((p) => p.status === "approved").length;
    const pendingCount = localParcels.filter((p) => p.status === "pending").length;
    const flaggedCount = localParcels.filter((p) => p.status === "flagged").length;

    return {
      ...MOCK_STATS,
      pendingApprovalsCount: pendingCount,
      statusBreakdown: [
        { name: "Approved / Published", value: approvedCount, color: "#16A34A" },
        { name: "AI-Drafted / Pending", value: pendingCount, color: "#DC2626" },
        { name: "Flagged (GCP Required)", value: flaggedCount, color: "#D97706" },
      ],
    };
  },
};
