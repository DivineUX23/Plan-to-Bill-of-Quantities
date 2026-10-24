import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Info,
  Square,
  DoorOpen,
  AppWindow,
  Ruler,
  Spline,
  Move,
  Layers,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { useEditorStore } from '../store/editorStore';

export const PlanLegend: React.FC = () => {
  const { sheet, showHeroLegend, toggleHeroLegend } = useEditorStore();
  const [expandedDetails, setExpandedDetails] = useState(false);

  if (!showHeroLegend) {
    return (
      <button
        onClick={toggleHeroLegend}
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          zIndex: 20,
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          color: '#F8FAFC',
          borderRadius: '9999px',
          padding: '6px 14px',
          fontSize: '12px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.95)';
          e.currentTarget.style.borderColor = '#38BDF8';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.9)';
          e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.4)';
        }}
      >
        <Sparkles size={14} color="#38BDF8" />
        <span>Plan Legend & Colors</span>
        <ChevronDown size={14} />
      </button>
    );
  }

  // Calculate element counts for quick summary
  const extWalls = sheet?.geometry.walls.filter((w) => w.kind === 'external') || [];
  const intWalls = sheet?.geometry.walls.filter((w) => w.kind === 'internal') || [];
  const rooms = sheet?.geometry.rooms || [];
  const doors = sheet?.geometry.openings.filter((o) => o.type.startsWith('D')) || [];
  const windows = sheet?.geometry.openings.filter((o) => o.type.startsWith('W')) || [];

  const legendItems = [
    {
      color: '#10B981',
      bg: 'rgba(16, 185, 129, 0.18)',
      border: 'rgba(16, 185, 129, 0.6)',
      title: 'External Walls',
      spec: '225mm (9") Sandcrete Blockwork',
      desc: 'Outer envelope girth. Feeds Trench Excavation, Foundation Footing Concrete & Superstructure blockwork.',
      count: `${extWalls.length} wall${extWalls.length === 1 ? '' : 's'}`,
      icon: <Square size={13} color="#10B981" />,
      shortcut: 'E',
    },
    {
      color: '#F59E0B',
      bg: 'rgba(245, 158, 11, 0.18)',
      border: 'rgba(245, 158, 11, 0.6)',
      title: 'Internal Partitions',
      spec: '150mm (6") Sandcrete Blockwork',
      desc: 'Interior dividing walls. Centerline net lengths deduct abutting thicknesses at T/cross junctions.',
      count: `${intWalls.length} wall${intWalls.length === 1 ? '' : 's'}`,
      icon: <Spline size={13} color="#F59E0B" />,
      shortcut: 'I',
    },
    {
      color: '#0EA5E9',
      bg: 'rgba(14, 165, 233, 0.18)',
      border: 'rgba(14, 165, 233, 0.6)',
      title: 'Rooms / Spaces',
      spec: 'Enclosed Floor Polygon (m²)',
      desc: 'Computes floor screed, ceramic tiling, plaster of Paris/ceiling, and room perimeter skirting.',
      count: `${rooms.length} room${rooms.length === 1 ? '' : 's'}`,
      icon: <Layers size={13} color="#0EA5E9" />,
      shortcut: 'R',
    },
    {
      color: '#8B5CF6',
      bg: 'rgba(139, 92, 246, 0.18)',
      border: 'rgba(139, 92, 246, 0.6)',
      title: 'Door Openings',
      spec: 'D1, D2 Standard Doors',
      desc: 'Automatic void deduction from wall blockwork, plaster & paint. Added to Bill 3 Doors schedule.',
      count: `${doors.length} door${doors.length === 1 ? '' : 's'}`,
      icon: <DoorOpen size={13} color="#8B5CF6" />,
      shortcut: 'D',
    },
    {
      color: '#EC4899',
      bg: 'rgba(236, 72, 153, 0.18)',
      border: 'rgba(236, 72, 153, 0.6)',
      title: 'Window Openings',
      spec: 'W1, W2 Glazed Windows',
      desc: 'Deducted from wall blockwork and finishes. Added to Bill 3 Windows & Glazing schedule.',
      count: `${windows.length} window${windows.length === 1 ? '' : 's'}`,
      icon: <AppWindow size={13} color="#EC4899" />,
      shortcut: 'W',
    },
    {
      color: '#38BDF8',
      bg: 'rgba(56, 189, 248, 0.18)',
      border: 'rgba(56, 189, 248, 0.6)',
      title: 'Drag Handles & Nodes',
      spec: 'Interactive Vertices',
      desc: 'Drag whole walls or individual corner handles to stretch or relocate geometry with magnetic snap.',
      count: 'Active in Select (V)',
      icon: <Move size={13} color="#38BDF8" />,
      shortcut: 'V',
    },
    {
      color: '#EF4444',
      bg: 'rgba(239, 68, 68, 0.18)',
      border: 'rgba(239, 68, 68, 0.6)',
      title: 'Calibration Scale',
      spec: 'Metric 1px = mm ratio',
      desc: 'Ground-truth architectural distance calibration between 2 known points or architectural presets.',
      count: sheet?.scale_m_per_px ? `1px = ${(sheet.scale_m_per_px * 1000).toFixed(1)}mm` : 'Not calibrated',
      icon: <Ruler size={13} color="#EF4444" />,
      shortcut: 'C',
    },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        top: '12px',
        left: '12px',
        zIndex: 20,
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.14)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
        color: '#F8FAFC',
        width: expandedDetails ? '380px' : 'auto',
        maxWidth: '90vw',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: expandedDetails ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
          backgroundColor: 'rgba(30, 41, 59, 0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10B981',
              boxShadow: '0 0 8px #10B981',
            }}
          />
          <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.02em', color: '#F1F5F9' }}>
            Plan Visual Guide & Legend
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setExpandedDetails(!expandedDetails)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              padding: '2px 6px',
              borderRadius: '4px',
            }}
            title={expandedDetails ? 'Collapse Guide' : 'Expand Details & Descriptions'}
          >
            <HelpCircle size={13} color="#38BDF8" />
            <span>{expandedDetails ? 'Less' : 'Details'}</span>
            {expandedDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          <button
            onClick={toggleHeroLegend}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748B',
              cursor: 'pointer',
              fontSize: '13px',
              padding: '2px 4px',
              lineHeight: 1,
            }}
            title="Minimize Legend"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Compact Horizontal Chip Bar (when not expanded) */}
      {!expandedDetails && (
        <div
          style={{
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          {legendItems.slice(0, 5).map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: item.bg,
                border: `1px solid ${item.border}`,
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '11px',
              }}
              title={`${item.title} (${item.spec}) - Shortcut [${item.shortcut}]`}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '2px',
                  backgroundColor: item.color,
                }}
              />
              <span style={{ fontWeight: 600, color: '#F8FAFC' }}>{item.title}</span>
              <span style={{ fontSize: '10px', color: '#CBD5E1', opacity: 0.85 }}>({item.count})</span>
            </div>
          ))}

          <button
            onClick={() => setExpandedDetails(true)}
            style={{
              background: 'transparent',
              border: '1px dashed rgba(255, 255, 255, 0.25)',
              color: '#38BDF8',
              borderRadius: '6px',
              padding: '3px 8px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            + All Symbols
          </button>
        </div>
      )}

      {/* Expanded Full Details */}
      {expandedDetails && (
        <div
          style={{
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            maxHeight: '440px',
            overflowY: 'auto',
          }}
        >
          {legendItems.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                gap: '10px',
                padding: '8px 10px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${item.border}`,
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  backgroundColor: item.bg,
                  border: `1px solid ${item.color}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '2px',
                }}
              >
                {item.icon}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF' }}>
                    {item.title}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '9px',
                        padding: '1px 5px',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '3px',
                        fontFamily: 'monospace',
                        color: '#94A3B8',
                      }}
                    >
                      Key: {item.shortcut}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: item.color }}>
                      {item.count}
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: '11px', fontWeight: 500, color: '#CBD5E1', marginBottom: '3px' }}>
                  {item.spec}
                </p>
                <p style={{ fontSize: '10px', color: '#94A3B8', lineHeight: 1.4, margin: 0 }}>
                  {item.desc}
                </p>
              </div>
            </div>
          ))}

          {/* Quick Interaction Tips */}
          <div
            style={{
              marginTop: '4px',
              padding: '10px',
              backgroundColor: 'rgba(37, 99, 235, 0.12)',
              border: '1px solid rgba(37, 99, 235, 0.3)',
              borderRadius: '8px',
              fontSize: '11px',
              color: '#93C5FD',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
              <Info size={14} color="#60A5FA" />
              <span>Canvas Pro Tips</span>
            </div>
            <div style={{ fontSize: '10px', color: '#BFDBFE', lineHeight: 1.4 }}>
              • <strong>Drag Whole Walls & Rooms</strong>: Click and drag any wall or room in Select (V) mode to move it.
              <br />
              • <strong>Spacebar / Middle Click</strong>: Hold Space or Middle-click to pan freely anywhere across the plan.
              <br />
              • <strong>Orthogonal (Shift)</strong>: Hold Shift to snap wall lines straight.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
