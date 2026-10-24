import React, { useEffect } from 'react';
import {
  MousePointer,
  Ruler,
  Square,
  DoorOpen,
  AppWindow,
  Magnet,
  Compass,
  Trash2,
  Spline,
  Grid,
  Sparkles,
} from 'lucide-react';
import { useEditorStore, type ToolMode } from '../store/editorStore';

export const Toolbar: React.FC = () => {
  const {
    activeTool,
    setActiveTool,
    selectedId,
    deleteSelected,
    orthoSnap,
    toggleOrthoSnap,
    magneticSnap,
    toggleMagneticSnap,
    showGrid,
    toggleGrid,
    gridSnap,
    toggleGridSnap,
    showHeroLegend,
    toggleHeroLegend,
    setCalibPoints,
  } = useEditorStore();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'v':
          setActiveTool('select');
          break;
        case 'c':
          setActiveTool('calibrate');
          break;
        case 'e':
          setActiveTool('wall_external');
          break;
        case 'i':
          setActiveTool('wall_internal');
          break;
        case 'r':
          setActiveTool('room');
          break;
        case 'd':
          setActiveTool('door');
          break;
        case 'w':
          setActiveTool('window');
          break;
        case 'm':
          setActiveTool('measure');
          break;
        case 'g':
          toggleGrid();
          break;
        case 'l':
          toggleHeroLegend();
          break;
        case 'delete':
        case 'backspace':
          if (selectedId) deleteSelected();
          break;
        case 'shift':
          // Hold shift for ortho snap
          if (!orthoSnap) toggleOrthoSnap();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
      if (e.key.toLowerCase() === 'shift' && orthoSnap) {
        toggleOrthoSnap();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedId, orthoSnap, deleteSelected, setActiveTool, toggleOrthoSnap, toggleGrid, toggleHeroLegend]);

  const tools: { id: ToolMode; label: string; icon: React.ReactNode; shortcut: string }[] = [
    { id: 'select', label: 'Select / Inspect', icon: <MousePointer size={18} />, shortcut: 'V' },
    { id: 'calibrate', label: 'Calibrate Scale', icon: <Ruler size={18} />, shortcut: 'C' },
    { id: 'wall_external', label: 'External Wall', icon: <Square size={18} color="#10B981" />, shortcut: 'E' },
    { id: 'wall_internal', label: 'Internal Wall', icon: <Spline size={18} color="#F59E0B" />, shortcut: 'I' },
    { id: 'room', label: 'Room Polygon', icon: <Square size={18} color="#0EA5E9" />, shortcut: 'R' },
    { id: 'door', label: 'Door Opening', icon: <DoorOpen size={18} color="#8B5CF6" />, shortcut: 'D' },
    { id: 'window', label: 'Window Opening', icon: <AppWindow size={18} color="#EC4899" />, shortcut: 'W' },
    { id: 'measure', label: 'Measure Distance', icon: <Ruler size={18} color="#64748B" />, shortcut: 'M' },
  ];

  return (
    <aside style={{
      width: '54px',
      backgroundColor: '#FFFFFF',
      borderRight: '1px solid var(--border-light)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '12px 0',
      gap: '6px',
      userSelect: 'none',
      zIndex: 10,
      boxShadow: 'var(--shadow-sm)',
    }}>
      {tools.map((t) => {
        const isActive = activeTool === t.id;
        return (
          <button
            key={t.id}
            onClick={() => {
              setActiveTool(t.id);
              if (t.id === 'calibrate') {
                setCalibPoints(null, null);
              }
            }}
            title={`${t.label} (${t.shortcut})`}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              border: isActive ? '1px solid var(--primary)' : '1px solid transparent',
              backgroundColor: isActive ? 'var(--primary-subtle)' : 'transparent',
              color: isActive ? 'var(--primary)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              position: 'relative',
            }}
          >
            {t.icon}
            <span style={{
              position: 'absolute',
              bottom: '2px',
              right: '4px',
              fontSize: '8px',
              fontWeight: 700,
              color: isActive ? 'var(--primary)' : 'var(--text-subtle)',
            }}>
              {t.shortcut}
            </span>
          </button>
        );
      })}

      <div style={{ width: '32px', height: '1px', backgroundColor: 'var(--border-light)', margin: '8px 0' }} />

      {/* Snap Toggles */}
      <button
        onClick={toggleOrthoSnap}
        title={`Orthogonal Snap (Shift) - ${orthoSnap ? 'ON' : 'OFF'}`}
        style={{
          width: '40px',
          height: '40px',
          borderRadius: 'var(--radius-md)',
          border: orthoSnap ? '1px solid #10B981' : '1px solid transparent',
          backgroundColor: orthoSnap ? '#ECFDF5' : 'transparent',
          color: orthoSnap ? '#10B981' : 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <Compass size={18} />
      </button>

      <button
        onClick={toggleMagneticSnap}
        title={`Magnetic Vertex Snap - ${magneticSnap ? 'ON' : 'OFF'}`}
        style={{
          width: '40px',
          height: '40px',
          borderRadius: 'var(--radius-md)',
          border: magneticSnap ? '1px solid #0EA5E9' : '1px solid transparent',
          backgroundColor: magneticSnap ? '#F0F9FF' : 'transparent',
          color: magneticSnap ? '#0EA5E9' : 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <Magnet size={18} />
      </button>

      <button
        onClick={toggleGrid}
        title={`Architectural Grid (G) - ${showGrid ? 'ON' : 'OFF'}`}
        style={{
          width: '40px',
          height: '40px',
          borderRadius: 'var(--radius-md)',
          border: showGrid ? '1px solid #8B5CF6' : '1px solid transparent',
          backgroundColor: showGrid ? '#F5F3FF' : 'transparent',
          color: showGrid ? '#8B5CF6' : 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <Grid size={18} />
      </button>

      <button
        onClick={toggleGridSnap}
        title={`Snap to Grid - ${gridSnap ? 'ON' : 'OFF'}`}
        style={{
          width: '40px',
          height: '40px',
          borderRadius: 'var(--radius-md)',
          border: gridSnap ? '1px solid #6366F1' : '1px solid transparent',
          backgroundColor: gridSnap ? '#EEF2FF' : 'transparent',
          color: gridSnap ? '#6366F1' : 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          position: 'relative',
        }}
      >
        <Grid size={15} />
        <span style={{
          position: 'absolute',
          bottom: '2px',
          right: '3px',
          fontSize: '7px',
          fontWeight: 800,
          color: gridSnap ? '#6366F1' : '#94A3B8',
        }}>
          SNAP
        </span>
      </button>

      <button
        onClick={toggleHeroLegend}
        title={`Plan Color Legend (L) - ${showHeroLegend ? 'ON' : 'OFF'}`}
        style={{
          width: '40px',
          height: '40px',
          borderRadius: 'var(--radius-md)',
          border: showHeroLegend ? '1px solid #38BDF8' : '1px solid transparent',
          backgroundColor: showHeroLegend ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
          color: showHeroLegend ? '#38BDF8' : 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <Sparkles size={18} />
      </button>

      {/* Delete button if item selected */}
      {selectedId && (
        <>
          <div style={{ width: '32px', height: '1px', backgroundColor: 'var(--border-light)', margin: '8px 0' }} />
          <button
            onClick={deleteSelected}
            title="Delete Selected Item (Delete/Backspace)"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #FECACA',
              backgroundColor: '#FEF2F2',
              color: '#DC2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              animation: 'pulse 1.5s infinite',
            }}
          >
            <Trash2 size={18} />
          </button>
        </>
      )}
    </aside>
  );
};
