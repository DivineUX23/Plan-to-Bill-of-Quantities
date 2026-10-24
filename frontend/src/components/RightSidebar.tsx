import React, { useState } from 'react';
import {
  Calculator,
  Sliders,
  ChevronDown,
  ChevronRight,
  Trash2,
  Layers,
  Info,
} from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import type { ProjectSpecs, SheetGeometry } from '../api/types';
import { api } from '../api/client';

interface RightSidebarProps {
  specs: ProjectSpecs;
  onRefreshTakeoff?: () => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({ specs }) => {
  const [activeTab, setActiveTab] = useState<'takeoff' | 'inspector'>('takeoff');
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const {
    sheet,
    sheetTakeoff,
    selectedId,
    selectedKind,
    updateGeometry,
    deleteSelected,
    setSheetTakeoff,
  } = useEditorStore();

  const toggleExpand = (key: string) => {
    setExpandedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedWall =
    selectedKind === 'wall'
      ? sheet?.geometry.walls.find((w) => w.id === selectedId)
      : null;

  const selectedRoom =
    selectedKind === 'room'
      ? sheet?.geometry.rooms.find((r) => r.id === selectedId)
      : null;

  const selectedOpening =
    selectedKind === 'opening'
      ? sheet?.geometry.openings.find((o) => o.id === selectedId)
      : null;

  const syncGeometry = async (geom: SheetGeometry) => {
    if (!sheet) return;
    updateGeometry(geom, true);
    try {
      await api.updateSheet(sheet.id, { geometry: geom });
      const t = await api.getSheetTakeoff(sheet.id);
      setSheetTakeoff(t);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <aside style={{
      width: '320px',
      backgroundColor: '#FFFFFF',
      borderLeft: '1px solid var(--border-light)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      zIndex: 10,
      boxShadow: 'var(--shadow-sm)',
    }}>
      {/* Sidebar Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-light)',
        backgroundColor: 'var(--bg-app)',
      }}>
        <button
          onClick={() => setActiveTab('takeoff')}
          style={{
            flex: 1,
            padding: '12px 14px',
            fontSize: '13px',
            fontWeight: 600,
            border: 'none',
            borderBottom: activeTab === 'takeoff' ? '2px solid var(--primary)' : '2px solid transparent',
            backgroundColor: activeTab === 'takeoff' ? '#FFFFFF' : 'transparent',
            color: activeTab === 'takeoff' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
          }}
        >
          <Calculator size={16} />
          <span>Live Quantities</span>
        </button>

        <button
          onClick={() => setActiveTab('inspector')}
          style={{
            flex: 1,
            padding: '12px 14px',
            fontSize: '13px',
            fontWeight: 600,
            border: 'none',
            borderBottom: activeTab === 'inspector' ? '2px solid var(--primary)' : '2px solid transparent',
            backgroundColor: activeTab === 'inspector' ? '#FFFFFF' : 'transparent',
            color: activeTab === 'inspector' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
          }}
        >
          <Sliders size={16} />
          <span>Inspector</span>
          {selectedId && (
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary)',
            }} />
          )}
        </button>
      </div>

      {/* Tab 1: Live Takeoff Quantities */}
      {activeTab === 'takeoff' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {!sheet?.scale_m_per_px ? (
            <div style={{
              padding: '16px',
              backgroundColor: '#FEF3C7',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #FDE68A',
              color: '#92400E',
              fontSize: '12px',
              lineHeight: 1.5,
            }}>
              <strong>Scale not set.</strong>
              <p style={{ marginTop: '4px' }}>
                Use the <strong>Calibrate (C)</strong> tool on the toolbar to set the drawing scale and view live quantities.
              </p>
            </div>
          ) : !sheetTakeoff || sheetTakeoff.groups.length === 0 ? (
            <div style={{
              padding: '30px 20px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '13px',
            }}>
              <Layers size={32} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
              <p style={{ fontWeight: 500 }}>No elements measured yet.</p>
              <p style={{ fontSize: '12px', marginTop: '4px' }}>
                Click <strong>Auto-Detect Layout</strong> or trace walls to generate bill quantities.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {sheetTakeoff.groups.map((group) => (
                <div key={group.key} style={{
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                }}>
                  {/* Group Header */}
                  <div style={{
                    padding: '8px 12px',
                    backgroundColor: 'var(--bg-app)',
                    borderBottom: '1px solid var(--border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-main)', letterSpacing: '0.05em' }}>
                      {group.title}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {group.items.length} items
                    </span>
                  </div>

                  {/* Group Items */}
                  <div>
                    {group.items.map((item) => {
                      const isExpanded = expandedItems[item.key];
                      return (
                        <div key={item.key} style={{
                          borderBottom: '1px solid var(--border-light)',
                          fontSize: '12px',
                        }}>
                          <div
                            onClick={() => toggleExpand(item.key)}
                            style={{
                              padding: '8px 12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: item.trace.length > 0 ? 'pointer' : 'default',
                              backgroundColor: isExpanded ? '#F8FAFC' : '#FFFFFF',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, paddingRight: '8px' }}>
                              {item.trace.length > 0 && (
                                <span style={{ color: 'var(--text-muted)' }}>
                                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </span>
                              )}
                              <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>
                                {item.description}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>
                                {item.quantity.toLocaleString(undefined, { minimumFractionDigits: item.unit === 'nr' ? 0 : 2 })}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {item.unit}
                              </span>
                            </div>
                          </div>

                          {/* Audit Calculation Trace */}
                          {isExpanded && item.trace.length > 0 && (
                            <div style={{
                              padding: '8px 12px 10px 28px',
                              backgroundColor: '#F8FAFC',
                              borderTop: '1px dashed var(--border-light)',
                              fontSize: '11px',
                              color: 'var(--text-muted)',
                              fontFamily: 'var(--font-mono)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', fontWeight: 600 }}>
                                <Info size={11} />
                                <span>Dimension Sheet Calculation Trace:</span>
                              </div>
                              {item.trace.map((tr, idx) => (
                                <div key={idx} style={{ paddingLeft: '8px', borderLeft: '2px solid var(--border-medium)' }}>
                                  {tr}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Selected Element Inspector */}
      {activeTab === 'inspector' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {!selectedId ? (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '13px',
            }}>
              <Sliders size={32} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
              <p style={{ fontWeight: 500 }}>No element selected.</p>
              <p style={{ fontSize: '12px', marginTop: '4px' }}>
                Click on any wall, room polygon, or opening on the canvas to inspect and edit its properties.
              </p>
            </div>
          ) : selectedWall ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: '14px' }}>Wall Inspector</span>
                <span className="badge badge-slate">{selectedWall.id}</span>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Wall Classification
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className={`btn btn-sm ${selectedWall.kind === 'external' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                    onClick={() => {
                      if (!sheet) return;
                      const updated = {
                        ...sheet.geometry,
                        walls: sheet.geometry.walls.map((w) =>
                          w.id === selectedWall.id ? { ...w, kind: 'external' as const } : w
                        ),
                      };
                      syncGeometry(updated);
                    }}
                  >
                    External Wall
                  </button>
                  <button
                    className={`btn btn-sm ${selectedWall.kind === 'internal' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                    onClick={() => {
                      if (!sheet) return;
                      const updated = {
                        ...sheet.geometry,
                        walls: sheet.geometry.walls.map((w) =>
                          w.id === selectedWall.id ? { ...w, kind: 'internal' as const } : w
                        ),
                      };
                      syncGeometry(updated);
                    }}
                  >
                    Internal Wall
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Thickness Override (m)
                </label>
                <input
                  type="number"
                  step="0.025"
                  className="input"
                  value={selectedWall.thickness || (selectedWall.kind === 'external' ? specs.external_wall_thickness : specs.internal_wall_thickness)}
                  onChange={(e) => {
                    if (!sheet) return;
                    const val = parseFloat(e.target.value);
                    const updated = {
                      ...sheet.geometry,
                      walls: sheet.geometry.walls.map((w) =>
                        w.id === selectedWall.id ? { ...w, thickness: isNaN(val) ? undefined : val } : w
                      ),
                    };
                    syncGeometry(updated);
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Height Override (m)
                </label>
                <input
                  type="number"
                  step="0.1"
                  className="input"
                  value={selectedWall.height || specs.wall_height}
                  onChange={(e) => {
                    if (!sheet) return;
                    const val = parseFloat(e.target.value);
                    const updated = {
                      ...sheet.geometry,
                      walls: sheet.geometry.walls.map((w) =>
                        w.id === selectedWall.id ? { ...w, height: isNaN(val) ? undefined : val } : w
                      ),
                    };
                    syncGeometry(updated);
                  }}
                />
              </div>

              <button
                className="btn btn-danger btn-sm"
                onClick={deleteSelected}
                style={{ marginTop: '10px' }}
              >
                <Trash2 size={14} />
                <span>Delete Wall</span>
              </button>
            </div>
          ) : selectedRoom ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: '14px' }}>Room Inspector</span>
                <span className="badge badge-blue">{selectedRoom.id}</span>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Room Name
                </label>
                <input
                  type="text"
                  className="input"
                  value={selectedRoom.name}
                  onChange={(e) => {
                    if (!sheet) return;
                    const updated = {
                      ...sheet.geometry,
                      rooms: sheet.geometry.rooms.map((r) =>
                        r.id === selectedRoom.id ? { ...r, name: e.target.value } : r
                      ),
                    };
                    syncGeometry(updated);
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Floor Finish
                </label>
                <select
                  className="select"
                  value={selectedRoom.floor_finish || specs.default_floor_finish}
                  onChange={(e) => {
                    if (!sheet) return;
                    const updated = {
                      ...sheet.geometry,
                      rooms: sheet.geometry.rooms.map((r) =>
                        r.id === selectedRoom.id ? { ...r, floor_finish: e.target.value } : r
                      ),
                    };
                    syncGeometry(updated);
                  }}
                >
                  {(specs.finish_options?.floor || ['Ceramic floor tiles', 'Porcelain floor tiles', 'Terrazzo', 'Cement screed only']).map((f: string) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Wall Finish
                </label>
                <select
                  className="select"
                  value={selectedRoom.wall_finish || specs.default_wall_finish}
                  onChange={(e) => {
                    if (!sheet) return;
                    const updated = {
                      ...sheet.geometry,
                      rooms: sheet.geometry.rooms.map((r) =>
                        r.id === selectedRoom.id ? { ...r, wall_finish: e.target.value } : r
                      ),
                    };
                    syncGeometry(updated);
                  }}
                >
                  {(specs.finish_options?.wall || ['Plaster & emulsion paint', 'Plaster & wall tiles', 'Plaster & textured paint']).map((f: string) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Ceiling Finish
                </label>
                <select
                  className="select"
                  value={selectedRoom.ceiling_finish || specs.default_ceiling_finish}
                  onChange={(e) => {
                    if (!sheet) return;
                    const updated = {
                      ...sheet.geometry,
                      rooms: sheet.geometry.rooms.map((r) =>
                        r.id === selectedRoom.id ? { ...r, ceiling_finish: e.target.value } : r
                      ),
                    };
                    syncGeometry(updated);
                  }}
                >
                  {(specs.finish_options?.ceiling || ['PVC ceiling', 'POP ceiling', 'Asbestos-free ceiling board', 'Plywood ceiling']).map((f: string) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <button
                className="btn btn-danger btn-sm"
                onClick={deleteSelected}
                style={{ marginTop: '10px' }}
              >
                <Trash2 size={14} />
                <span>Delete Room</span>
              </button>
            </div>
          ) : selectedOpening ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: '14px' }}>Opening Inspector</span>
                <span className="badge badge-amber">{selectedOpening.id}</span>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Opening Schedule Type
                </label>
                <select
                  className="select"
                  value={selectedOpening.type}
                  onChange={(e) => {
                    if (!sheet) return;
                    const updated = {
                      ...sheet.geometry,
                      openings: sheet.geometry.openings.map((o) =>
                        o.id === selectedOpening.id ? { ...o, type: e.target.value } : o
                      ),
                    };
                    syncGeometry(updated);
                  }}
                >
                  {specs.opening_types.map((ot) => (
                    <option key={ot.mark} value={ot.mark}>
                      {ot.mark} - {ot.description} ({(ot.width * 1000).toFixed(0)} × {(ot.height * 1000).toFixed(0)}mm)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Count
                </label>
                <input
                  type="number"
                  min="1"
                  className="input"
                  value={selectedOpening.count}
                  onChange={(e) => {
                    if (!sheet) return;
                    const val = parseInt(e.target.value, 10);
                    const updated = {
                      ...sheet.geometry,
                      openings: sheet.geometry.openings.map((o) =>
                        o.id === selectedOpening.id ? { ...o, count: Math.max(1, isNaN(val) ? 1 : val) } : o
                      ),
                    };
                    syncGeometry(updated);
                  }}
                />
              </div>

              <button
                className="btn btn-danger btn-sm"
                onClick={deleteSelected}
                style={{ marginTop: '10px' }}
              >
                <Trash2 size={14} />
                <span>Delete Opening</span>
              </button>
            </div>
          ) : null}
        </div>
      )}
    </aside>
  );
};
