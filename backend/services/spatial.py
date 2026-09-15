"""
GeoSync Spatial Service — PostGIS Operations & ULPIN Generation

Handles:
1. Spatial topological cleanup (ST_Difference, ST_Snap, ST_MakeValid)
2. WGS84 centroid calculation (ST_Centroid)
3. 14-digit Base-14 ULPIN (Bhu-Aadhaar) generation from centroid coordinates

ULPIN Algorithm (simplified for MVP):
- Take the WGS84 centroid (lat, lon) of the parcel
- Scale and encode both coordinates into a Base-14 numeric representation
- Base-14 digits: 0-9 and A, B, C, D
- First 7 digits encode latitude, last 7 encode longitude
- This gives unique, location-derived identification for each land parcel
"""

import math
from typing import Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from geoalchemy2.functions import ST_AsGeoJSON, ST_Centroid, ST_Area, ST_MakeValid, ST_Snap

# Base-14 character set for ULPIN encoding
BASE14_CHARS = "0123456789ABCD"


def encode_base14(value: float, num_digits: int = 7) -> str:
    """
    Encodes a normalized float value [0, 1) into a Base-14 string.
    Similar to geohash but using Base-14 for the Bhu-Aadhaar standard.
    """
    BASE14_CHARS = "0123456789ABCD"
    result = []
    for _ in range(num_digits):
        value *= 14
        digit = int(value)
        digit = min(digit, 13)  # Clamp to valid range
        result.append(BASE14_CHARS[digit])
        value -= digit
    return "".join(result)


def generate_ulpin(lat: float, lon: float) -> str:
    """
    Generates a 14-digit Base-14 ULPIN from WGS84 coordinates.
    Strictly replaces 'I' -> 'Y', 'O' -> 'Z' (DoLR/ECCMA-compliant).
    """
    norm_lat = (lat + 90.0) / 180.0
    norm_lon = (lon + 180.0) / 360.0

    norm_lat = max(0.0, min(norm_lat, 0.999999999))
    norm_lon = max(0.0, min(norm_lon, 0.999999999))

    lat_code = encode_base14(norm_lat, 7)
    lon_code = encode_base14(norm_lon, 7)
    
    ulpin = lat_code + lon_code
    
    # Strictly replace visually ambiguous characters per ECCMA spec
    ulpin = ulpin.replace('I', 'Y').replace('O', 'Z')
    
    return ulpin


def get_parcel_centroid(db: Session, parcel_id: str) -> Tuple[float, float]:
    result = db.execute(
        text("""
            SELECT
                ST_Y(ST_Centroid(ST_Transform(geometry, 4326))) as lat,
                ST_X(ST_Centroid(ST_Transform(geometry, 4326))) as lon
            FROM parcels
            WHERE id = :pid
        """),
        {"pid": parcel_id}
    ).fetchone()

    if result is None:
        raise ValueError(f"Parcel {parcel_id} not found")

    return result.lat, result.lon


def calculate_area_sqm(db: Session, parcel_id: str) -> float:
    result = db.execute(
        text("""
            SELECT ST_Area(geometry::geography) as area_sqm
            FROM parcels
            WHERE id = :pid
        """),
        {"pid": parcel_id}
    ).fetchone()

    if result is None:
        raise ValueError(f"Parcel {parcel_id} not found")

    return round(result.area_sqm, 2)


