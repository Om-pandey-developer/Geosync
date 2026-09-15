"""
GeoSync Phase 1: Python Mock Data Seeder

Seeds 5 property polygons in Lucknow (26.8467, 80.9451) with intentional spatial defects:
- P101 & P102: 5cm overlap (for ST_Difference testing)
- P103 & P104: 3cm gap (for ST_Snap testing)
"""

import sys
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, DateTime, text
from sqlalchemy.orm import declarative_base, sessionmaker
from geoalchemy2 import Geometry
from datetime import datetime

# Database Connection
DB_URL = "postgresql://postgres:postgres@localhost:5432/geosync_db"

print("🔄 Initializing database connection...")
try:
    engine = create_engine(DB_URL)
    Session = sessionmaker(bind=engine)
    Base = declarative_base()
except Exception as e:
    print(f"❌ Failed to connect to database: {e}")
    sys.exit(1)


# SQLAlchemy Model matching the SQL script
class Parcel(Base):
    __tablename__ = 'parcels'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    plot_id = Column(String(50), nullable=False)
    ulpin = Column(String(14), unique=True)
    status = Column(String(20), default='DRAFT')
    confidence_score = Column(Float, default=0.0)
    officer_notes = Column(Text)
    geom = Column(Geometry("POLYGON", srid=4326), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


def generate_mock_data():
    """Generates 5 polygons with precise spatial defects."""
    # Base coordinates: Lucknow (WGS84 Lat 26.8467, Long 80.9451)
    lon, lat = 80.9451, 26.8467
    
    # 1 degree lat/lon is roughly 111,000 meters. 
    # Therefore, 1 meter is approx 0.000009 degrees.
    # 5cm (0.05m) overlap = 0.00000045 degrees
    # 3cm (0.03m) gap = 0.00000027 degrees
    deg_5cm = 0.00000045
    deg_3cm = 0.00000027
    
    width = 0.0002  # ~22 meters wide
    height = 0.0002 # ~22 meters high
    
    # P101: Base Plot
    p101_wkt = f"POLYGON(({lon} {lat}, {lon+width} {lat}, {lon+width} {lat+height}, {lon} {lat+height}, {lon} {lat}))"
    
    # P102: Right of P101, with 5cm overlap on the left boundary
    lon2 = lon + width - deg_5cm # Shifts left by 5cm to create overlap
    p102_wkt = f"POLYGON(({lon2} {lat}, {lon2+width} {lat}, {lon2+width} {lat+height}, {lon2} {lat+height}, {lon2} {lat}))"
    
    # P103: Right of P102, perfectly snapped
    lon3 = lon2 + width
    p103_wkt = f"POLYGON(({lon3} {lat}, {lon3+width} {lat}, {lon3+width} {lat+height}, {lon3} {lat+height}, {lon3} {lat}))"
    
    # P104: Right of P103, with 3cm gap on the left boundary
    lon4 = lon3 + width + deg_3cm # Shifts right by 3cm to create gap
    p104_wkt = f"POLYGON(({lon4} {lat}, {lon4+width} {lat}, {lon4+width} {lat+height}, {lon4} {lat+height}, {lon4} {lat}))"
    
    # P105: Right of P104, perfectly snapped
    lon5 = lon4 + width
    p105_wkt = f"POLYGON(({lon5} {lat}, {lon5+width} {lat}, {lon5+width} {lat+height}, {lon5} {lat+height}, {lon5} {lat}))"

    return [
        Parcel(plot_id="P101", geom=f"SRID=4326;{p101_wkt}", status="DRAFT", confidence_score=94.2, officer_notes="Base plot."),
        Parcel(plot_id="P102", geom=f"SRID=4326;{p102_wkt}", status="DRAFT", confidence_score=88.5, officer_notes="Contains 5cm overlap with P101."),
        Parcel(plot_id="P103", geom=f"SRID=4326;{p103_wkt}", status="DRAFT", confidence_score=97.1, officer_notes="Perfect alignment."),
        Parcel(plot_id="P104", geom=f"SRID=4326;{p104_wkt}", status="DRAFT", confidence_score=91.8, officer_notes="Contains 3cm gap with P103."),
        Parcel(plot_id="P105", geom=f"SRID=4326;{p105_wkt}", status="DRAFT", confidence_score=95.0, officer_notes="Perfect alignment."),
    ]


def main():
    try:
        # Test connection
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("✅ Database connection successful.")
    except Exception as e:
        print(f"❌ Database connection failed. Ensure PostgreSQL is running and credentials are correct.\n{e}")
        return

    session = Session()
    try:
        # Check if table exists
        print("🔄 Checking if parcels table exists...")
        # We don't drop the table here, we rely on the SQL script being run first
        
        # Clear existing data for fresh seed
        print("🗑️  Clearing existing data...")
        session.query(Parcel).delete()
        
        print("🌱 Seeding mock data with spatial defects...")
        mock_parcels = generate_mock_data()
        session.add_all(mock_parcels)
        session.commit()
        
        print(f"🎉 Successfully seeded {len(mock_parcels)} parcels!")
        for p in mock_parcels:
            print(f"  - {p.plot_id}: Confidence {p.confidence_score}% | Note: {p.officer_notes}")
            
    except Exception as e:
        session.rollback()
        print(f"❌ Error during seeding: {e}")
        print("💡 Hint: Did you run the setup_phase1.sql script in pgAdmin first to create the table?")
    finally:
        session.close()


if __name__ == "__main__":
    main()
