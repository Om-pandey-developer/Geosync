"""
GeoSync Database Connection Layer
Connects to PostgreSQL + PostGIS via SQLAlchemy async-compatible engine.
"""

import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/geosync_db"
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=10, max_overflow=20)


# Ensure PostGIS extension is enabled on first connect
@event.listens_for(engine, "connect")
def _enable_postgis(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
    dbapi_conn.commit()
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency: yields a DB session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
