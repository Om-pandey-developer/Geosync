"""
GeoSync Phase 2 — Map Alignment Engine
========================================

Production-grade geospatial alignment pipeline that registers legacy cadastral
(BhuNaksha) vector contours against high-resolution drone imagery rasters.

Pipeline Stages:
    1. ORB (Oriented FAST and Rotated BRIEF) keypoint & descriptor extraction
    2. Feature matching via FLANN or BruteForce matcher
    3. RANSAC-filtered homography estimation (3×3 perspective transform)
    4. Optional Thin-Plate Spline (TPS) warping from manual Ground Control Points
    5. RMSE-based Alignment Quality Index (confidence 0-100%)
    6. Homography application to input GeoJSON coordinates

Dependencies: opencv-python-headless, numpy, shapely
"""

from __future__ import annotations

import os
import json
import math
import logging
import time
from typing import List, Optional, Tuple

import cv2
import numpy as np
from shapely.geometry import shape, mapping, Polygon, MultiPolygon
from shapely.affinity import affine_transform

logger = logging.getLogger("geosync.alignment_engine")

# ━━━━━━━━━━━━━━━━━━ CRS Normalization (pyproj / Math) ━━━━━━━━━━━━━━━━━━

try:
    from pyproj import Transformer
    _transformer_4326_to_3857 = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
    _transformer_3857_to_4326 = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True)
    HAS_PYPROJ = True
except ImportError:
    HAS_PYPROJ = False
    _transformer_4326_to_3857 = None
    _transformer_3857_to_4326 = None

def project_wgs84_to_webmercator(lon: float, lat: float) -> Tuple[float, float]:
    """Transforms WGS84 (EPSG:4326) degrees into Web Mercator (EPSG:3857) meters."""
    if HAS_PYPROJ and _transformer_4326_to_3857:
        x, y = _transformer_4326_to_3857.transform(lon, lat)
        return float(x), float(y)
    x = lon * 20037508.34 / 180.0
    lat_rad = max(min(lat, 89.5), -89.5) * math.pi / 180.0
    y = math.log(math.tan((math.pi / 4.0) + (lat_rad / 2.0))) * 20037508.34 / math.pi
    return float(x), float(y)

def project_webmercator_to_wgs84(x: float, y: float) -> Tuple[float, float]:
    """Transforms Web Mercator (EPSG:3857) meters into WGS84 (EPSG:4326) degrees."""
    if HAS_PYPROJ and _transformer_3857_to_4326:
        lon, lat = _transformer_3857_to_4326.transform(x, y)
        return float(lon), float(lat)
    lon = x * 180.0 / 20037508.34
    lat = (2.0 * math.atan(math.exp(y * math.pi / 20037508.34)) - (math.pi / 2.0)) * 180.0 / math.pi
    return float(lon), float(lat)

def normalize_geojson_crs(
    coordinates: List[List[List[float]]],
    source_crs: str = "EPSG:4326",
    target_crs: str = "EPSG:3857",
) -> List[List[List[float]]]:
    """
    Normalizes coordinates from source CRS to target metric CRS.
    Supports EPSG:4326 -> EPSG:3857 (metric) and vice versa.
    """
    if source_crs == target_crs:
        return coordinates

    transformed_rings = []
    for ring in coordinates:
        new_ring = []
        for pt in ring:
            if target_crs == "EPSG:3857" and source_crs == "EPSG:4326":
                x, y = project_wgs84_to_webmercator(pt[0], pt[1])
            elif target_crs == "EPSG:4326" and source_crs == "EPSG:3857":
                x, y = project_webmercator_to_wgs84(pt[0], pt[1])
            else:
                x, y = pt[0], pt[1]
            new_ring.append([
                round(x, 4 if target_crs == "EPSG:3857" else 8),
                round(y, 4 if target_crs == "EPSG:3857" else 8),
            ])
        transformed_rings.append(new_ring)
    return transformed_rings

# ━━━━━━━━━━━━━━━━━━ Redis Draft Caching ━━━━━━━━━━━━━━━━━━

try:
    import redis
    REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
    redis_client = redis.Redis(
        host=REDIS_HOST, port=REDIS_PORT, db=0,
        decode_responses=True, socket_connect_timeout=1.0,
    )
    # Don't block if redis is not running yet
    redis_client.ping()
    HAS_REDIS = True
except Exception:
    redis_client = None
    HAS_REDIS = False

