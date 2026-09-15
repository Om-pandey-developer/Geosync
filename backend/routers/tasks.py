"""
GeoSync API Router — All REST Endpoints
=======================================

Endpoints:
  GET  /parcels                — List all parcels (summary)
  GET  /parcels/{id}           — Get full parcel details with GeoJSON
  GET  /parcels/geojson        — Get all parcels as GeoJSON FeatureCollection
  POST /align/{parcel_id}      — Trigger alignment pipeline on a parcel
  POST /cleanup/{parcel_id}    — Run topological cleanup on existing parcel
  POST /ulpin/{parcel_id}      — Generate and assign ULPIN
  POST /v1/topology-cleanup    — ST_Difference + ST_Snap (0.05m tolerance) on GeoJSON
  POST /v1/generate-ulpin      — 14-character Base-14 ULPIN generation
  POST /v1/commit-parcel       — Legal HITL publish commit
  POST /v1/extract-boundaries  — GeoSAM ViT-H zero-shot boundary extraction with occlusion scoring
  POST /v1/validate-officer    — Strict server-side KYC validation
  POST /v1/register-parcel     — Register new land parcel with strict validation
  POST /approvals              — Submit parcel for Tehsildar approval
  GET  /approvals/pending      — List all pending approvals
  POST /approvals/{id}/action  — Approve / Reject / Request revision
  GET  /dashboard/stats        — Dashboard statistics
"""

import uuid
import json
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from database import get_db, IS_SQLITE
from models import Parcel, ApprovalRequest
from schemas import (
    ParcelOut, ParcelSummary, AlignmentRequest, AlignmentResult,
    GenerateULPINResponse, ApprovalRequestCreate, ApprovalAction, ApprovalOut,
    DashboardStats, TopologyCleanupRequest, TopologyCleanupResponse,
    GenerateULPINRequest, CommitParcelRequest, CommitParcelResponse,
    BoundaryExtractionRequest, BoundaryExtractionResponse,
    OfficerValidationRequest, OfficerValidationResponse,
    RegisterParcelRequest,
)
from services.vision import run_alignment_pipeline
from services.geosam_engine import geosam_engine
from services.spatial import (
    run_topological_cleanup, assign_ulpin_to_parcel,
    run_topological_cleanup_geojson, commit_parcel_to_db,
    _parse_geometry_to_shapely
)
from services.workflow import (
    create_approval_request, process_approval_action,
    get_pending_approvals, get_dashboard_stats,
)
from shapely.geometry import mapping

router = APIRouter()


def _get_geojson_dict(parcel: Parcel) -> dict:
    """Helper to convert parcel geometry to GeoJSON dict."""
    try:
        poly = _parse_geometry_to_shapely(parcel.geometry)
        return mapping(poly)
    except Exception:
        return {"type": "Polygon", "coordinates": []}


# ──────────────────── Parcel Endpoints ────────────────────

@router.get("/parcels", response_model=List[ParcelSummary], tags=["Parcels"])
def list_parcels(db: Session = Depends(get_db)):
    """Returns a summary list of all parcels."""
    parcels = db.query(Parcel).order_by(Parcel.khasra_no).all()
    return [
        ParcelSummary(
            id=str(p.id),
            khasra_no=p.khasra_no,
            owner_name=p.owner_name,
            village=p.village,
            alignment_status=p.alignment_status,
            ulpin=p.ulpin,
            area_sqm=p.area_sqm,
        )
        for p in parcels
    ]


@router.get("/parcels/geojson", tags=["Parcels"])
def get_parcels_geojson(db: Session = Depends(get_db)):
    """Returns all parcels as a GeoJSON FeatureCollection for map rendering."""
    parcels = db.query(Parcel).order_by(Parcel.khasra_no).all()

    features = []
    for p in parcels:
        geo = _get_geojson_dict(p)
        features.append({
            "type": "Feature",
            "geometry": geo,
            "properties": {
                "id": str(p.id),
                "khasra_no": p.khasra_no,
                "owner_name": p.owner_name,
                "village": p.village,
                "tehsil": p.tehsil,
                "district": p.district,
                "alignment_status": p.alignment_status,
                "ulpin": p.ulpin,
                "area_sqm": p.area_sqm,
                "alignment_confidence": p.alignment_confidence,
                "centroid_lat": p.centroid_lat,
                "centroid_lon": p.centroid_lon,
            },
        })

    return {"type": "FeatureCollection", "features": features}


