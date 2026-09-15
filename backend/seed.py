"""
GeoSync Database Seeder — Mock 1-Ward Spatial Dataset

Generates ~18 realistic land parcels for Ward 12, Mohanlalganj Tehsil, Lucknow.
Parcels are positioned around real coordinates near Lucknow (26.76°N, 80.90°E)
with realistic Khasra numbers, owner names, and polygon geometries.

Run: python seed.py
"""

import sys
import uuid
from database import engine, Base, SessionLocal
from sqlalchemy import text


# ────────────────── Mock Parcel Data ──────────────────

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


def make_polygon_wkt(lat_offset: float, lon_offset: float, size: float = 0.001) -> str:
    """
    Creates a slightly irregular rectangular polygon WKT string.
    Adds small random-ish offsets to make parcels look more realistic.
    """
    lat = BASE_LAT + lat_offset
    lon = BASE_LON + lon_offset

    # Slight irregularity for realistic shapes
    jitter = size * 0.08

    coords = [
        (lon, lat),
        (lon + size + jitter, lat + jitter * 0.5),
        (lon + size, lat + size),
        (lon - jitter * 0.3, lat + size - jitter * 0.4),
        (lon, lat),  # close ring
    ]

    coord_str = ", ".join(f"{c[0]:.6f} {c[1]:.6f}" for c in coords)
    return f"SRID=4326;POLYGON(({coord_str}))"


def seed_database():
    """Seeds the database with mock parcel data."""
    db = SessionLocal()

    try:
        # Check if data already exists
        count = db.execute(text("SELECT COUNT(*) FROM parcels")).scalar()
        if count > 0:
            print(f"⚠️  Database already has {count} parcels. Skipping seed.")
            print("   To re-seed, run: python seed.py --force")
            if "--force" not in sys.argv:
                return
            print("   --force flag detected. Clearing existing data...")
            db.execute(text("DELETE FROM approval_requests"))
            db.execute(text("DELETE FROM parcels"))
            db.commit()

        print(f"🌱 Seeding {len(MOCK_PARCELS)} parcels for Ward 12, Mohanlalganj, Lucknow...\n")

        for p in MOCK_PARCELS:
            parcel_id = str(uuid.uuid4())
            wkt = make_polygon_wkt(p["offset"][0], p["offset"][1])

            db.execute(
                text("""
                    INSERT INTO parcels (id, khasra_no, owner_name, village, tehsil, district, state, geometry, alignment_status, created_at, updated_at)
                    VALUES (:id, :khasra, :owner, :village, :tehsil, :district, :state, ST_GeomFromEWKT(:wkt), 'raw', NOW(), NOW())
                """),
                {
                    "id": parcel_id,
                    "khasra": p["khasra"],
                    "owner": p["owner"],
                    "village": "Mohanlalganj",
                    "tehsil": "Mohanlalganj",
                    "district": "Lucknow",
                    "state": "Uttar Pradesh",
                    "wkt": wkt,
                }
            )
            print(f"   ✅ Khasra {p['khasra']:>6} — {p['owner']}")

        db.commit()
        print(f"\n🎉 Successfully seeded {len(MOCK_PARCELS)} parcels!")
        print(f"   📍 Location: Ward 12, Mohanlalganj, Lucknow (26.76°N, 80.90°E)")
        print(f"   🗂️  Status: All parcels set to 'raw' (unaligned)")

    except Exception as e:
        db.rollback()
        print(f"❌ Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    # Create tables first
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables ready\n")
    seed_database()