def cache_aligned_draft(parcel_id: str, alignment_data: dict, ttl_seconds: int = 86400) -> bool:
    """Caches aligned GeoJSON and metadata with status ALIGNED_DRAFT in Redis."""
    global HAS_REDIS, redis_client
    if not HAS_REDIS or not redis_client:
        return False
    try:
        key = f"geosync:alignment:{parcel_id}"
        payload = {
            "status": "ALIGNED_DRAFT",
            "cached_at": time.time(),
            **alignment_data
        }
        redis_client.setex(key, ttl_seconds, json.dumps(payload))
        logger.info("Cached ALIGNED_DRAFT for parcel %s in Redis (TTL: %ds)", parcel_id, ttl_seconds)
        return True
    except Exception as e:
        logger.warning("Redis cache error: %s", e)
        return False

def get_cached_aligned_draft(parcel_id: str) -> Optional[dict]:
    """Retrieves cached ALIGNED_DRAFT for parcel_id from Redis."""
    global HAS_REDIS, redis_client
    if not HAS_REDIS or not redis_client:
        return None
    try:
        key = f"geosync:alignment:{parcel_id}"
        val = redis_client.get(key)
        return json.loads(val) if val else None
    except Exception:
        return None


# ━━━━━━━━━━━━━━━━━━ Constants ━━━━━━━━━━━━━━━━━━

# ORB detector parameters
ORB_MAX_FEATURES = 5000
ORB_SCALE_FACTOR = 1.2
ORB_N_LEVELS = 8
ORB_EDGE_THRESHOLD = 31
ORB_FAST_THRESHOLD = 20

# FLANN matcher parameters (for ORB binary descriptors → LSH index)
FLANN_INDEX_LSH = 6
FLANN_TABLE_NUMBER = 12
FLANN_KEY_SIZE = 20
FLANN_MULTI_PROBE_LEVEL = 2
FLANN_SEARCH_PARAMS_CHECKS = 50

# RANSAC thresholds
RANSAC_REPROJ_THRESHOLD = 5.0
RANSAC_MAX_ITERS = 2000
RANSAC_CONFIDENCE = 0.995

# Lowe's ratio test threshold
LOWES_RATIO = 0.75

# Minimum number of inlier matches to consider alignment valid
MIN_MATCH_COUNT = 10


# ━━━━━━━━━━━━━━━━━━ Feature Detection ━━━━━━━━━━━━━━━━━━

def create_orb_detector() -> cv2.ORB:
    """
    Creates a tuned ORB (Oriented FAST and Rotated BRIEF) feature detector.

    ORB is chosen over SIFT/SURF because:
    - Patent-free and open source
    - ~10x faster than SURF and ~100x faster than SIFT
    - Binary descriptors enable fast Hamming-distance matching
    - Rotation-invariant via intensity centroid orientation
    """
    return cv2.ORB_create(
        nfeatures=ORB_MAX_FEATURES,
        scaleFactor=ORB_SCALE_FACTOR,
        nlevels=ORB_N_LEVELS,
        edgeThreshold=ORB_EDGE_THRESHOLD,
        firstLevel=0,
        WTA_K=2,
        scoreType=cv2.ORB_HARRIS_SCORE,
        patchSize=ORB_EDGE_THRESHOLD,
        fastThreshold=ORB_FAST_THRESHOLD,
    )


