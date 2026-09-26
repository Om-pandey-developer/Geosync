"""
GeoSync SQLAlchemy ORM Models
Maps Python classes to PostGIS database tables.

-- WHY SQLAlchemy Models? --
Instead of writing raw SQL like:
    INSERT INTO parcels (khasra_no, geometry, ...) VALUES (...)
We define a Python class `Parcel` that automatically maps to the `parcels` table.
Then we can do:
    parcel = Parcel(khasra_no="101", geometry=..., ...)
    db.add(parcel)
    db.commit()
This gives us type safety, validation, and cleaner code.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Float, DateTime, Enum, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.types import TypeDecorator, Text
from geoalchemy2 import Geometry
from sqlalchemy.orm import relationship

from database import Base


class SafeGeometry(TypeDecorator):
    """
    Dual-engine geometry type:
    Uses PostGIS Geometry('POLYGON', srid=4326) on PostgreSQL,
    and Text (storing WKT / GeoJSON) on SQLite for offline air-gap demo resilience.
    """
    impl = Geometry("POLYGON", srid=4326)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect is not None and dialect.name == "sqlite":
            return dialect.type_descriptor(Text())
        return dialect.type_descriptor(Geometry("POLYGON", srid=4326)) if dialect else Geometry("POLYGON", srid=4326)


class Parcel(Base):
    """
    Represents a single land parcel (plot) in the cadastral system.

    Use Case: When a Patwari uploads a BhuNaksha map or drone image,
    each detected boundary polygon gets stored as a Parcel row.
    The geometry column stores the actual shape (polygon) of the land.
    """
    __tablename__ = "parcels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    khasra_no = Column(String(50), nullable=False, index=True, comment="Khasra number from revenue records")
    owner_name = Column(String(200), nullable=False)
    village = Column(String(200), nullable=False)
    tehsil = Column(String(200), nullable=False)
    district = Column(String(200), nullable=False)
    state = Column(String(100), nullable=False, default="Uttar Pradesh")
    area_sqm = Column(Float, nullable=True, comment="Area in square meters from ST_Area")
    ulpin = Column(String(14), nullable=True, unique=True, comment="14-digit Base-14 Bhu-Aadhaar ULPIN")
    centroid_lat = Column(Float, nullable=True)
    centroid_lon = Column(Float, nullable=True)

    # PostGIS geometry column: stores the parcel polygon in WGS84 (SRID 4326)
    geometry = Column(SafeGeometry(), nullable=False)

    # Alignment metadata
    alignment_status = Column(
        Enum("raw", "aligned", "cleaned", "ulpin_assigned", name="alignment_status_enum"),
        default="raw",
        nullable=False,
    )
    alignment_confidence = Column(Float, nullable=True, comment="ORB/RANSAC match confidence 0-1")

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationship to approval requests
    approval_requests = relationship("ApprovalRequest", back_populates="parcel")

    def __repr__(self):
        return f"<Parcel khasra={self.khasra_no} village={self.village} status={self.alignment_status}>"


class ApprovalRequest(Base):
    """
    HITL (Human-in-the-Loop) Revenue Officer Approval workflow.

    Use Case: After a Patwari aligns a parcel and generates a ULPIN,
    it must be legally approved by a Tehsildar (Revenue Officer).
    This table tracks each approval request with its status.
    """
    __tablename__ = "approval_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parcel_id = Column(UUID(as_uuid=True), ForeignKey("parcels.id"), nullable=False)
    requested_by = Column(String(100), nullable=False, comment="Patwari username")
    reviewed_by = Column(String(100), nullable=True, comment="Tehsildar username")
    status = Column(
        Enum("pending", "approved", "rejected", "revision_requested", name="approval_status_enum"),
        default="pending",
        nullable=False,
    )
    remarks = Column(Text, nullable=True)
    requested_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    parcel = relationship("Parcel", back_populates="approval_requests")

    def __repr__(self):
        return f"<ApprovalRequest parcel={self.parcel_id} status={self.status}>"
