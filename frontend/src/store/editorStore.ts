import { create } from 'zustand';
import type { SheetGeometry, SheetOut, Takeoff } from '../api/types';

export type ToolMode =
  | 'select'
  | 'calibrate'
  | 'wall_external'
  | 'wall_internal'
  | 'room'
  | 'door'
  | 'window'
  | 'measure';

interface HistoryState {
  past: SheetGeometry[];
  future: SheetGeometry[];
}

interface EditorState {
  sheet: SheetOut | null;
  setSheet: (sheet: SheetOut | null) => void;

  // Active Tool
  activeTool: ToolMode;
  setActiveTool: (tool: ToolMode) => void;

  // Selection
  selectedId: string | null;
  selectedKind: 'wall' | 'room' | 'opening' | null;
  selectItem: (id: string | null, kind: 'wall' | 'room' | 'opening' | null) => void;

  // In-progress drawing
  draftPoints: [number, number][];
  setDraftPoints: (pts: [number, number][]) => void;
  addDraftPoint: (pt: [number, number]) => void;
  clearDraft: () => void;

  // Calibration state
  calibP1: [number, number] | null;
  calibP2: [number, number] | null;
  setCalibPoints: (p1: [number, number] | null, p2: [number, number] | null) => void;
  showCalibModal: boolean;
  setShowCalibModal: (show: boolean) => void;

  // Canvas Viewport transform
  stageScale: number;
  stagePos: { x: number; y: number };
  setStageTransform: (scale: number, pos: { x: number; y: number }) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;

  // Snapping & drawing options
  orthoSnap: boolean;
  toggleOrthoSnap: () => void;
  magneticSnap: boolean;
  toggleMagneticSnap: () => void;
  showGrid: boolean;
  toggleGrid: () => void;
  gridSnap: boolean;
  toggleGridSnap: () => void;

  // Hero Legend section
  showHeroLegend: boolean;
  toggleHeroLegend: () => void;

  // Viewport helper
  panBy: (dx: number, dy: number) => void;

  // History / Undo / Redo
  history: HistoryState;
  updateGeometry: (geometry: SheetGeometry, recordHistory?: boolean) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Detection loading
  isDetecting: boolean;
  setIsDetecting: (val: boolean) => void;

  // Live Sheet Takeoff
  sheetTakeoff: Takeoff | null;
  setSheetTakeoff: (takeoff: Takeoff | null) => void;

  // Delete selected item
  deleteSelected: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  sheet: null,
  setSheet: (sheet) =>
    set({
      sheet,
      selectedId: null,
      selectedKind: null,
      draftPoints: [],
      history: { past: [], future: [] },
      canUndo: false,
      canRedo: false,
    }),

  activeTool: 'select',
  setActiveTool: (tool) => {
    set({
      activeTool: tool,
      draftPoints: [],
      selectedId: tool === 'select' ? get().selectedId : null,
      selectedKind: tool === 'select' ? get().selectedKind : null,
    });
  },

  selectedId: null,
  selectedKind: null,
  selectItem: (id, kind) => set({ selectedId: id, selectedKind: kind }),

  draftPoints: [],
  setDraftPoints: (pts) => set({ draftPoints: pts }),
  addDraftPoint: (pt) => set((s) => ({ draftPoints: [...s.draftPoints, pt] })),
  clearDraft: () => set({ draftPoints: [] }),

  calibP1: null,
  calibP2: null,
  setCalibPoints: (p1, p2) => set({ calibP1: p1, calibP2: p2 }),
  showCalibModal: false,
  setShowCalibModal: (show) => set({ showCalibModal: show }),

