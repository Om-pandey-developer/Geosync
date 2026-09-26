// Vibrant Cheerful Pastel parcel colors with high-contrast outlines (supports 5-stage enum & legacy)
export const STATUS_COLORS: Record<string, { fill: string; stroke: string }> = {
  raw: { fill: "#E2E8F0", stroke: "#475569" },
  draft: { fill: "#E2E8F0", stroke: "#475569" },
  aligned: { fill: "#CCFBF1", stroke: "#0D9488" },
  aligned_draft: { fill: "#CCFBF1", stroke: "#0D9488" },
  cleaned: { fill: "#E0F2FE", stroke: "#0284C7" },
  topology_cleaned: { fill: "#E0F2FE", stroke: "#0284C7" },
  ulpin_assigned: { fill: "#D1FAE5", stroke: "#059669" },
  published: { fill: "#F3E8FF", stroke: "#7C3AED" },
  occluded: { fill: "#FEF3C7", stroke: "#D97706" },
};

export function formatAlignmentStatus(status: string | null | undefined): string {
  if (!status) return "Draft";
  const s = status.toUpperCase();
  switch (s) {
    case "DRAFT":
    case "RAW":
      return "Draft";
    case "ALIGNED_DRAFT":
    case "ALIGNED":
      return "Aligned Candidate";
    case "TOPOLOGY_CLEANED":
    case "CLEANED":
      return "Topology Cleaned";
    case "ULPIN_ASSIGNED":
      return "Bhu-Aadhaar Assigned";
    case "PUBLISHED":
      return "Legally Published";
    default:
      return status;
  }
}
