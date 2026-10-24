import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Printer,
  RotateCcw,
  Plus,
  Trash2,
  Check,
  ChevronDown,
  ChevronRight,
  Calculator,
  Layers,
  FileSpreadsheet,
  TrendingUp,
  BookOpen,
} from 'lucide-react';
import { api } from '../api/client';
import { Besmm4SidePanel } from '../components/Besmm4SidePanel';
import type {
  BoqBill,
  BoqItem,
  BoqOut,
  ProjectOut,
  RawTakeoffOut,
  RawTakeoffRow,
} from '../api/types';

export const BoqPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectOut | null>(null);
  const [boq, setBoq] = useState<BoqOut | null>(null);
  const [rawTakeoff, setRawTakeoff] = useState<RawTakeoffOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('summary');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [expandedTraces, setExpandedTraces] = useState<Record<string, boolean>>({});

  // BESMM4 Reference Side Panel state
  const [besmm4PanelOpen, setBesmm4PanelOpen] = useState(false);
  const [activeBesmm4Code, setActiveBesmm4Code] = useState('1.14:2.1.1');
  const [activeBesmm4Desc, setActiveBesmm4Desc] = useState('');
  const [activeBesmm4BillNum, setActiveBesmm4BillNum] = useState<number | null>(null);
  const [activeBesmm4ItemId, setActiveBesmm4ItemId] = useState<string | null>(null);

  const handleOpenBesmm4 = (code: string, desc: string, billNum: number, itemId: string) => {
    setActiveBesmm4Code(code || '1.14:2.1.1');
    setActiveBesmm4Desc(desc);
    setActiveBesmm4BillNum(billNum);
    setActiveBesmm4ItemId(itemId);
    setBesmm4PanelOpen(true);
  };

  // Currency options
  const CURRENCIES = [
    { code: 'NGN', symbol: '₦', label: 'Nigerian Naira (₦)' },
    { code: 'USD', symbol: '$', label: 'US Dollar ($)' },
    { code: 'GBP', symbol: '£', label: 'British Pound (£)' },
    { code: 'EUR', symbol: '€', label: 'Euro (€)' },
  ];

  // Load project & BOQ data
  const loadData = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const [p, b, r] = await Promise.all([
        api.getProject(projectId),
        api.getBoq(projectId),
        api.getRawTakeoff(projectId),
      ]);
      setProject(p);
      setBoq(b);
      setRawTakeoff(r);
    } catch (err: any) {
      alert(`Failed to load BOQ data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  // Recalculate totals in memory on client
  const recalculateClientTotals = (bills: BoqBill[], currentSummary = boq?.summary) => {
    if (!currentSummary) return currentSummary;
    const bill_totals: Record<string, number> = {};
    bills.forEach((b) => {
      let sub = 0;
      b.items.forEach((itm) => {
        const amt = Math.round((itm.quantity || 0) * (itm.rate || 0) * 100) / 100;
        itm.amount = amt;
        sub += amt;
      });
      b.subtotal = Math.round(sub * 100) / 100;
      bill_totals[String(b.bill_number)] = b.subtotal;
    });

    const subtotal_1 = Object.values(bill_totals).reduce((a, b) => a + b, 0);
    const c_rate = currentSummary.contingency_rate ?? 5.0;
    const c_amount = Math.round(subtotal_1 * (c_rate / 100) * 100) / 100;
    const subtotal_2 = Math.round((subtotal_1 + c_amount) * 100) / 100;

    const op_rate = currentSummary.overhead_profit_rate ?? 0.0;
    const op_amount = Math.round(subtotal_2 * (op_rate / 100) * 100) / 100;

    const vat_rate = currentSummary.vat_rate ?? 7.5;
    const vat_base = subtotal_2 + op_amount;
    const vat_amount = Math.round(vat_base * (vat_rate / 100) * 100) / 100;

    const grand_total = Math.round((vat_base + vat_amount) * 100) / 100;

    return {
      bill_totals,
      subtotal_1: Math.round(subtotal_1 * 100) / 100,
      contingency_rate: c_rate,
      contingency_amount: c_amount,
      subtotal_2,
      overhead_profit_rate: op_rate,
      overhead_profit_amount: op_amount,
      vat_rate,
      vat_amount,
      grand_total,
    };
  };

  // Handle unit rate change
  const handleRateChange = (billNumber: number, itemId: string, newRate: number) => {
    if (!boq) return;
    const updatedBills = boq.bills.map((b) => {
      if (b.bill_number !== billNumber) return b;
      const updatedItems = b.items.map((itm) => {
        if (itm.id !== itemId) return itm;
        const rate = Math.max(0, newRate);
        const amount = Math.round(itm.quantity * rate * 100) / 100;
        return { ...itm, rate, amount };
      });
      return { ...b, items: updatedItems };
    });

    const updatedSummary = recalculateClientTotals(updatedBills, boq.summary);
    setBoq({
      ...boq,
      bills: updatedBills,
      summary: updatedSummary as any,
    });
  };

  // Handle quantity change
  const handleQtyChange = (billNumber: number, itemId: string, newQty: number) => {
    if (!boq) return;
    const updatedBills = boq.bills.map((b) => {
      if (b.bill_number !== billNumber) return b;
      const updatedItems = b.items.map((itm) => {
        if (itm.id !== itemId) return itm;
        const qty = Math.max(0, newQty);
        const amount = Math.round(qty * itm.rate * 100) / 100;
        return { ...itm, quantity: qty, amount };
      });
      return { ...b, items: updatedItems };
    });

    const updatedSummary = recalculateClientTotals(updatedBills, boq.summary);
    setBoq({
      ...boq,
      bills: updatedBills,
      summary: updatedSummary as any,
    });
  };

  // Handle description edit
  const handleDescChange = (billNumber: number, itemId: string, newDesc: string) => {
    if (!boq) return;
    const updatedBills = boq.bills.map((b) => {
      if (b.bill_number !== billNumber) return b;
      return {
        ...b,
        items: b.items.map((itm) => (itm.id === itemId ? { ...itm, description: newDesc } : itm)),
      };
    });
    setBoq({ ...boq, bills: updatedBills });
  };

  // Handle BESMM4 code edit
  const handleCodeChange = (billNumber: number, itemId: string, newCode: string) => {
    if (!boq) return;
    const updatedBills = boq.bills.map((b) => {
      if (b.bill_number !== billNumber) return b;
      return {
        ...b,
        items: b.items.map((itm) => (itm.id === itemId ? { ...itm, code: newCode } : itm)),
      };
    });
    setBoq({ ...boq, bills: updatedBills });
  };

  // Add custom item
  const handleAddItem = (billNumber: number) => {
    if (!boq) return;
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const targetBill = boq.bills.find((b) => b.bill_number === billNumber);
    const count = targetBill ? targetBill.items.length : 0;
    const ref = count < 26 ? letters[count] : `A${letters[count % 26]}`;

    const defaultCodes: Record<number, string> = {
      1: '1.1:1.1.0',
      2: '1.5:1.1.1',
      3: '1.14:2.1.1',
      4: '1.38:1.1.1',
      5: '1.35:1.1.1',
      6: '1.1:9.1.0',
    };
    const defaultCode = defaultCodes[billNumber] || `1.${billNumber}:1.1.1`;

    const newItem: BoqItem = {
      id: `custom_${Date.now()}`,
      item_ref: ref,
      code: defaultCode,
      element: 'Additional Measured Works',
      description: 'Extra item specified by Quantity Surveyor',
      unit: 'm²',
      quantity: 1,
      rate: 0,
      amount: 0,
      trace: ['Manually inserted by QS'],
      is_provisional: false,
    };

    const updatedBills = boq.bills.map((b) => {
      if (b.bill_number !== billNumber) return b;
      return { ...b, items: [...b.items, newItem] };
    });

    const updatedSummary = recalculateClientTotals(updatedBills, boq.summary);
    setBoq({ ...boq, bills: updatedBills, summary: updatedSummary as any });
  };

  // Delete item
  const handleDeleteItem = (billNumber: number, itemId: string) => {
    if (!boq) return;
    if (!confirm('Are you sure you want to remove this item from the BOQ?')) return;
    const updatedBills = boq.bills.map((b) => {
      if (b.bill_number !== billNumber) return b;
      return { ...b, items: b.items.filter((i) => i.id !== itemId) };
    });

    const updatedSummary = recalculateClientTotals(updatedBills, boq.summary);
    setBoq({ ...boq, bills: updatedBills, summary: updatedSummary as any });
  };

  // Save changes to backend
  const handleSave = async () => {
    if (!boq || !projectId) return;
    try {
      setIsSaving(true);
      const res = await api.updateBoq(projectId, {
        title: boq.title,
        currency: boq.currency,
        currency_symbol: boq.currency_symbol,
        rounding_rule: boq.rounding_rule,
        bills: boq.bills,
        summary: boq.summary,
      });
      setBoq(res);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Regenerate BOQ from Takeoff
  const handleRegenerate = async () => {
    if (!projectId) return;
    if (
      !confirm(
        'Regenerate Bill of Quantities from drawing takeoff? This will recalculate all quantities based on your drawing dimensions and project specifications.'
      )
    )
      return;

    try {
      setLoading(true);
      const res = await api.generateBoq(projectId, {
        rounding_rule: boq?.rounding_rule || 'besmm4_whole',
        currency: boq?.currency || 'NGN',
        populate_default_rates: true,
      });
      setBoq(res);
      alert('BOQ successfully regenerated from drawing takeoff!');
    } catch (err: any) {
      alert(`Regeneration error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Switch Rounding Mode
  const handleToggleRounding = async (mode: 'besmm4_whole' | 'two_dp') => {
    if (!boq || !projectId) return;
    try {
      setLoading(true);
      const res = await api.generateBoq(projectId, {
        rounding_rule: mode,
        currency: boq.currency,
        populate_default_rates: true,
      });
      setBoq(res);
    } catch (err: any) {
      alert(`Error toggling rounding: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Switch Currency
  const handleCurrencyChange = (currCode: string) => {
    if (!boq) return;
    const match = CURRENCIES.find((c) => c.code === currCode);
    if (!match) return;
    setBoq({
      ...boq,
      currency: match.code,
      currency_symbol: match.symbol,
    });
  };

  // Change summary rates (Contingency, VAT)
  const handleSummaryRateChange = (field: 'contingency_rate' | 'vat_rate', val: number) => {
    if (!boq) return;
    const updatedSummary = {
      ...boq.summary,
      [field]: Math.max(0, val),
    };
    const recalculated = recalculateClientTotals(boq.bills, updatedSummary as any);
    setBoq({
      ...boq,
      summary: recalculated as any,
    });
  };

  // Toggle trace expand
  const toggleTrace = (id: string) => {
    setExpandedTraces((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Raw Takeoff operations
  const handleAddRawRow = () => {
    if (!rawTakeoff) return;
    const newRow: RawTakeoffRow = {
      id: `raw_${Date.now()}`,
      timesing: '1',
      dim1: 0,
      dim2: null,
      dim3: null,
      squaring: 0,
      description: 'New dimension item',
      unit: 'm²',
      bill_number: 2,
      work_section: 'Excavating and Filling',
    };
    setRawTakeoff({
      ...rawTakeoff,
      rows: [...rawTakeoff.rows, newRow],
    });
  };

  const handleUpdateRawRow = (id: string, field: keyof RawTakeoffRow, val: any) => {
    if (!rawTakeoff) return;
    const updated = rawTakeoff.rows.map((r) => {
      if (r.id !== id) return r;
      const updatedRow = { ...r, [field]: val };
      // Compute squaring
      let t = 1;
      try {
        const parts = String(updatedRow.timesing || '1').split(/[/x*]/);
        t = parts.reduce((acc, p) => (p.trim() ? acc * (parseFloat(p) || 1) : acc), 1);
      } catch {}
      const d1 = parseFloat(String(updatedRow.dim1)) || 0;
      const d2 = updatedRow.dim2 !== null ? parseFloat(String(updatedRow.dim2)) || 0 : null;
      const d3 = updatedRow.dim3 !== null ? parseFloat(String(updatedRow.dim3)) || 0 : null;

      let prod = t;
      if (d1 > 0) prod *= d1;
      if (d2 !== null && d2 > 0) prod *= d2;
      if (d3 !== null && d3 > 0) prod *= d3;
      updatedRow.squaring = Math.round(prod * 100) / 100;
      return updatedRow;
    });
    setRawTakeoff({ ...rawTakeoff, rows: updated });
  };

  const handleDeleteRawRow = (id: string) => {
    if (!rawTakeoff) return;
    setRawTakeoff({
      ...rawTakeoff,
      rows: rawTakeoff.rows.filter((r) => r.id !== id),
    });
  };

  const handleSaveRawTakeoff = async () => {
    if (!rawTakeoff || !projectId) return;
    try {
      setIsSaving(true);
      const res = await api.updateRawTakeoff(projectId, {
        title: rawTakeoff.title,
        rows: rawTakeoff.rows,
      });
      setRawTakeoff(res);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(`Error saving dimension sheet: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConvertRawToBoq = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      // Save raw takeoff first
      if (rawTakeoff) {
        await api.updateRawTakeoff(projectId, { rows: rawTakeoff.rows });
      }
      const updatedBoq = await api.convertRawTakeoff(projectId);
      setBoq(updatedBoq);
      setActiveTab('2'); // Go to Bill 2
      alert('Raw dimensions successfully converted and merged into the Bill of Quantities!');
    } catch (err: any) {
      alert(`Conversion error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !project || !boq) {
    return (
      <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: '40px', height: '40px', margin: '0 auto 16px auto', borderTopColor: '#2563EB' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>Generating BESMM4 Bill of Quantities</h3>
          <p style={{ fontSize: '13px', color: '#64748B' }}>Organizing work sections, applying NIQS measurement rules, and calculating tender sum...</p>
        </div>
      </div>
    );
  }

  const sym = boq.currency_symbol || '₦';
  const activeBill = boq.bills.find((b) => String(b.bill_number) === activeTab);

  return (
    <div style={{ minHeight: '100%', backgroundColor: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header Bar */}
      <header
        style={{
          backgroundColor: '#0F172A',
          color: '#FFFFFF',
          padding: '14px 28px',
          borderBottom: '1px solid #1E293B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        {/* Left: Project Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: '#94A3B8', padding: '6px 10px' }}
            onClick={() => navigate(`/projects/${project.id}`)}
            title="Back to Taking-Off Studio"
          >
            <ArrowLeft size={16} />
            <span style={{ fontSize: '12px' }}>Studio</span>
          </button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '16px', fontWeight: 800, color: '#F8FAFC' }}>
                {project.name}
              </h1>
              <span
                style={{
                  backgroundColor: '#1E3A8A',
                  color: '#93C5FD',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  letterSpacing: '0.04em',
                }}
              >
                NIQS BESMM4
              </span>
              {saveSuccess && (
                <span style={{ color: '#10B981', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Check size={12} /> Saved
                </span>
              )}
            </div>
            <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>
              {project.location ? `${project.location} • ` : ''}
              {project.client ? `Client: ${project.client} • ` : ''}
              Firm Elemental Bill of Quantities
            </p>
          </div>
        </div>

        {/* Center: Currency & Rounding Mode */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Currency dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#94A3B8' }}>Currency:</span>
            <select
              value={boq.currency}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              style={{
                backgroundColor: '#1E293B',
                color: '#F8FAFC',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Rounding Mode Toggle */}
          <div
            style={{
              display: 'flex',
              backgroundColor: '#1E293B',
              padding: '2px',
              borderRadius: '6px',
              border: '1px solid #334155',
            }}
          >
            <button
              onClick={() => handleToggleRounding('besmm4_whole')}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: boq.rounding_rule === 'besmm4_whole' ? 700 : 500,
                color: boq.rounding_rule === 'besmm4_whole' ? '#FFFFFF' : '#94A3B8',
                backgroundColor: boq.rounding_rule === 'besmm4_whole' ? '#2563EB' : 'transparent',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
              }}
              title="NIQS BESMM4 Rule 1.5.3: Round to nearest whole unit (tonnes to 2 dp)"
            >
              BESMM4 Whole Units
            </button>
            <button
              onClick={() => handleToggleRounding('two_dp')}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: boq.rounding_rule === 'two_dp' ? 700 : 500,
                color: boq.rounding_rule === 'two_dp' ? '#FFFFFF' : '#94A3B8',
                backgroundColor: boq.rounding_rule === 'two_dp' ? '#2563EB' : 'transparent',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
              }}
              title="High precision: Round all quantities to 2 decimal places"
            >
              2 Decimal Places
            </button>
          </div>
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Save Button */}
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: '6px 14px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Check size={14} />
            <span>{isSaving ? 'Saving...' : 'Save BOQ'}</span>
          </button>

          {/* Regenerate Button */}
          <button
            className="btn btn-dark btn-sm"
            onClick={handleRegenerate}
            title="Recalculate BOQ directly from Phase 1 drawing takeoff"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RotateCcw size={13} />
            <span>Regenerate</span>
          </button>

          {/* Export Excel Button */}
          <a
            href={api.getBoqExcelExportUrl(project.id)}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
            title="Download multi-tab formatted Excel BOQ (.xlsx)"
          >
            <Download size={13} />
            <span>Excel (.xlsx)</span>
          </a>

          {/* Print / PDF Button */}
          <a
            href={api.getBoqHtmlExportUrl(project.id)}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
            title="Open clean printable document / Save as PDF"
          >
            <Printer size={13} />
            <span>Print / PDF</span>
          </a>

          {/* BESMM4 Manual / Reference Side Panel Button */}
          <button
            onClick={() => {
              setActiveBesmm4Code('1.14:2.1.1');
              setActiveBesmm4Desc('General building works specifications & classification');
              setBesmm4PanelOpen(true);
            }}
            className="btn btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#1E3A8A',
              color: '#93C5FD',
              border: '1px solid #3B82F6',
              fontWeight: 600,
            }}
            title="Open NIQS BESMM4 PDF Manual & Rule Viewer"
          >
            <BookOpen size={13} />
            <span>BESMM4 Reference</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '24px 32px', maxWidth: '1440px', width: '100%', margin: '0 auto' }}>
        {/* Top Summary Metrics Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          {/* Total Tender Sum Card */}
          <div
            style={{
              background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%)',
              color: '#FFFFFF',
              borderRadius: '12px',
              padding: '20px 24px',
              boxShadow: '0 4px 14px rgba(15, 23, 42, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#93C5FD', letterSpacing: '0.04em' }}>
                  TOTAL TENDER SUM
                </span>
                <span
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    fontSize: '10px',
                  }}
                >
                  VAT & Contingency Incl.
                </span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', color: '#F8FAFC' }}>
                {sym}
                {(boq.summary.grand_total || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '12px' }}>
              Carried to Form of Tender • {boq.bills.length} Elemental Bills
            </div>
          </div>

          {/* Measured Works Sub-Total 1 */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              padding: '18px 20px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>
              SUB-TOTAL 1 (MEASURED WORKS)
            </span>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A' }}>
              {sym}
              {(boq.summary.subtotal_1 || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <span style={{ fontSize: '11px', color: '#94A3B8', marginTop: '10px', display: 'block' }}>
              Bills 1 to 6 Base Works Total
            </span>
          </div>

          {/* Contingency Setting Card */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              padding: '18px 20px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B' }}>CONTINGENCIES</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="0.5"
                  value={boq.summary.contingency_rate ?? 5}
                  onChange={(e) => handleSummaryRateChange('contingency_rate', parseFloat(e.target.value) || 0)}
                  style={{
                    width: '48px',
                    padding: '2px 4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '4px',
                    border: '1px solid #CBD5E1',
                    textAlign: 'center',
                  }}
                />
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B' }}>%</span>
              </div>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A' }}>
              {sym}
              {(boq.summary.contingency_amount || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <span style={{ fontSize: '11px', color: '#94A3B8', marginTop: '10px', display: 'block' }}>
              Provisional Sum for Unforeseen Works
            </span>
          </div>

          {/* VAT Setting Card */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              padding: '18px 20px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B' }}>VALUE ADDED TAX (VAT)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="number"
                  min="0"
                  max="30"
                  step="0.5"
                  value={boq.summary.vat_rate ?? 7.5}
                  onChange={(e) => handleSummaryRateChange('vat_rate', parseFloat(e.target.value) || 0)}
                  style={{
                    width: '48px',
                    padding: '2px 4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '4px',
                    border: '1px solid #CBD5E1',
                    textAlign: 'center',
                  }}
                />
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B' }}>%</span>
              </div>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A' }}>
              {sym}
              {(boq.summary.vat_amount || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <span style={{ fontSize: '11px', color: '#94A3B8', marginTop: '10px', display: 'block' }}>
              Statutory Federal Tax (Standard 7.5%)
            </span>
          </div>
        </div>

        {/* Tab Navigation Rail */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            borderBottom: '1px solid #E2E8F0',
            marginBottom: '20px',
            overflowX: 'auto',
          }}
        >
          {/* Summary Tab */}
          <button
            onClick={() => setActiveTab('summary')}
            style={{
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: activeTab === 'summary' ? 700 : 500,
              color: activeTab === 'summary' ? '#2563EB' : '#64748B',
              borderBottom: `2px solid ${activeTab === 'summary' ? '#2563EB' : 'transparent'}`,
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <TrendingUp size={15} />
            <span>Grand Summary</span>
          </button>

          {/* Bills 1 to 6 Tabs */}
          {boq.bills.map((b) => (
            <button
              key={b.bill_number}
              onClick={() => setActiveTab(String(b.bill_number))}
              style={{
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: activeTab === String(b.bill_number) ? 700 : 500,
                color: activeTab === String(b.bill_number) ? '#2563EB' : '#64748B',
                borderBottom: `2px solid ${activeTab === String(b.bill_number) ? '#2563EB' : 'transparent'}`,
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>Bill {b.bill_number}: {b.title.split(' ')[0]}</span>
              <span
                style={{
                  fontSize: '10px',
                  backgroundColor: activeTab === String(b.bill_number) ? '#EFF6FF' : '#F1F5F9',
                  color: activeTab === String(b.bill_number) ? '#2563EB' : '#64748B',
                  padding: '2px 6px',
                  borderRadius: '9999px',
                  fontWeight: 600,
                }}
              >
                {sym}{((b.subtotal || 0) / 1000).toFixed(0)}k
              </span>
            </button>
          ))}

          {/* Raw Dimension Sheet Tab */}
          <button
            onClick={() => setActiveTab('raw')}
            style={{
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: activeTab === 'raw' ? 700 : 500,
              color: activeTab === 'raw' ? '#0D9488' : '#64748B',
              borderBottom: `2px solid ${activeTab === 'raw' ? '#0D9488' : 'transparent'}`,
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginLeft: 'auto',
            }}
          >
            <FileSpreadsheet size={15} />
            <span>Raw Dimension Sheet</span>
          </button>
        </div>

        {/* TAB 1: GRAND SUMMARY VIEW */}
        {activeTab === 'summary' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                padding: '24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                    Main Summary of Elemental Bills
                  </h2>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0 0' }}>
                    Prepared in accordance with NIQS BESMM4 Building Works Classification
                  </p>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => navigate(`/projects/${project.id}/takeoff-sheet`)}
                >
                  <Layers size={14} />
                  <span>View Dimension Sheet Trace</span>
                </button>
              </div>

              {/* Summary Breakdown Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid #E2E8F0', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569', width: '10%' }}>
                      Bill Nr.
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569', width: '50%' }}>
                      Elemental Section Title
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569', width: '15%' }}>
                      Work Section
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569', width: '25%', textAlign: 'right' }}>
                      Subtotal Amount ({sym})
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {boq.bills.map((b) => (
                    <tr
                      key={b.bill_number}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      onClick={() => setActiveTab(String(b.bill_number))}
                    >
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: '#1E3A8A' }}>
                        Bill {b.bill_number}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#0F172A' }}>{b.title}</div>
                        {b.preamble && (
                          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                            {b.preamble.slice(0, 95)}...
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B' }}>
                        {b.work_section}
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 700, fontSize: '14px', color: '#0F172A', textAlign: 'right' }}>
                        {sym}
                        {(b.subtotal || 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))}

                  {/* Subtotal 1 */}
                  <tr style={{ backgroundColor: '#F8FAFC', borderTop: '2px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}>
                    <td colSpan={3} style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                      SUB-TOTAL 1 (MEASURED WORKS):
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, fontSize: '15px', color: '#0F172A' }}>
                      {sym}
                      {(boq.summary.subtotal_1 || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>

                  {/* Contingencies */}
                  <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td colSpan={3} style={{ padding: '10px 16px', textAlign: 'right', color: '#475569', fontSize: '12px' }}>
                      Add: Contingencies ({boq.summary.contingency_rate}%):
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                      {sym}
                      {(boq.summary.contingency_amount || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>

                  {/* Subtotal 2 */}
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <td colSpan={3} style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                      SUB-TOTAL 2:
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                      {sym}
                      {(boq.summary.subtotal_2 || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>

                  {/* VAT */}
                  <tr style={{ borderBottom: '2px solid #0F172A' }}>
                    <td colSpan={3} style={{ padding: '10px 16px', textAlign: 'right', color: '#475569', fontSize: '12px' }}>
                      Add: Value Added Tax (VAT @ {boq.summary.vat_rate}%):
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                      {sym}
                      {(boq.summary.vat_amount || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>

                  {/* Total Tender Sum */}
                  <tr style={{ backgroundColor: '#EFF6FF', borderBottom: '3px double #0F172A' }}>
                    <td
                      colSpan={3}
                      style={{
                        padding: '16px',
                        textAlign: 'right',
                        fontWeight: 800,
                        fontSize: '14px',
                        color: '#1E3A8A',
                        letterSpacing: '0.02em',
                      }}
                    >
                      TOTAL TENDER SUM CARRIED TO FORM OF TENDER:
                    </td>
                    <td
                      style={{
                        padding: '16px',
                        textAlign: 'right',
                        fontWeight: 900,
                        fontSize: '18px',
                        color: '#1E3A8A',
                      }}
                    >
                      {sym}
                      {(boq.summary.grand_total || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2 TO 7: INDIVIDUAL BILLS (1 to 6) */}
        {activeBill && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Bill Header Info Banner */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span
                    style={{
                      backgroundColor: '#1E3A8A',
                      color: '#FFFFFF',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                    }}
                  >
                    BILL {activeBill.bill_number}
                  </span>
                  <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                    {activeBill.title}
                  </h2>
                </div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  Work Section: <strong>{activeBill.work_section}</strong>
                  {activeBill.preamble && ` • ${activeBill.preamble}`}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>Bill Subtotal</span>
                  <span style={{ fontSize: '18px', fontWeight: 800, color: '#1E3A8A' }}>
                    {sym}
                    {(activeBill.subtotal || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleAddItem(activeBill.bill_number)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus size={14} />
                  <span>Add Item</span>
                </button>
              </div>
            </div>

            {/* Bill Items Table */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0F172A', color: '#FFFFFF', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, width: '5%', textAlign: 'center' }}>
                      Item
                    </th>
                    <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, width: '13%', textAlign: 'center' }}>
                      BESMM4 Code
                    </th>
                    <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, width: '40%' }}>
                      Description & Work Section Classification
                    </th>
                    <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, width: '9%', textAlign: 'right' }}>
                      Quantity
                    </th>
                    <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, width: '7%', textAlign: 'center' }}>
                      Unit
                    </th>
                    <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, width: '12%', textAlign: 'right' }}>
                      Unit Rate ({sym})
                    </th>
                    <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, width: '11%', textAlign: 'right' }}>
                      Amount ({sym})
                    </th>
                    <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, width: '3%', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {activeBill.items.map((itm, idx) => {
                    const hasTrace = itm.trace && itm.trace.length > 0;
                    const isExpanded = expandedTraces[itm.id];
                    return (
                      <React.Fragment key={itm.id}>
                        <tr
                          style={{
                            borderBottom: '1px solid #F1F5F9',
                            backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FBFCFD',
                            verticalAlign: 'top',
                          }}
                        >
                          {/* Item Ref */}
                          <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: '#1E3A8A' }}>
                            {itm.item_ref || makeRef(idx)}
                          </td>

                          {/* BESMM4 Code (Rule 1.14.02) */}
                          <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <button
                                onClick={() => handleOpenBesmm4(itm.code, itm.description, activeBill.bill_number, itm.id)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  backgroundColor: '#EFF6FF',
                                  color: '#1E40AF',
                                  border: '1px solid #BFDBFE',
                                  borderRadius: '6px',
                                  padding: '4px 8px',
                                  letterSpacing: '0.02em',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                  boxShadow: '0 1px 2px rgba(37,99,235,0.06)',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#DBEAFE';
                                  e.currentTarget.style.borderColor = '#2563EB';
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#EFF6FF';
                                  e.currentTarget.style.borderColor = '#BFDBFE';
                                  e.currentTarget.style.transform = 'none';
                                }}
                                title="Click to view NIQS BESMM4 details & PDF in side panel"
                              >
                                <BookOpen size={12} color="#2563EB" />
                                <span>{itm.code || '1.14:1.1.1'}</span>
                              </button>
                            </div>
                          </td>

                          {/* Description & Element Header */}
                          <td style={{ padding: '12px 14px' }}>
                            {itm.element && (
                              <div
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  color: '#2563EB',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.04em',
                                  marginBottom: '3px',
                                }}
                              >
                                {itm.element}
                              </div>
                            )}
                            <textarea
                              value={itm.description}
                              rows={2}
                              onChange={(e) => handleDescChange(activeBill.bill_number, itm.id, e.target.value)}
                              style={{
                                width: '100%',
                                fontSize: '12px',
                                color: '#0F172A',
                                border: '1px solid transparent',
                                borderRadius: '4px',
                                padding: '4px',
                                backgroundColor: 'transparent',
                                resize: 'vertical',
                                fontFamily: 'inherit',
                              }}
                              onFocus={(e) => (e.target.style.borderColor = '#93C5FD')}
                              onBlur={(e) => (e.target.style.borderColor = 'transparent')}
                            />

                            {/* Audit trace link */}
                            {hasTrace && (
                              <button
                                onClick={() => toggleTrace(itm.id)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '10px',
                                  color: '#64748B',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '2px 0',
                                  marginTop: '2px',
                                }}
                              >
                                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                <span>{isExpanded ? 'Hide' : 'Show'} Audit Taking-Off Trace</span>
                              </button>
                            )}

                            {isExpanded && hasTrace && (
                              <div
                                style={{
                                  backgroundColor: '#F8FAFC',
                                  borderLeft: '3px solid #2563EB',
                                  padding: '6px 10px',
                                  marginTop: '4px',
                                  borderRadius: '0 4px 4px 0',
                                  fontSize: '10px',
                                  color: '#475569',
                                  fontFamily: 'monospace',
                                }}
                              >
                                {itm.trace.map((tr, tidx) => (
                                  <div key={tidx}>• {tr}</div>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* Quantity */}
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={itm.quantity}
                              onChange={(e) =>
                                handleQtyChange(activeBill.bill_number, itm.id, parseFloat(e.target.value) || 0)
                              }
                              style={{
                                width: '80px',
                                textAlign: 'right',
                                padding: '4px 6px',
                                fontSize: '12px',
                                fontWeight: 700,
                                borderRadius: '4px',
                                border: '1px solid #CBD5E1',
                              }}
                            />
                          </td>

                          {/* Unit */}
                          <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: '12px', color: '#475569' }}>
                            {itm.unit}
                          </td>

                          {/* Unit Rate */}
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                              <span style={{ fontSize: '11px', color: '#64748B' }}>{sym}</span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={itm.rate || ''}
                                placeholder="0.00"
                                onChange={(e) =>
                                  handleRateChange(activeBill.bill_number, itm.id, parseFloat(e.target.value) || 0)
                                }
                                style={{
                                  width: '100px',
                                  textAlign: 'right',
                                  padding: '4px 8px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  borderRadius: '4px',
                                  border: '1px solid #CBD5E1',
                                }}
                              />
                            </div>
                          </td>

                          {/* Amount */}
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#0F172A', fontSize: '13px' }}>
                            {sym}
                            {(itm.amount || 0).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>

                          {/* Delete Item */}
                          <td style={{ padding: '12px 6px', textAlign: 'center' }}>
                            <button
                              onClick={() => handleDeleteItem(activeBill.bill_number, itm.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#94A3B8',
                                cursor: 'pointer',
                                padding: '4px',
                              }}
                              title="Delete Item"
                              onMouseEnter={(e) => (e.currentTarget.style.color = '#EF4444')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = '#94A3B8')}
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#F8FAFC', borderTop: '2px solid #0F172A', borderBottom: '3px double #0F172A' }}>
                    <td colSpan={6} style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, fontSize: '13px', color: '#0F172A' }}>
                      TOTAL BILL NR. {activeBill.bill_number} CARRIED TO SUMMARY:
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 900, fontSize: '15px', color: '#1E3A8A' }}>
                      {sym}
                      {(activeBill.subtotal || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* TAB 8: RAW DIMENSION SHEET */}
        {activeTab === 'raw' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Traditional Taking-Off Dimension Sheet
                </h2>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0 0' }}>
                  Record direct dimensions (Timesing × L × B × H/D = Squaring) to generate or supplement BOQ items.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button className="btn btn-secondary btn-sm" onClick={handleAddRawRow}>
                  <Plus size={14} />
                  <span>Add Dimension Row</span>
                </button>
                <button className="btn btn-primary btn-sm" onClick={handleSaveRawTakeoff} disabled={isSaving}>
                  <Check size={14} />
                  <span>Save Dimension Sheet</span>
                </button>
                <button
                  className="btn btn-sm"
                  onClick={handleConvertRawToBoq}
                  style={{
                    backgroundColor: '#0D9488',
                    color: '#FFFFFF',
                    fontWeight: 600,
                  }}
                  title="Aggregate dimension sheet squaring and append into BOQ"
                >
                  <Calculator size={14} />
                  <span>Convert & Append to BOQ</span>
                </button>
              </div>
            </div>

            {/* Dimension Sheet Table */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0F172A', color: '#FFFFFF', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 700, width: '9%' }}>Timesing</th>
                    <th style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 700, width: '10%' }}>Dim 1 (L)</th>
                    <th style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 700, width: '10%' }}>Dim 2 (B)</th>
                    <th style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 700, width: '10%' }}>Dim 3 (H/D)</th>
                    <th style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 700, width: '10%', textAlign: 'right' }}>
                      Squaring
                    </th>
                    <th style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 700, width: '26%' }}>Description</th>
                    <th style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 700, width: '8%', textAlign: 'center' }}>
                      Unit
                    </th>
                    <th style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 700, width: '12%' }}>Destination Bill</th>
                    <th style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 700, width: '5%', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rawTakeoff?.rows.map((row) => (
                    <tr key={row.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      {/* Timesing */}
                      <td style={{ padding: '8px 12px' }}>
                        <input
                          type="text"
                          value={row.timesing}
                          placeholder="e.g. 2/"
                          onChange={(e) => handleUpdateRawRow(row.id, 'timesing', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '4px',
                            fontSize: '12px',
                            borderRadius: '4px',
                            border: '1px solid #CBD5E1',
                            fontFamily: 'monospace',
                          }}
                        />
                      </td>

                      {/* Dim 1 */}
                      <td style={{ padding: '8px 12px' }}>
                        <input
                          type="number"
                          step="any"
                          value={row.dim1 || ''}
                          placeholder="0.00"
                          onChange={(e) => handleUpdateRawRow(row.id, 'dim1', parseFloat(e.target.value) || 0)}
                          style={{
                            width: '100%',
                            padding: '4px',
                            fontSize: '12px',
                            borderRadius: '4px',
                            border: '1px solid #CBD5E1',
                          }}
                        />
                      </td>

                      {/* Dim 2 */}
                      <td style={{ padding: '8px 12px' }}>
                        <input
                          type="number"
                          step="any"
                          value={row.dim2 !== null ? row.dim2 : ''}
                          placeholder="-"
                          onChange={(e) =>
                            handleUpdateRawRow(row.id, 'dim2', e.target.value ? parseFloat(e.target.value) : null)
                          }
                          style={{
                            width: '100%',
                            padding: '4px',
                            fontSize: '12px',
                            borderRadius: '4px',
                            border: '1px solid #CBD5E1',
                          }}
                        />
                      </td>

                      {/* Dim 3 */}
                      <td style={{ padding: '8px 12px' }}>
                        <input
                          type="number"
                          step="any"
                          value={row.dim3 !== null ? row.dim3 : ''}
                          placeholder="-"
                          onChange={(e) =>
                            handleUpdateRawRow(row.id, 'dim3', e.target.value ? parseFloat(e.target.value) : null)
                          }
                          style={{
                            width: '100%',
                            padding: '4px',
                            fontSize: '12px',
                            borderRadius: '4px',
                            border: '1px solid #CBD5E1',
                          }}
                        />
                      </td>

                      {/* Squaring */}
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#1E3A8A', fontSize: '13px' }}>
                        {(row.squaring || 0).toFixed(2)}
                      </td>

                      {/* Description */}
                      <td style={{ padding: '8px 12px' }}>
                        <input
                          type="text"
                          value={row.description}
                          onChange={(e) => handleUpdateRawRow(row.id, 'description', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '4px',
                            fontSize: '12px',
                            borderRadius: '4px',
                            border: '1px solid #CBD5E1',
                          }}
                        />
                      </td>

                      {/* Unit */}
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <select
                          value={row.unit}
                          onChange={(e) => handleUpdateRawRow(row.id, 'unit', e.target.value)}
                          style={{
                            padding: '4px',
                            fontSize: '11px',
                            borderRadius: '4px',
                            border: '1px solid #CBD5E1',
                          }}
                        >
                          <option value="m³">m³</option>
                          <option value="m²">m²</option>
                          <option value="m">m</option>
                          <option value="nr">nr</option>
                          <option value="Item">Item</option>
                          <option value="t">t</option>
                        </select>
                      </td>

                      {/* Destination Bill */}
                      <td style={{ padding: '8px 12px' }}>
                        <select
                          value={row.bill_number}
                          onChange={(e) => handleUpdateRawRow(row.id, 'bill_number', parseInt(e.target.value, 10))}
                          style={{
                            width: '100%',
                            padding: '4px',
                            fontSize: '11px',
                            borderRadius: '4px',
                            border: '1px solid #CBD5E1',
                          }}
                        >
                          <option value={1}>Bill 1: Prelims</option>
                          <option value={2}>Bill 2: Substructure</option>
                          <option value={3}>Bill 3: Superstructure</option>
                          <option value={4}>Bill 4: Finishes</option>
                          <option value={5}>Bill 5: Services</option>
                          <option value={6}>Bill 6: External</option>
                        </select>
                      </td>

                      {/* Delete */}
                      <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleDeleteRawRow(row.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#94A3B8',
                            cursor: 'pointer',
                          }}
                          title="Delete Row"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* BESMM4 REFERENCE & PDF SIDE PANEL */}
      <Besmm4SidePanel
        isOpen={besmm4PanelOpen}
        onClose={() => setBesmm4PanelOpen(false)}
        code={activeBesmm4Code}
        itemDescription={activeBesmm4Desc}
        onCodeChange={(newCode) => {
          setActiveBesmm4Code(newCode);
          if (activeBesmm4BillNum && activeBesmm4ItemId) {
            handleCodeChange(activeBesmm4BillNum, activeBesmm4ItemId, newCode);
          }
        }}
      />
    </div>
  );
};

function makeRef(index: number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (index < 26) return letters[index];
  return `${letters[Math.floor(index / 26) - 1]}${letters[index % 26]}`;
}