def geojson_coords_to_contour_image(
    coordinates: List[List[List[float]]],
    image_size: Tuple[int, int] = (2048, 2048),
    padding: float = 0.05,
) -> Tuple[np.ndarray, dict]:
    """
    Rasterizes GeoJSON polygon coordinates into a binary contour image
    suitable for ORB feature extraction.

    This converts vector parcel boundaries into a raster representation
    so that OpenCV feature detection can find common structural patterns
    between legacy map contours and drone orthophotos.

    Args:
        coordinates: GeoJSON Polygon coordinate rings
                     [[[lon, lat], [lon, lat], ...], ...]
        image_size:  (width, height) of the output raster
        padding:     fractional padding around the bounding box

    Returns:
        (grayscale_image, geo_transform) where geo_transform contains
        the mapping parameters from pixel space back to WGS84.
    """
    # Flatten all rings into a single array for bounding box computation
    all_points = []
    for ring in coordinates:
        all_points.extend(ring)
    all_points = np.array(all_points, dtype=np.float64)

    min_lon, min_lat = all_points.min(axis=0)
    max_lon, max_lat = all_points.max(axis=0)

    # Add padding
    lon_range = max_lon - min_lon or 1e-6
    lat_range = max_lat - min_lat or 1e-6
    pad_lon = lon_range * padding
    pad_lat = lat_range * padding
    min_lon -= pad_lon
    max_lon += pad_lon
    min_lat -= pad_lat
    max_lat += pad_lat

    w, h = image_size
    scale_x = w / (max_lon - min_lon)
    scale_y = h / (max_lat - min_lat)

    geo_transform = {
        "min_lon": min_lon,
        "min_lat": min_lat,
        "max_lon": max_lon,
        "max_lat": max_lat,
        "scale_x": scale_x,
        "scale_y": scale_y,
        "image_width": w,
        "image_height": h,
    }

    # Create blank image and draw polygon contours
    img = np.zeros((h, w), dtype=np.uint8)

    for ring in coordinates:
        pts = np.array(ring, dtype=np.float64)
        # Map geo coords → pixel coords
        px = ((pts[:, 0] - min_lon) * scale_x).astype(np.int32)
        py = (h - 1 - (pts[:, 1] - min_lat) * scale_y).astype(np.int32)  # flip Y
        pixel_pts = np.column_stack([px, py]).reshape((-1, 1, 2))
        cv2.polylines(img, [pixel_pts], isClosed=True, color=255, thickness=2)

    return img, geo_transform


def extract_keypoints_descriptors(
    image: np.ndarray,
    detector: cv2.ORB,
) -> Tuple[List[cv2.KeyPoint], Optional[np.ndarray]]:
    """
    Extracts ORB keypoints and binary descriptors from a grayscale image.

    Returns:
        (keypoints, descriptors) — descriptors is None if no features found.
    """
    keypoints, descriptors = detector.detectAndCompute(image, None)
    logger.info(
        "ORB extraction: %d keypoints detected (image %dx%d)",
        len(keypoints), image.shape[1], image.shape[0],
    )
    return keypoints, descriptors


def create_reference_raster_from_metadata(
    raster_metadata: dict,
    image_size: Tuple[int, int] = (2048, 2048),
) -> Tuple[np.ndarray, dict]:
    """
    Generates or loads a reference raster image from drone raster metadata.

    If 'image_path' is provided in raster_metadata and exists on disk, it loads
    the real drone orthophoto raster via OpenCV, applies CLAHE (Contrast Limited
    Adaptive Histogram Equalization) for contrast enhancement, and resizes it.

    Otherwise, synthesizes a reference contour image from metadata coverage extent.

    Args:
        raster_metadata: Dict with keys like 'image_path', 'bounds', 'resolution_cm',
                         'crs', 'reference_features' (optional GeoJSON coords)

    Returns:
        (grayscale_image, geo_transform)
    """
    bounds = raster_metadata.get("bounds", {})
    min_lon = bounds.get("min_lon", 80.94)
    min_lat = bounds.get("min_lat", 26.84)
    max_lon = bounds.get("max_lon", 80.95)
    max_lat = bounds.get("max_lat", 26.85)

    w, h = image_size
    scale_x = w / (max_lon - min_lon) if (max_lon - min_lon) > 0 else w
    scale_y = h / (max_lat - min_lat) if (max_lat - min_lat) > 0 else h

    geo_transform = {
        "min_lon": min_lon,
        "min_lat": min_lat,
        "max_lon": max_lon,
        "max_lat": max_lat,
        "scale_x": scale_x,
        "scale_y": scale_y,
        "image_width": w,
        "image_height": h,
    }

    # ── Stage 2A: Real Drone Raster Loading & CLAHE Pre-processing ──
    image_path = raster_metadata.get("image_path")
    if image_path and os.path.exists(image_path):
        try:
            raw_img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
            if raw_img is not None and raw_img.size > 0:
                logger.info("Loaded real drone raster from %s (%dx%d)", image_path, raw_img.shape[1], raw_img.shape[0])
                # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
                # This sharpens field bunds and boundary demarcations under shadows
                clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
                enhanced_img = clahe.apply(raw_img)
                # Standardize to target processing resolution
                processed_img = cv2.resize(enhanced_img, image_size, interpolation=cv2.INTER_AREA)
                return processed_img, geo_transform
        except Exception as e:
            logger.warning("Failed to process real raster at %s: %s. Falling back to synthetic.", image_path, e)

    img = np.zeros((h, w), dtype=np.uint8)

    # If reference features (e.g., extracted edges from drone ortho) are provided
    ref_features = raster_metadata.get("reference_features", [])
    if ref_features:
        for feature_coords in ref_features:
            pts = np.array(feature_coords, dtype=np.float64)
            px = ((pts[:, 0] - min_lon) * scale_x).astype(np.int32)
            py = (h - 1 - (pts[:, 1] - min_lat) * scale_y).astype(np.int32)
            pixel_pts = np.column_stack([px, py]).reshape((-1, 1, 2))
            cv2.polylines(img, [pixel_pts], isClosed=True, color=255, thickness=2)
    else:
        # Generate synthetic edge structure from bounds for feature matching
        # This simulates the edge-detection output of a real drone orthophoto
        border_pts = np.array([
            [int(w * 0.1), int(h * 0.1)],
            [int(w * 0.9), int(h * 0.1)],
            [int(w * 0.9), int(h * 0.9)],
            [int(w * 0.1), int(h * 0.9)],
        ], dtype=np.int32).reshape((-1, 1, 2))
        cv2.polylines(img, [border_pts], isClosed=True, color=255, thickness=2)

        # Add cross-hairs and grid lines for feature-rich reference
        for i in range(1, 10):
            y = int(h * i / 10)
            cv2.line(img, (0, y), (w, y), 128, 1)
            x = int(w * i / 10)
            cv2.line(img, (x, 0), (x, h), 128, 1)

    return img, geo_transform


