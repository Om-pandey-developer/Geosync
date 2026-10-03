"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { computeGeodeticAreaSqm, LatLngTuple } from "@/lib/geoMath";

export interface UnifiedParcelBoundaryEditorProps {
  /** Array of coordinates forming the polygon ring: [y, x] in image pixels or [lat, lon] in GPS degrees */
  coordinates: [number, number][];
  /** Callback fired continuously during drag with updated coordinates and computed area (m²) */
  onChange: (updatedCoords: [number, number][], areaSqm: number) => void;
  /** Khasra number or identifier */
  khasraNo: string;
  /** Active editing state */
  isActive: boolean;
  /** Georeferencing parameters for GPS conversion if needed */
  refCenterLat?: number;
  refCenterLon?: number;
  activeGsd?: number;
  imageWidth?: number;
  imageHeight?: number;
  /** Optional nudge offset applied to the cadastral overlay */
  nudge?: { x: number; y: number; rot: number };
  /** Baseline calibrated area for proportional scaling */
  baselineAreaSqm?: number;
  /** Color matching the parcel's status (Red for illegal/govt, Green for clear, Amber for occluded) */
  statusColor?: string;
}

interface Point2D {
  x: number;
  y: number;
}

/**
 * Computes polygon pixel area using the Shoelace formula
 */
function computeShoelaceArea(pts: Point2D[]): number {
  if (pts.length < 3) return 0;
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += pts[i].x * pts[j].y;
    area -= pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2.0;
}

/**
 * UnifiedParcelBoundaryEditor
 * Directly activates the exact boundary of the selected Khasra (e.g. Red for Kh. 36475, Green for Kh. 656565).
 * Eliminates all external bounding boxes, extra frames, and clutter.
 * Allows Patwari to click directly on the boundary to move it, or drag the border/corner handles to resize (badi/chhoti).
 */
