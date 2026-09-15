"""
GeoSync API Router — All REST endpoints

Endpoints:
  GET  /parcels              — List all parcels (summary)
  GET  /parcels/{id}         — Get full parcel details with GeoJSON
  GET  /parcels/geojson      — Get all parcels as GeoJSON FeatureCollection
  POST /align/{parcel_id}    — Trigger alignment pipeline on a parcel
  POST /cleanup/{parcel_id}  — Run topological cleanup
  POST /ulpin/{parcel_id}    — Generate and assign ULPIN
  POST /approvals            — Submit parcel for Tehsildar approval
  GET  /approvals/pending    — List all pending approvals
  POST /approvals/{id}/action — Approve / Reject / Request revision
  GET  /dashboard/stats      — Dashboard statistics
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from database import get_db
from schemas import (
    ParcelOut, ParcelSummary, AlignmentRequest, AlignmentResult,
    GenerateULPINResponse, ApprovalRequestCreate, ApprovalAction, ApprovalOut,
    DashboardStats, TopologyCleanupRequest, TopologyCleanupResponse,
    GenerateULPINRequest, CommitParcelRequest, CommitParcelResponse
)
from services.vision import run_alignment_pipeline
from services.spatial import (
    run_topological_cleanup, assign_ulpin_to_parcel,
    run_topological_cleanup_geojson, commit_parcel_to_db
)
from services.workflow import (
    create_approval_request, process_approval_action,
    get_pending_approvals, get_dashboard_stats,
)

router = APIRouter()


# ──────────────────── Parcel Endpoints ────────────────────

@router.get("/parcels", response_model=list[ParcelSummary], tags=["Parcels"])
def list_parcels(db: Session = Depends(get_db)):
    """Returns a summary list of all parcels."""
    rows = db.execute(
        text("""
            SELECT id, khasra_no, owner_name, village, alignment_status, ulpin, area_sqm
            FROM parcels ORDER BY khasra_no
        """)
    ).fetchall()
    return [
        ParcelSummary(
            id=str(r.id), khasra_no=r.khasra_no, owner_name=r.owner_name,
            village=r.village, alignment_status=r.alignment_status,
            ulpin=r.ulpin, area_sqm=r.area_sqm,
        )
        for r in rows
    ]


@router.get("/parcels/geojson", tags=["Parcels"])
def get_parcels_geojson(db: Session = Depends(get_db)):
    """Returns all parcels as a GeoJSON FeatureCollection for map rendering."""
    rows = db.execute(
        text("""
            SELECT
                id, khasra_no, owner_name, village, tehsil, district,
                alignment_status, ulpin, area_sqm, alignment_confidence,
                centroid_lat, centroid_lon,
                ST_AsGeoJSON(geometry)::json as geojson
            FROM parcels
            ORDER BY khasra_no
        """)
    ).fetchall()

    features = []
    for r in rows:
        features.append({
            "type": "Feature",
            "geometry": r.geojson,
            "properties": {
                "id": str(r.id),
                "khasra_no": r.khasra_no,
                "owner_name": r.owner_name,
                "village": r.village,
                "tehsil": r.tehsil,
                "district": r.district,
                "alignment_status": r.alignment_status,
                "ulpin": r.ulpin,
                "area_sqm": r.area_sqm,
                "alignment_confidence": r.alignment_confidence,
                "centroid_lat": r.centroid_lat,
                "centroid_lon": r.centroid_lon,
            },
        })

    return {"type": "FeatureCollection", "features": features}


@router.get("/parcels/{parcel_id}", tags=["Parcels"])
def get_parcel(parcel_id: str, db: Session = Depends(get_db)):
    """Returns full details of a single parcel with GeoJSON geometry."""
    row = db.execute(
        text("""
            SELECT
                id, khasra_no, owner_name, village, tehsil, district, state,
                alignment_status, ulpin, area_sqm, alignment_confidence,
                centroid_lat, centroid_lon, created_at, updated_at,
                ST_AsGeoJSON(geometry)::json as geojson
            FROM parcels WHERE id = :pid
        """),
        {"pid": parcel_id}
    ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Parcel not found")

    return {
        "id": str(row.id),
        "khasra_no": row.khasra_no,
        "owner_name": row.owner_name,
        "village": row.village,
        "tehsil": row.tehsil,
        "district": row.district,
        "state": row.state,
        "alignment_status": row.alignment_status,
        "ulpin": row.ulpin,
        "area_sqm": row.area_sqm,
        "alignment_confidence": row.alignment_confidence,
        "centroid_lat": row.centroid_lat,
        "centroid_lon": row.centroid_lon,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        "geometry_geojson": row.geojson,
    }


# ──────────────────── Alignment Pipeline ────────────────────

@router.post("/align/{parcel_id}", response_model=AlignmentResult, tags=["Alignment"])
def align_parcel(parcel_id: str, db: Session = Depends(get_db)):
    """
    Triggers the OpenCV alignment pipeline (ORB → RANSAC → TPS) on a parcel.
    Updates the parcel status to 'aligned' with confidence score.
    """
    # Verify parcel exists
    parcel = db.execute(
        text("SELECT id, alignment_status FROM parcels WHERE id = :pid"),
        {"pid": parcel_id}
    ).fetchone()
    if not parcel:
        raise HTTPException(status_code=404, detail="Parcel not found")

    # Run mock alignment
    confidence, matched_kp, message = run_alignment_pipeline(parcel_id)

    # Update parcel in DB
    db.execute(
        text("""
            UPDATE parcels
            SET alignment_status = 'aligned',
                alignment_confidence = :conf,
                updated_at = NOW()
            WHERE id = :pid
        """),
        {"conf": confidence, "pid": parcel_id}
    )
    db.commit()

    return AlignmentResult(
        parcel_id=parcel_id,
        status="aligned",
        confidence=confidence,
        matched_keypoints=matched_kp,
        message=message,
    )


# ──────────────────── Topological Cleanup ────────────────────

@router.post("/cleanup/{parcel_id}", tags=["Spatial"])
def cleanup_parcel(parcel_id: str, db: Session = Depends(get_db)):
    """Runs PostGIS topological cleanup (ST_MakeValid, ST_Snap)."""
    parcel = db.execute(
        text("SELECT id FROM parcels WHERE id = :pid"),
        {"pid": parcel_id}
    ).fetchone()
    if not parcel:
        raise HTTPException(status_code=404, detail="Parcel not found")

    result = run_topological_cleanup(db, parcel_id)

    db.execute(
        text("UPDATE parcels SET alignment_status = 'cleaned' WHERE id = :pid"),
        {"pid": parcel_id}
    )
    db.commit()

    return result


# ──────────────────── ULPIN Generation ────────────────────

@router.post("/ulpin/{parcel_id}", response_model=GenerateULPINResponse, tags=["ULPIN"])
def generate_ulpin(parcel_id: str, db: Session = Depends(get_db)):
    """Generates and assigns a 14-digit Base-14 ULPIN (Bhu-Aadhaar)."""
    parcel = db.execute(
        text("SELECT id FROM parcels WHERE id = :pid"),
        {"pid": parcel_id}
    ).fetchone()
    if not parcel:
        raise HTTPException(status_code=404, detail="Parcel not found")

    result = assign_ulpin_to_parcel(db, parcel_id)

    return GenerateULPINResponse(
        parcel_id=parcel_id,
        ulpin=result["ulpin"],
        centroid_lat=result["centroid_lat"],
        centroid_lon=result["centroid_lon"],
    )


# ──────────────────── Approval Workflow ────────────────────

@router.post("/approvals", tags=["Approvals"])
def submit_for_approval(body: ApprovalRequestCreate, db: Session = Depends(get_db)):
    """Patwari submits a parcel for Tehsildar approval."""
    try:
        result = create_approval_request(db, body.parcel_id, body.requested_by)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/approvals/pending", tags=["Approvals"])
def list_pending_approvals(db: Session = Depends(get_db)):
    """Returns all pending approval requests for Tehsildar dashboard."""
    return get_pending_approvals(db)


@router.get("/approvals/all", tags=["Approvals"])
def list_all_approvals(db: Session = Depends(get_db)):
    """Returns all approval requests regardless of status."""
    results = db.execute(
        text("""
            SELECT
                ar.id as approval_id,
                ar.parcel_id,
                ar.requested_by,
                ar.reviewed_by,
                ar.status,
                ar.remarks,
                ar.requested_at,
                ar.reviewed_at,
                p.khasra_no,
                p.owner_name,
                p.village,
                p.ulpin,
                p.area_sqm
            FROM approval_requests ar
            JOIN parcels p ON ar.parcel_id = p.id
            ORDER BY ar.requested_at DESC
        """)
    ).fetchall()

    return [
        {
            "approval_id": str(r.approval_id),
            "parcel_id": str(r.parcel_id),
            "requested_by": r.requested_by,
            "reviewed_by": r.reviewed_by,
            "status": r.status,
            "remarks": r.remarks,
            "requested_at": r.requested_at.isoformat() if r.requested_at else None,
            "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
            "khasra_no": r.khasra_no,
            "owner_name": r.owner_name,
            "village": r.village,
            "ulpin": r.ulpin,
            "area_sqm": r.area_sqm,
        }
        for r in results
    ]


@router.post("/approvals/{approval_id}/action", tags=["Approvals"])
def action_approval(approval_id: str, body: ApprovalAction, db: Session = Depends(get_db)):
    """Tehsildar approves, rejects, or requests revision on a parcel."""
    try:
        result = process_approval_action(
            db, approval_id, body.action, body.reviewed_by, body.remarks
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ──────────────────── Dashboard ────────────────────

@router.get("/dashboard/stats", response_model=DashboardStats, tags=["Dashboard"])
def dashboard_stats(db: Session = Depends(get_db)):
    """Returns aggregate statistics for the dashboard."""
    return get_dashboard_stats(db)


# ──────────────────── Phase 3 Core Spatial Processing ────────────────────

@router.post("/v1/topology-cleanup", response_model=TopologyCleanupResponse, tags=["Spatial Phase 3"])
def api_topology_cleanup(body: TopologyCleanupRequest, db: Session = Depends(get_db)):
    """Phase 3: Real Topological Cleanup using ST_Difference and ST_Snap."""
    result = run_topological_cleanup_geojson(db, body.geometry_geojson)
    return TopologyCleanupResponse(
        cleaned_geojson=result["cleaned_geojson"],
        area_sqm=result["area_sqm"]
    )


@router.post("/v1/generate-ulpin", response_model=GenerateULPINResponse, tags=["ULPIN Phase 3"])
def api_generate_ulpin(body: GenerateULPINRequest, db: Session = Depends(get_db)):
    """Phase 3: Generate and assign ULPIN for a given parcel."""
    # Ensure parcel exists
    parcel = db.execute(
        text("SELECT id FROM parcels WHERE id = :pid"),
        {"pid": body.parcel_id}
    ).fetchone()
    if not parcel:
        raise HTTPException(status_code=404, detail="Parcel not found")
        
    result = assign_ulpin_to_parcel(db, body.parcel_id)
    return GenerateULPINResponse(
        parcel_id=body.parcel_id,
        ulpin=result["ulpin"],
        centroid_lat=result["centroid_lat"],
        centroid_lon=result["centroid_lon"]
    )


@router.post("/v1/commit-parcel", response_model=CommitParcelResponse, tags=["Spatial Phase 3"])
def api_commit_parcel(body: CommitParcelRequest, db: Session = Depends(get_db)):
    """Phase 3: Commit the parcel to DB, setting status to PUBLISHED."""
    try:
        result = commit_parcel_to_db(
            db, 
            parcel_id=body.parcel_id, 
            ulpin=body.ulpin, 
            officer_id=body.officer_id,
            audit_notes=body.audit_notes
        )
        return CommitParcelResponse(
            parcel_id=result["parcel_id"],
            status=result["status"],
            ulpin=result["ulpin"],
            committed_at=result["committed_at"],
            officer_id=result["officer_id"]
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