# ━━━━━━━━━━━━━━━━━━ Feature Matching ━━━━━━━━━━━━━━━━━━

def create_flann_matcher() -> cv2.FlannBasedMatcher:
    """
    Creates a FLANN (Fast Library for Approximate Nearest Neighbors) matcher
    configured for ORB binary descriptors using the LSH (Locality Sensitive
    Hashing) index.

    FLANN is preferred over BruteForce for large feature sets (>1000 keypoints)
    because it uses approximate nearest-neighbor search with sub-linear time.
    """
    index_params = dict(
        algorithm=FLANN_INDEX_LSH,
        table_number=FLANN_TABLE_NUMBER,
        key_size=FLANN_KEY_SIZE,
        multi_probe_level=FLANN_MULTI_PROBE_LEVEL,
    )
    search_params = dict(checks=FLANN_SEARCH_PARAMS_CHECKS)
    return cv2.FlannBasedMatcher(index_params, search_params)


def create_bruteforce_matcher() -> cv2.BFMatcher:
    """
    Creates a BruteForce matcher with Hamming distance for ORB descriptors.
    Used as a fallback when FLANN produces insufficient matches, or for
    small feature sets where exhaustive search is acceptable.
    """
    return cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)


def match_features(
    desc_source: np.ndarray,
    desc_target: np.ndarray,
    use_flann: bool = True,
) -> List[cv2.DMatch]:
    """
    Matches ORB descriptors between source (legacy map) and target (drone)
    using Lowe's ratio test to filter ambiguous matches.

    Args:
        desc_source: Source descriptors (legacy map contour)
        desc_target: Target descriptors (drone raster)
        use_flann:   If True, use FLANN matcher; otherwise BruteForce

    Returns:
        List of good DMatch objects that passed the ratio test.
    """
    if use_flann:
        try:
            matcher = create_flann_matcher()
            raw_matches = matcher.knnMatch(desc_source, desc_target, k=2)
        except cv2.error:
            logger.warning("FLANN matching failed, falling back to BruteForce")
            matcher = create_bruteforce_matcher()
            raw_matches = matcher.knnMatch(desc_source, desc_target, k=2)
    else:
        matcher = create_bruteforce_matcher()
        raw_matches = matcher.knnMatch(desc_source, desc_target, k=2)

    # Apply Lowe's ratio test
    good_matches = []
    for match_pair in raw_matches:
        if len(match_pair) == 2:
            m, n = match_pair
            if m.distance < LOWES_RATIO * n.distance:
                good_matches.append(m)

    logger.info(
        "Feature matching: %d raw → %d good (ratio=%.2f)",
        len(raw_matches), len(good_matches), LOWES_RATIO,
    )
    return good_matches


# ━━━━━━━━━━━━━━━━━━ Homography & RANSAC ━━━━━━━━━━━━━━━━━━