export function UnifiedParcelBoundaryEditor({
  coordinates,
  onChange,
  khasraNo,
  isActive,
  refCenterLat = 26.7605,
  refCenterLon = 80.901,
  activeGsd = 0.05,
  imageWidth = 1558,
  imageHeight = 778,
  nudge = { x: 0, y: 0, rot: 0 },
  baselineAreaSqm,
  statusColor = "#EF4444",
}: UnifiedParcelBoundaryEditorProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Local active coordinates
  const [coords, setCoords] = useState<[number, number][]>(coordinates);
  const coordsRef = useRef<[number, number][]>(coordinates);
  const [dragMode, setDragMode] = useState<"NONE" | "TRANSLATE" | "RESIZE" | "CORNER_RESIZE">("NONE");
  const [activeCornerIdx, setActiveCornerIdx] = useState<number | null>(null);

  // Sync external coordinates when not actively dragging
  useEffect(() => {
    if (dragMode === "NONE") {
      setCoords(coordinates);
      coordsRef.current = coordinates;
    }
  }, [coordinates, dragMode]);

  // Determine whether coordinates are in image pixel space (> 90) or GPS degrees (<= 90)
  const isImagePixelSpace = useMemo(() => {
    if (!coordinates || coordinates.length === 0) return true;
    return coordinates.some((pt) => Math.max(Math.abs(pt[0]), Math.abs(pt[1])) > 90);
  }, [coordinates]);

  // Convert coordinate tuple to SVG image pixel point (x, y)
  const coordToImagePoint = useCallback(
    (coord: [number, number]): Point2D => {
      if (isImagePixelSpace) {
        // coord[0] is Y (px), coord[1] is X (px)
        return {
          x: coord[1],
          y: coord[0],
        };
      } else {
        // coord[0] is lat (deg), coord[1] is lon (deg)
        const lat = coord[0];
        const lon = coord[1];
        const dy_m = (lat - refCenterLat) * 111320.0;
        const dx_m = (lon - refCenterLon) * (111320.0 * Math.cos((refCenterLat * Math.PI) / 180.0));
        const px = imageWidth / 2 + dx_m / activeGsd;
        const py = imageHeight / 2 - dy_m / activeGsd;
        return { x: px, y: py };
      }
    },
    [isImagePixelSpace, refCenterLat, refCenterLon, activeGsd, imageWidth, imageHeight]
  );

  // Convert SVG image pixel point (x, y) back to coordinate tuple
  const imagePointToCoord = useCallback(
    (pt: Point2D): [number, number] => {
      if (isImagePixelSpace) {
        return [Number(pt.y.toFixed(2)), Number(pt.x.toFixed(2))];
      } else {
        const dx_m = (pt.x - imageWidth / 2) * activeGsd;
        const dy_m = -(pt.y - imageHeight / 2) * activeGsd;
        const lon = refCenterLon + dx_m / (111320.0 * Math.cos((refCenterLat * Math.PI) / 180.0));
        const lat = refCenterLat + dy_m / 111320.0;
        return [Number(lat.toFixed(7)), Number(lon.toFixed(7))];
      }
    },
    [isImagePixelSpace, refCenterLat, refCenterLon, activeGsd, imageWidth, imageHeight]
  );

  // Polygon points in SVG image pixel space
  const svgPts = useMemo<Point2D[]>(() => {
    if (!coords || coords.length === 0) return [];
    return coords.map((c) => coordToImagePoint(c));
  }, [coords, coordToImagePoint]);

  // Centroid of the polygon
  const centroid = useMemo<Point2D>(() => {
    if (svgPts.length === 0) return { x: 0, y: 0 };
    let sumX = 0;
    let sumY = 0;
    for (const p of svgPts) {
      sumX += p.x;
      sumY += p.y;
    }
    return { x: sumX / svgPts.length, y: sumY / svgPts.length };
  }, [svgPts]);

  // Initial reference pixel area for proportional scaling
  const initialPixelAreaRef = useRef<number>(1);
  useEffect(() => {
    if (svgPts.length >= 3) {
      const a = computeShoelaceArea(svgPts);
      if (a > 0) initialPixelAreaRef.current = a;
    }
  }, []);

  // Compute live area in m²
  const computeLiveArea = useCallback(
    (currentPts: Point2D[]): number => {
      if (isImagePixelSpace) {
        const curPxArea = computeShoelaceArea(currentPts);
        if (baselineAreaSqm && baselineAreaSqm > 0 && initialPixelAreaRef.current > 0) {
          const ratio = curPxArea / initialPixelAreaRef.current;
          return Number((baselineAreaSqm * ratio).toFixed(1));
        }
        return Number((curPxArea * (activeGsd * activeGsd)).toFixed(1));
      } else {
        const latLngs: LatLngTuple[] = currentPts.map((p) => {
          const c = imagePointToCoord(p);
          return [c[0], c[1]];
        });
        return computeGeodeticAreaSqm(latLngs);
      }
    },
    [isImagePixelSpace, baselineAreaSqm, activeGsd, imagePointToCoord]
  );

  // Utility to convert client pointer event to exact SVG image pixel point
  const getSvgCoordinates = useCallback((e: PointerEvent | React.PointerEvent): Point2D => {
    const svg = svgRef.current;
    if (!svg) return { x: e.clientX, y: e.clientY };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (ctm) {
      const transformed = pt.matrixTransform(ctm.inverse());
      return { x: transformed.x, y: transformed.y };
    }
    return { x: e.clientX, y: e.clientY };
  }, []);

  // Drag start state tracking ref
  const dragStartRef = useRef<{
    startSvg: Point2D;
    initialSvgPts: Point2D[];
    initialCentroid: Point2D;
    initialDistanceToCentroid: number;
    cornerIdx?: number;
    mode: "TRANSLATE" | "RESIZE" | "CORNER_RESIZE";
  } | null>(null);

  const rafRef = useRef<number | null>(null);

  // ── 1. Start Whole-Boundary Move ──
  const handlePolygonPointerDown = (e: React.PointerEvent) => {
    if (!isActive) return;
    e.stopPropagation();
    e.preventDefault();

    const startSvg = getSvgCoordinates(e);
    dragStartRef.current = {
      startSvg,
      initialSvgPts: [...svgPts],
      initialCentroid: { ...centroid },
      initialDistanceToCentroid: Math.max(10, Math.hypot(startSvg.x - centroid.x, startSvg.y - centroid.y)),
      mode: "TRANSLATE",
    };
    setDragMode("TRANSLATE");
  };

  // ── 2. Start Direct Boundary Resize (Badi / Chhoti) ──
  const handleBorderPointerDown = (e: React.PointerEvent) => {
    if (!isActive) return;
    e.stopPropagation();
    e.preventDefault();

    const startSvg = getSvgCoordinates(e);
    const distToCenter = Math.hypot(startSvg.x - centroid.x, startSvg.y - centroid.y);
    dragStartRef.current = {
      startSvg,
      initialSvgPts: [...svgPts],
      initialCentroid: { ...centroid },
      initialDistanceToCentroid: Math.max(10, distToCenter),
      mode: "RESIZE",
    };
    setDragMode("RESIZE");
  };

  // ── 3. Start Corner Pull-to-Resize ──
  const handleCornerPointerDown = (idx: number, e: React.PointerEvent) => {
    if (!isActive) return;
    e.stopPropagation();
    e.preventDefault();

    const startSvg = getSvgCoordinates(e);
    const distToCenter = Math.hypot(startSvg.x - centroid.x, startSvg.y - centroid.y);
    dragStartRef.current = {
      startSvg,
      initialSvgPts: [...svgPts],
      initialCentroid: { ...centroid },
      initialDistanceToCentroid: Math.max(10, distToCenter),
      cornerIdx: idx,
      mode: "CORNER_RESIZE",
    };
    setActiveCornerIdx(idx);
    setDragMode("CORNER_RESIZE");
  };

  // ── 4. Global Window Move and Up Listeners ──
  useEffect(() => {
    if (dragMode === "NONE") return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!dragStartRef.current) return;
      const { startSvg, initialSvgPts, initialCentroid, initialDistanceToCentroid, mode } =
        dragStartRef.current;

      const curSvg = getSvgCoordinates(e);

      let updatedPts: Point2D[] = [];

      if (mode === "TRANSLATE") {
        // Whole boundary move: translate each point by (dx, dy)
        const dx = curSvg.x - startSvg.x;
        const dy = curSvg.y - startSvg.y;
        updatedPts = initialSvgPts.map((p) => ({
          x: p.x + dx,
          y: p.y + dy,
        }));
      } else if (mode === "RESIZE" || mode === "CORNER_RESIZE") {
        // Radial scale from centroid: pulling outward expands (badi), pushing inward shrinks (chhoti)
        const curDist = Math.hypot(curSvg.x - initialCentroid.x, curSvg.y - initialCentroid.y);
        const scale = Math.max(0.15, Math.min(6.0, curDist / initialDistanceToCentroid));

        updatedPts = initialSvgPts.map((p) => ({
          x: initialCentroid.x + (p.x - initialCentroid.x) * scale,
          y: initialCentroid.y + (p.y - initialCentroid.y) * scale,
        }));
      }

      if (updatedPts.length === 0) return;

      // Keep closing duplicate in sync
      if (
        updatedPts.length > 1 &&
        initialSvgPts[0].x === initialSvgPts[initialSvgPts.length - 1].x &&
        initialSvgPts[0].y === initialSvgPts[initialSvgPts.length - 1].y
      ) {
        updatedPts[updatedPts.length - 1] = { ...updatedPts[0] };
      }

      // Convert back to coordinate representation
      const updatedCoords = updatedPts.map((p) => imagePointToCoord(p));
      coordsRef.current = updatedCoords;
      setCoords(updatedCoords);

      // Real-time 60 FPS area calculation & notification
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const areaSqm = computeLiveArea(updatedPts);
        onChange(updatedCoords, areaSqm);
      });
    };

    const handlePointerUp = () => {
      setDragMode("NONE");
      setActiveCornerIdx(null);
      dragStartRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [dragMode, computeLiveArea, getSvgCoordinates, imagePointToCoord, onChange]);

  if (!isActive || svgPts.length < 3) return null;

  const polygonPointsStr = svgPts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

  // Identify the 4 corner points (extremities) on the actual polygon itself
  const cornerIndices = useMemo(() => {
    if (svgPts.length < 4) return [];
    let topIdx = 0;
    let bottomIdx = 0;
    let leftIdx = 0;
    let rightIdx = 0;

    for (let i = 1; i < svgPts.length; i++) {
      if (svgPts[i].y < svgPts[topIdx].y) topIdx = i;
      if (svgPts[i].y > svgPts[bottomIdx].y) bottomIdx = i;
      if (svgPts[i].x < svgPts[leftIdx].x) leftIdx = i;
      if (svgPts[i].x > svgPts[rightIdx].x) rightIdx = i;
    }

    return Array.from(new Set([topIdx, rightIdx, bottomIdx, leftIdx]));
  }, [svgPts]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${imageWidth} ${imageHeight}`}
      preserveAspectRatio="xMidYMid meet"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 110,
        transform: `translate(${nudge.x}px, ${nudge.y}px) rotate(${nudge.rot}deg)`,
        transformOrigin: "center center",
      }}
    >
      <defs>
        {/* Pulsing drop shadow filter for active boundary outline */}
        <filter id="active-boundary-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="4.5" floodColor={statusColor} floodOpacity="0.85" />
          <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#FFFFFF" floodOpacity="0.9" />
        </filter>
      </defs>

      {/* ── 1. The Actual Khasra Polygon (Glowing Active Boundary) ── */}
      <polygon
        points={polygonPointsStr}
        fill={statusColor}
        fillOpacity={dragMode === "TRANSLATE" ? 0.35 : 0.22}
        stroke={statusColor}
        strokeWidth={3.8}
        strokeDasharray={dragMode === "TRANSLATE" ? "8 4" : undefined}
        filter="url(#active-boundary-glow)"
        style={{
          cursor: dragMode === "TRANSLATE" ? "grabbing" : "move",
          pointerEvents: "auto",
          transition: "fill-opacity 0.15s ease",
        }}
        onPointerDown={handlePolygonPointerDown}
      >
        <title>Click & drag to move Khasra {khasraNo} boundary</title>
      </polygon>

      {/* ── 2. Direct Boundary Edge Grab Strip (Pull Outward to Make Badi, Inward to Make Chhoti) ── */}
      <polygon
        points={polygonPointsStr}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{
          cursor: "grab",
          pointerEvents: "auto",
        }}
        onPointerDown={handleBorderPointerDown}
      >
        <title>Drag boundary outward to expand (badi) or inward to shrink (chhoti)</title>
      </polygon>

      {/* ── 3. Subtle Corner Pull Grips Directly on the Real Boundary Corners ── */}
      {cornerIndices.map((idx) => {
        const pt = svgPts[idx];
        if (!pt) return null;
        const isDraggingThis = activeCornerIdx === idx;
        const radius = isDraggingThis ? 9.5 : 7.5;

        return (
          <g
            key={`corner-grip-${idx}`}
            style={{ cursor: "nwse-resize", pointerEvents: "auto" }}
            onPointerDown={(e) => handleCornerPointerDown(idx, e)}
          >
            {/* Outer Glow Halo */}
            <circle
              cx={pt.x}
              cy={pt.y}
              r={radius + 4}
              fill={statusColor}
              fillOpacity={0.4}
            />
            {/* Main Interactive Corner Grip */}
            <circle
              cx={pt.x}
              cy={pt.y}
              r={radius}
              fill={statusColor}
              stroke="#FFFFFF"
              strokeWidth={2.5}
              style={{
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
                transition: "r 0.12s ease",
              }}
            />
          </g>
        );
      })}
    </svg>
  );
}

export default UnifiedParcelBoundaryEditor;
