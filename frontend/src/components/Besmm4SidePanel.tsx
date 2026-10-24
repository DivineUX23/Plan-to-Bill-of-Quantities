import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  ExternalLink,
  Maximize2,
  Minimize2,
  X,
  ChevronDown,
  ChevronUp,
  Check,
  Copy,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { api } from '../api/client';
import type { Besmm4Reference } from '../api/types';

interface Besmm4SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  code: string;
  itemDescription?: string;
  onCodeChange?: (newCode: string) => void;
}

export const Besmm4SidePanel: React.FC<Besmm4SidePanelProps> = ({
  isOpen,
  onClose,
  code,
  itemDescription,
  onCodeChange,
}) => {
  const [refData, setRefData] = useState<Besmm4Reference | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(179);
  const [inputPage, setInputPage] = useState<string>('179');
  const [isMaximized, setIsMaximized] = useState(false);
  const [showSummary, setShowSummary] = useState(true);
  const [copied, setCopied] = useState(false);
  const [editableCode, setEditableCode] = useState(code);

  // Fetch reference metadata whenever code changes or panel opens
  useEffect(() => {
    if (!isOpen || !code) return;
    setEditableCode(code);
    let isMounted = true;
    const fetchRef = async () => {
      try {
        setLoading(true);
        const data = await api.getBesmm4Reference(code);
        if (isMounted) {
          setRefData(data);
          const targetPage = data.tabulated_page || data.page || 179;
          setCurrentPage(targetPage);
          setInputPage(String(targetPage));
        }
      } catch (err) {
        console.error('Failed to load BESMM4 reference:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchRef();
    return () => {
      isMounted = false;
    };
  }, [isOpen, code]);

  if (!isOpen) return null;

  const pdfUrl = api.getBesmm4PdfUrl(currentPage);

  const handleJumpPage = (p: number) => {
    const valid = Math.max(1, Math.min(509, p));
    setCurrentPage(valid);
    setInputPage(String(valid));
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(editableCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleCodeSubmit = () => {
    if (onCodeChange && editableCode.trim()) {
      onCodeChange(editableCode.trim());
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: isMaximized ? '85vw' : '580px',
        maxWidth: '100vw',
        backgroundColor: '#FFFFFF',
        boxShadow: '-8px 0 24px rgba(15, 23, 42, 0.2)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        borderLeft: '1px solid #CBD5E1',
      }}
    >
      {/* 1. TOP HEADER BANNER */}
      <div
        style={{
          backgroundColor: '#0F172A',
          color: '#FFFFFF',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #1E293B',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: '#1E3A8A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#60A5FA',
            }}
          >
            <BookOpen size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '-0.01em' }}>
                NIQS BESMM4 Reference
              </span>
              <span
                style={{
                  fontSize: '10px',
                  backgroundColor: '#1E293B',
                  color: '#93C5FD',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 700,
                }}
              >
                Rule 1.14.02
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
              {refData?.section_title ? `Section: ${refData.section_title}` : 'Standard Method of Measurement 4th Edition'}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <a
            href={api.getBesmm4PdfUrl(currentPage)}
            target="_blank"
            rel="noopener noreferrer"
            title="Open PDF in new window / full tab"
            style={{
              background: '#1E293B',
              color: '#CBD5E1',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 8px',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            <ExternalLink size={14} />
          </a>

          <button
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? 'Restore standard width' : 'Expand panel width'}
            style={{
              background: '#1E293B',
              color: '#CBD5E1',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 8px',
              cursor: 'pointer',
            }}
          >
            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          <button
            onClick={onClose}
            title="Close Reference Panel"
            style={{
              background: '#334155',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 8px',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* 2. CODE BAR & QUICK JUMP SHORTCUTS */}
      <div
        style={{
          backgroundColor: '#F8FAFC',
          padding: '10px 18px',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        {/* Code Input & Copy */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Code:</span>
          <input
            type="text"
            value={editableCode}
            onChange={(e) => setEditableCode(e.target.value)}
            onBlur={handleCodeSubmit}
            onKeyDown={(e) => e.key === 'Enter' && handleCodeSubmit()}
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: '12px',
              fontWeight: 800,
              backgroundColor: '#EFF6FF',
              color: '#1E40AF',
              border: '1px solid #BFDBFE',
              borderRadius: '4px',
              padding: '3px 8px',
              width: '105px',
              textAlign: 'center',
            }}
          />
          <button
            onClick={handleCopyCode}
            title="Copy code"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: copied ? '#10B981' : '#64748B',
              padding: '4px',
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>

        {/* Quick Page Jump Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={() => handleJumpPage(refData?.tabulated_page || refData?.page || 179)}
            style={{
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor: currentPage === (refData?.tabulated_page || refData?.page) ? '#1E3A8A' : '#FFFFFF',
              color: currentPage === (refData?.tabulated_page || refData?.page) ? '#FFFFFF' : '#1E3A8A',
              border: '1px solid #BFDBFE',
              borderRadius: '4px',
              padding: '3px 8px',
              cursor: 'pointer',
            }}
          >
            Section Table (P{refData?.tabulated_page || refData?.page || 179})
          </button>

          <button
            onClick={() => handleJumpPage(20)}
            style={{
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor: currentPage === 20 ? '#1E3A8A' : '#FFFFFF',
              color: currentPage === 20 ? '#FFFFFF' : '#475569',
              border: '1px solid #CBD5E1',
              borderRadius: '4px',
              padding: '3px 8px',
              cursor: 'pointer',
            }}
          >
            Coding Rules (P20)
          </button>

          <button
            onClick={() => handleJumpPage(4)}
            style={{
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor: currentPage === 4 ? '#1E3A8A' : '#FFFFFF',
              color: currentPage === 4 ? '#FFFFFF' : '#475569',
              border: '1px solid #CBD5E1',
              borderRadius: '4px',
              padding: '3px 8px',
              cursor: 'pointer',
            }}
          >
            TOC (P4)
          </button>

          {/* Direct Page Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: '#64748B' }}>P:</span>
            <input
              type="number"
              min={1}
              max={509}
              value={inputPage}
              onChange={(e) => setInputPage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJumpPage(parseInt(inputPage) || 1)}
              style={{
                width: '45px',
                fontSize: '11px',
                padding: '2px 4px',
                borderRadius: '4px',
                border: '1px solid #CBD5E1',
                textAlign: 'center',
              }}
            />
            <button
              onClick={() => handleJumpPage(parseInt(inputPage) || 1)}
              style={{
                fontSize: '11px',
                fontWeight: 600,
                backgroundColor: '#2563EB',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '4px',
                padding: '3px 6px',
                cursor: 'pointer',
              }}
            >
              Go
            </button>
          </div>
        </div>
      </div>

      {/* 3. COLLAPSIBLE CLAUSE & MEASUREMENT RULES CARD */}
      <div style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
        <button
          onClick={() => setShowSummary(!showSummary)}
          style={{
            width: '100%',
            padding: '8px 18px',
            background: 'none',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 700,
            color: '#1E3A8A',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={13} color="#2563EB" />
            <span>Clause 1.14.02 Structure & NIQS Measurement Rules</span>
          </div>
          {showSummary ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showSummary && refData && (
          <div style={{ padding: '0 18px 12px 18px', fontSize: '11px', color: '#334155' }}>
            {itemDescription && (
              <div
                style={{
                  backgroundColor: '#F1F5F9',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  marginBottom: '8px',
                  fontSize: '11px',
                  color: '#0F172A',
                  borderLeft: '3px solid #2563EB',
                }}
              >
                <strong>Bill Item:</strong> {itemDescription}
              </div>
            )}

            {/* Division Breakdown Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '6px',
                marginBottom: '10px',
              }}
            >
              <div style={{ backgroundColor: '#EFF6FF', padding: '6px', borderRadius: '4px', border: '1px solid #DBEAFE' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase' }}>Section</div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#1E3A8A' }}>
                  {refData.work_section_code} {refData.section_title}
                </div>
              </div>
              <div style={{ backgroundColor: '#F8FAFC', padding: '6px', borderRadius: '4px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>1st Column</div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#0F172A' }}>{refData.divisions.col1}</div>
              </div>
              <div style={{ backgroundColor: '#F8FAFC', padding: '6px', borderRadius: '4px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>2nd Column</div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#0F172A' }}>{refData.divisions.col2}</div>
              </div>
              <div style={{ backgroundColor: '#F8FAFC', padding: '6px', borderRadius: '4px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>3rd Column</div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#0F172A' }}>{refData.divisions.col3}</div>
              </div>
            </div>

            {/* Specific Rules Bullets */}
            <div style={{ backgroundColor: '#FAF5FF', border: '1px solid #E9D5FF', borderRadius: '6px', padding: '8px 10px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#7E22CE', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <HelpCircle size={12} />
                <span>Key Measurement & Deduction Rules:</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: '16px', lineHeight: 1.4, color: '#581C87' }}>
                {refData.measurement_rules.map((r, i) => (
                  <li key={i} style={{ marginBottom: '3px' }}>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* 4. EMBEDDED PDF VIEWER IFRAME */}
      <div style={{ flex: 1, position: 'relative', backgroundColor: '#E2E8F0' }}>
        {loading && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              fontSize: '12px',
              fontWeight: 600,
              color: '#1E3A8A',
            }}
          >
            Loading BESMM4 PDF (Page {currentPage})...
          </div>
        )}

        <iframe
          key={`besmm4-pdf-${currentPage}`}
          src={pdfUrl}
          title="NIQS BESMM4 PDF Document"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
          }}
        />
      </div>

      {/* 5. BOTTOM STATUS BAR */}
      <div
        style={{
          padding: '6px 14px',
          backgroundColor: '#0F172A',
          color: '#94A3B8',
          fontSize: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid #1E293B',
        }}
      >
        <span>NIQS BESMM4 4th Edition • 509 Pages</span>
        <span>Viewing Page {currentPage} of 509</span>
      </div>
    </div>
  );
};
