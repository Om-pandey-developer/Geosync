"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import {
  computeGeodeticAreaSqm,
  sqmToBigha,
  translateCoordinates,
  findSnapTarget,
  LatLngTuple,
  Point2D,
} from "@/lib/geoMath";
import { Check, X, Move, Magnet, Info, Sparkles } from "lucide-react";

export interface ParcelBoundaryEditorProps {
  /** Array of [lat, lng] coordinates forming the polygon ring */
  coordinates: LatLngTuple[];
  /** Callback fired continuously during drag with updated [lat, lng] and computed area (m²) */
  onChange: (coords: LatLngTuple[], areaSqm: number) => void;
  /** Khasra number or identifier */
  khasraNo: string;
  /** Active editing state */
  isActive: boolean;
  /** Optional adjacent parcel features for boundary snapping */
  adjacentGeoJson?: GeoJSON.FeatureCollection | null;
  /** Current parcel ID (to exclude from snapping candidates) */
  currentParcelId?: string | null;
  /** Called when user clicks Save in the dock */
  onSave?: () => void;
  /** Called when user clicks Discard in the dock */
  onDiscard?: () => void;
  /** Whether snapping to neighbor borders is enabled */
  enableSnapping?: boolean;
  /** Color accent for active boundary: defaults to neon cyan (#06B6D4) */
  accentColor?: string;
  /** Baseline calibrated area (m²) for reference comparison */
  baselineAreaSqm?: number;
  /** Whether to render the floating action dock directly inside the component */
  renderDock?: boolean;
}

/**
 * ParcelBoundaryEditor
 * Interactive GIS Canvas Layer for Whole-Polygon Translation Drag & Vertex Adjustment.
 * Renders directly inside Leaflet MapContainer, leveraging hardware-accelerated SVG overlays.
 */