  stageScale: 1,
  stagePos: { x: 40, y: 40 },
  setStageTransform: (scale, pos) => set({ stageScale: scale, stagePos: pos }),
  zoomIn: () =>
    set((s) => {
      const newScale = Math.min(s.stageScale * 1.25, 12);
      const factor = newScale / s.stageScale;
      const cx = window.innerWidth / 2 - 200;
      const cy = window.innerHeight / 2 - 40;
      return {
        stageScale: newScale,
        stagePos: {
          x: cx - (cx - s.stagePos.x) * factor,
          y: cy - (cy - s.stagePos.y) * factor,
        },
      };
    }),
  zoomOut: () =>
    set((s) => {
      const newScale = Math.max(s.stageScale / 1.25, 0.05);
      const factor = newScale / s.stageScale;
      const cx = window.innerWidth / 2 - 200;
      const cy = window.innerHeight / 2 - 40;
      return {
        stageScale: newScale,
        stagePos: {
          x: cx - (cx - s.stagePos.x) * factor,
          y: cy - (cy - s.stagePos.y) * factor,
        },
      };
    }),
  resetZoom: () => set({ stageScale: 1, stagePos: { x: 40, y: 40 } }),
  panBy: (dx, dy) => set((s) => ({ stagePos: { x: s.stagePos.x + dx, y: s.stagePos.y + dy } })),

  orthoSnap: false,
  toggleOrthoSnap: () => set((s) => ({ orthoSnap: !s.orthoSnap })),
  magneticSnap: true,
  toggleMagneticSnap: () => set((s) => ({ magneticSnap: !s.magneticSnap })),
  showGrid: true,
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  gridSnap: false,
  toggleGridSnap: () => set((s) => ({ gridSnap: !s.gridSnap })),

  showHeroLegend: true,
  toggleHeroLegend: () => set((s) => ({ showHeroLegend: !s.showHeroLegend })),

  history: { past: [], future: [] },
  canUndo: false,
  canRedo: false,

  updateGeometry: (newGeom, recordHistory = true) => {
    const s = get();
    if (!s.sheet) return;
    const currentGeom = s.sheet.geometry;
    let newPast = s.history.past;
    if (recordHistory) {
      newPast = [...s.history.past, currentGeom].slice(-30);
    }
    set({
      sheet: { ...s.sheet, geometry: newGeom },
      history: { past: newPast, future: recordHistory ? [] : s.history.future },
      canUndo: newPast.length > 0,
      canRedo: false,
    });
  },

  undo: () => {
    const s = get();
    if (!s.sheet || s.history.past.length === 0) return;
    const previous = s.history.past[s.history.past.length - 1];
    const newPast = s.history.past.slice(0, -1);
    const newFuture = [s.sheet.geometry, ...s.history.future];
    set({
      sheet: { ...s.sheet, geometry: previous },
      history: { past: newPast, future: newFuture },
      canUndo: newPast.length > 0,
      canRedo: true,
      selectedId: null,
      selectedKind: null,
    });
  },

  redo: () => {
    const s = get();
    if (!s.sheet || s.history.future.length === 0) return;
    const next = s.history.future[0];
    const newFuture = s.history.future.slice(1);
    const newPast = [...s.history.past, s.sheet.geometry];
    set({
      sheet: { ...s.sheet, geometry: next },
      history: { past: newPast, future: newFuture },
      canUndo: true,
      canRedo: newFuture.length > 0,
      selectedId: null,
      selectedKind: null,
    });
  },

  isDetecting: false,
  setIsDetecting: (val) => set({ isDetecting: val }),

  sheetTakeoff: null,
  setSheetTakeoff: (takeoff) => set({ sheetTakeoff: takeoff }),

  deleteSelected: () => {
    const s = get();
    if (!s.sheet || !s.selectedId || !s.selectedKind) return;
    const g = s.sheet.geometry;
    let updated: SheetGeometry = { ...g };
    if (s.selectedKind === 'wall') {
      updated.walls = g.walls.filter((w) => w.id !== s.selectedId);
      // Also disassociate any openings on this wall
      updated.openings = g.openings.map((o) =>
        o.wall_id === s.selectedId ? { ...o, wall_id: undefined } : o
      );
    } else if (s.selectedKind === 'room') {
      updated.rooms = g.rooms.filter((r) => r.id !== s.selectedId);
    } else if (s.selectedKind === 'opening') {
      updated.openings = g.openings.filter((o) => o.id !== s.selectedId);
    }
    s.updateGeometry(updated, true);
    set({ selectedId: null, selectedKind: null });
  },
}));
