import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Printer,
  ChevronDown,
  ChevronRight,
  Info,
  Calculator,
} from 'lucide-react';
import { api } from '../api/client';
import type { ProjectOut, Takeoff } from '../api/types';

export const TakeoffSummaryPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectOut | null>(null);
  const [takeoff, setTakeoff] = useState<Takeoff | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState<string>('all');
  const [expandedAll, setExpandedAll] = useState(true);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loadData = async () => {
      if (!projectId) return;
      try {
        setLoading(true);
        const p = await api.getProject(projectId);
        setProject(p);
        const t = await api.getProjectTakeoff(projectId);
        setTakeoff(t);
        // Expand all traces by default
        const initial: Record<string, boolean> = {};
        t.groups.forEach((g) => g.items.forEach((i) => (initial[i.key] = true)));
        setExpandedKeys(initial);
      } catch (err: any) {
        alert(`Failed to load takeoff summary: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [projectId]);

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleToggleExpandAll = () => {
    if (!takeoff) return;
    const nextState = !expandedAll;
    setExpandedAll(nextState);
    const updated: Record<string, boolean> = {};
    takeoff.groups.forEach((g) => g.items.forEach((i) => (updated[i.key] = nextState)));
    setExpandedKeys(updated);
  };

  if (loading || !project || !takeoff) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Loading Takeoff Summary...
      </div>
    );
  }

  const filteredGroups =
    activeGroup === 'all'
      ? takeoff.groups
      : takeoff.groups.filter((g) => g.key === activeGroup);

  return (
    <div style={{ minHeight: '100%', backgroundColor: 'var(--bg-app)', display: 'flex', flexDirection: 'column' }}>
      {/* Header bar */}
      <header style={{
        backgroundColor: '#0F172A',
        color: '#FFFFFF',
        padding: '16px 36px',
        borderBottom: '1px solid #1E293B',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: '#94A3B8' }}
            onClick={() => navigate(`/projects/${project.id}`)}
          >
            <ArrowLeft size={18} />
            <span>Studio</span>
          </button>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#F8FAFC' }}>
              {project.name} — Dimension Sheet
            </h1>
            <p style={{ fontSize: '12px', color: '#94A3B8' }}>
              BESMM4 Measurement Summary & Audit Calculation Traces
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleToggleExpandAll}>
            {expandedAll ? 'Collapse Traces' : 'Expand All Traces'}
          </button>

          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
            <Printer size={15} />
            <span>Print Sheet</span>
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate(`/projects/${project.id}/boq`)}
            style={{
              backgroundColor: '#1E3A8A',
              borderColor: '#3B82F6',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
            }}
          >
            <Calculator size={15} color="#93C5FD" />
            <span>Proceed to BESMM4 BOQ →</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => window.open(api.getProjectExportUrl(project.id), '_blank')}
          >
            <Download size={15} />
            <span>Export Takeoff (.xlsx)</span>
          </button>
        </div>
      </header>

      {/* Main dimension sheet table */}
      <main style={{ flex: 1, padding: '32px 36px', maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
        {/* Filter pills */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${activeGroup === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveGroup('all')}
          >
            All Elements
          </button>
          {takeoff.groups.map((g) => (
            <button
              key={g.key}
              className={`btn btn-sm ${activeGroup === g.key ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveGroup(g.key)}
            >
              {g.title}
            </button>
          ))}
        </div>

        {/* Quantities Table */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
        }}>
          {filteredGroups.map((group) => (
            <div key={group.key} style={{ borderBottom: '2px solid var(--border-light)' }}>
              {/* Group Title Row */}
              <div style={{
                padding: '12px 20px',
                backgroundColor: 'var(--primary-subtle)',
                borderBottom: '1px solid var(--primary-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--primary-hover)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {group.title}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)' }}>
                  {group.items.length} items
                </span>
              </div>

              {/* Items List */}
              <div>
                {group.items.map((item, idx) => {
                  const isExpanded = expandedKeys[item.key];
                  return (
                    <div key={item.key} style={{
                      borderBottom: idx === group.items.length - 1 ? 'none' : '1px solid var(--border-light)',
                    }}>
                      <div
                        onClick={() => toggleExpand(item.key)}
                        style={{
                          padding: '14px 20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: item.trace.length > 0 ? 'pointer' : 'default',
                          backgroundColor: isExpanded ? '#FAFBFD' : '#FFFFFF',
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, paddingRight: '20px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>
                            {item.trace.length > 0 && (isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                            {item.description}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '130px', justifyContent: 'flex-end' }}>
                          <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>
                            {item.quantity.toLocaleString(undefined, { minimumFractionDigits: item.unit === 'nr' ? 0 : 2 })}
                          </span>
                          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', width: '28px' }}>
                            {item.unit}
                          </span>
                        </div>
                      </div>

                      {/* Expanded calculation trace */}
                      {isExpanded && item.trace.length > 0 && (
                        <div style={{
                          padding: '10px 20px 14px 46px',
                          backgroundColor: '#F8FAFC',
                          borderTop: '1px dashed var(--border-light)',
                          fontSize: '12px',
                          color: '#475569',
                          fontFamily: 'var(--font-mono)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontWeight: 600, fontSize: '11px' }}>
                            <Info size={13} />
                            <span>Digital Dimension Sheet Audit Trace:</span>
                          </div>
                          {item.trace.map((tr, tIdx) => (
                            <div key={tIdx} style={{
                              paddingLeft: '10px',
                              borderLeft: '2px solid var(--border-medium)',
                              lineHeight: 1.5,
                            }}>
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
      </main>
    </div>
  );
};