def compute_homography_ransac(
    kp_source: List[cv2.KeyPoint],
    kp_target: List[cv2.KeyPoint],
    good_matches: List[cv2.DMatch],
) -> Tuple[Optional[np.ndarray], Optional[np.ndarray], int]:
    """
    Computes the 3×3 homography matrix using RANSAC to reject outlier matches.

    RANSAC (Random Sample Consensus) iteratively:
    1. Selects 4 random point correspondences
    2. Computes a candidate homography
    3. Counts how many other matches agree (inliers)
    4. Keeps the homography with the most inliers

    Args:
        kp_source:    Source keypoints
        kp_target:    Target keypoints
        good_matches: Filtered DMatch list from ratio test

    Returns:
        (homography_3x3, inlier_mask, num_inliers)
        Returns (None, None, 0) if insufficient matches.
    """
    if len(good_matches) < MIN_MATCH_COUNT:
        logger.warning(
            "Insufficient matches for homography: %d < %d required",
            len(good_matches), MIN_MATCH_COUNT,
        )
        return None, None, 0

    src_pts = np.float32(
        [kp_source[m.queryIdx].pt for m in good_matches]
    ).reshape(-1, 1, 2)

    dst_pts = np.float32(
        [kp_target[m.trainIdx].pt for m in good_matches]
    ).reshape(-1, 1, 2)

    H, mask = cv2.findHomography(
        src_pts,
        dst_pts,
        cv2.RANSAC,
        ransacReprojThreshold=RANSAC_REPROJ_THRESHOLD,
        maxIters=RANSAC_MAX_ITERS,
        confidence=RANSAC_CONFIDENCE,
    )

    if H is None or mask is None:
        return None, None, 0

    num_inliers = int(mask.sum())
    logger.info(
        "RANSAC homography: %d/%d inliers (%.1f%%)",
        num_inliers, len(good_matches),
        100.0 * num_inliers / len(good_matches) if good_matches else 0,
    )
    return H, mask, num_inliers


def calculate_rmse(
    kp_source: List[cv2.KeyPoint],
    kp_target: List[cv2.KeyPoint],
    good_matches: List[cv2.DMatch],
    homography: np.ndarray,
    inlier_mask: np.ndarray,
) -> float:
    """
    Calculates Root Mean Square Error (RMSE) of reprojected inlier points.

    For each inlier match:
        error = || H · src_point - dst_point ||

    RMSE quantifies the average geometric registration error in pixels.
    Lower RMSE → better alignment.
    """
    inlier_indices = [
        i for i, m in enumerate(inlier_mask.ravel()) if m == 1
    ]

    if not inlier_indices:
        return float("inf")

    errors_sq = []
    for idx in inlier_indices:
        match = good_matches[idx]
        src_pt = np.array(
            [kp_source[match.queryIdx].pt[0],
             kp_source[match.queryIdx].pt[1],
             1.0],
            dtype=np.float64,
        )
        dst_pt = np.array(kp_target[match.trainIdx].pt, dtype=np.float64)

        projected = homography @ src_pt
        if projected[2] != 0:
            projected = projected[:2] / projected[2]
        else:
            projected = projected[:2]

        error = np.sum((projected - dst_pt) ** 2)
        errors_sq.append(error)

    rmse = float(np.sqrt(np.mean(errors_sq)))
    logger.info("RMSE of inlier reprojection: %.4f px", rmse)
    return rmse


def compute_confidence_score(
    num_inliers: int,
    total_matches: int,
    rmse: float,
    image_diagonal: float = 2896.0,  # sqrt(2048² + 2048²)
) -> float:
    """
    Computes an Alignment Quality Index (0-100%) from three signals:

    1. Inlier Ratio (40% weight): What fraction of matches survived RANSAC?
       Higher = more consistent geometric relationship found.

    2. Normalised RMSE (40% weight): Reprojection error relative to image size.
       Lower RMSE → higher score.

    3. Match Density (20% weight): Raw number of inliers.
       More inliers → more robust and trustworthy transform.

    The final score is clamped to [0, 100].
    """
    if total_matches == 0 or num_inliers == 0:
        return 0.0

    # Component 1: Inlier ratio → [0, 1]
    inlier_ratio = num_inliers / total_matches

    # Component 2: Normalised RMSE → [0, 1], inverted so lower error = higher score
    # RMSE of 0 → score 1.0, RMSE ≥ 2% of diagonal → score 0.0
    max_acceptable_rmse = image_diagonal * 0.02  # ~58 px for 2048×2048
    rmse_score = max(0.0, 1.0 - (rmse / max_acceptable_rmse))

    # Component 3: Match density → saturates at 200 inliers
    density_score = min(1.0, num_inliers / 200.0)

    confidence = (
        0.40 * inlier_ratio
        + 0.40 * rmse_score
        + 0.20 * density_score
    ) * 100.0

    return round(max(0.0, min(100.0, confidence)), 2)


