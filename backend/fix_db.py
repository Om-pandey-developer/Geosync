"""
Fix the database schema by dropping old tables and re-creating from models.
"""
from database import engine, Base
from sqlalchemy import text
import models  # noqa - registers models with Base

import sys
import os

env = os.getenv("GEOSYNC_ENV", os.getenv("ENVIRONMENT", "development")).lower()
if env in ("production", "prod"):
    print("❌ ERROR: fix_db.py cannot be executed in a PRODUCTION environment!")
    print("This script drops all tables and cascades deletions. Exiting for safety.")
    sys.exit(1)

force = "--force" in sys.argv
if not force:
    print("⚠️  WARNING: This script will DROP and RECREATE all GeoSync database tables and enums!")
    confirmation = input("Type 'CONFIRM_DROP' to proceed, or press Ctrl+C to cancel: ").strip()
    if confirmation != "CONFIRM_DROP":
        print("Aborted. Database was not modified.")
        sys.exit(0)

print("Dropping old tables...")
with engine.connect() as conn:
    conn.execute(text("DROP TABLE IF EXISTS approval_requests CASCADE"))
    conn.execute(text("DROP TABLE IF EXISTS parcels CASCADE"))
    conn.execute(text("DROP TYPE IF EXISTS alignment_status_enum CASCADE"))
    conn.execute(text("DROP TYPE IF EXISTS approval_status_enum CASCADE"))
    conn.commit()
print("Done.\n")

print("Creating tables from SQLAlchemy models...")
Base.metadata.create_all(bind=engine)
print("Done.\n")

with engine.connect() as conn:
    r = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='parcels' ORDER BY ordinal_position"))
    cols = [row[0] for row in r.fetchall()]
    print(f"parcels columns: {cols}\n")

    r2 = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='approval_requests' ORDER BY ordinal_position"))
    cols2 = [row[0] for row in r2.fetchall()]
    print(f"approval_requests columns: {cols2}\n")

print("Now run: python seed.py --force")
