"""
GeoSync Database Connection Layer
Connects to PostgreSQL + PostGIS via SQLAlchemy with automatic psycopg3 support,
and provides a resilient offline SQLite fallback for air-gapped demo mode.
"""

import os
import logging
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, declarative_base

logger = logging.getLogger("geosync.database")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/geosync_db"
)

# Convert postgresql:// to postgresql+psycopg:// if psycopg3 is installed
if DATABASE_URL.startswith("postgresql://") and not DATABASE_URL.startswith("postgresql+"):
    try:
        import psycopg
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
    except ImportError:
        pass

IS_SQLITE = False

def create_resilient_engine():
    global IS_SQLITE
    # First, if DATABASE_URL specifies sqlite, use SQLite directly
    if "sqlite" in DATABASE_URL:
        IS_SQLITE = True
        logger.info("Using SQLite offline database: %s", DATABASE_URL)
        return create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    
    # Try connecting to PostgreSQL
    try:
        eng = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=10, max_overflow=20, connect_args={"connect_timeout": 2})
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info(" Connected to PostgreSQL + PostGIS database successfully!")
        
        # Enable postgis extension if needed
        try:
            with eng.connect() as conn:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
                conn.commit()
        except Exception as pe:
            logger.warning("PostGIS extension check: %s", pe)
            
        return eng
    except Exception as e:
        logger.warning(
            "[Air-Gap Mode] PostgreSQL not available (%s). Switching to offline SQLite engine.",
            str(e).split("\n")[0]
        )
        IS_SQLITE = True
        sqlite_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "geosync_offline.db")
        sqlite_url = f"sqlite:///{sqlite_path}"
        return create_engine(sqlite_url, connect_args={"check_same_thread": False})

engine = create_resilient_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency: yields a DB session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