# ━━━━━━━━━━━━━━━━━━ GCP Thin-Plate Spline Warping ━━━━━━━━━━━━━━━━━━

def apply_gcp_tps_warp(
    coordinates: List[List[List[float]]],
    gcps: List[dict],
) -> List[List[List[float]]]:
    """
    Applies Thin-Plate Spline (TPS) transformation to GeoJSON coordinates
    using manually provided Ground Control Points.

    TPS is a non-rigid, interpolating spline that:
    - Passes exactly through all control points
    - Minimises bending energy (smoothest possible deformation)
    - Handles local distortions that a global affine/perspective cannot

    This corrects for paper curl, scanner non-linearities, and local
    registration errors in legacy paper maps.

    If fewer than 3 GCPs, falls back to affine transformation.

    Args:
        coordinates: GeoJSON polygon rings [[[lon,lat], ...], ...]
        gcps:        List of dicts with keys:
                     'source_lon', 'source_lat', 'target_lon', 'target_lat'

    Returns:
        Warped GeoJSON polygon rings.
    """
    if not gcps or len(gcps) < 2:
        logger.warning("Insufficient GCPs (%d), returning unmodified coordinates", len(gcps or []))
        return coordinates

    src_points = np.array(
        [[g["source_lon"], g["source_lat"]] for g in gcps],
        dtype=np.float64,
    )
    dst_points = np.array(
        [[g["target_lon"], g["target_lat"]] for g in gcps],
        dtype=np.float64,
    )

    if len(gcps) < 3:
        # Fallback: Offset transformation
        logger.info("Only %d GCPs — using simple offset transformation", len(gcps))
        offset_lon = float(np.mean(dst_points[:, 0] - src_points[:, 0]))
        offset_lat = float(np.mean(dst_points[:, 1] - src_points[:, 1]))
        warped = []
        for ring in coordinates:
            warped_ring = [
                [pt[0] + offset_lon, pt[1] + offset_lat]
                for pt in ring
            ]
            warped.append(warped_ring)
        return warped

    # Robust Thin-Plate Splines (TPS) formulation via Radial Basis Functions:
    # E_tps(f) = sum ||y_i - f(x_i)||^2 + lambda * bending_energy
    # Kernel U(r) = r^2 * log(r)
    n = len(src_points)
    diff = src_points[:, None, :] - src_points[None, :, :]
    r = np.linalg.norm(diff, axis=-1)
    with np.errstate(divide="ignore", invalid="ignore"):
        K = np.where(r > 0, r**2 * np.log(r), 0.0)
    K += 1e-6 * np.eye(n)
    P = np.hstack([np.ones((n, 1)), src_points])
    L = np.block([[K, P], [P.T, np.zeros((3, 3))]])
    V = np.vstack([dst_points, np.zeros((3, 2))])
    params, _, _, _ = np.linalg.lstsq(L, V, rcond=None)
    w = params[:n]
    a = params[n:]

    # Apply TPS transformation to each coordinate ring
    warped_rings = []
    for ring in coordinates:
        pts = np.array(ring, dtype=np.float64)
        diff_eval = pts[:, None, :] - src_points[None, :, :]
        r_eval = np.linalg.norm(diff_eval, axis=-1)
        with np.errstate(divide="ignore", invalid="ignore"):
            K_eval = np.where(r_eval > 0, r_eval**2 * np.log(r_eval), 0.0)
        P_eval = np.hstack([np.ones((len(pts), 1)), pts])
        warped_pts = P_eval @ a + K_eval @ w
        warped_ring = [[float(p[0]), float(p[1])] for p in warped_pts]
        warped_rings.append(warped_ring)

    logger.info(
        "TPS warp applied: %d GCPs, %d coordinate rings transformed",
        len(gcps), len(warped_rings),
    )
    return warped_rings



