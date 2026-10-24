import React, { useState } from 'react';
import { Settings, Check, X, Building, Home, Grid, Paintbrush } from 'lucide-react';
import type { ProjectOut, ProjectSpecs } from '../api/types';
import { api } from '../api/client';
import { useEditorStore } from '../store/editorStore';

interface SpecsModalProps {
  project: ProjectOut;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updatedProject: ProjectOut) => void;
}

export const SpecsModal: React.FC<SpecsModalProps> = ({
  project,
  isOpen,
  onClose,
  onSaved,
}) => {
  const { sheet, setSheetTakeoff } = useEditorStore();
  const [specs, setSpecs] = useState<ProjectSpecs>(project.specs);
  const [activeTab, setActiveTab] = useState<'walls' | 'substructure' | 'roof' | 'openings' | 'finishes'>('walls');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleChange = (field: keyof ProjectSpecs, val: any) => {
    setSpecs((prev) => ({ ...prev, [field]: val }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const updated = await api.updateProject(project.id, { specs });
      if (sheet) {
        const takeoff = await api.getSheetTakeoff(sheet.id);
        setSheetTakeoff(takeoff);
      }
      onSaved(updated);
      onClose();
    } catch (err: any) {
      alert(`Failed to save specs: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '15px' }}>Project Measurement Specifications</h3>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-light)',
          backgroundColor: 'var(--bg-app)',
          padding: '0 8px',
        }}>
          {[
            { id: 'walls', label: 'Walls & Heights', icon: <Building size={14} /> },
            { id: 'substructure', label: 'Substructure', icon: <Grid size={14} /> },
            { id: 'roof', label: 'Roofing', icon: <Home size={14} /> },
            { id: 'openings', label: 'Doors / Windows', icon: <Building size={14} /> },
            { id: 'finishes', label: 'Finishes', icon: <Paintbrush size={14} /> },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              style={{
                padding: '10px 12px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                borderBottom: activeTab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === t.id ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {/* Walls Tab */}
          {activeTab === 'walls' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  External Wall Thickness (m)
                </label>
                <input
                  type="number"
                  step="0.025"
                  className="input"
                  value={specs.external_wall_thickness}
                  onChange={(e) => handleChange('external_wall_thickness', parseFloat(e.target.value))}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>e.g. 0.225m (9" blockwork)</span>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Internal Wall Thickness (m)
                </label>
                <input
                  type="number"
                  step="0.025"
                  className="input"
                  value={specs.internal_wall_thickness}
                  onChange={(e) => handleChange('internal_wall_thickness', parseFloat(e.target.value))}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>e.g. 0.150m (6" blockwork)</span>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Wall Height DPC to Plate (m)
                </label>
                <input
                  type="number"
                  step="0.1"
                  className="input"
                  value={specs.wall_height}
                  onChange={(e) => handleChange('wall_height', parseFloat(e.target.value))}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Finished Floor to Ceiling Height (m)
                </label>
                <input
                  type="number"
                  step="0.1"
                  className="input"
                  value={specs.room_height}
                  onChange={(e) => handleChange('room_height', parseFloat(e.target.value))}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Lintel Depth (m)
                </label>
                <input
                  type="number"
                  step="0.025"
                  className="input"
                  value={specs.lintel_depth}
                  onChange={(e) => handleChange('lintel_depth', parseFloat(e.target.value))}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Min Opening Deduction Area (m²)
                </label>
                <input
                  type="number"
                  step="0.1"
                  className="input"
                  value={specs.min_void_deduction}
                  onChange={(e) => handleChange('min_void_deduction', parseFloat(e.target.value))}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>BESMM4 standard: 0.50 m²</span>
              </div>
            </div>
          )}

          {/* Substructure Tab */}
          {activeTab === 'substructure' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Trench Excavation Width (m)
                </label>
                <input
                  type="number"
                  step="0.025"
                  className="input"
                  value={specs.trench_width}
                  onChange={(e) => handleChange('trench_width', parseFloat(e.target.value))}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Trench Excavation Depth (m)
                </label>
                <input
                  type="number"
                  step="0.05"
                  className="input"
                  value={specs.trench_depth}
                  onChange={(e) => handleChange('trench_depth', parseFloat(e.target.value))}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Footing Concrete Thickness (m)
                </label>
                <input
                  type="number"
                  step="0.025"
                  className="input"
                  value={specs.footing_thickness}
                  onChange={(e) => handleChange('footing_thickness', parseFloat(e.target.value))}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Ground to DPC Height (m)
                </label>
                <input
                  type="number"
                  step="0.05"
                  className="input"
                  value={specs.dpc_height}
                  onChange={(e) => handleChange('dpc_height', parseFloat(e.target.value))}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Oversite Slab Concrete (m)
                </label>
                <input
                  type="number"
                  step="0.025"
                  className="input"
                  value={specs.oversite_thickness}
                  onChange={(e) => handleChange('oversite_thickness', parseFloat(e.target.value))}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Hardcore Filling Bed (m)
                </label>
                <input
                  type="number"
                  step="0.025"
                  className="input"
                  value={specs.hardcore_thickness}
                  onChange={(e) => handleChange('hardcore_thickness', parseFloat(e.target.value))}
                />
              </div>
            </div>
          )}

          {/* Roof Tab */}
          {activeTab === 'roof' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Roof Geometry Type
                </label>
                <select
                  className="select"
                  value={specs.roof_type}
                  onChange={(e) => handleChange('roof_type', e.target.value)}
                >
                  <option value="hip">Hip Roof</option>
                  <option value="gable">Gable Roof</option>
                  <option value="flat">Flat Roof / Parapet</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Roof Pitch (Degrees)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="75"
                  className="input"
                  value={specs.roof_pitch_deg}
                  onChange={(e) => handleChange('roof_pitch_deg', parseFloat(e.target.value))}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Eaves Overhang (m)
                </label>
                <input
                  type="number"
                  step="0.05"
                  className="input"
                  value={specs.roof_overhang}
                  onChange={(e) => handleChange('roof_overhang', parseFloat(e.target.value))}
                />
              </div>
            </div>
          )}

          {/* Openings Tab */}
          {activeTab === 'openings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Opening schedule dimensions used for deductions and opening bills:
              </span>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-light)' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>Mark</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>Kind</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>Width (m)</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>Height (m)</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {specs.opening_types.map((ot, idx) => (
                    <tr key={ot.mark} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 700 }}>{ot.mark}</td>
                      <td style={{ padding: '6px 8px', textTransform: 'capitalize' }}>{ot.kind}</td>
                      <td style={{ padding: '6px 8px' }}>
                        <input
                          type="number"
                          step="0.05"
                          className="input"
                          style={{ padding: '3px 6px', width: '70px' }}
                          value={ot.width}
                          onChange={(e) => {
                            const updated = [...specs.opening_types];
                            updated[idx] = { ...updated[idx], width: parseFloat(e.target.value) || 0 };
                            handleChange('opening_types', updated);
                          }}
                        />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <input
                          type="number"
                          step="0.05"
                          className="input"
                          style={{ padding: '3px 6px', width: '70px' }}
                          value={ot.height}
                          onChange={(e) => {
                            const updated = [...specs.opening_types];
                            updated[idx] = { ...updated[idx], height: parseFloat(e.target.value) || 0 };
                            handleChange('opening_types', updated);
                          }}
                        />
                      </td>
                      <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{ot.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Finishes Tab */}
          {activeTab === 'finishes' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Default Floor Finish
                </label>
                <select
                  className="select"
                  value={specs.default_floor_finish}
                  onChange={(e) => handleChange('default_floor_finish', e.target.value)}
                >
                  {(specs.finish_options?.floor || ['Ceramic floor tiles', 'Porcelain floor tiles', 'Terrazzo', 'Cement screed only']).map((f: string) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Default Wall Finish
                </label>
                <select
                  className="select"
                  value={specs.default_wall_finish}
                  onChange={(e) => handleChange('default_wall_finish', e.target.value)}
                >
                  {(specs.finish_options?.wall || ['Plaster & emulsion paint', 'Plaster & wall tiles', 'Plaster & textured paint']).map((f: string) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Default Ceiling Finish
                </label>
                <select
                  className="select"
                  value={specs.default_ceiling_finish}
                  onChange={(e) => handleChange('default_ceiling_finish', e.target.value)}
                >
                  {(specs.finish_options?.ceiling || ['PVC ceiling', 'POP ceiling', 'Asbestos-free ceiling board', 'Plywood ceiling']).map((f: string) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Skirting Height (m)
                </label>
                <input
                  type="number"
                  step="0.025"
                  className="input"
                  value={specs.skirting_height}
                  onChange={(e) => handleChange('skirting_height', parseFloat(e.target.value))}
                />
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Check size={16} />
            <span>{saving ? 'Saving...' : 'Save & Recalculate'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
