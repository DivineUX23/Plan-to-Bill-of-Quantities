import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Sparkles,
  Download,
  Settings,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Ruler,
  Layers,
  FileSpreadsheet,
  Calculator,
} from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import type { ProjectOut, SheetSummary } from '../api/types';
import { api } from '../api/client';

interface NavbarProps {
  project: ProjectOut;
  currentSheet: SheetSummary | null;
  onSelectSheet: (sheetId: string) => void;
  onOpenSpecs: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  project,
  currentSheet,
  onSelectSheet,
  onOpenSpecs,
}) => {
  const navigate = useNavigate();
  const {
    undo,
    redo,
    canUndo,
    canRedo,
    zoomIn,
    zoomOut,
    resetZoom,
    stageScale,
    sheet,
    isDetecting,
    setIsDetecting,
    updateGeometry,
    setSheetTakeoff,
  } = useEditorStore();

  const handleAutoDetect = async () => {
    if (!sheet) return;
    try {
      setIsDetecting(true);
      const res = await api.detectLayout(sheet.id, 'auto', true);
      updateGeometry(res.geometry, true);
      // Refresh live sheet takeoff
      const takeoff = await api.getSheetTakeoff(sheet.id);
      setSheetTakeoff(takeoff);
    } catch (err: any) {
      alert(`Auto-detection error: ${err.message}`);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleExport = () => {
    window.open(api.getProjectExportUrl(project.id), '_blank');
  };

  const isCalibrated = !!sheet?.scale_m_per_px;

  return (
    <header style={{
      height: '56px',
      backgroundColor: '#0F172A',
      color: '#FFFFFF',
      borderBottom: '1px solid #1E293B',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      userSelect: 'none',
      zIndex: 100,
    }}>
      {/* Left: Project & Sheet info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button
          className="btn btn-ghost btn-sm"
          style={{ color: '#94A3B8', padding: '6px' }}
          onClick={() => navigate('/')}
          title="Back to Projects"
        >
          <ChevronLeft size={20} />
        </button>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '15px', color: '#F8FAFC' }}>
              {project.name}
            </span>
            <span className="badge badge-blue" style={{ fontSize: '10px', padding: '2px 6px' }}>
              BESMM4
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#94A3B8' }}>
            {project.location ? `${project.location} • ` : ''}
            {project.client ? `Client: ${project.client}` : 'Taking-off Project'}
          </span>
        </div>

        {/* Sheet Selector */}
        {project.sheets.length > 0 && (
          <div style={{ marginLeft: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={14} color="#94A3B8" />
            <select
              className="select"
              value={currentSheet?.id || ''}
              onChange={(e) => onSelectSheet(e.target.value)}
              style={{
                backgroundColor: '#1E293B',
                color: '#F8FAFC',
                borderColor: '#334155',
                padding: '4px 8px',
                fontSize: '12px',
                width: 'auto',
                minWidth: '130px',
              }}
            >
              {project.sheets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.scale_m_per_px ? '✓' : '(uncalibrated)'}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Scale Status Indicator */}
        {sheet && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: isCalibrated ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            border: `1px solid ${isCalibrated ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
            padding: '3px 10px',
            borderRadius: '9999px',
            fontSize: '11px',
            fontWeight: 500,
            color: isCalibrated ? '#10B981' : '#F59E0B',
          }}>
            <Ruler size={12} />
            <span>
              {isCalibrated
                ? `Scale: 1px = ${(sheet.scale_m_per_px! * 1000).toFixed(1)}mm`
                : 'Scale not set (click Calibrate)'}
            </span>
          </div>
        )}
      </div>

      {/* Center: Undo/Redo & Zoom Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button
          className="btn btn-ghost btn-sm"
          style={{ color: canUndo ? '#F8FAFC' : '#475569' }}
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={16} />
        </button>
        <button
          className="btn btn-ghost btn-sm"
          style={{ color: canRedo ? '#F8FAFC' : '#475569' }}
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 size={16} />
        </button>

        <div style={{ width: '1px', height: '20px', backgroundColor: '#334155', margin: '0 6px' }} />

        <button
          className="btn btn-ghost btn-sm"
          style={{ color: '#CBD5E1' }}
          onClick={zoomOut}
          title="Zoom Out (-)"
        >
          <ZoomOut size={16} />
        </button>
        <span style={{ fontSize: '12px', minWidth: '42px', textAlign: 'center', color: '#94A3B8', fontFamily: 'var(--font-mono)' }}>
          {Math.round(stageScale * 100)}%
        </span>
        <button
          className="btn btn-ghost btn-sm"
          style={{ color: '#CBD5E1' }}
          onClick={zoomIn}
          title="Zoom In (+)"
        >
          <ZoomIn size={16} />
        </button>
        <button
          className="btn btn-ghost btn-sm"
          style={{ color: '#CBD5E1' }}
          onClick={resetZoom}
          title="Fit View"
        >
          <Maximize2 size={15} />
        </button>
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Auto Detect Layout */}
        <button
          className="btn btn-sm"
          onClick={handleAutoDetect}
          disabled={isDetecting || !sheet}
          style={{
            background: 'linear-gradient(135deg, #2563EB 0%, #0D9488 100%)',
            color: '#FFFFFF',
            fontWeight: 600,
            boxShadow: '0 2px 8px rgba(13, 148, 136, 0.25)',
          }}
          title="Automatically detect walls, rooms and openings"
        >
          <Sparkles size={14} className={isDetecting ? 'animate-spin' : ''} />
          <span>{isDetecting ? 'Detecting Layout...' : 'Auto-Detect Layout'}</span>
        </button>

        {/* Project Specs */}
        <button
          className="btn btn-dark btn-sm"
          onClick={onOpenSpecs}
          title="Project Specifications (Heights, Foundation, Finishes)"
        >
          <Settings size={14} />
          <span>Specs</span>
        </button>

        {/* Full Takeoff Sheet */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => navigate(`/projects/${project.id}/takeoff-sheet`)}
          title="View comprehensive Takeoff Dimension Sheet"
        >
          <FileSpreadsheet size={14} color="#2563EB" />
          <span>Dimension Sheet</span>
        </button>

        {/* BESMM4 Bill of Quantities */}
        <button
          className="btn btn-sm"
          onClick={() => navigate(`/projects/${project.id}/boq`)}
          title="Open BESMM4 Bill of Quantities Studio"
          style={{
            backgroundColor: '#1E3A8A',
            color: '#FFFFFF',
            fontWeight: 700,
            boxShadow: '0 2px 8px rgba(30, 58, 138, 0.35)',
            border: '1px solid #3B82F6',
          }}
        >
          <Calculator size={14} color="#93C5FD" />
          <span>BESMM4 BOQ</span>
        </button>

        {/* Export Excel */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleExport}
          title="Export Takeoff to Microsoft Excel (.xlsx)"
        >
          <Download size={14} />
          <span>Export Excel</span>
        </button>
      </div>
    </header>
  );
};