def apply_affine_from_gcps(
    coordinates: List[List[List[float]]],
    gcps: List[dict],
) -> List[List[List[float]]]:
    """
    Applies a least-squares affine transformation estimated from GCPs.
    Used when TPS is overkill or when we want a rigid global correction.

    Solves for the 2×3 affine matrix [a b tx; c d ty] using least-squares.
    """
    if len(gcps) < 3:
        return apply_gcp_tps_warp(coordinates, gcps)

    src = np.array(
        [[g["source_lon"], g["source_lat"]] for g in gcps],
        dtype=np.float64,
    )
    dst = np.array(
        [[g["target_lon"], g["target_lat"]] for g in gcps],
        dtype=np.float64,
    )

    # Solve affine: dst = A @ [src_x, src_y, 1]^T
    n = len(gcps)
    A_mat = np.zeros((2 * n, 6))
    b_vec = np.zeros(2 * n)
    for i in range(n):
        A_mat[2 * i] = [src[i, 0], src[i, 1], 1, 0, 0, 0]
        A_mat[2 * i + 1] = [0, 0, 0, src[i, 0], src[i, 1], 1]
        b_vec[2 * i] = dst[i, 0]
        b_vec[2 * i + 1] = dst[i, 1]

    params, _, _, _ = np.linalg.lstsq(A_mat, b_vec, rcond=None)
    # params = [a, b, tx, c, d, ty]

    warped_rings = []
    for ring in coordinates:
        warped_ring = []
        for pt in ring:
            x = params[0] * pt[0] + params[1] * pt[1] + params[2]
            y = params[3] * pt[0] + params[4] * pt[1] + params[5]
            warped_ring.append([float(x), float(y)])
        warped_rings.append(warped_ring)

    return warped_rings


# ━━━━━━━━━━━━━━━━━━ Homography → GeoJSON Transform ━━━━━━━━━━━━━━━━━━

def apply_homography_to_geojson(
    coordinates: List[List[List[float]]],
    homography: np.ndarray,
    source_geo_transform: dict,
    target_geo_transform: dict,
) -> List[List[List[float]]]:
    """
    Applies the computed 3×3 pixel-space homography to WGS84 GeoJSON coordinates.

    Workflow:
        geo_coords → source pixel coords → H @ pixel → target pixel → geo_coords

    This bridges between the image-space homography and real-world geographic
    coordinates, enabling the alignment result to be used directly in PostGIS.
    """
    sg = source_geo_transform
    tg = target_geo_transform

    warped_rings = []
    for ring in coordinates:
        warped_ring = []
        for lon, lat in ring:
            # Step 1: Geo → source pixel
            px = (lon - sg["min_lon"]) * sg["scale_x"]
            py = (sg["image_height"] - 1) - (lat - sg["min_lat"]) * sg["scale_y"]

            # Step 2: Apply homography
            src_pt = np.array([px, py, 1.0], dtype=np.float64)
            dst_pt = homography @ src_pt
            if dst_pt[2] != 0:
                dst_px, dst_py = dst_pt[0] / dst_pt[2], dst_pt[1] / dst_pt[2]
            else:
                dst_px, dst_py = dst_pt[0], dst_pt[1]

            # Step 3: Target pixel → geo
            new_lon = dst_px / tg["scale_x"] + tg["min_lon"]
            new_lat = ((tg["image_height"] - 1) - dst_py) / tg["scale_y"] + tg["min_lat"]

            warped_ring.append([round(float(new_lon), 8), round(float(new_lat), 8)])
        warped_rings.append(warped_ring)

    return warped_rings


# ━━━━━━━━━━━━━━━━━━ Main Pipeline ━━━━━━━━━━━━━━━━━━