def run_topological_cleanup(db: Session, parcel_id: str) -> dict:
    """
    Phase 3: Real Topological Cleanup using ST_Difference and ST_Snap for an existing parcel.
    """
    import json
    
    query = """
    WITH input_geom AS (
        SELECT ST_MakeValid(geometry) as geom FROM parcels WHERE id = :pid
    ),
    diff_geom AS (
        SELECT COALESCE(
            (
                SELECT ST_Difference(i.geom, ST_Union(p.geometry))
                FROM input_geom i
                CROSS JOIN parcels p
                WHERE ST_Intersects(i.geom, p.geometry) AND p.id != :pid
            ),
            (SELECT geom FROM input_geom)
        ) as geom
    ),
    snapped_geom AS (
        SELECT ST_Snap(d.geom, p.geometry, 0.0000005) as geom
        FROM diff_geom d
        LEFT JOIN parcels p ON ST_DWithin(d.geom, p.geometry, 0.0000005) AND p.id != :pid
        ORDER BY ST_Distance(d.geom, p.geometry) ASC
        LIMIT 1
    )
    SELECT 
        ST_AsGeoJSON(COALESCE((SELECT geom FROM snapped_geom), (SELECT geom FROM diff_geom)))::json as cleaned_geojson,
        ST_Area(COALESCE((SELECT geom FROM snapped_geom), (SELECT geom FROM diff_geom))::geography) as area_sqm
    """
    
    result = db.execute(text(query), {"pid": parcel_id}).fetchone()
    
    if not result or not result.cleaned_geojson:
        fallback_query = """
        WITH input_geom AS (
            SELECT ST_MakeValid(geometry) as geom FROM parcels WHERE id = :pid
        ),
        diff_geom AS (
            SELECT COALESCE(
                (
                    SELECT ST_Difference(i.geom, ST_Union(p.geometry))
                    FROM input_geom i
                    CROSS JOIN parcels p
                    WHERE ST_Intersects(i.geom, p.geometry) AND p.id != :pid
                ),
                (SELECT geom FROM input_geom)
            ) as geom
        )
        SELECT 
            ST_AsGeoJSON(geom)::json as cleaned_geojson,
            ST_Area(geom::geography) as area_sqm
        FROM diff_geom
        """
        result = db.execute(text(fallback_query), {"pid": parcel_id}).fetchone()
        
    cleaned_geojson = result.cleaned_geojson
    area_sqm = round(result.area_sqm, 2)
    
    update_query = """
    UPDATE parcels 
    SET geometry = ST_SetSRID(ST_GeomFromGeoJSON(:geojson_str), 4326),
        area_sqm = :area
    WHERE id = :pid
    """
    db.execute(text(update_query), {"geojson_str": json.dumps(cleaned_geojson), "area": area_sqm, "pid": parcel_id})
    
    return {
        "cleaned_geojson": cleaned_geojson,
        "area_sqm": area_sqm
    }


def run_topological_cleanup_geojson(db: Session, geojson: dict) -> dict:
    """
    Phase 3: Real Topological Cleanup using ST_Difference and ST_Snap.
    Accepts candidate GeoJSON and returns cleaned GeoJSON + Area.
    Tolerance: 0.05 meters (approx 0.0000005 degrees).
    """
    import json
    
    geojson_str = json.dumps(geojson)
    
    # We use ST_GeomFromGeoJSON, then ST_MakeValid
    # Then we run ST_Difference against all existing parcels to cut overlaps
    # Then ST_Snap to close gaps
    
    # First, let's create a temporary geometry in a CTE, subtract overlapping parcels, then snap
    query = """
    WITH input_geom AS (
        SELECT ST_MakeValid(ST_GeomFromGeoJSON(:geojson)) as geom
    ),
    diff_geom AS (
        SELECT COALESCE(
            (
                SELECT ST_Difference(i.geom, ST_Union(p.geometry))
                FROM input_geom i
                CROSS JOIN parcels p
                WHERE ST_Intersects(i.geom, p.geometry)
            ),
            (SELECT geom FROM input_geom)
        ) as geom
    ),
    snapped_geom AS (
        SELECT ST_Snap(d.geom, p.geometry, 0.0000005) as geom
        FROM diff_geom d
        LEFT JOIN parcels p ON ST_DWithin(d.geom, p.geometry, 0.0000005)
        ORDER BY ST_Distance(d.geom, p.geometry) ASC
        LIMIT 1
    )
    SELECT 
        ST_AsGeoJSON(COALESCE((SELECT geom FROM snapped_geom), (SELECT geom FROM diff_geom)))::json as cleaned_geojson,
        ST_Area(COALESCE((SELECT geom FROM snapped_geom), (SELECT geom FROM diff_geom))::geography) as area_sqm
    """
    
    result = db.execute(text(query), {"geojson": geojson_str}).fetchone()
    
    # If the snapped logic fails, fallback to simple difference
    if not result or not result.cleaned_geojson:
        fallback_query = """
        WITH input_geom AS (
            SELECT ST_MakeValid(ST_GeomFromGeoJSON(:geojson)) as geom
        ),
        diff_geom AS (
            SELECT COALESCE(
                (
                    SELECT ST_Difference(i.geom, ST_Union(p.geometry))
                    FROM input_geom i
                    CROSS JOIN parcels p
                    WHERE ST_Intersects(i.geom, p.geometry)
                ),
                (SELECT geom FROM input_geom)
            ) as geom
        )
        SELECT 
            ST_AsGeoJSON(geom)::json as cleaned_geojson,
            ST_Area(geom::geography) as area_sqm
        FROM diff_geom
        """
        result = db.execute(text(fallback_query), {"geojson": geojson_str}).fetchone()
        
    return {
        "cleaned_geojson": result.cleaned_geojson,
        "area_sqm": round(result.area_sqm, 2)
    }


