"""
GeoSync Workflow Service — HITL Revenue Officer Approval
========================================================

Implements the legal Human-in-the-Loop approval workflow:
1. Patwari submits an aligned parcel for approval
2. Tehsildar reviews alignment quality, topology, and ULPIN
3. Tehsildar approves, rejects, or requests revision

Designed with SQLAlchemy ORM for 100% cross-compatibility across
both production PostgreSQL/PostGIS and offline air-gapped SQLite environments.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from models import Parcel, ApprovalRequest


def _resolve_uuid(val: Any) -> uuid.UUID:
    """Helper to convert string or UUID to UUID object."""
    if isinstance(val, uuid.UUID):
        return val
    return uuid.UUID(str(val))


def create_approval_request(db: Session, parcel_id: str, requested_by: str = "patwari_01") -> dict:
    """Creates a new approval request for a parcel."""
    pid = _resolve_uuid(parcel_id)
    parcel = db.query(Parcel).filter(Parcel.id == pid).first()

    if parcel is None:
        raise ValueError(f"Parcel {parcel_id} not found")

    if parcel.alignment_status not in ("ulpin_assigned", "cleaned", "aligned"):
        raise ValueError(
            f"Parcel must be at least aligned before submitting for approval. Current: {parcel.alignment_status}"
        )

    # Check for existing pending request
    existing = db.query(ApprovalRequest).filter(
        ApprovalRequest.parcel_id == pid,
        ApprovalRequest.status == 'pending',
    ).first()

    if existing:
        return {
            "id": str(existing.id),
            "parcel_id": str(parcel_id),
            "status": "pending",
            "message": "An approval request is already pending for this parcel.",
        }

    # Create new request
    new_id = uuid.uuid4()
    new_req = ApprovalRequest(
        id=new_id,
        parcel_id=pid,
        requested_by=requested_by,
        status="pending",
        requested_at=datetime.now(timezone.utc),
    )
    db.add(new_req)
    db.commit()
    db.refresh(new_req)

    return {
        "id": str(new_req.id),
        "parcel_id": str(parcel_id),
        "requested_by": requested_by,
        "status": "pending",
        "message": f"Approval request created for Khasra {parcel.khasra_no}.",
    }


def process_approval_action(
    db: Session,
    approval_id: str,
    action: str,
    reviewed_by: str = "tehsildar_01",
    remarks: Optional[str] = None,
) -> dict:
    """
    Tehsildar processes an approval request.
    Actions: 'approved', 'rejected', 'revision_requested'
    """
    aid = _resolve_uuid(approval_id)
    approval = db.query(ApprovalRequest).filter(ApprovalRequest.id == aid).first()

    if approval is None:
        raise ValueError(f"Approval request {approval_id} not found")

    if approval.status != "pending":
        raise ValueError(f"Cannot process. Request is already '{approval.status}'.")

    # Update approval status
    approval.status = action
    approval.reviewed_by = reviewed_by
    approval.remarks = remarks
    approval.reviewed_at = datetime.now(timezone.utc)

    # If rejected or revision_requested, reset parcel status
    if action in ("rejected", "revision_requested"):
        new_parcel_status = "raw" if action == "rejected" else "aligned"
        parcel = db.query(Parcel).filter(Parcel.id == approval.parcel_id).first()
        if parcel:
            parcel.alignment_status = new_parcel_status

    db.commit()

    return {
        "approval_id": str(approval.id),
        "parcel_id": str(approval.parcel_id),
        "action": action,
        "reviewed_by": reviewed_by,
        "remarks": remarks,
        "message": f"Parcel {action} by {reviewed_by}.",
    }


def get_pending_approvals(db: Session) -> list:
    """Returns all pending approval requests with parcel details."""
    records = (
        db.query(ApprovalRequest, Parcel)
        .join(Parcel, ApprovalRequest.parcel_id == Parcel.id)
        .filter(ApprovalRequest.status == "pending")
        .order_by(ApprovalRequest.requested_at.asc())
        .all()
    )

    return [
        {
            "approval_id": str(ar.id),
            "parcel_id": str(ar.parcel_id),
            "requested_by": ar.requested_by,
            "status": ar.status,
            "requested_at": ar.requested_at.isoformat() if ar.requested_at else None,
            "khasra_no": p.khasra_no,
            "owner_name": p.owner_name,
            "village": p.village,
            "tehsil": p.tehsil,
            "district": p.district,
            "ulpin": p.ulpin,
            "area_sqm": p.area_sqm,
            "alignment_status": p.alignment_status,
            "alignment_confidence": p.alignment_confidence,
        }
        for ar, p in records
    ]


def get_dashboard_stats(db: Session) -> dict:
    """Returns aggregate statistics for the Tehsildar dashboard."""
    total = db.query(func.count(Parcel.id)).scalar() or 0
    raw_count = db.query(func.count(Parcel.id)).filter(Parcel.alignment_status == "raw").scalar() or 0
    aligned_count = db.query(func.count(Parcel.id)).filter(Parcel.alignment_status == "aligned").scalar() or 0
    cleaned_count = db.query(func.count(Parcel.id)).filter(Parcel.alignment_status == "cleaned").scalar() or 0
    ulpin_count = db.query(func.count(Parcel.id)).filter(Parcel.alignment_status == "ulpin_assigned").scalar() or 0

    pending = db.query(func.count(ApprovalRequest.id)).filter(ApprovalRequest.status == "pending").scalar() or 0
    approved = db.query(func.count(ApprovalRequest.id)).filter(ApprovalRequest.status == "approved").scalar() or 0
    rejected = db.query(func.count(ApprovalRequest.id)).filter(ApprovalRequest.status == "rejected").scalar() or 0

    return {
        "total_parcels": total,
        "raw_count": raw_count,
        "aligned_count": aligned_count,
        "cleaned_count": cleaned_count,
        "ulpin_assigned_count": ulpin_count,
        "pending_approvals": pending,
        "approved_count": approved,
        "rejected_count": rejected,
    }