export function ParcelBoundaryEditor({
  coordinates,
  onChange,
  khasraNo,
  isActive,
  adjacentGeoJson,
  currentParcelId,
  onSave,
  onDiscard,
  enableSnapping = true,
  accentColor = "#06B6D4",
  baselineAreaSqm,
  renderDock = false,
}: ParcelBoundaryEditorProps) {
  const map = useMap();

  // Local drag tracking
  const [coords, setCoords] = useState<LatLngTuple[]>(coordinates);
  const [dragMode, setDragMode] = useState<"NONE" | "TRANSLATE" | "VERTEX">("NONE");
  const [activeVertexIndex, setActiveVertexIndex] = useState<number | null>(null);
  const [hoveredVertexIndex, setHoveredVertexIndex] = useState<number | null>(null);
  const [snappedPoint, setSnappedPoint] = useState<Point2D | null>(null);
  const [snappingActive, setSnappingActive] = useState<boolean>(enableSnapping);

  // Sync external coordinates when not actively dragging
  useEffect(() => {
    if (dragMode === "NONE") {
      setCoords(coordinates);
    }
  }, [coordinates, dragMode]);

  // Keep a mutable ref for 60fps raf updates
  const coordsRef = useRef<LatLngTuple[]>(coordinates);
  useEffect(() => {
    coordsRef.current = coords;
  }, [coords]);

  const dragStartRef = useRef<{
    startClientX: number;
    startClientY: number;
    startLatLng: L.LatLng;
    initialCoords: LatLngTuple[];
    vertexIdx?: number;
  } | null>(null);

  const rafRef = useRef<number | null>(null);

  // Pre-calculate adjacent polygon rings in LatLng for snapping
  const adjacentRingsLatLng = useMemo<LatLngTuple[][]>(() => {
    if (!adjacentGeoJson || !adjacentGeoJson.features) return [];
    const rings: LatLngTuple[][] = [];
    for (const feat of adjacentGeoJson.features) {
      if (
        feat.properties?.id === currentParcelId ||
        feat.id === currentParcelId ||
        String(feat.properties?.khasra_no) === String(khasraNo)
      ) {
        continue; // Skip self
      }
      if (feat.geometry && feat.geometry.type === "Polygon") {
        const polyCoords = (feat.geometry as GeoJSON.Polygon).coordinates[0] || [];
        rings.push(polyCoords.map(([lng, lat]) => [lat, lng]));
      }
    }
    return rings;
  }, [adjacentGeoJson, currentParcelId, khasraNo]);

  // Convert coords to container screen pixels
  const [screenPoints, setScreenPoints] = useState<Point2D[]>([]);

  const updateScreenPoints = useCallback(() => {
    if (!map || !coordsRef.current || coordsRef.current.length === 0) return;
    const pts = coordsRef.current.map(([lat, lng]) => {
      const p = map.latLngToContainerPoint([lat, lng]);
      return { x: p.x, y: p.y };
    });
    setScreenPoints(pts);
  }, [map]);

  // Update screen points on map pan/zoom
  useEffect(() => {
    updateScreenPoints();
    const handleMapMove = () => updateScreenPoints();
    map.on("move", handleMapMove);
    map.on("zoom", handleMapMove);
    map.on("resize", handleMapMove);
    return () => {
      map.off("move", handleMapMove);
      map.off("zoom", handleMapMove);
      map.off("resize", handleMapMove);
    };
  }, [map, updateScreenPoints]);

  // Real-time computed area
  const currentAreaSqm = useMemo(() => {
    return computeGeodeticAreaSqm(coords);
  }, [coords]);

  // ── WHOLE-POLYGON TRANSLATION DRAG ──
  const handlePolygonPointerDown = (e: React.PointerEvent) => {
    if (!isActive) return;
    e.stopPropagation();
    e.preventDefault();

    // Disable Leaflet's native pan dragging during translation
    map.dragging.disable();

    const latLng = map.containerPointToLatLng([e.clientX, e.clientY]);
    dragStartRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startLatLng: latLng,
      initialCoords: [...coordsRef.current],
    };
    setDragMode("TRANSLATE");
  };

  // ── INDIVIDUAL VERTEX DRAG ──
  const handleVertexPointerDown = (idx: number, e: React.PointerEvent) => {
    if (!isActive) return;
    e.stopPropagation();
    e.preventDefault();

    map.dragging.disable();

    const latLng = map.containerPointToLatLng([e.clientX, e.clientY]);
    dragStartRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startLatLng: latLng,
      initialCoords: [...coordsRef.current],
      vertexIdx: idx,
    };
    setActiveVertexIndex(idx);
    setDragMode("VERTEX");
  };

  // ── GLOBAL POINTER MOVE & UP LISTENER ──
  useEffect(() => {
    if (dragMode === "NONE") return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!dragStartRef.current) return;

      const { startClientX, startClientY, initialCoords, vertexIdx } = dragStartRef.current;
      const currentPoint = L.point(e.clientX, e.clientY);
      let targetLatLng = map.containerPointToLatLng(currentPoint);

      if (dragMode === "TRANSLATE") {
        // Uniform translation: compute delta from drag start
        const startPt = map.latLngToContainerPoint(dragStartRef.current.startLatLng);
        const curPt = L.point(e.clientX, e.clientY);
        const deltaX = curPt.x - startPt.x;
        const deltaY = curPt.y - startPt.y;

        // Convert screen delta to geographic delta
        const originLatLng = map.containerPointToLatLng(startPt);
        const movedLatLng = map.containerPointToLatLng(L.point(startPt.x + deltaX, startPt.y + deltaY));
        const dLat = movedLatLng.lat - originLatLng.lat;
        const dLon = movedLatLng.lng - originLatLng.lng;

        const updated = translateCoordinates(initialCoords, dLat, dLon);
        coordsRef.current = updated;
        setCoords(updated);
        updateScreenPoints();

        // 60 FPS Area notification
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          const area = computeGeodeticAreaSqm(updated);
          onChange(updated, area);
        });
      } else if (dragMode === "VERTEX" && typeof vertexIdx === "number") {
        // Micro-adjustment for single vertex
        let finalScreenPt: Point2D = { x: e.clientX, y: e.clientY };

        // Optional Cadastral Snapping against neighbor parcels
        if (snappingActive && adjacentRingsLatLng.length > 0) {
          const refScreenRings: Point2D[][] = adjacentRingsLatLng.map((ring) =>
            ring.map(([lat, lng]) => {
              const p = map.latLngToContainerPoint([lat, lng]);
              return { x: p.x, y: p.y };
            })
          );
          const snapTarget = findSnapTarget({ x: e.clientX, y: e.clientY }, refScreenRings, 14);
          if (snapTarget) {
            finalScreenPt = snapTarget;
            targetLatLng = map.containerPointToLatLng(L.point(snapTarget.x, snapTarget.y));
            setSnappedPoint(snapTarget);
          } else {
            setSnappedPoint(null);
          }
        } else {
          setSnappedPoint(null);
        }

        const updated = [...coordsRef.current];
        updated[vertexIdx] = [targetLatLng.lat, targetLatLng.lng];

        // If ring is closed (first pt == last pt) and dragging first, sync last
        if (vertexIdx === 0 && updated.length > 1) {
          updated[updated.length - 1] = [targetLatLng.lat, targetLatLng.lng];
        } else if (vertexIdx === updated.length - 1 && updated.length > 1) {
          updated[0] = [targetLatLng.lat, targetLatLng.lng];
        }

        coordsRef.current = updated;
        setCoords(updated);
        updateScreenPoints();

        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          const area = computeGeodeticAreaSqm(updated);
          onChange(updated, area);
        });
      }
    };

    const handlePointerUp = () => {
      // Re-enable Leaflet map dragging
      map.dragging.enable();
      setDragMode("NONE");
      setActiveVertexIndex(null);
      setSnappedPoint(null);
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
  }, [dragMode, map, snappingActive, adjacentRingsLatLng, onChange, updateScreenPoints]);

  if (!isActive || screenPoints.length < 3) return null;

  // Filter closing duplicate for vertex handle rendering
  const displayHandles = screenPoints.filter((pt, idx) => {
    if (idx === screenPoints.length - 1 && screenPoints.length > 1) {
      const first = screenPoints[0];
      return Math.abs(pt.x - first.x) > 1 || Math.abs(pt.y - first.y) > 1;
    }
    return true;
  });

  const polygonSvgPoints = screenPoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <>
      {/* ── 1. SVG Boundary & Vertex Layer ── */}
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 800,
        }}
      >
        <defs>
          {/* Glowing boundary filter */}
          <filter id="boundary-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Halo Glow Polygon */}
        <polygon
          points={polygonSvgPoints}
          fill="rgba(6, 182, 212, 0.18)"
          stroke={accentColor}
          strokeWidth="6"
          strokeOpacity="0.4"
          filter="url(#boundary-glow)"
        />

        {/* Primary Interactive Polygon (Supports Whole-Parcel Translation Drag) */}
        <polygon
          points={polygonSvgPoints}
          fill="rgba(6, 182, 212, 0.22)"
          stroke={accentColor}
          strokeWidth="3"
          strokeDasharray={dragMode === "TRANSLATE" ? "8 4" : "6 4"}
          style={{
            cursor: dragMode === "TRANSLATE" ? "grabbing" : "move",
            pointerEvents: "auto",
            transition: "fill 0.15s ease",
          }}
          onPointerDown={handlePolygonPointerDown}
        >
          <title>Click and drag inside to translate Khasra {khasraNo} boundary</title>
        </polygon>

        {/* Magnetic Snap Target Visual Indicator */}
        {snappedPoint && (
          <circle
            cx={snappedPoint.x}
            cy={snappedPoint.y}
            r="12"
            fill="none"
            stroke="#10B981"
            strokeWidth="3"
            strokeDasharray="3 3"
            style={{ animation: "pulse 1s infinite" }}
          />
        )}

        {/* Vertex Handles (Click and Drag for Micro-Adjustment) */}
        {displayHandles.map((pt, idx) => {
          const isDragging = activeVertexIndex === idx;
          const isHovered = hoveredVertexIndex === idx;
          const radius = isDragging ? 9 : isHovered ? 8 : 6.5;

          return (
            <g
              key={`vnode-${idx}`}
              style={{
                pointerEvents: "auto",
                cursor: isDragging ? "grabbing" : "crosshair",
              }}
              onPointerDown={(e) => handleVertexPointerDown(idx, e)}
              onMouseEnter={() => setHoveredVertexIndex(idx)}
              onMouseLeave={() => setHoveredVertexIndex(null)}
            >
              {/* Outer pulsing ring on hover/active */}
              {(isHovered || isDragging) && (
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={radius + 8}
                  fill="rgba(6, 182, 212, 0.25)"
                  stroke={accentColor}
                  strokeWidth="1.5"
                />
              )}

              {/* Main Node Body */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={radius}
                fill="#FFFFFF"
                stroke={isDragging ? "#10B981" : accentColor}
                strokeWidth={isDragging ? "3" : "2.5"}
                style={{
                  filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.5))",
                  transition: "r 0.12s ease",
                }}
              />

              {/* Node Center Dot */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r="2"
                fill={isDragging ? "#10B981" : "#0F172A"}
              />
            </g>
          );
        })}
      </svg>

      {/* ── 2. Floating Action Dock (Optional embedded render) ── */}
      {renderDock && (
        <ParcelBoundaryDock
          khasraNo={khasraNo}
          nodeCount={displayHandles.length}
          currentAreaSqm={currentAreaSqm}
          baselineAreaSqm={baselineAreaSqm}
          isDragging={dragMode !== "NONE"}
          dragMode={dragMode}
          snappingActive={snappingActive}
          onToggleSnapping={() => setSnappingActive((prev) => !prev)}
          onSave={onSave}
          onDiscard={onDiscard}
        />
      )}
    </>
  );
}