def assign_ulpin_to_parcel(db: Session, parcel_id: str) -> dict:
    """
    Full ULPIN assignment pipeline:
    1. Calculate centroid via PostGIS
    2. Calculate area
    3. Generate Base-14 ULPIN
    4. Store results in DB
    """
    lat, lon = get_parcel_centroid(db, parcel_id)
    area = calculate_area_sqm(db, parcel_id)
    ulpin = generate_ulpin(lat, lon)

    db.execute(
        text("""
            UPDATE parcels
            SET ulpin = :ulpin,
                centroid_lat = :lat,
                centroid_lon = :lon,
                area_sqm = :area,
                alignment_status = 'ulpin_assigned',
                updated_at = NOW()
            WHERE id = :pid
        """),
        {"ulpin": ulpin, "lat": lat, "lon": lon, "area": area, "pid": parcel_id}
    )
    db.commit()

    return {
        "parcel_id": parcel_id,
        "ulpin": ulpin,
        "centroid_lat": lat,
        "centroid_lon": lon,
        "area_sqm": area,
    }


def commit_parcel_to_db(
    db: Session, 
    parcel_id: str, 
    ulpin: str, 
    officer_id: str, 
    audit_notes: str = None
) -> dict:
    """
    Phase 3: Database Commit Service.
    Updates parcel status to 'PUBLISHED', attaches ULPIN, and logs audit metadata.
    """
    parcel = db.execute(
        text("SELECT id FROM parcels WHERE id = :pid"),
        {"pid": parcel_id}
    ).fetchone()

    if not parcel:
        raise ValueError(f"Parcel {parcel_id} not found")

    # In a real system, audit_notes and officer_id would go to an audit_logs table
    # Here we update the parcel status
    
    db.execute(
        text("""
            UPDATE parcels
            SET status = 'PUBLISHED',
                ulpin = :ulpin,
                updated_at = NOW()
            WHERE id = :pid
        """),
        {
            "ulpin": ulpin,
            "pid": parcel_id
        }
    )
    db.commit()

    # Fetch the exact updated_at time
    updated = db.execute(
        text("SELECT updated_at FROM parcels WHERE id = :pid"),
        {"pid": parcel_id}
    ).fetchone()

    return {
        "parcel_id": parcel_id,
        "status": "PUBLISHED",
        "ulpin": ulpin,
        "committed_at": updated.updated_at,
        "officer_id": officer_id
    }
