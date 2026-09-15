"""
GeoSync Database Seeder — Mock 1-Ward Spatial Dataset
=====================================================

Generates ~18 realistic land parcels for Ward 12, Mohanlalganj Tehsil, Lucknow.
Parcels are positioned around real coordinates near Lucknow (26.76°N, 80.90°E)
with realistic Khasra numbers, owner names, and polygon geometries.

Supports both:
- PostgreSQL + PostGIS (via ST_GeomFromEWKT)
- Resilient SQLite + Shapely offline database (storing GeoJSON/WKT)

Run: python seed.py
"""

import sys
import os
import uuid
import json
from datetime import datetime, timezone

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from sqlalchemy import text
from shapely.geometry import Polygon, mapping

from database import engine, Base, SessionLocal, IS_SQLITE
from models import Parcel, ApprovalRequest

# Base coordinates: Near Mohanlalganj, Lucknow (~26.76°N, 80.90°E)
BASE_LAT = 26.7605
BASE_LON = 80.9010

MOCK_PARCELS = [
    {"khasra": "101", "owner": "Ram Prasad Verma", "offset": (0.0, 0.0)},
    {"khasra": "102", "owner": "Sita Devi", "offset": (0.0012, 0.0)},
    {"khasra": "103", "owner": "Mohan Lal Yadav", "offset": (0.0024, 0.0)},
    {"khasra": "104", "owner": "Geeta Singh", "offset": (0.0036, 0.0)},
    {"khasra": "105", "owner": "Rajesh Kumar", "offset": (0.0, 0.0012)},
    {"khasra": "106/1", "owner": "Sunita Mishra", "offset": (0.0012, 0.0012)},
    {"khasra": "106/2", "owner": "Anil Mishra", "offset": (0.0024, 0.0012)},
    {"khasra": "107", "owner": "Pradeep Tiwari", "offset": (0.0036, 0.0012)},
    {"khasra": "108", "owner": "Kamla Devi Gupta", "offset": (0.0, 0.0024)},
    {"khasra": "109", "owner": "Suresh Chandra", "offset": (0.0012, 0.0024)},
    {"khasra": "110", "owner": "Rekha Pandey", "offset": (0.0024, 0.0024)},
    {"khasra": "111", "owner": "Dinesh Sharma", "offset": (0.0036, 0.0024)},
    {"khasra": "112", "owner": "Meera Bai", "offset": (0.0, 0.0036)},
    {"khasra": "113/1", "owner": "Harish Patel", "offset": (0.0012, 0.0036)},
    {"khasra": "113/2", "owner": "Kavita Patel", "offset": (0.0024, 0.0036)},
    {"khasra": "114", "owner": "Vijay Kushwaha", "offset": (0.0036, 0.0036)},
    {"khasra": "115", "owner": "Lakshmi Narayan", "offset": (0.0048, 0.0)},
    {"khasra": "116", "owner": "Asha Rani", "offset": (0.0048, 0.0012)},
]


def make_polygon(lat_offset: float, lon_offset: float, size: float = 0.001) -> Polygon:
    """Creates a slightly irregular realistic cadastral parcel polygon."""
    lat = BASE_LAT + lat_offset
    lon = BASE_LON + lon_offset
    jitter = size * 0.08

    coords = [
        (lon, lat),
        (lon + size + jitter, lat + jitter * 0.5),
        (lon + size, lat + size),
        (lon - jitter * 0.3, lat + size - jitter * 0.4),
        (lon, lat),
    ]
    return Polygon(coords)


def seed_database(force: bool = False):
    """Seeds the database with mock 1-ward parcel data."""
    db = SessionLocal()

    try:
        count = db.query(Parcel).count()
        if count > 0 and not force:
            print(f"⚠️  Database already has {count} parcels. Skipping seed.")
            return

        if force and count > 0:
            print("   --force flag detected. Clearing existing data...")
            db.query(ApprovalRequest).delete()
            db.query(Parcel).delete()
            db.commit()

        print(f"🌱 Seeding {len(MOCK_PARCELS)} parcels for Ward 12, Mohanlalganj, Lucknow...")

        for p in MOCK_PARCELS:
            poly = make_polygon(p["offset"][0], p["offset"][1])
            geo_dict = mapping(poly)
            
            # Compute centroid and approximate area
            c = poly.centroid
            lat_rad = (c.y * 3.141592653589793) / 180.0
            area_sqm = round(poly.area * 111320.0 * (111320.0 * 0.89), 2)

            parcel_id = uuid.uuid4()

            if IS_SQLITE:
                # Store GeoJSON string on SQLite
                parcel = Parcel(
                    id=parcel_id,
                    khasra_no=p["khasra"],
                    owner_name=p["owner"],
                    village="Mohanlalganj",
                    tehsil="Mohanlalganj",
                    district="Lucknow",
                    state="Uttar Pradesh",
                    geometry=json.dumps(geo_dict),
                    alignment_status="raw",
                    centroid_lat=round(c.y, 6),
                    centroid_lon=round(c.x, 6),
                    area_sqm=area_sqm,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
                db.add(parcel)
            else:
                # PostGIS insert using ST_GeomFromGeoJSON
                wkt_str = f"SRID=4326;{poly.wkt}"
                db.execute(
                    text("""
                        INSERT INTO parcels (id, khasra_no, owner_name, village, tehsil, district, state, geometry, alignment_status, centroid_lat, centroid_lon, area_sqm, created_at, updated_at)
                        VALUES (:id, :khasra, :owner, :village, :tehsil, :district, :state, ST_GeomFromEWKT(:wkt), 'raw', :lat, :lon, :area, NOW(), NOW())
                    """),
                    {
                        "id": str(parcel_id),
                        "khasra": p["khasra"],
                        "owner": p["owner"],
                        "village": "Mohanlalganj",
                        "tehsil": "Mohanlalganj",
                        "district": "Lucknow",
                        "state": "Uttar Pradesh",
                        "wkt": wkt_str,
                        "lat": round(c.y, 6),
                        "lon": round(c.x, 6),
                        "area": area_sqm,
                    }
                )

        db.commit()
        print(f"🎉 Successfully seeded {len(MOCK_PARCELS)} parcels for offline/online evaluation!")

    except Exception as e:
        db.rollback()
        print(f"❌ Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    force = "--force" in sys.argv
    seed_database(force=force)
