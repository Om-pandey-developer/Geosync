"""
GeoSync Workflow Service — HITL Revenue Officer Approval

Implements the legal Human-in-the-Loop approval workflow:
1. Patwari submits an aligned parcel for approval
2. Tehsildar reviews alignment quality, topology, and ULPIN
3. Tehsildar approves, rejects, or requests revision
"""

from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import text


def create_approval_request(db: Session, parcel_id: str, requested_by: str = "patwari_01") -> dict:
    """Creates a new approval request for a parcel."""
    # Check parcel exists and has ULPIN
    parcel = db.execute(
        text("SELECT id, khasra_no, alignment_status, ulpin FROM parcels WHERE id = :pid"),
        {"pid": parcel_id}
    ).fetchone()

    if parcel is None:
        raise ValueError(f"Parcel {parcel_id} not found")

    if parcel.alignment_status not in ("ulpin_assigned", "cleaned", "aligned"):
        raise ValueError(f"Parcel must be at least aligned before submitting for approval. Current: {parcel.alignment_status}")

    # Check for existing pending request
    existing = db.execute(
        text("SELECT id FROM approval_requests WHERE parcel_id = :pid AND status = 'pending'"),
        {"pid": parcel_id}
    ).fetchone()

    if existing:
        return {
            "id": str(existing.id),
            "parcel_id": parcel_id,
            "status": "pending",
            "message": "An approval request is already pending for this parcel.",
        }

    # Create new request
    result = db.execute(
        text("""
            INSERT INTO approval_requests (id, parcel_id, requested_by, status, requested_at)
            VALUES (gen_random_uuid(), :pid, :req_by, 'pending', NOW())
            RETURNING id
        """),
        {"pid": parcel_id, "req_by": requested_by}
    )
    db.commit()
    new_id = result.fetchone().id

    return {
        "id": str(new_id),
        "parcel_id": parcel_id,
        "requested_by": requested_by,
        "status": "pending",
        "message": f"Approval request created for Khasra {parcel.khasra_no}.",
    }


def process_approval_action(
    db: Session,
    approval_id: str,
    action: str,
    reviewed_by: str = "tehsildar_01",
    remarks: str = None,
) -> dict:
    """
    Tehsildar processes an approval request.
    Actions: 'approved', 'rejected', 'revision_requested'
    """
    approval = db.execute(
        text("SELECT id, parcel_id, status FROM approval_requests WHERE id = :aid"),
        {"aid": approval_id}
    ).fetchone()

    if approval is None:
        raise ValueError(f"Approval request {approval_id} not found")

    if approval.status != "pending":
        raise ValueError(f"Cannot process. Request is already '{approval.status}'.")

    # Update approval status
    db.execute(
        text("""
            UPDATE approval_requests
            SET status = :action,
                reviewed_by = :rev_by,
                remarks = :remarks,
                reviewed_at = NOW()
            WHERE id = :aid
        """),
        {"action": action, "rev_by": reviewed_by, "remarks": remarks, "aid": approval_id}
    )

    # If rejected or revision_requested, reset parcel status
    if action in ("rejected", "revision_requested"):
        new_parcel_status = "raw" if action == "rejected" else "aligned"
        db.execute(
            text("UPDATE parcels SET alignment_status = :status WHERE id = :pid"),
            {"status": new_parcel_status, "pid": str(approval.parcel_id)}
        )

    db.commit()

    return {
        "approval_id": approval_id,
        "parcel_id": str(approval.parcel_id),
        "action": action,
        "reviewed_by": reviewed_by,
        "remarks": remarks,
        "message": f"Parcel {action} by {reviewed_by}.",
    }


def get_pending_approvals(db: Session) -> list:
    """Returns all pending approval requests with parcel details."""
    results = db.execute(
        text("""
            SELECT
                ar.id as approval_id,
                ar.parcel_id,
                ar.requested_by,
                ar.status,
                ar.requested_at,
                p.khasra_no,
                p.owner_name,
                p.village,
                p.tehsil,
                p.district,
                p.ulpin,
                p.area_sqm,
                p.alignment_status,
                p.alignment_confidence
            FROM approval_requests ar
            JOIN parcels p ON ar.parcel_id = p.id
            WHERE ar.status = 'pending'
            ORDER BY ar.requested_at ASC
        """)
    ).fetchall()

    return [
        {
            "approval_id": str(r.approval_id),
            "parcel_id": str(r.parcel_id),
            "requested_by": r.requested_by,
            "status": r.status,
            "requested_at": r.requested_at.isoformat() if r.requested_at else None,
            "khasra_no": r.khasra_no,
            "owner_name": r.owner_name,
            "village": r.village,
            "tehsil": r.tehsil,
            "district": r.district,
            "ulpin": r.ulpin,
            "area_sqm": r.area_sqm,
            "alignment_status": r.alignment_status,
            "alignment_confidence": r.alignment_confidence,
        }
        for r in results
    ]


def get_dashboard_stats(db: Session) -> dict:
    """Returns aggregate statistics for the Tehsildar dashboard."""
    parcel_stats = db.execute(
        text("""
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE alignment_status = 'raw') as raw_count,
                COUNT(*) FILTER (WHERE alignment_status = 'aligned') as aligned_count,
                COUNT(*) FILTER (WHERE alignment_status = 'cleaned') as cleaned_count,
                COUNT(*) FILTER (WHERE alignment_status = 'ulpin_assigned') as ulpin_count
            FROM parcels
        """)
    ).fetchone()

    approval_stats = db.execute(
        text("""
            SELECT
                COUNT(*) FILTER (WHERE status = 'pending') as pending,
                COUNT(*) FILTER (WHERE status = 'approved') as approved,
                COUNT(*) FILTER (WHERE status = 'rejected') as rejected
            FROM approval_requests
        """)
    ).fetchone()

    return {
        "total_parcels": parcel_stats.total,
        "raw_count": parcel_stats.raw_count,
        "aligned_count": parcel_stats.aligned_count,
        "cleaned_count": parcel_stats.cleaned_count,
        "ulpin_assigned_count": parcel_stats.ulpin_count,
        "pending_approvals": approval_stats.pending,
        "approved_count": approval_stats.approved,
        "rejected_count": approval_stats.rejected,
    }
