"""
GeoSync — AI-Powered Geospatial Middleware
FastAPI Application Entry Point

Run with: uvicorn main:app --reload --port 8000
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from database import engine, Base
from routers.tasks import router as tasks_router
from routers.alignment import router as alignment_router

# ── Logging setup ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)-30s | %(levelname)-5s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("geosync.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables on startup."""
    Base.metadata.create_all(bind=engine)
    logger.info("✅ Database tables created / verified")
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


# ── CORS — Allow frontend dev server & common origins ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
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


@app.get("/", tags=["Health"])
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

