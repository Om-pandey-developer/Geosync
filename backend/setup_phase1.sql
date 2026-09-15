-- =========================================================================
-- GeoSync Phase 1: Database Initialization Script
-- Execute this script in pgAdmin against the target database (geosync_db)
-- =========================================================================

-- 1. Enable PostGIS Extension for spatial data support
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Drop table if it exists to allow re-running this script
DROP TABLE IF EXISTS parcels CASCADE;

-- 3. Create the parcels table
CREATE TABLE parcels (
    id SERIAL PRIMARY KEY,
    plot_id VARCHAR(50) NOT NULL,
    ulpin VARCHAR(14) UNIQUE,
    status VARCHAR(20) DEFAULT 'DRAFT', -- Values: DRAFT, APPROVED, PUBLISHED
    confidence_score FLOAT DEFAULT 0.0,
    officer_notes TEXT,
    geom GEOMETRY(Polygon, 4326) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create Spatial GIST Index for fast spatial queries (bounding box searches, overlaps)
CREATE INDEX idx_parcels_geom ON parcels USING GIST (geom);

-- 5. Add table and column comments for documentation
COMMENT ON TABLE parcels IS 'Stores cadastral land parcels with PostGIS geometries';
COMMENT ON COLUMN parcels.plot_id IS 'Survey or Khasra number';
COMMENT ON COLUMN parcels.ulpin IS '14-digit Unique Land Parcel Identification Number (Base-14)';
COMMENT ON COLUMN parcels.geom IS 'Polygon geometry in WGS84 (SRID 4326)';