/**
 * ParcelBoundaryDock
 * Bottom floating action bar rendered cleanly over the dark GeoSync theme.
 */
export function ParcelBoundaryDock({
  khasraNo,
  nodeCount,
  currentAreaSqm,
  baselineAreaSqm,
  isDragging,
  dragMode,
  snappingActive,
  onToggleSnapping,
  onSave,
  onDiscard,
}: {
  khasraNo: string;
  nodeCount: number;
  currentAreaSqm: number;
  baselineAreaSqm?: number;
  isDragging: boolean;
  dragMode: "NONE" | "TRANSLATE" | "VERTEX";
  snappingActive: boolean;
  onToggleSnapping?: () => void;
  onSave?: () => void;
  onDiscard?: () => void;
}) {
  const deltaArea = baselineAreaSqm ? currentAreaSqm - baselineAreaSqm : 0;

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3.5 px-5 py-2.5 rounded-xl border shadow-2xl backdrop-blur-md"
      style={{
        background: "rgba(15, 23, 42, 0.94)",
        borderColor: "rgba(255, 255, 255, 0.14)",
        boxShadow: "0 20px 48px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(6, 182, 212, 0.2)",
      }}
    >
      {/* Parcel Badge & Drag State */}
      <div className="flex items-center gap-2.5 pr-2 border-r border-slate-700/80">
        <div
          className={`w-2.5 h-2.5 rounded-full ${
            isDragging
              ? "bg-emerald-400 animate-ping"
              : "bg-amber-400 animate-pulse"
          }`}
        />
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black tracking-wide text-slate-100">
              Khasra {khasraNo}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {dragMode === "TRANSLATE"
                ? "Translating Parcel"
                : dragMode === "VERTEX"
                ? "Adjusting Node"
                : "Manual Drag Adjust"}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
            <Move size={10} className="text-cyan-400" />
            Click polygon to translate • Drag nodes to reshape
          </span>
        </div>
      </div>

      {/* Real-time Dynamic Metrics */}
      <div className="flex items-center gap-3 px-2 border-r border-slate-700/80 text-xs">
        <div>
          <span className="text-slate-400 text-[11px] block">Live Area:</span>
          <div className="flex items-baseline gap-1.5 font-mono">
            <strong className="text-emerald-400 font-bold text-sm">
              {currentAreaSqm.toFixed(1)} m²
            </strong>
            <span className="text-cyan-300 text-xs font-medium">
              (~{sqmToBigha(currentAreaSqm)} Bigha)
            </span>
            {baselineAreaSqm && Math.abs(deltaArea) > 0.05 && (
              <span
                className={`text-[10px] font-semibold ${
                  deltaArea > 0 ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                ({deltaArea > 0 ? "+" : ""}
                {deltaArea.toFixed(1)} m²)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Node Count Indicator */}
      <div className="flex items-center gap-1.5 px-2 text-xs font-semibold text-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        <span>{nodeCount} Nodes</span>
        <span className="text-[10px] text-slate-400 font-normal">
          (drag handles on map)
        </span>
      </div>

      {/* Snapping Toggle */}
      {onToggleSnapping && (
        <button
          onClick={onToggleSnapping}
          title={snappingActive ? "Snapping enabled (Click to toggle)" : "Snapping disabled"}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
            snappingActive
              ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
              : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
          }`}
        >
          <Magnet size={12} className={snappingActive ? "text-cyan-400" : ""} />
          <span>Snap {snappingActive ? "ON" : "OFF"}</span>
        </button>
      )}

      {/* Action Buttons: Save & Discard */}
      <div className="flex items-center gap-2 pl-2">
        {onSave && (
          <button
            onClick={onSave}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-extrabold text-xs text-white bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400 shadow-md shadow-emerald-900/40 active:scale-95 transition-all cursor-pointer"
          >
            <Check size={14} className="stroke-[3]" />
            <span>Save Adjustments</span>
          </button>
        )}

        {onDiscard && (
          <button
            onClick={onDiscard}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs text-red-300 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 hover:border-red-500/50 active:scale-95 transition-all cursor-pointer"
          >
            <X size={14} />
            <span>Discard</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default ParcelBoundaryEditor;