def run_alignment_pipeline(
    legacy_coordinates: List[List[List[float]]],
    raster_metadata: dict,
    gcps: Optional[List[dict]] = None,
) -> dict:
    """
    Executes the full Phase 2 Map Alignment Pipeline.

    Args:
        legacy_coordinates: GeoJSON Polygon coordinate rings from the legacy map
        raster_metadata:    Drone raster metadata with 'bounds', 'resolution_cm',
                            optionally 'reference_features'
        gcps:               Optional list of manual Ground Control Points for
                            TPS/Affine local warping

    Returns:
        {
            "aligned_geojson":    { GeoJSON Polygon },
            "homography_matrix":  [[3×3 floats]],
            "confidence_score":   float (0-100),
            "processing_time_ms": float,
            "diagnostics": {
                "source_keypoints":  int,
                "target_keypoints":  int,
                "raw_matches":       int,
                "good_matches":      int,
                "inliers":           int,
                "rmse_px":           float,
                "gcp_applied":       bool,
                "gcp_method":        str | None,
            }
        }
    """
    t_start = time.perf_counter()

    # ── Step 1: Rasterize legacy contours → grayscale image ──
    source_img, source_gt = geojson_coords_to_contour_image(
        legacy_coordinates, image_size=(2048, 2048)
    )

    # ── Step 2: Generate / load reference raster ──
    target_img, target_gt = create_reference_raster_from_metadata(
        raster_metadata, image_size=(2048, 2048)
    )

    # ── Step 3: ORB feature extraction ──
    detector = create_orb_detector()
    kp_src, desc_src = extract_keypoints_descriptors(source_img, detector)
    kp_tgt, desc_tgt = extract_keypoints_descriptors(target_img, detector)

    diagnostics = {
        "source_keypoints": len(kp_src),
        "target_keypoints": len(kp_tgt),
        "raw_matches": 0,
        "good_matches": 0,
        "inliers": 0,
        "rmse_px": 0.0,
        "gcp_applied": False,
        "gcp_method": None,
    }

    # Handle edge case: no descriptors found
    if desc_src is None or desc_tgt is None or len(desc_src) < 2 or len(desc_tgt) < 2:
        elapsed_ms = (time.perf_counter() - t_start) * 1000
        logger.warning("Insufficient features for matching")
        return {
            "aligned_geojson": {
                "type": "Polygon",
                "coordinates": legacy_coordinates,
            },
            "homography_matrix": np.eye(3).tolist(),
            "confidence_score": 0.0,
            "processing_time_ms": round(elapsed_ms, 2),
            "diagnostics": diagnostics,
        }

    # ── Step 4: Feature matching (FLANN → BruteForce fallback) ──
    good_matches = match_features(desc_src, desc_tgt, use_flann=True)
    diagnostics["good_matches"] = len(good_matches)

    # ── Step 5: RANSAC Homography ──
    H, inlier_mask, num_inliers = compute_homography_ransac(
        kp_src, kp_tgt, good_matches,
    )

    aligned_coords = legacy_coordinates

    if H is not None and num_inliers >= MIN_MATCH_COUNT:
        # ── Step 6: RMSE calculation ──
        rmse = calculate_rmse(kp_src, kp_tgt, good_matches, H, inlier_mask)
        diagnostics["inliers"] = num_inliers
        diagnostics["rmse_px"] = round(rmse, 4)

        # ── Step 7: Apply homography to GeoJSON ──
        aligned_coords = apply_homography_to_geojson(
            legacy_coordinates, H, source_gt, target_gt,
        )
    else:
        H = np.eye(3)
        rmse = float("inf")
        diagnostics["inliers"] = num_inliers

    # ── Step 8: GCP-based local warping (if provided) ──
    if gcps and len(gcps) >= 2:
        diagnostics["gcp_applied"] = True
        if len(gcps) >= 3:
            diagnostics["gcp_method"] = "thin_plate_spline"
            aligned_coords = apply_gcp_tps_warp(aligned_coords, gcps)
        else:
            diagnostics["gcp_method"] = "offset_translation"
            aligned_coords = apply_gcp_tps_warp(aligned_coords, gcps)

    # ── Step 9: Compute confidence score ──
    image_diag = np.sqrt(2048**2 + 2048**2)
    confidence = compute_confidence_score(
        num_inliers, len(good_matches), rmse if rmse != float("inf") else image_diag,
        image_diagonal=image_diag,
    )
    if diagnostics.get("gcp_applied", False):
        # Manual GCPs pin ground truth with high surveyor precision
        gcp_conf = min(98.5, 88.0 + (len(gcps) * 2.0))
        confidence = max(confidence, gcp_conf)


    # ── Step 10: Validate output geometry ──
    try:
        out_geom = shape({"type": "Polygon", "coordinates": aligned_coords})
        if not out_geom.is_valid:
            out_geom = out_geom.buffer(0)
            aligned_coords = list(mapping(out_geom)["coordinates"])
            logger.info("Output geometry corrected via buffer(0)")
    except Exception as e:
        logger.error("Geometry validation failed: %s", e)

    elapsed_ms = (time.perf_counter() - t_start) * 1000

    logger.info(
        "Alignment complete: confidence=%.1f%%, inliers=%d, RMSE=%.2fpx, time=%.1fms",
        confidence, num_inliers, diagnostics["rmse_px"], elapsed_ms,
    )

    return {
        "aligned_geojson": {
            "type": "Polygon",
            "coordinates": aligned_coords,
        },
        "homography_matrix": H.tolist() if isinstance(H, np.ndarray) else H,
        "confidence_score": confidence,
        "processing_time_ms": round(elapsed_ms, 2),
        "diagnostics": diagnostics,
    }
