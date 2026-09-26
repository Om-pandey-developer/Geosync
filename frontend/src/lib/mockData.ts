export type BoundaryStatus = "pending" | "approved" | "flagged";

export interface BoundaryParcel {
  id: string;
  khasra_no: string;
  owner_name: string;
  village: string;
  tehsil: string;
  district: string;
  state: string;
  area_sqm: number;
  legacy_area_sqm: number;
  ulpin: string;
  status: BoundaryStatus;
  confidence: number;
  last_updated_by: string;
  last_updated_at: string;
  approval_timestamp?: string;
  approving_officer?: string;
  // Coordinates are [lat, lng][]
  coordinates: [number, number][];
  legacy_coordinates: [number, number][];
  reason?: string;
}

// Center reference around Mohanlalganj, Lucknow (Ward 12)
export const MAP_CENTER: [number, number] = [26.7605, 80.901];
export const MAP_ZOOM: number = 16;

export const INITIAL_PARCELS: BoundaryParcel[] = [
  {
    id: "par-101",
    khasra_no: "101",
    owner_name: "Ram Prasad Verma",
    village: "Mohanlalganj",
    tehsil: "Mohanlalganj",
    district: "Lucknow",
    state: "Uttar Pradesh",
    area_sqm: 11205.5,
    legacy_area_sqm: 11040.0,
    ulpin: "9YYD56AA2Z9Y3A",
    status: "pending",
    confidence: 0.94,
    last_updated_by: "AI GeoSAM Pipeline (v2.4)",
    last_updated_at: "2026-09-26T06:15:00Z",
    coordinates: [
      [26.7605, 80.9010],
      [26.7615, 80.9011],
      [26.7614, 80.9022],
      [26.7604, 80.9021],
      [26.7605, 80.9010],
    ],
    legacy_coordinates: [
      [26.7603, 80.9008],
      [26.7617, 80.9009],
      [26.7616, 80.9025],
      [26.7602, 80.9023],
      [26.7603, 80.9008],
    ],
    reason: "Boundary extracted from 5cm drone ortho. +165.5 m² expansion reconciled from paper shrinkage.",
  },
  {
    id: "par-102",
    khasra_no: "102",
    owner_name: "Sita Devi",
    village: "Mohanlalganj",
    tehsil: "Mohanlalganj",
    district: "Lucknow",
    state: "Uttar Pradesh",
    area_sqm: 9840.2,
    legacy_area_sqm: 9840.2,
    ulpin: "9YYD56AA2Z9Y3B",
    status: "approved",
    confidence: 0.99,
    last_updated_by: "Tehsildar V. K. Sharma",
    last_updated_at: "2026-09-25T14:30:00Z",
    approval_timestamp: "2026-09-25T14:30:00Z",
    approving_officer: "Tehsildar V. K. Sharma (ID: UP-REV-7412)",
    coordinates: [
      [26.7617, 80.9010],
      [26.7627, 80.9011],
      [26.7626, 80.9022],
      [26.7616, 80.9021],
      [26.7617, 80.9010],
    ],
    legacy_coordinates: [
      [26.7617, 80.9010],
      [26.7627, 80.9011],
      [26.7626, 80.9022],
      [26.7616, 80.9021],
      [26.7617, 80.9010],
    ],
    reason: "Statutory sanction complete. Published to State Land Stack.",
  },
  {
    id: "par-103",
    khasra_no: "103",
    owner_name: "Mohan Lal Yadav",
    village: "Mohanlalganj",
    tehsil: "Mohanlalganj",
    district: "Lucknow",
    state: "Uttar Pradesh",
    area_sqm: 13420.0,
    legacy_area_sqm: 13180.0,
    ulpin: "9YYD56AA2Z9Y3C",
    status: "flagged",
    confidence: 0.68,
    last_updated_by: "Radiometric Occlusion Detector",
    last_updated_at: "2026-09-26T05:40:00Z",
    coordinates: [
      [26.7629, 80.9010],
      [26.7639, 80.9011],
      [26.7638, 80.9022],
      [26.7628, 80.9021],
      [26.7629, 80.9010],
    ],
    legacy_coordinates: [
      [26.7631, 80.9007],
      [26.7642, 80.9009],
      [26.7640, 80.9024],
      [26.7626, 80.9023],
      [26.7631, 80.9007],
    ],
    reason: "Dense banyan tree canopy obscuring south-west corner. Manual GCP ground verification required.",
  },
  {
    id: "par-104",
    khasra_no: "104",
    owner_name: "Geeta Singh",
    village: "Mohanlalganj",
    tehsil: "Mohanlalganj",
    district: "Lucknow",
    state: "Uttar Pradesh",
    area_sqm: 8750.8,
    legacy_area_sqm: 8690.0,
    ulpin: "9YYD56AA2Z9Y3D",
    status: "pending",
    confidence: 0.92,
    last_updated_by: "AI GeoSAM Pipeline (v2.4)",
    last_updated_at: "2026-09-26T06:18:00Z",
    coordinates: [
      [26.7641, 80.9010],
      [26.7651, 80.9011],
      [26.7650, 80.9022],
      [26.7640, 80.9021],
      [26.7641, 80.9010],
    ],
    legacy_coordinates: [
      [26.7639, 80.9008],
      [26.7653, 80.9013],
      [26.7648, 80.9026],
      [26.7638, 80.9020],
      [26.7639, 80.9008],
    ],
    reason: "Field bund alignment adjusted with adjacent parcel 103. Ready for officer review.",
  },
  {
    id: "par-105",
    khasra_no: "105",
    owner_name: "Gram Sabha (Public Charagah)",
    village: "Mohanlalganj",
    tehsil: "Mohanlalganj",
    district: "Lucknow",
    state: "Uttar Pradesh",
    area_sqm: 16800.0,
    legacy_area_sqm: 16800.0,
    ulpin: "9YYD56AA2Z9Y3E",
    status: "approved",
    confidence: 0.98,
    last_updated_by: "Tehsildar V. K. Sharma",
    last_updated_at: "2026-09-24T11:00:00Z",
    approval_timestamp: "2026-09-24T11:00:00Z",
    approving_officer: "Tehsildar V. K. Sharma (ID: UP-REV-7412)",
    coordinates: [
      [26.7605, 80.9025],
      [26.7615, 80.9026],
      [26.7614, 80.9037],
      [26.7604, 80.9036],
      [26.7605, 80.9025],
    ],
    legacy_coordinates: [
      [26.7605, 80.9025],
      [26.7615, 80.9026],
      [26.7614, 80.9037],
      [26.7604, 80.9036],
      [26.7605, 80.9025],
    ],
    reason: "Government community pasture land protected under Sec 132 UP Revenue Code.",
  },
  {
    id: "par-106",
    khasra_no: "106",
    owner_name: "Pradeep Tiwari",
    village: "Mohanlalganj",
    tehsil: "Mohanlalganj",
    district: "Lucknow",
    state: "Uttar Pradesh",
    area_sqm: 10450.0,
    legacy_area_sqm: 10100.0,
    ulpin: "9YYD56AA2Z9Y3F",
    status: "pending",
    confidence: 0.89,
    last_updated_by: "AI GeoSAM Pipeline (v2.4)",
    last_updated_at: "2026-09-26T06:20:00Z",
    coordinates: [
      [26.7617, 80.9025],
      [26.7627, 80.9026],
      [26.7626, 80.9037],
      [26.7616, 80.9036],
      [26.7617, 80.9025],
    ],
    legacy_coordinates: [
      [26.7614, 80.9022],
      [26.7629, 80.9028],
      [26.7624, 80.9041],
      [26.7613, 80.9034],
      [26.7614, 80.9022],
    ],
    reason: "North boundary aligned along 5cm concrete compound wall. Awaiting human verification.",
  },
];

