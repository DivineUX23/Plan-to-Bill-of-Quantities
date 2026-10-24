import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Circle, Text, Group, Rect } from 'react-konva';
import Konva from 'konva';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Grid as GridIcon,
  Sparkles,
  Move,
} from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { api } from '../api/client';
import type { Opening, Room, SheetGeometry, Wall } from '../api/types';
import { PlanLegend } from './PlanLegend';

interface CanvasEditorProps {
  onGeometryChanged?: (geometry: SheetGeometry) => void;
}

export const CanvasEditor: React.FC<CanvasEditorProps> = ({ onGeometryChanged }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Spacebar pan state
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ mouseX: number; mouseY: number; stageX: number; stageY: number } | null>(null);

  const {
    sheet,
    activeTool,
    selectedId,
    selectItem,
    draftPoints,
    addDraftPoint,
    clearDraft,
    stageScale,
    stagePos,
    setStageTransform,
    panBy,
    zoomIn,
    zoomOut,
    resetZoom,
    orthoSnap,
    magneticSnap,
    showGrid,
    toggleGrid,
    gridSnap,
    showHeroLegend,
    toggleHeroLegend,
    updateGeometry,
    calibP1,
    calibP2,
    setCalibPoints,
    setShowCalibModal,
    setSheetTakeoff,
  } = useEditorStore();

  // Resize canvas to fill container
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Spacebar listeners for universal pan
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
      if (e.code === 'Space' && !e.repeat) {
        setIsSpaceDown(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpaceDown(false);
        setIsPanning(false);
        panStartRef.current = null;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Load sheet background image
  useEffect(() => {
    if (!sheet) return;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = api.getSheetImageUrl(sheet.id);
    img.onload = () => {
      setBgImage(img);
      // Auto fit image initially if not scaled
      if (containerRef.current && stageScale === 1 && stagePos.x === 40) {
        const cw = containerRef.current.offsetWidth;
        const ch = containerRef.current.offsetHeight;
        const s = Math.min((cw - 80) / img.width, (ch - 80) / img.height, 1);
        const px = (cw - img.width * s) / 2;
        const py = (ch - img.height * s) / 2;
        setStageTransform(s, { x: Math.max(20, px), y: Math.max(20, py) });
      }
    };
  }, [sheet?.id]);

  // Helper: Convert screen coords to canvas/sheet image coords
  const getCanvasCoords = useCallback(
    (stage: Konva.Stage, rawPos?: { x: number; y: number }): { x: number; y: number } => {
      const pos = rawPos || stage.getPointerPosition();
      if (!pos) return { x: 0, y: 0 };
      const transform = stage.getAbsoluteTransform().copy().invert();
      const pt = transform.point(pos);
      return { x: pt.x, y: pt.y };
    },
    []
  );

  // Architectural Grid Calculation
  const gridData = useMemo(() => {
    if (!showGrid) return { vLines: [], hLines: [], labels: [], intervalPx: 100 };
    const width = sheet?.width_px || bgImage?.width || 3500;
    const height = sheet?.height_px || bgImage?.height || 2500;

    let intervalPx = 100;
    let labelStep = 1;
    let isMetric = false;

    if (sheet?.scale_m_per_px) {
      isMetric = true;
      const oneMeterPx = 1 / sheet.scale_m_per_px;
      if (stageScale < 0.25) {
        intervalPx = oneMeterPx * 5;
        labelStep = 5;
      } else if (stageScale < 0.6) {
        intervalPx = oneMeterPx * 2;
        labelStep = 2;
      } else if (stageScale > 2.0) {
        intervalPx = oneMeterPx * 0.5;
        labelStep = 0.5;
      } else {
        intervalPx = oneMeterPx * 1;
        labelStep = 1;
      }
    } else {
      intervalPx = stageScale < 0.4 ? 200 : 100;
    }

    const vLines: { x: number; isMajor: boolean }[] = [];
    const hLines: { y: number; isMajor: boolean }[] = [];
    const labels: { x: number; y: number; text: string }[] = [];

    let count = 0;
    for (let x = 0; x <= width + intervalPx; x += intervalPx) {
      const isMajor = count % 5 === 0;
      vLines.push({ x, isMajor });
      if (isMajor || count % 2 === 0) {
        labels.push({
          x: x + 4 / stageScale,
          y: 4 / stageScale,
          text: isMetric ? `${(count * labelStep).toFixed(labelStep < 1 ? 1 : 0)}m` : `${Math.round(x)}`,
        });
      }
      count++;
    }

    count = 0;
    for (let y = 0; y <= height + intervalPx; y += intervalPx) {
      const isMajor = count % 5 === 0;
      hLines.push({ y, isMajor });
      if ((isMajor || count % 2 === 0) && y > 0) {
        labels.push({
          x: 4 / stageScale,
          y: y + 4 / stageScale,
          text: isMetric ? `${(count * labelStep).toFixed(labelStep < 1 ? 1 : 0)}m` : `${Math.round(y)}`,
        });
      }
      count++;
    }

    return { vLines, hLines, labels, intervalPx };
  }, [showGrid, sheet?.width_px, sheet?.height_px, sheet?.scale_m_per_px, bgImage, stageScale]);

  // Snap to Grid
  const snapToGrid = useCallback(
    (pt: { x: number; y: number }): { x: number; y: number } => {
      if (!gridSnap || !gridData.intervalPx) return pt;
      const interval = gridData.intervalPx;
      return {
        x: Math.round(pt.x / interval) * interval,
        y: Math.round(pt.y / interval) * interval,
      };
    },
    [gridSnap, gridData.intervalPx]
  );

  // Helper: Snap to existing vertices if magnetic snap is on
  const snapToVertices = useCallback(
    (pt: { x: number; y: number }): { x: number; y: number } => {
      if (!magneticSnap || !sheet) return snapToGrid(pt);
      const snapRadius = 18 / stageScale;
      let closestPt = pt;
      let minDist = snapRadius;

      // Check wall vertices
      sheet.geometry.walls.forEach((w) => {
        w.points.forEach(([x, y]) => {
          const d = Math.hypot(x - pt.x, y - pt.y);
          if (d < minDist) {
            minDist = d;
            closestPt = { x, y };
          }
        });
      });

      // Check room vertices
      sheet.geometry.rooms.forEach((r) => {
        r.points.forEach(([x, y]) => {
          const d = Math.hypot(x - pt.x, y - pt.y);
          if (d < minDist) {
            minDist = d;
            closestPt = { x, y };
          }
        });
      });

      if (minDist < snapRadius) {
        return closestPt;
      }
      return snapToGrid(pt);
    },
    [magneticSnap, sheet, stageScale, snapToGrid]
  );

  // Helper: Orthogonal snapping relative to reference point
  const applyOrthoSnap = useCallback(
    (pt: { x: number; y: number }, refPt: [number, number]): { x: number; y: number } => {
      if (!orthoSnap) return pt;
      const dx = Math.abs(pt.x - refPt[0]);
      const dy = Math.abs(pt.y - refPt[1]);
      if (dx >= dy) {
        return { x: pt.x, y: refPt[1] }; // Snap horizontal
      } else {
        return { x: refPt[0], y: pt.y }; // Snap vertical
      }
    },
    [orthoSnap]
  );

  // Zoom on wheel (centered precisely at mouse pointer)
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    // Shift + wheel = horizontal pan
    if (e.evt.shiftKey && !e.evt.ctrlKey) {
      setStageTransform(stageScale, {
        x: stagePos.x - e.evt.deltaY,
        y: stagePos.y,
      });
      return;
    }

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const factor = 1.14;
    const newScale = direction > 0 ? Math.min(oldScale * factor, 14) : Math.max(oldScale / factor, 0.04);

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    setStageTransform(newScale, newPos);
  };

  // Mouse Down: Start Spacebar or Middle-mouse pan
  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isSpaceDown || e.evt.button === 1) {
      e.evt.preventDefault();
      setIsPanning(true);
      panStartRef.current = {
        mouseX: e.evt.clientX,
        mouseY: e.evt.clientY,
        stageX: stagePos.x,
        stageY: stagePos.y,
      };
      if (containerRef.current) {
        containerRef.current.style.cursor = 'grabbing';
      }
    }
  };

  // Mouse Move on canvas
  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // If currently panning with spacebar or middle-mouse
    if (isPanning && panStartRef.current) {
      const dx = e.evt.clientX - panStartRef.current.mouseX;
      const dy = e.evt.clientY - panStartRef.current.mouseY;
      setStageTransform(stageScale, {
        x: panStartRef.current.stageX + dx,
        y: panStartRef.current.stageY + dy,
      });
      return;
    }

    const stage = stageRef.current;
    if (!stage) return;
    let pt = getCanvasCoords(stage);
    pt = snapToVertices(pt);
    if (draftPoints.length > 0) {
      pt = applyOrthoSnap(pt, draftPoints[draftPoints.length - 1]);
    }
    setMousePos(pt);
  };

  // Mouse Up: Stop Pan
  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
      if (containerRef.current) {
        containerRef.current.style.cursor = isSpaceDown ? 'grab' : activeTool === 'select' ? 'default' : 'crosshair';
      }
    }
  };

  // Canvas Click
  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // If user was panning or clicked on spacebar, ignore click
    if (isSpaceDown || isPanning) return;

    // If clicked on an element and tool is select, don't clear
    if (e.target !== stageRef.current && e.target !== stageRef.current?.findOne('.bg-image')) {
      return;
    }

    const stage = stageRef.current;
    if (!stage) return;

    let pt = getCanvasCoords(stage);
    pt = snapToVertices(pt);

    if (activeTool === 'select') {
      selectItem(null, null);
      return;
    }

    if (activeTool === 'calibrate') {
      if (!calibP1) {
        setCalibPoints([pt.x, pt.y], null);
      } else if (!calibP2) {
        setCalibPoints(calibP1, [pt.x, pt.y]);
        setShowCalibModal(true);
      }
      return;
    }

    if (activeTool === 'wall_external' || activeTool === 'wall_internal') {
      if (draftPoints.length > 0) {
        pt = applyOrthoSnap(pt, draftPoints[draftPoints.length - 1]);
      }
      addDraftPoint([pt.x, pt.y]);
      return;
    }

    if (activeTool === 'room') {
      addDraftPoint([pt.x, pt.y]);
      return;
    }

    if (activeTool === 'door' || activeTool === 'window') {
      if (!sheet) return;
      const type = activeTool === 'door' ? 'D1' : 'W1';
      // Find nearest wall
      let nearestWall: Wall | null = null;
      let minDist = 30 / stageScale;
      sheet.geometry.walls.forEach((w) => {
        for (let i = 0; i < w.points.length - 1; i++) {
          const p1 = w.points[i];
          const p2 = w.points[i + 1];
          const d = distToSegment(pt, { x: p1[0], y: p1[1] }, { x: p2[0], y: p2[1] });
          if (d < minDist) {
            minDist = d;
            nearestWall = w;
          }
        }
      });

      const newOpening: Opening = {
        id: `o_${Date.now()}`,
        type,
        x: Math.round(pt.x),
        y: Math.round(pt.y),
        wall_id: nearestWall ? (nearestWall as Wall).id : undefined,
        count: 1,
      };

      const updatedGeom = {
        ...sheet.geometry,
        openings: [...sheet.geometry.openings, newOpening],
      };
      updateGeometry(updatedGeom, true);
      saveGeometry(updatedGeom);
      return;
    }

    if (activeTool === 'measure') {
      if (draftPoints.length === 0) {
        addDraftPoint([pt.x, pt.y]);
      } else {
        clearDraft();
      }
    }
  };

  // Double click or Enter to finish wall or room
  const finishDraft = useCallback(() => {
    if (!sheet || draftPoints.length < 2) {
      clearDraft();
      return;
    }

    if (activeTool === 'wall_external' || activeTool === 'wall_internal') {
      const isExt = activeTool === 'wall_external';
      const first = draftPoints[0];
      const last = draftPoints[draftPoints.length - 1];
      const isClosed = draftPoints.length >= 3 && Math.hypot(first[0] - last[0], first[1] - last[1]) < 22 / stageScale;

      const newWall: Wall = {
        id: `w_${Date.now()}`,
        kind: isExt ? 'external' : 'internal',
        points: isClosed ? draftPoints.slice(0, -1) : draftPoints,
        closed: isClosed,
        ref: isExt ? 'outer' : 'centre',
      };

      const updated = {
        ...sheet.geometry,
        walls: [...sheet.geometry.walls, newWall],
      };
      updateGeometry(updated, true);
      saveGeometry(updated);
      clearDraft();
    } else if (activeTool === 'room') {
      if (draftPoints.length >= 3) {
        const newRoom: Room = {
          id: `r_${Date.now()}`,
          name: `Room ${sheet.geometry.rooms.length + 1}`,
          points: draftPoints,
          skirting: true,
        };
        const updated = {
          ...sheet.geometry,
          rooms: [...sheet.geometry.rooms, newRoom],
        };
        updateGeometry(updated, true);
        saveGeometry(updated);
      }
      clearDraft();
    }
  }, [activeTool, draftPoints, sheet, stageScale, updateGeometry, clearDraft]);

  const saveGeometry = async (geom: SheetGeometry) => {
    if (!sheet) return;
    try {
      await api.updateSheet(sheet.id, { geometry: geom });
      const takeoff = await api.getSheetTakeoff(sheet.id);
      setSheetTakeoff(takeoff);
      if (onGeometryChanged) onGeometryChanged(geom);
    } catch (e: any) {
      console.error('Failed to sync geometry:', e);
    }
  };

  // Keyboard Enter / Escape handler for drafting
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        finishDraft();
      } else if (e.key === 'Escape') {
        clearDraft();
        if (activeTool === 'calibrate') setCalibPoints(null, null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [finishDraft, clearDraft, activeTool]);

  // Distance helper in meters
  const pxToMeters = (px: number) => {
    if (!sheet?.scale_m_per_px) return null;
    return (px * sheet.scale_m_per_px).toFixed(2);
  };

  const scale = sheet?.scale_m_per_px || 0.01;

  // Fit to screen helper
  const handleFitToScreen = () => {
    if (!containerRef.current || !bgImage) {
      resetZoom();
      return;
    }
    const cw = containerRef.current.offsetWidth;
    const ch = containerRef.current.offsetHeight;
    const s = Math.min((cw - 60) / bgImage.width, (ch - 60) / bgImage.height, 1);
    const px = (cw - bgImage.width * s) / 2;
    const py = (ch - bgImage.height * s) / 2;
    setStageTransform(s, { x: Math.max(10, px), y: Math.max(10, py) });
  };

  const cursorStyle = isSpaceDown
    ? isPanning
      ? 'grabbing'
      : 'grab'
    : activeTool === 'select'
    ? 'default'
    : 'crosshair';

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        height: '100%',
        backgroundColor: '#0F172A',
        position: 'relative',
        overflow: 'hidden',
        cursor: cursorStyle,
      }}
      onDoubleClick={finishDraft}
    >
      {/* Plan Legend / Hero Section Overlay */}
      <PlanLegend />

      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        scaleX={stageScale}
        scaleY={stageScale}
        x={stagePos.x}
        y={stagePos.y}
        draggable={activeTool === 'select' && !isSpaceDown}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleStageClick}
        onDragEnd={(e) => {
          if (e.target === stageRef.current) {
            setStageTransform(stageScale, { x: e.target.x(), y: e.target.y() });
          }
        }}
      >
        {/* Layer 1: Floor Plan Image */}
        <Layer>
          {bgImage && (
            <KonvaImage
              name="bg-image"
              image={bgImage}
              width={sheet?.width_px || bgImage.width}
              height={sheet?.height_px || bgImage.height}
              listening={true}
              shadowColor="black"
              shadowBlur={20}
              shadowOpacity={0.4}
            />
          )}
        </Layer>

        {/* Layer 1.5: Optional Architectural Grid */}
        {showGrid && (
          <Layer listening={false}>
            {/* Vertical lines */}
            {gridData.vLines.map((v, i) => (
              <Line
                key={`gv_${i}`}
                points={[v.x, 0, v.x, (sheet?.height_px || 3000)]}
                stroke={v.isMajor ? 'rgba(56, 189, 248, 0.22)' : 'rgba(255, 255, 255, 0.08)'}
                strokeWidth={(v.isMajor ? 1.5 : 0.8) / stageScale}
              />
            ))}
            {/* Horizontal lines */}
            {gridData.hLines.map((h, i) => (
              <Line
                key={`gh_${i}`}
                points={[0, h.y, (sheet?.width_px || 3500), h.y]}
                stroke={h.isMajor ? 'rgba(56, 189, 248, 0.22)' : 'rgba(255, 255, 255, 0.08)'}
                strokeWidth={(h.isMajor ? 1.5 : 0.8) / stageScale}
              />
            ))}
            {/* Grid coordinate labels */}
            {gridData.labels.map((lbl, i) => (
              <Text
                key={`gl_${i}`}
                text={lbl.text}
                x={lbl.x}
                y={lbl.y}
                fontSize={10 / stageScale}
                fontFamily="JetBrains Mono"
                fill="rgba(148, 163, 184, 0.75)"
              />
            ))}
          </Layer>
        )}

        {/* Layer 2: Rooms (Fills, Draggable Body & Labels) */}
        <Layer>
          {sheet?.geometry.rooms.map((room) => {
            const isSelected = selectedId === room.id;
            const flatPoints = room.points.flatMap((p) => p);
            const cx = room.points.reduce((sum, p) => sum + p[0], 0) / room.points.length;
            const cy = room.points.reduce((sum, p) => sum + p[1], 0) / room.points.length;

            return (
              <Group key={room.id}>
                {/* Room Fill / Outline */}
                <Line
                  points={flatPoints}
                  closed={true}
                  fill={isSelected ? 'rgba(14, 165, 233, 0.35)' : 'rgba(14, 165, 233, 0.16)'}
                  stroke={isSelected ? '#0284C7' : 'rgba(14, 165, 233, 0.8)'}
                  strokeWidth={isSelected ? 3 / stageScale : 1.5 / stageScale}
                  dash={isSelected ? [6 / stageScale, 3 / stageScale] : undefined}
                  draggable={activeTool === 'select' && !isSpaceDown}
                  onMouseEnter={() => {
                    if (activeTool === 'select' && !isSpaceDown && containerRef.current) {
                      containerRef.current.style.cursor = 'grab';
                    }
                  }}
                  onMouseLeave={() => {
                    if (activeTool === 'select' && !isSpaceDown && containerRef.current) {
                      containerRef.current.style.cursor = 'default';
                    }
                  }}
                  onDragStart={() => {
                    selectItem(room.id, 'room');
                    if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
                  }}
                  onDragEnd={(e) => {
                    const dx = e.target.x();
                    const dy = e.target.y();
                    e.target.position({ x: 0, y: 0 });
                    if (dx !== 0 || dy !== 0) {
                      const newPts = room.points.map(([x, y]) => [Math.round(x + dx), Math.round(y + dy)] as [number, number]);
                      const updatedRoom = { ...room, points: newPts };
                      const updatedGeom = {
                        ...sheet.geometry,
                        rooms: sheet.geometry.rooms.map((r) => (r.id === room.id ? updatedRoom : r)),
                      };
                      updateGeometry(updatedGeom, true);
                      saveGeometry(updatedGeom);
                    }
                    if (containerRef.current) containerRef.current.style.cursor = 'grab';
                  }}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    selectItem(room.id, 'room');
                  }}
                />

                {/* Room Corner Handles if Selected */}
                {isSelected &&
                  room.points.map(([rx, ry], idx) => (
                    <Circle
                      key={`rv_${idx}`}
                      x={rx}
                      y={ry}
                      radius={Math.max(6, 8 / stageScale)}
                      hitStrokeWidth={22 / stageScale}
                      fill="#FFFFFF"
                      stroke="#0284C7"
                      strokeWidth={2 / stageScale}
                      shadowColor="#0284C7"
                      shadowBlur={6}
                      draggable={activeTool === 'select' && !isSpaceDown}
                      onMouseEnter={() => {
                        if (containerRef.current) containerRef.current.style.cursor = 'move';
                      }}
                      onMouseLeave={() => {
                        if (containerRef.current) containerRef.current.style.cursor = 'default';
                      }}
                      onDragEnd={(e) => {
                        let targetPt = { x: e.target.x(), y: e.target.y() };
                        targetPt = snapToVertices(targetPt);
                        const newPts: [number, number][] = [...room.points];
                        newPts[idx] = [Math.round(targetPt.x), Math.round(targetPt.y)];
                        const updatedRoom = { ...room, points: newPts };
                        const updatedGeom = {
                          ...sheet.geometry,
                          rooms: sheet.geometry.rooms.map((r) =>
                            r.id === room.id ? updatedRoom : r
                          ),
                        };
                        updateGeometry(updatedGeom, true);
                        saveGeometry(updatedGeom);
                      }}
                    />
                  ))}

                {/* Room Centroid Label */}
                <Group x={cx} y={cy} listening={false}>
                  <Rect
                    x={-45 / stageScale}
                    y={-14 / stageScale}
                    width={90 / stageScale}
                    height={28 / stageScale}
                    fill="rgba(15, 23, 42, 0.85)"
                    cornerRadius={4 / stageScale}
                  />
                  <Text
                    text={room.name}
                    x={-45 / stageScale}
                    y={-11 / stageScale}
                    width={90 / stageScale}
                    align="center"
                    fontSize={10 / stageScale}
                    fontFamily="Inter"
                    fontStyle="bold"
                    fill="#FFFFFF"
                  />
                  {sheet.scale_m_per_px && (
                    <Text
                      text={`${(polygonArea(room.points) * (sheet.scale_m_per_px ** 2)).toFixed(1)} m²`}
                      x={-45 / stageScale}
                      y={2 / stageScale}
                      width={90 / stageScale}
                      align="center"
                      fontSize={9 / stageScale}
                      fontFamily="JetBrains Mono"
                      fill="#38BDF8"
                    />
                  )}
                </Group>
              </Group>
            );
          })}
        </Layer>

        {/* Layer 3: Walls (Draggable Wall Lines, Midpoint Split, & Vertex Handles) */}
        <Layer>
          {sheet?.geometry.walls.map((wall) => {
            const isSelected = selectedId === wall.id;
            const isExt = wall.kind === 'external';
            const flatPoints = wall.points.flatMap((p) => p);

            const thicknessM = wall.thickness || (isExt ? 0.225 : 0.150);
            const strokePx = Math.max(4, (thicknessM / scale));
            const strokeColor = isExt ? '#10B981' : '#F59E0B';

            return (
              <Group key={wall.id}>
                {/* Wall body line - Draggable in Select tool */}
                <Line
                  points={flatPoints}
                  closed={wall.closed}
                  stroke={strokeColor}
                  strokeWidth={strokePx}
                  opacity={isSelected ? 0.95 : 0.78}
                  lineCap="round"
                  lineJoin="round"
                  draggable={activeTool === 'select' && !isSpaceDown}
                  hitStrokeWidth={Math.max(24 / stageScale, strokePx + 14 / stageScale)}
                  onMouseEnter={() => {
                    if (activeTool === 'select' && !isSpaceDown && containerRef.current) {
                      containerRef.current.style.cursor = 'grab';
                    }
                  }}
                  onMouseLeave={() => {
                    if (activeTool === 'select' && !isSpaceDown && containerRef.current) {
                      containerRef.current.style.cursor = 'default';
                    }
                  }}
                  onDragStart={() => {
                    selectItem(wall.id, 'wall');
                    if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
                  }}
                  onDragEnd={(e) => {
                    const dx = e.target.x();
                    const dy = e.target.y();
                    e.target.position({ x: 0, y: 0 }); // reset node position
                    if (dx !== 0 || dy !== 0) {
                      const newPts: [number, number][] = wall.points.map(([x, y]) => [
                        Math.round(x + dx),
                        Math.round(y + dy),
                      ]);
                      const updatedWall = { ...wall, points: newPts };
                      const updatedGeom = {
                        ...sheet.geometry,
                        walls: sheet.geometry.walls.map((w) => (w.id === wall.id ? updatedWall : w)),
                      };
                      updateGeometry(updatedGeom, true);
                      saveGeometry(updatedGeom);
                    }
                    if (containerRef.current) containerRef.current.style.cursor = 'grab';
                  }}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    selectItem(wall.id, 'wall');
                  }}
                  shadowColor={isSelected ? '#38BDF8' : 'black'}
                  shadowBlur={isSelected ? 12 : 3}
                  shadowOpacity={isSelected ? 0.85 : 0.3}
                />

                {/* Centerline trace */}
                <Line
                  points={flatPoints}
                  closed={wall.closed}
                  stroke={isSelected ? '#38BDF8' : '#FFFFFF'}
                  strokeWidth={1.5 / stageScale}
                  dash={isSelected ? [4 / stageScale, 2 / stageScale] : undefined}
                  listening={false}
                />

                {/* Wall Midpoint '+' Handles (Click or Drag to add corner vertex) */}
                {isSelected &&
                  wall.points.slice(0, wall.closed ? wall.points.length : wall.points.length - 1).map((p1, idx) => {
                    const p2 = wall.points[(idx + 1) % wall.points.length];
                    const mx = (p1[0] + p2[0]) / 2;
                    const my = (p1[1] + p2[1]) / 2;
                    return (
                      <Circle
                        key={`mid_${idx}`}
                        x={mx}
                        y={my}
                        radius={Math.max(5, 6 / stageScale)}
                        fill="#38BDF8"
                        stroke="#FFFFFF"
                        strokeWidth={1.5 / stageScale}
                        hitStrokeWidth={20 / stageScale}
                        draggable={activeTool === 'select' && !isSpaceDown}
                        onMouseEnter={() => {
                          if (containerRef.current) containerRef.current.style.cursor = 'crosshair';
                        }}
                        onMouseLeave={() => {
                          if (containerRef.current) containerRef.current.style.cursor = 'default';
                        }}
                        onDragEnd={(e) => {
                          const nx = Math.round(e.target.x());
                          const ny = Math.round(e.target.y());
                          const newPts: [number, number][] = [...wall.points];
                          newPts.splice(idx + 1, 0, [nx, ny]);
                          const updatedWall = { ...wall, points: newPts };
                          const updatedGeom = {
                            ...sheet.geometry,
                            walls: sheet.geometry.walls.map((w) =>
                              w.id === wall.id ? updatedWall : w
                            ),
                          };
                          updateGeometry(updatedGeom, true);
                          saveGeometry(updatedGeom);
                        }}
                      />
                    );
                  })}

                {/* Vertex Draggable Handles */}
                {isSelected &&
                  wall.points.map(([vx, vy], idx) => (
                    <Circle
                      key={`v_${idx}`}
                      x={vx}
                      y={vy}
                      radius={Math.max(7, 9 / stageScale)}
                      hitStrokeWidth={24 / stageScale}
                      fill="#FFFFFF"
                      stroke="#2563EB"
                      strokeWidth={2.5 / stageScale}
                      shadowColor="#2563EB"
                      shadowBlur={8}
                      shadowOpacity={0.6}
                      draggable={activeTool === 'select' && !isSpaceDown}
                      onMouseEnter={() => {
                        if (containerRef.current) containerRef.current.style.cursor = 'move';
                      }}
                      onMouseLeave={() => {
                        if (containerRef.current) containerRef.current.style.cursor = 'default';
                      }}
                      onDragMove={(e) => {
                        let targetPt = { x: e.target.x(), y: e.target.y() };
                        targetPt = snapToVertices(targetPt);
                        e.target.position(targetPt);
                        const newPts: [number, number][] = [...wall.points];
                        newPts[idx] = [targetPt.x, targetPt.y];
                        const updatedWall = { ...wall, points: newPts };
                        const updatedGeom = {
                          ...sheet.geometry,
                          walls: sheet.geometry.walls.map((w) =>
                            w.id === wall.id ? updatedWall : w
                          ),
                        };
                        updateGeometry(updatedGeom, false);
                      }}
                      onDragEnd={(e) => {
                        let targetPt = { x: e.target.x(), y: e.target.y() };
                        targetPt = snapToVertices(targetPt);
                        const newPts: [number, number][] = [...wall.points];
                        newPts[idx] = [Math.round(targetPt.x), Math.round(targetPt.y)];
                        const updatedWall = { ...wall, points: newPts };
                        const updatedGeom = {
                          ...sheet.geometry,
                          walls: sheet.geometry.walls.map((w) =>
                            w.id === wall.id ? updatedWall : w
                          ),
                        };
                        updateGeometry(updatedGeom, true);
                        saveGeometry(updatedGeom);
                      }}
                    />
                  ))}
              </Group>
            );
          })}
        </Layer>

        {/* Layer 4: Openings (Draggable Doors & Windows) */}
        <Layer>
          {sheet?.geometry.openings.map((opening) => {
            const isSelected = selectedId === opening.id;
            const isDoor = opening.type.startsWith('D');
            const symbolColor = isDoor ? '#8B5CF6' : '#EC4899';
            const size = 16 / stageScale;

            return (
              <Group
                key={opening.id}
                x={opening.x}
                y={opening.y}
                draggable={activeTool === 'select' && !isSpaceDown}
                onMouseEnter={() => {
                  if (activeTool === 'select' && !isSpaceDown && containerRef.current) {
                    containerRef.current.style.cursor = 'grab';
                  }
                }}
                onMouseLeave={() => {
                  if (activeTool === 'select' && !isSpaceDown && containerRef.current) {
                    containerRef.current.style.cursor = 'default';
                  }
                }}
                onDragStart={() => {
                  selectItem(opening.id, 'opening');
                  if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
                }}
                onDragEnd={(e) => {
                  const newX = Math.round(e.target.x());
                  const newY = Math.round(e.target.y());
                  // Find nearest wall
                  let nearestWall: Wall | null = null;
                  let minDist = 40 / stageScale;
                  sheet.geometry.walls.forEach((w) => {
                    for (let i = 0; i < w.points.length - 1; i++) {
                      const p1 = w.points[i];
                      const p2 = w.points[i + 1];
                      const d = distToSegment({ x: newX, y: newY }, { x: p1[0], y: p1[1] }, { x: p2[0], y: p2[1] });
                      if (d < minDist) {
                        minDist = d;
                        nearestWall = w;
                      }
                    }
                  });
                  const updatedOpening: Opening = {
                    ...opening,
                    x: newX,
                    y: newY,
                    wall_id: nearestWall ? (nearestWall as Wall).id : opening.wall_id,
                  };
                  const updatedGeom = {
                    ...sheet.geometry,
                    openings: sheet.geometry.openings.map((o) => (o.id === opening.id ? updatedOpening : o)),
                  };
                  updateGeometry(updatedGeom, true);
                  saveGeometry(updatedGeom);
                  if (containerRef.current) containerRef.current.style.cursor = 'grab';
                }}
                onClick={(e) => {
                  e.cancelBubble = true;
                  selectItem(opening.id, 'opening');
                }}
              >
                {/* Background circle badge */}
                <Circle
                  radius={size}
                  fill={isSelected ? '#3B82F6' : symbolColor}
                  opacity={0.88}
                  shadowColor="black"
                  shadowBlur={6}
                />
                {/* Type Label */}
                <Text
                  text={opening.type}
                  x={-size}
                  y={-5 / stageScale}
                  width={size * 2}
                  align="center"
                  fontSize={9 / stageScale}
                  fontFamily="Inter"
                  fontStyle="bold"
                  fill="#FFFFFF"
                  listening={false}
                />
              </Group>
            );
          })}
        </Layer>

        {/* Layer 5: Active Drafting & Guides */}
        <Layer>
          {/* Draft Points & Rubber Band */}
          {draftPoints.length > 0 && (
            <Group>
              <Line
                points={[
                  ...draftPoints.flatMap((p) => p),
                  ...(mousePos ? [mousePos.x, mousePos.y] : []),
                ]}
                stroke={activeTool === 'wall_external' ? '#10B981' : activeTool === 'wall_internal' ? '#F59E0B' : '#0EA5E9'}
                strokeWidth={2.5 / stageScale}
                dash={[6 / stageScale, 4 / stageScale]}
              />

              {draftPoints.map(([px, py], i) => (
                <Circle
                  key={i}
                  x={px}
                  y={py}
                  radius={5 / stageScale}
                  fill="#FFFFFF"
                  stroke="#2563EB"
                  strokeWidth={2 / stageScale}
                />
              ))}

              {/* Rubber band distance label */}
              {mousePos && draftPoints.length > 0 && (
                <Group
                  x={(draftPoints[draftPoints.length - 1][0] + mousePos.x) / 2}
                  y={(draftPoints[draftPoints.length - 1][1] + mousePos.y) / 2}
                >
                  {(() => {
                    const last = draftPoints[draftPoints.length - 1];
                    const distPx = Math.hypot(mousePos.x - last[0], mousePos.y - last[1]);
                    const m = pxToMeters(distPx);
                    if (!m) return null;
                    return (
                      <>
                        <Rect
                          x={-28 / stageScale}
                          y={-12 / stageScale}
                          width={56 / stageScale}
                          height={18 / stageScale}
                          fill="#0F172A"
                          cornerRadius={3 / stageScale}
                        />
                        <Text
                          text={`${m}m`}
                          x={-28 / stageScale}
                          y={-9 / stageScale}
                          width={56 / stageScale}
                          align="center"
                          fontSize={10 / stageScale}
                          fontFamily="JetBrains Mono"
                          fontStyle="bold"
                          fill="#38BDF8"
                        />
                      </>
                    );
                  })()}
                </Group>
              )}
            </Group>
          )}

          {/* Calibration Points in Progress */}
          {calibP1 && (
            <Group>
              <Circle
                x={calibP1[0]}
                y={calibP1[1]}
                radius={7 / stageScale}
                fill="#EF4444"
                stroke="#FFFFFF"
                strokeWidth={2 / stageScale}
              />
              {mousePos && (
                <Line
                  points={[calibP1[0], calibP1[1], mousePos.x, mousePos.y]}
                  stroke="#EF4444"
                  strokeWidth={2 / stageScale}
                  dash={[4 / stageScale, 3 / stageScale]}
                />
              )}
            </Group>
          )}
        </Layer>
      </Stage>

      {/* Floating Canvas Navigation & Zoom HUD (Bottom-Right) */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          zIndex: 30,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          userSelect: 'none',
        }}
      >
        {/* Directional Pan Compass */}
        <div
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: 'var(--radius-lg)',
            padding: '4px',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 28px)',
            gridTemplateRows: 'repeat(3, 28px)',
            gap: '2px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div />
          <button
            onClick={() => panBy(0, 80)}
            title="Pan Up (Arrow Up)"
            style={hudBtnStyle}
          >
            <ChevronUp size={16} />
          </button>
          <div />

          <button
            onClick={() => panBy(80, 0)}
            title="Pan Left (Arrow Left)"
            style={hudBtnStyle}
          >
            <ChevronLeft size={16} />
          </button>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748B',
            }}
          >
            <Move size={12} />
          </div>
          <button
            onClick={() => panBy(-80, 0)}
            title="Pan Right (Arrow Right)"
            style={hudBtnStyle}
          >
            <ChevronRight size={16} />
          </button>

          <div />
          <button
            onClick={() => panBy(0, -80)}
            title="Pan Down (Arrow Down)"
            style={hudBtnStyle}
          >
            <ChevronDown size={16} />
          </button>
          <div />
        </div>

        {/* Zoom & View Actions */}
        <div
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: 'var(--radius-lg)',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
          }}
        >
          <button
            onClick={zoomIn}
            title="Zoom In (+)"
            style={hudBtnStyle}
          >
            <ZoomIn size={15} />
          </button>
          <button
            onClick={zoomOut}
            title="Zoom Out (-)"
            style={hudBtnStyle}
          >
            <ZoomOut size={15} />
          </button>
          <button
            onClick={handleFitToScreen}
            title="Fit Plan to Screen"
            style={hudBtnStyle}
          >
            <Maximize2 size={14} />
          </button>
          <button
            onClick={toggleGrid}
            title={`Toggle Grid (${showGrid ? 'ON' : 'OFF'})`}
            style={{
              ...hudBtnStyle,
              color: showGrid ? '#8B5CF6' : '#94A3B8',
              backgroundColor: showGrid ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
            }}
          >
            <GridIcon size={14} />
          </button>
          <button
            onClick={toggleHeroLegend}
            title={`Toggle Plan Legend (${showHeroLegend ? 'ON' : 'OFF'})`}
            style={{
              ...hudBtnStyle,
              color: showHeroLegend ? '#38BDF8' : '#94A3B8',
              backgroundColor: showHeroLegend ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
            }}
          >
            <Sparkles size={14} />
          </button>
        </div>
      </div>

      {/* Floating Instructions Toast */}
      <div style={{
        position: 'absolute',
        bottom: '16px',
        left: '20px',
        backgroundColor: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(8px)',
        color: '#F8FAFC',
        padding: '8px 14px',
        borderRadius: 'var(--radius-md)',
        fontSize: '12px',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        pointerEvents: 'none',
        userSelect: 'none',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}>
        <span style={{ color: '#38BDF8', fontWeight: 600 }}>
          {activeTool.toUpperCase().replace('_', ' ')}:
        </span>
        <span>
          {activeTool === 'select' && 'Click & drag any wall/room/opening to move. Drag corner handles to reshape. Hold Space to pan.'}
          {activeTool === 'calibrate' && 'Click two ends of a known dimension to calibrate.'}
          {(activeTool === 'wall_external' || activeTool === 'wall_internal') &&
            'Click points along wall. Double-click or press Enter to finish. Hold Space to pan.'}
          {activeTool === 'room' && 'Click room corners. Double-click or press Enter to close polygon.'}
          {(activeTool === 'door' || activeTool === 'window') && 'Click along any wall to place opening.'}
          {activeTool === 'measure' && 'Click 2 points to measure distance.'}
        </span>
      </div>
    </div>
  );
};

const hudBtnStyle: React.CSSProperties = {
  width: '28px',
  height: '28px',
  borderRadius: '6px',
  border: 'none',
  backgroundColor: 'transparent',
  color: '#F1F5F9',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

// Math helpers
function distToSegment(
  p: { x: number; y: number },
  v: { x: number; y: number },
  w: { x: number; y: number }
) {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

function polygonArea(points: [number, number][]) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i][0] * points[j][1];
    area -= points[j][0] * points[i][1];
  }
  return Math.abs(area) / 2;
}
