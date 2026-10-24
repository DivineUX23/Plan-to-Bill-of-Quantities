import React, { useState } from 'react';
import { Ruler, Check, X } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { api } from '../api/client';

interface CalibrateModalProps {
  onCalibrated?: (scale: number) => void;
}

export const CalibrateModal: React.FC<CalibrateModalProps> = ({ onCalibrated }) => {
  const {
    sheet,
    calibP1,
    calibP2,
    setCalibPoints,
    showCalibModal,
    setShowCalibModal,
    setSheet,
    setSheetTakeoff,
  } = useEditorStore();

  const [inputVal, setInputVal] = useState<string>('5.0');
  const [unit, setUnit] = useState<'m' | 'mm' | 'ft'>('m');
  const [loading, setLoading] = useState<boolean>(false);

  if (!showCalibModal || !calibP1 || !calibP2 || !sheet) return null;

  const dx = calibP2[0] - calibP1[0];
  const dy = calibP2[1] - calibP1[1];
  const pixelDist = Math.hypot(dx, dy);

  const handleApply = async () => {
    let meters = parseFloat(inputVal);
    if (isNaN(meters) || meters <= 0) {
      alert('Please enter a valid positive number for distance.');
      return;
    }

    if (unit === 'mm') meters = meters / 1000;
    else if (unit === 'ft') meters = meters * 0.3048;

    try {
      setLoading(true);
      const updatedSheet = await api.calibrateSheet(sheet.id, {
        p1: calibP1,
        p2: calibP2,
        real_length_m: meters,
        label: `${inputVal}${unit}`,
      });
      setSheet(updatedSheet);
      // Refresh live sheet takeoff
      const takeoff = await api.getSheetTakeoff(sheet.id);
      setSheetTakeoff(takeoff);
      setShowCalibModal(false);
      setCalibPoints(null, null);
      if (onCalibrated) onCalibrated(updatedSheet.scale_m_per_px!);
    } catch (err: any) {
      alert(`Calibration failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePresetRatio = async (ratio: number) => {
    // If user selects 1:100 on standard 150 DPI drawing:
    // 1 pt = 1/72 inch = 25.4/72 mm. At 1:100, 1mm on paper = 100mm in reality.
    // Scale m/px = (ratio / 1000) / (render_dpi / 0.0254)
    const dpi = sheet.render_dpi || 150;
    const m_per_px = (ratio / 1000) / (dpi / 0.0254);
    try {
      setLoading(true);
      const updatedSheet = await api.updateSheet(sheet.id, {
        scale_m_per_px: m_per_px,
      });
      setSheet(updatedSheet);
      const takeoff = await api.getSheetTakeoff(sheet.id);
      setSheetTakeoff(takeoff);
      setShowCalibModal(false);
      setCalibPoints(null, null);
      if (onCalibrated) onCalibrated(m_per_px);
    } catch (err: any) {
      alert(`Preset failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Ruler size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '15px' }}>Calibrate Drawing Scale</h3>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setShowCalibModal(false);
              setCalibPoints(null, null);
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            padding: '12px 14px',
            backgroundColor: 'var(--bg-app)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '13px',
          }}>
            <span style={{ color: 'var(--text-muted)' }}>Measured Segment:</span>
            <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
              {pixelDist.toFixed(1)} px
            </span>
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
              Real-World Length of this Segment:
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="input"
                autoFocus
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                style={{ flex: 1, fontSize: '15px', fontWeight: 600 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleApply();
                }}
              />
              <select
                className="select"
                value={unit}
                onChange={(e) => setUnit(e.target.value as any)}
                style={{ width: '90px', fontWeight: 600 }}
              >
                <option value="m">Meters (m)</option>
                <option value="mm">Millimeters</option>
                <option value="ft">Feet (ft)</option>
              </select>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Tip: Pick a clear dimension string, grid line, or known wall segment on the drawing.
            </p>
          </div>

          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
              Or use Standard Drawing Scale Ratio:
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary btn-sm"
                style={{ flex: 1 }}
                onClick={() => handlePresetRatio(50)}
              >
                1 : 50
              </button>
              <button
                className="btn btn-secondary btn-sm"
                style={{ flex: 1 }}
                onClick={() => handlePresetRatio(100)}
              >
                1 : 100
              </button>
              <button
                className="btn btn-secondary btn-sm"
                style={{ flex: 1 }}
                onClick={() => handlePresetRatio(200)}
              >
                1 : 200
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={() => {
              setShowCalibModal(false);
              setCalibPoints(null, null);
            }}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleApply}
            disabled={loading}
          >
            <Check size={16} />
            <span>{loading ? 'Calibrating...' : 'Apply Scale'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
