"""
GeoSync Pydantic Schemas
Validates API request/response data.

-- WHY Pydantic Schemas? --
When the frontend sends JSON data to our API, Pydantic automatically:
1. Validates that all required fields are present
2. Checks that field types are correct (e.g., string, number)
3. Returns clear error messages if validation fails
4. Generates automatic API documentation in Swagger UI
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


# ──────────────────── Parcel Schemas ────────────────────

class ParcelBase(BaseModel):
    khasra_no: str = Field(..., description="Khasra number from revenue records")
    owner_name: str
    village: str
    tehsil: str
    district: str
    state: str = "Uttar Pradesh"


class ParcelOut(ParcelBase):
    """Response schema when returning parcel data to the frontend."""
    id: str
    area_sqm: Optional[float] = None
    ulpin: Optional[str] = None
    centroid_lat: Optional[float] = None
    centroid_lon: Optional[float] = None
    alignment_status: str = "raw"
    alignment_confidence: Optional[float] = None
    geometry_geojson: Optional[dict] = Field(None, description="GeoJSON representation of parcel geometry")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ParcelSummary(BaseModel):
    """Lightweight summary for list views."""
    id: str
    khasra_no: str
    owner_name: str
    village: str
    alignment_status: str
    ulpin: Optional[str] = None
    area_sqm: Optional[float] = None


# ──────────────────── Alignment Schemas (Phase 1 — Simple) ────────────────────

class AlignmentRequest(BaseModel):
    parcel_id: str = Field(..., description="UUID of the parcel to align")


class AlignmentResult(BaseModel):
    parcel_id: str
    status: str
    confidence: float = Field(..., ge=0, le=1, description="Alignment confidence 0-1")
    matched_keypoints: int
    message: str


# ──────────────────── Phase 2: Map Alignment Engine Schemas ────────────────────

class GroundControlPoint(BaseModel):
    """A single manual GCP mapping source (legacy) coordinates to target (drone)."""
    source_lon: float = Field(..., description="Longitude in legacy map (WGS84)")
    source_lat: float = Field(..., description="Latitude in legacy map (WGS84)")
    target_lon: float = Field(..., description="Longitude in drone imagery (WGS84)")
    target_lat: float = Field(..., description="Latitude in drone imagery (WGS84)")


class RasterBounds(BaseModel):
    """Geographic bounding box of the drone raster."""
    min_lon: float = Field(default=80.94, description="Western bound")
    min_lat: float = Field(default=26.84, description="Southern bound")
    max_lon: float = Field(default=80.95, description="Eastern bound")
    max_lat: float = Field(default=26.85, description="Northern bound")


class RasterMetadata(BaseModel):
    """Metadata describing the reference drone imagery raster."""
    bounds: RasterBounds = Field(default_factory=RasterBounds)
    resolution_cm: float = Field(default=5.0, ge=0.1, le=100.0, description="Ground resolution in cm/pixel")
    crs: str = Field(default="EPSG:4326", description="Coordinate Reference System")
    reference_features: Optional[List[List[List[float]]]] = Field(
        default=None,
        description="Optional extracted edge features from drone ortho as coordinate rings"
    )


class MapAlignmentRequest(BaseModel):
    """
    Full request payload for the Phase 2 Map Alignment Engine.

    Accepts legacy cadastral GeoJSON coordinates and optional drone raster metadata
    plus ground control points for precision alignment.
    """
    legacy_coordinates: List[List[List[float]]] = Field(
        ...,
        description="GeoJSON Polygon coordinate rings [[[lon,lat], ...], ...]",
        min_length=1,
    )
    raster_metadata: RasterMetadata = Field(
        default_factory=RasterMetadata,
        description="Reference drone raster metadata (bounds, resolution, CRS)"
    )
    gcps: Optional[List[GroundControlPoint]] = Field(
        default=None,
        description="Optional manual Ground Control Points for TPS/Affine warping"
    )


class AlignmentDiagnostics(BaseModel):
    """Detailed diagnostics from the alignment pipeline."""
    source_keypoints: int = Field(description="ORB keypoints detected in legacy contour")
    target_keypoints: int = Field(description="ORB keypoints detected in drone raster")
    raw_matches: int = Field(default=0)
    good_matches: int = Field(description="Matches surviving Lowe's ratio test")
    inliers: int = Field(description="RANSAC inlier count")
    rmse_px: float = Field(description="Root Mean Square reprojection Error in pixels")
    gcp_applied: bool = Field(default=False, description="Whether GCP warping was applied")
    gcp_method: Optional[str] = Field(default=None, description="TPS, affine, or offset")


class MapAlignmentResponse(BaseModel):
    """
    Structured response from the Phase 2 Map Alignment Engine.

    Contains the aligned GeoJSON, the 3×3 homography matrix,
    a confidence score (0-100%), processing time, and full diagnostics.
    """
    aligned_geojson: dict = Field(description="Aligned GeoJSON Polygon geometry")
    homography_matrix: List[List[float]] = Field(description="3×3 perspective transformation matrix")
    confidence_score: float = Field(
        ge=0.0, le=100.0,
        description="Alignment Quality Index (0-100%) based on RMSE of point matches"
    )
    processing_time_ms: float = Field(description="Total pipeline execution time in milliseconds")
    diagnostics: AlignmentDiagnostics = Field(description="Detailed pipeline diagnostics")




# ──────────────────── Phase 3: Spatial Processing Schemas ────────────────────

class TopologyCleanupRequest(BaseModel):
    """Payload for POST /api/v1/topology-cleanup"""
    geometry_geojson: dict = Field(..., description="Candidate parcel Polygon GeoJSON")


class TopologyCleanupResponse(BaseModel):
    """Response from POST /api/v1/topology-cleanup"""
    cleaned_geojson: dict = Field(..., description="Polygon GeoJSON after ST_Difference and ST_Snap")
    area_sqm: float = Field(..., description="Calculated area in square meters using ST_Area")


class GenerateULPINRequest(BaseModel):
    """Payload for POST /api/v1/generate-ulpin"""
    parcel_id: str = Field(..., description="UUID of the parcel")


class GenerateULPINResponse(BaseModel):
    """Response from POST /api/v1/generate-ulpin"""
    parcel_id: str
    ulpin: str = Field(..., min_length=14, max_length=14, description="14-digit Base-14 ULPIN (ECCMA-compliant)")
    centroid_lat: float
    centroid_lon: float


class CommitParcelRequest(BaseModel):
    """Payload for POST /api/v1/commit-parcel"""
    parcel_id: str = Field(..., description="UUID of the parcel to commit")
    ulpin: str = Field(..., min_length=14, max_length=14)
    officer_id: str = Field(..., description="ID of the officer committing the parcel")
    audit_notes: Optional[str] = Field(default=None, description="Optional audit metadata")


class CommitParcelResponse(BaseModel):
    """Response from POST /api/v1/commit-parcel"""
    parcel_id: str
    status: str = Field(..., description="Will be set to 'PUBLISHED'")
    ulpin: str
    committed_at: datetime
    officer_id: str



# ──────────────────── Approval Schemas ────────────────────

class ApprovalRequestCreate(BaseModel):
    parcel_id: str
    requested_by: str = Field(default="patwari_01", description="Patwari username")


class ApprovalAction(BaseModel):
    reviewed_by: str = Field(default="tehsildar_01", description="Tehsildar username")
    action: str = Field(..., pattern="^(approved|rejected|revision_requested)$")
    remarks: Optional[str] = None


class ApprovalOut(BaseModel):
    id: str
    parcel_id: str
    requested_by: str
    reviewed_by: Optional[str] = None
    status: str
    remarks: Optional[str] = None
    requested_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    parcel: Optional[ParcelSummary] = None

    class Config:
        from_attributes = True


# ──────────────────── Dashboard Stats ────────────────────

class DashboardStats(BaseModel):
    total_parcels: int
    raw_count: int
    aligned_count: int
    cleaned_count: int
    ulpin_assigned_count: int
    pending_approvals: int
    approved_count: int
    rejected_count: int


# ──────────────────── GeoSAM Boundary Extraction Schemas ────────────────────

class BoundaryExtractionRequest(BaseModel):
    """Payload for POST /api/v1/extract-boundaries (GeoSAM ViT-H)."""
    bbox: List[float] = Field(..., min_length=4, max_length=4, description="[min_lon, min_lat, max_lon, max_lat]")
    legacy_polygon: Optional[dict] = Field(default=None, description="Optional legacy polygon GeoJSON")
    ward_name: Optional[str] = Field(default="Ward 12, Mohanlalganj", description="Ward identification")


class BoundaryExtractionResponse(BaseModel):
    """Response from POST /api/v1/extract-boundaries."""
    model_config = {"protected_namespaces": ()}

    feature: dict = Field(..., description="Extracted physical boundary GeoJSON Feature")
    confidence_score: float = Field(..., description="Confidence score 0-100%")
    is_occluded: bool = Field(..., description="True if tree canopy / shadow occludes ground")
    occlusion_reason: str
    hitl_review_required: bool
    model_backbone: str = "GeoSAM-ViT-H-LoRA"
    embedding_dimension: int = 1024
    inference_time_ms: float


# ──────────────────── Strict Form Validation Schemas ────────────────────

class OfficerValidationRequest(BaseModel):
    """
    Strict validation schema for Revenue Officer registration / KYC.
    - officer_name: Only alphabets and spaces allowed (no numbers)
    - phone_number: Exactly 10 digits numeric only (no alphabets or special chars)
    - designation: Patwari, Tehsildar, or Naib Tehsildar
    """
    officer_name: str = Field(
        ...,
        pattern=r"^[A-Za-z\s]{2,100}$",
        description="Officer name (alphabetic and spaces only, no numbers)",
    )
    phone_number: str = Field(
        ...,
        pattern=r"^\d{10}$",
        description="10-digit mobile number (digits only, exactly 10 digits)",
    )
    designation: str = Field(
        ...,
        pattern=r"^(Patwari|Tehsildar|Naib Tehsildar|Revenue Inspector)$",
        description="Official revenue department designation",
    )
    jurisdiction_ward: str = Field(..., min_length=2, max_length=100)


class OfficerValidationResponse(BaseModel):
    valid: bool
    message: str
    officer_id: str
    verified_at: datetime


class RegisterParcelRequest(BaseModel):
    """
    Strict validation schema for registering a new cadastral land parcel.
    """
    khasra_no: str = Field(..., pattern=r"^[0-9]+(/[0-9]+)?$", description="Khasra number (e.g. 101 or 106/1)")
    owner_name: str = Field(..., pattern=r"^[A-Za-z\s]{2,100}$", description="Owner name (alphabets only)")
    owner_phone: str = Field(..., pattern=r"^\d{10}$", description="Owner 10-digit phone number")
    village: str = Field(..., min_length=2, max_length=100)
    tehsil: str = Field(..., min_length=2, max_length=100)
    district: str = Field(default="Lucknow")
    state: str = Field(default="Uttar Pradesh")
    geometry_geojson: dict = Field(..., description="Parcel polygon GeoJSON")

