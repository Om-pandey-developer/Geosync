"""
GeoSync Phase 2 — Alignment Router
====================================

REST endpoint for the Map Alignment Engine.

Endpoint:
    POST /api/v1/align-map  — Accepts legacy GeoJSON + drone raster metadata,
                               returns aligned geometry, homography, and confidence.
"""

import logging
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from schemas import (
    MapAlignmentRequest,
    MapAlignmentResponse,
    AlignmentDiagnostics,
)
from services.alignment_engine import run_alignment_pipeline

logger = logging.getLogger("geosync.alignment_router")

router = APIRouter(
    prefix="/v1",
    tags=["Phase 2 — Map Alignment Engine"],
)


@router.post(
    "/align-map",
    response_model=MapAlignmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Align Legacy Map to Drone Imagery",
    description=(
        "Executes the full ORB → FLANN/BF → RANSAC → TPS alignment pipeline. "
        "Accepts legacy cadastral GeoJSON coordinates, reference drone raster metadata, "
        "and optional manual Ground Control Points. Returns the aligned GeoJSON, "
        "3×3 homography matrix, confidence score (0-100%), and processing diagnostics."
    ),
    responses={
        200: {
            "description": "Alignment completed successfully",
            "content": {
                "application/json": {
                    "example": {
                        "aligned_geojson": {
                            "type": "Polygon",
                            "coordinates": [
                                [[80.945, 26.846], [80.946, 26.846], [80.946, 26.847], [80.945, 26.847], [80.945, 26.846]]
                            ],
                        },
                        "homography_matrix": [
                            [1.002, -0.001, 3.45],
                            [0.001, 0.998, -2.12],
                            [0.0, 0.0, 1.0],
                        ],
                        "confidence_score": 87.5,
                        "processing_time_ms": 142.8,
                        "diagnostics": {
                            "source_keypoints": 1847,
                            "target_keypoints": 2103,
                            "raw_matches": 0,
                            "good_matches": 312,
                            "inliers": 248,
                            "rmse_px": 2.34,
                            "gcp_applied": False,
                            "gcp_method": None,
                        },
                    }
                }
            },
        },
        400: {"description": "Invalid input coordinates or parameters"},
        422: {"description": "Validation error in request payload"},
        500: {"description": "Internal alignment engine error"},
    },
)
async def align_map(request: MapAlignmentRequest) -> MapAlignmentResponse:
    """
    POST /api/v1/align-map

    Accepts legacy cadastral map coordinates and aligns them against drone imagery
    using the ORB + RANSAC + TPS pipeline.
    """
    # ── Input validation ──
    if not request.legacy_coordinates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="legacy_coordinates must contain at least one coordinate ring.",
        )

    # Validate coordinate ring closure (first point == last point for each ring)
    for i, ring in enumerate(request.legacy_coordinates):
        if len(ring) < 4:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Coordinate ring {i} has {len(ring)} points; minimum 4 required for a valid polygon.",
            )
        if ring[0] != ring[-1]:
            # Auto-close the ring
            ring.append(ring[0])

    # Validate raster bounds make geometric sense
    bounds = request.raster_metadata.bounds
    if bounds.min_lon >= bounds.max_lon or bounds.min_lat >= bounds.max_lat:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Raster bounds are invalid: min must be less than max for both lon and lat.",
        )

    # ── Prepare GCP dicts ──
    gcps_dicts = None
    if request.gcps:
        gcps_dicts = [
            {
                "source_lon": gcp.source_lon,
                "source_lat": gcp.source_lat,
                "target_lon": gcp.target_lon,
                "target_lat": gcp.target_lat,
            }
            for gcp in request.gcps
        ]

    # ── Prepare raster metadata dict ──
    raster_meta = {
        "bounds": {
            "min_lon": bounds.min_lon,
            "min_lat": bounds.min_lat,
            "max_lon": bounds.max_lon,
            "max_lat": bounds.max_lat,
        },
        "resolution_cm": request.raster_metadata.resolution_cm,
        "crs": request.raster_metadata.crs,
    }
    if request.raster_metadata.reference_features:
        raster_meta["reference_features"] = request.raster_metadata.reference_features

    # ── Execute alignment pipeline ──
    try:
        result = run_alignment_pipeline(
            legacy_coordinates=request.legacy_coordinates,
            raster_metadata=raster_meta,
            gcps=gcps_dicts,
        )
    except Exception as e:
        logger.exception("Alignment pipeline failed: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Alignment engine error: {str(e)}",
        )

    # ── Build typed response ──
    return MapAlignmentResponse(
        aligned_geojson=result["aligned_geojson"],
        homography_matrix=result["homography_matrix"],
        confidence_score=result["confidence_score"],
        processing_time_ms=result["processing_time_ms"],
        diagnostics=AlignmentDiagnostics(**result["diagnostics"]),
    )