@router.get("/parcels/{parcel_id}", tags=["Parcels"])
def get_parcel(parcel_id: str, db: Session = Depends(get_db)):
    """Returns full details of a single parcel with GeoJSON geometry."""
    p = db.query(Parcel).filter(Parcel.id == parcel_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Parcel not found")

    return {
        "id": str(p.id),
        "khasra_no": p.khasra_no,
        "owner_name": p.owner_name,
        "village": p.village,
        "tehsil": p.tehsil,
        "district": p.district,
        "state": p.state,
        "alignment_status": p.alignment_status,
        "ulpin": p.ulpin,
        "area_sqm": p.area_sqm,
        "alignment_confidence": p.alignment_confidence,
        "centroid_lat": p.centroid_lat,
        "centroid_lon": p.centroid_lon,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        "geometry_geojson": _get_geojson_dict(p),
    }


# ──────────────────── Alignment Pipeline ────────────────────

@router.post("/align/{parcel_id}", response_model=AlignmentResult, tags=["Alignment"])
def align_parcel(parcel_id: str, db: Session = Depends(get_db)):
    """
    Triggers the OpenCV alignment pipeline (ORB → RANSAC → TPS) on a parcel.
    Updates the parcel status to 'aligned' with confidence score.
    """
    parcel = db.query(Parcel).filter(Parcel.id == parcel_id).first()
    if not parcel:
        raise HTTPException(status_code=404, detail="Parcel not found")

    confidence, matched_kp, msg = run_alignment_pipeline(parcel_id)

    parcel.alignment_status = "aligned"
    parcel.alignment_confidence = confidence
    db.commit()

    return AlignmentResult(
        parcel_id=parcel_id,
        status="aligned",
        confidence=confidence,
        matched_keypoints=matched_kp,
        message=msg,
    )


# ──────────────────── Topological Cleanup ────────────────────

@router.post("/cleanup/{parcel_id}", tags=["Topological Cleanup"])
def cleanup_parcel(parcel_id: str, db: Session = Depends(get_db)):
    """
    Runs topological cleanup on an existing parcel:
    - Eliminates overlaps with adjacent parcels (ST_Difference)
    - Snaps sliver gaps within 0.05m tolerance (ST_Snap)
    - Recalculates area in sqm
    """
    try:
        result = run_topological_cleanup(db, parcel_id)
        return {
            "parcel_id": parcel_id,
            "status": "cleaned",
            "area_sqm": result["area_sqm"],
            "cleaned_geojson": result["cleaned_geojson"],
            "message": "Topological defects resolved: Overlaps sliced, sliver gaps sealed.",
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cleanup error: {e}")


@router.post(
    "/v1/topology-cleanup",
    response_model=TopologyCleanupResponse,
    tags=["Phase 3 — Topology & ULPIN"],
)
def api_topology_cleanup(
    payload: TopologyCleanupRequest,
    db: Session = Depends(get_db),
):
    """
    POST /api/v1/topology-cleanup
    Accepts candidate GeoJSON polygon and cleans overlaps and slivers.
    """
    try:
        result = run_topological_cleanup_geojson(db, payload.geometry_geojson)
        return TopologyCleanupResponse(
            cleaned_geojson=result["cleaned_geojson"],
            area_sqm=result["area_sqm"],
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Topology cleanup failed: {str(e)}",
        )


# ──────────────────── ULPIN Generation & Commit ────────────────────

@router.post("/ulpin/{parcel_id}", tags=["ULPIN"])
def generate_parcel_ulpin(parcel_id: str, db: Session = Depends(get_db)):
    """
    Generates and assigns a 14-character Base-14 Bhu-Aadhaar ULPIN.
    """
    try:
        return assign_ulpin_to_parcel(db, parcel_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ULPIN error: {e}")


@router.post(
    "/v1/generate-ulpin",
    response_model=GenerateULPINResponse,
    tags=["Phase 3 — Topology & ULPIN"],
)
def api_generate_ulpin(
    payload: GenerateULPINRequest,
    db: Session = Depends(get_db),
):
    """
    POST /api/v1/generate-ulpin
    Generates a 14-digit Base-14 ULPIN from parcel centroid.
    """
    try:
        result = assign_ulpin_to_parcel(db, payload.parcel_id)
        return GenerateULPINResponse(
            parcel_id=result["parcel_id"],
            ulpin=result["ulpin"],
            centroid_lat=result["centroid_lat"],
            centroid_lon=result["centroid_lon"],
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ULPIN generation failed: {e}")


@router.post(
    "/v1/commit-parcel",
    response_model=CommitParcelResponse,
    tags=["Phase 3 — Topology & ULPIN"],
)
def api_commit_parcel(
    payload: CommitParcelRequest,
    db: Session = Depends(get_db),
):
    """
    POST /api/v1/commit-parcel
    Finalizes parcel status to 'PUBLISHED' following Tehsildar approval.
    """
    try:
        result = commit_parcel_to_db(
            db=db,
            parcel_id=payload.parcel_id,
            ulpin=payload.ulpin,
            officer_id=payload.officer_id,
            audit_notes=payload.audit_notes,
        )
        return CommitParcelResponse(
            parcel_id=result["parcel_id"],
            status=result["status"],
            ulpin=result["ulpin"],
            committed_at=result["committed_at"],
            officer_id=result["officer_id"],
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Commit failed: {e}")


# ──────────────────── GeoSAM Zero-Shot Boundary Extraction ────────────────────

@router.post(
    "/v1/extract-boundaries",
    response_model=BoundaryExtractionResponse,
    tags=["AI & Computer Vision"],
)
def extract_boundaries(payload: BoundaryExtractionRequest):
    """
    POST /api/v1/extract-boundaries
    Executes zero-shot boundary extraction using GeoSAM ViT-H embeddings.
    Calculates occlusion index and confidence score.
    If confidence < 80%, flags area for manual HITL officer review.
    """
    try:
        bbox_tuple = (payload.bbox[0], payload.bbox[1], payload.bbox[2], payload.bbox[3])
        result = geosam_engine.extract_boundaries(
            bbox=bbox_tuple,
            legacy_polygon=payload.legacy_polygon,
        )
        return BoundaryExtractionResponse(
            feature=result,
            confidence_score=result["properties"]["confidence_score"],
            is_occluded=result["properties"]["is_occluded"],
            occlusion_reason=result["properties"]["occlusion_reason"],
            hitl_review_required=result["properties"]["hitl_review_required"],
            model_backbone=result["properties"]["model_backbone"],
            embedding_dimension=result["properties"]["embedding_dimension"],
            inference_time_ms=result["properties"]["inference_time_ms"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Boundary extraction failed: {e}")


# ──────────────────── Strict Form Validation Endpoints ────────────────────

@router.post(
    "/v1/validate-officer",
    response_model=OfficerValidationResponse,
    tags=["Governance & Validation"],
)
def validate_officer(payload: OfficerValidationRequest):
    """
    POST /api/v1/validate-officer
    Enforces strict validation:
    - Name: Alphabetic and spaces only, no numbers
    - Phone: Exactly 10 digits numeric only, strictly no special characters
    """
    officer_id = f"REV-{payload.designation[:3].upper()}-{payload.phone_number[-4:]}"
    return OfficerValidationResponse(
        valid=True,
        message=f"Officer credential verified for {payload.designation} {payload.officer_name}",
        officer_id=officer_id,
        verified_at=datetime.now(timezone.utc),
    )


@router.post("/v1/register-parcel", tags=["Parcels"])
def register_parcel(payload: RegisterParcelRequest, db: Session = Depends(get_db)):
    """
    Registers a new cadastral parcel with strict validation.
    """
    new_id = uuid.uuid4()
    geo_dict = payload.geometry_geojson

    poly = _parse_geometry_to_shapely(geo_dict)
    centroid = poly.centroid
    area_sqm = round(poly.area * 111320.0 * (111320.0 * 0.89), 2)

    if IS_SQLITE:
        parcel = Parcel(
            id=new_id,
            khasra_no=payload.khasra_no,
            owner_name=payload.owner_name,
            village=payload.village,
            tehsil=payload.tehsil,
            district=payload.district,
            state=payload.state,
            geometry=json.dumps(geo_dict),
            alignment_status="raw",
            centroid_lat=round(centroid.y, 6),
            centroid_lon=round(centroid.x, 6),
            area_sqm=area_sqm,
        )
        db.add(parcel)
    else:
        wkt_str = f"SRID=4326;{poly.wkt}"
        db.execute(
            text("""
                INSERT INTO parcels (id, khasra_no, owner_name, village, tehsil, district, state, geometry, alignment_status, centroid_lat, centroid_lon, area_sqm, created_at, updated_at)
                VALUES (:id, :khasra, :owner, :village, :tehsil, :district, :state, ST_GeomFromEWKT(:wkt), 'raw', :lat, :lon, :area, NOW(), NOW())
            """),
            {
                "id": str(new_id),
                "khasra": payload.khasra_no,
                "owner": payload.owner_name,
                "village": payload.village,
                "tehsil": payload.tehsil,
                "district": payload.district,
                "state": payload.state,
                "wkt": wkt_str,
                "lat": round(centroid.y, 6),
                "lon": round(centroid.x, 6),
                "area": area_sqm,
            }
        )

    db.commit()
    return {
        "status": "success",
        "parcel_id": str(new_id),
        "khasra_no": payload.khasra_no,
        "message": f"Parcel Khasra {payload.khasra_no} successfully registered.",
    }


# ──────────────────── Approval Workflow (HITL) ────────────────────

@router.post("/approvals", response_model=ApprovalOut, tags=["Approvals"])
def submit_for_approval(payload: ApprovalRequestCreate, db: Session = Depends(get_db)):
    """Submits an aligned parcel for Tehsildar approval."""
    try:
        approval = create_approval_request(db, payload.parcel_id, payload.requested_by)
        return approval
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/approvals/pending", response_model=List[ApprovalOut], tags=["Approvals"])
def list_pending_approvals(db: Session = Depends(get_db)):
    """Lists all pending approval requests for the Tehsildar."""
    return get_pending_approvals(db)


@router.post("/approvals/{approval_id}/action", response_model=ApprovalOut, tags=["Approvals"])
def take_approval_action(
    approval_id: str,
    action_data: ApprovalAction,
    db: Session = Depends(get_db),
):
    """Tehsildar approves, rejects, or requests revision on a parcel."""
    try:
        return process_approval_action(
            db, approval_id, action_data.reviewed_by,
            action_data.action, action_data.remarks,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ──────────────────── Dashboard Stats ────────────────────

@router.get("/dashboard/stats", response_model=DashboardStats, tags=["Dashboard"])
def dashboard_stats(db: Session = Depends(get_db)):
    """Returns aggregated stats for the dashboard."""
    return get_dashboard_stats(db)
