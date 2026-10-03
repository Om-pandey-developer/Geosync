"""
GeoSync — AI-Powered Geospatial Middleware
FastAPI Application Entry Point

Run with: uvicorn main:app --reload --port 8000
"""

import sys
import os
import logging
from contextlib import asynccontextmanager

# Ensure backend root is always on sys.path regardless of where uvicorn is launched
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from sqlalchemy import text
from database import engine, Base, IS_SQLITE
from routers.tasks import router as tasks_router
from routers.alignment import router as alignment_router

# ── Logging setup ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)-30s | %(levelname)-5s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("geosync.main")


def _migrate_existing_db_enums():
    """Migrates legacy lowercase status strings to 5-stage formal enum in SQLite/PostGIS."""
    status_map = {
        "raw": "DRAFT",
        "aligned": "ALIGNED_DRAFT",
        "cleaned": "TOPOLOGY_CLEANED",
        "ulpin_assigned": "ULPIN_ASSIGNED",
    }
    try:
        if not IS_SQLITE:
            with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
                for val in ["DRAFT", "ALIGNED_DRAFT", "TOPOLOGY_CLEANED", "ULPIN_ASSIGNED", "PUBLISHED"]:
                    try:
                        conn.execute(text(f"ALTER TYPE alignment_status_enum ADD VALUE IF NOT EXISTS '{val}'"))
                    except Exception as enum_err:
                        logger.debug("Enum value '%s' add check: %s", val, enum_err)

        with engine.begin() as conn:
            for old_val, new_val in status_map.items():
                conn.execute(
                    text("UPDATE parcels SET alignment_status = :new_val WHERE alignment_status = :old_val"),
                    {"new_val": new_val, "old_val": old_val}
                )
        logger.info("✅ Database enum status migration verified.")
    except Exception as e:
        logger.warning("Enum migration check skipped or completed: %s", e)



@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables and verify migrations on startup."""
    Base.metadata.create_all(bind=engine)
    logger.info("✅ Database tables created / verified")
    _migrate_existing_db_enums()
    yield
    logger.info("🔒 GeoSync shutting down")


app = FastAPI(
    title="GeoSync API",
    description="AI-Powered Geospatial Middleware for cadastral map alignment, "
                "ULPIN generation, and Revenue Officer approval workflows. "
                "Phase 2 includes the ORB + RANSAC + TPS Map Alignment Engine.",
    version="2.0.0",
    lifespan=lifespan,
)


# ── CORS — Support configurable origins for production and local development ──
cors_origins_env = os.getenv("CORS_ORIGINS", "")
if cors_origins_env:
    allowed_origins = [orig.strip() for orig in cors_origins_env.split(",") if orig.strip()]
else:
    allowed_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

# If wildcard is explicitly used, allow_credentials must be False according to CORS specification
allow_credentials = "*" not in allowed_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=os.getenv("CORS_ORIGIN_REGEX", r"https?://(localhost|127\.0\.0\.1)(:\d+)?|https://.*\.pages\.dev|https://.*\.hf\.space"),
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Process-Time"],
)


# ── Global Exception Handlers ──

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all handler for unhandled exceptions — returns clean JSON."""
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An unexpected internal error occurred.",
            "error_type": type(exc).__name__,
            "path": str(request.url.path),
        },
    )


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    """Convert ValueErrors to 400 Bad Request."""
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": str(exc)},
    )


# ── Mount API routes ──
# Phase 1: Parcels, Alignment (mock), ULPIN, Approvals, Dashboard
app.include_router(tasks_router, prefix="/api")

# Phase 2: Map Alignment Engine at /api/v1/align-map
app.include_router(alignment_router, prefix="/api")

# ── Static File Storage (Output 3-panel reports, GeoJSON, and upload scratch) ──
from fastapi.staticfiles import StaticFiles
_storage_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "storage")
os.makedirs(os.path.join(_storage_dir, "alignment_reports"), exist_ok=True)
os.makedirs(os.path.join(_storage_dir, "uploads"), exist_ok=True)
app.mount("/storage", StaticFiles(directory=_storage_dir), name="storage")
app.mount("/api/storage", StaticFiles(directory=_storage_dir), name="api_storage")


@app.get("/", tags=["Health"])
@app.get("/api/health", tags=["Health"])
def health_check():
    return {
        "service": "GeoSync API",
        "status": "operational",
        "version": "2.0.0",
        "description": "AI-Powered Geospatial Middleware — Smart India Hackathon 2026",
        "engines": {
            "phase1": "Parcels + ULPIN + Approval Workflow",
            "phase2": "ORB→RANSAC→TPS Map Alignment Engine",
        },
    }

