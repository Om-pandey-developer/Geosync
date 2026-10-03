/**
 * GeoSync Cadastral Spatial & Geodetic Math Utilities
 * Standardized for Indian Revenue Cadastral Surveys (UP Revenue Code / SVAMITVA)
 */

export interface Point2D {
  x: number;
  y: number;
}

export type LatLngTuple = [number, number]; // [latitude, longitude]

export const SQM_PER_BIGHA = 2529.28; // Standard UP Pucca Bigha (~2529.28 m² / 0.2529 Hectare)
export const SQM_PER_BISWA = 126.464; // 1 Bigha = 20 Biswa

/**
 * Calculates geodetic area of a polygon ring in square meters using ellipsoidal/spherical approximation.
 * Coordinates are [lat, lon] tuples.
 */
export function computeGeodeticAreaSqm(coords: LatLngTuple[]): number {
  if (!coords || coords.length < 3) return 0;

  // Filter consecutive duplicates
  const ring: LatLngTuple[] = [];
  for (let i = 0; i < coords.length; i++) {
    const pt = coords[i];
    if (i === 0 || pt[0] !== ring[ring.length - 1][0] || pt[1] !== ring[ring.length - 1][1]) {
      ring.push(pt);
    }
  }

  // Remove closing duplicate if present for computation
  if (
    ring.length > 3 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
  ) {
    ring.pop();
  }

  if (ring.length < 3) return 0;

  const isGeographic = ring.every(
    (c) => Math.abs(c[0]) <= 90 && Math.abs(c[1]) <= 180
  );

  if (isGeographic) {
    // Mean latitude for Mercator meter conversion
    const meanLat = ring.reduce((acc, c) => acc + c[0], 0) / ring.length;
    const latRad = (meanLat * Math.PI) / 180.0;
    const mPerDegLat = 111319.5;
    const mPerDegLon = 111319.5 * Math.cos(latRad);

    let area = 0;
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const x1 = ring[i][1] * mPerDegLon;
      const y1 = ring[i][0] * mPerDegLat;
      const x2 = ring[j][1] * mPerDegLon;
      const y2 = ring[j][0] * mPerDegLat;
      area += x1 * y2 - x2 * y1;
    }
    return Math.abs(area) / 2.0;
  } else {
    // Planar pixel or projected meter coordinates
    let area = 0;
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += ring[i][1] * ring[j][0] - ring[j][1] * ring[i][0];
    }
    return (Math.abs(area) / 2.0) * 0.24; // Scaled to ~0.24 m²/px if canvas pixels
  }
}

/**
 * Converts square meters to formatted Bigha string.
 */
export function sqmToBigha(sqm: number, decimals = 2): string {
  if (!sqm || sqm <= 0) return "0.00";
  const bigha = sqm / SQM_PER_BIGHA;
  return bigha.toFixed(decimals);
}

/**
 * Computes centroid [lat, lon] of a polygon ring.
 */
export function computeCentroid(coords: LatLngTuple[]): LatLngTuple {
  if (!coords || coords.length === 0) return [26.7605, 80.901];
  let sumLat = 0;
  let sumLon = 0;
  const count = coords.length;
  for (const [lat, lon] of coords) {
    sumLat += lat;
    sumLon += lon;
  }
  return [sumLat / count, sumLon / count];
}

/**
 * Translates an entire array of [lat, lon] coordinates by a fixed geographic delta.
 */
export function translateCoordinates(
  coords: LatLngTuple[],
  deltaLat: number,
  deltaLon: number
): LatLngTuple[] {
  return coords.map(([lat, lon]) => [lat + deltaLat, lon + deltaLon]);
}

/**
 * Cadastral Boundary Snapping:
 * Finds the closest candidate vertex among nearby reference polygons within a pixel snap threshold.
 */
export function findSnapTarget(
  currentScreenPos: Point2D,
  referenceRingsInScreen: Point2D[][],
  snapDistancePx = 12
): Point2D | null {
  let closestDist = Infinity;
  let snapTarget: Point2D | null = null;

  for (const ring of referenceRingsInScreen) {
    for (const pt of ring) {
      const dx = pt.x - currentScreenPos.x;
      const dy = pt.y - currentScreenPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < snapDistancePx && dist < closestDist) {
        closestDist = dist;
        snapTarget = { x: pt.x, y: pt.y };
      }
    }
  }

  return snapTarget;
}