export interface DashboardStats {
  propertiesProcessed: number;
  averageAccuracyPercent: number;
  pendingApprovalsCount: number;
  estimatedTaxImpactCrores: number;
  disputeReductionPercent: number;
  statusBreakdown: {
    name: string;
    value: number;
    color: string;
  }[];
  processingTimeline: {
    week: string;
    aiDrafted: number;
    officerApproved: number;
  }[];
}

export const MOCK_STATS: DashboardStats = {
  propertiesProcessed: 1248,
  averageAccuracyPercent: 98.4,
  pendingApprovalsCount: 34,
  estimatedTaxImpactCrores: 4.85,
  disputeReductionPercent: 76.2,
  statusBreakdown: [
    { name: "Approved / Published", value: 1120, color: "#16A34A" }, // Green
    { name: "AI-Drafted / Pending", value: 94, color: "#DC2626" },   // Red
    { name: "Flagged (GCP Required)", value: 34, color: "#D97706" }, // Amber
  ],
  processingTimeline: [
    { week: "Week 1", aiDrafted: 180, officerApproved: 140 },
    { week: "Week 2", aiDrafted: 290, officerApproved: 260 },
    { week: "Week 3", aiDrafted: 410, officerApproved: 380 },
    { week: "Week 4", aiDrafted: 368, officerApproved: 340 },
  ],
};
