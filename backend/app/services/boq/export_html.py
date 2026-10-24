"""Printable / PDF HTML exporter for BESMM4 Bill of Quantities."""

from __future__ import annotations

import html
from ...models import Project


def export_boq_html(project: Project, boq_data: dict) -> str:
    sym = html.escape(boq_data.get("currency_symbol", "₦"))
    curr = html.escape(boq_data.get("currency", "NGN"))
    summary = boq_data.get("summary", {})
    bills = boq_data.get("bills", [])

    def fmt_num(v: float | int | None) -> str:
        if v is None:
            return "0.00"
        return f"{float(v):,.2f}"

    def fmt_qty(v: float | int | None, unit: str) -> str:
        if v is None:
            return "0"
        if unit == "nr" or boq_data.get("rounding_rule") == "besmm4_whole":
            return f"{float(v):,.0f}" if float(v).is_integer() else f"{float(v):,.2f}"
        return f"{float(v):,.2f}"

    # Build bills HTML
    bills_html = []
    for b in bills:
        b_num = b.get("bill_number", 1)
        items_html = []
        current_elem = None

        for itm in b.get("items", []):
            elem = itm.get("element")
            if elem and elem != current_elem:
                current_elem = elem
                items_html.append(f"""
                <tr class="element-header">
                    <td colspan="7"><strong>{html.escape(elem.upper())}</strong></td>
                </tr>
                """)

            trace_html = ""
            if itm.get("trace"):
                traces = "<br>".join(f"<small class='trace'>• {html.escape(t)}</small>" for t in itm["trace"][:2])
                trace_html = f"<div class='trace-container'>{traces}</div>"

            items_html.append(f"""
            <tr>
                <td class="text-center font-bold">{html.escape(itm.get("item_ref", ""))}</td>
                <td class="text-center font-mono" style="font-size: 10px; color: #1E3A8A; font-weight: 600;">{html.escape(itm.get("code", ""))}</td>
                <td>
                    <div class="item-desc">{html.escape(itm.get("description", ""))}</div>
                    {trace_html}
                </td>
                <td class="text-right font-bold">{fmt_qty(itm.get("quantity"), itm.get("unit", ""))}</td>
                <td class="text-center">{html.escape(itm.get("unit", ""))}</td>
                <td class="text-right">{sym}{fmt_num(itm.get("rate"))}</td>
                <td class="text-right font-bold">{sym}{fmt_num(itm.get("amount"))}</td>
            </tr>
            """)

        bills_html.append(f"""
        <div class="bill-page page-break">
            <div class="bill-header">
                <h2>BILL NR. {b_num}: {html.escape(b.get("title", "").upper())}</h2>
                <p class="bill-worksection">{html.escape(b.get("work_section", ""))}</p>
                {f'<p class="bill-preamble"><em>{html.escape(b["preamble"])}</em></p>' if b.get("preamble") else ''}
            </div>

            <table class="boq-table">
                <thead>
                    <tr>
                        <th style="width: 6%;">Item</th>
                        <th style="width: 13%;">BESMM4 Code</th>
                        <th style="width: 43%;">Description & Specifications</th>
                        <th style="width: 10%;">Qty</th>
                        <th style="width: 8%;">Unit</th>
                        <th style="width: 10%;">Rate ({sym})</th>
                        <th style="width: 10%;">Amount ({sym})</th>
                    </tr>
                </thead>
                <tbody>
                    {"".join(items_html)}
                </tbody>
                <tfoot>
                    <tr class="subtotal-row">
                        <td colspan="6" class="text-right font-bold">TOTAL BILL NR. {b_num} CARRIED TO SUMMARY:</td>
                        <td class="text-right font-bold total-amount">{sym}{fmt_num(b.get("subtotal"))}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
        """)

    # Summary table rows
    summary_rows = []
    for b in bills:
        b_num = b.get("bill_number", 1)
        summary_rows.append(f"""
        <tr>
            <td class="text-center font-bold">Bill Nr. {b_num}</td>
            <td class="font-bold">{html.escape(b.get("title", ""))}</td>
            <td class="text-center">Sheet: Bill {b_num}</td>
            <td class="text-right font-bold">{sym}{fmt_num(b.get("subtotal"))}</td>
        </tr>
        """)

    c_rate = summary.get("contingency_rate", 5.0)
    c_amt = summary.get("contingency_amount", 0.0)
    vat_rate = summary.get("vat_rate", 7.5)
    vat_amt = summary.get("vat_amount", 0.0)
    sub1 = summary.get("subtotal_1", 0.0)
    sub2 = summary.get("subtotal_2", 0.0)
    grand = summary.get("grand_total", 0.0)

    html_out = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Bill of Quantities - {html.escape(project.name)}</title>
    <style>
        @page {{
            size: A4 portrait;
            margin: 15mm;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #0F172A;
            background-color: #FFFFFF;
            margin: 0;
            padding: 24px;
            font-size: 11px;
            line-height: 1.4;
        }}
        .no-print {{
            margin-bottom: 20px;
            display: flex;
            gap: 12px;
        }}
        .btn {{
            background-color: #2563EB;
            color: #FFFFFF;
            padding: 8px 16px;
            border-radius: 6px;
            border: none;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
        }}
        @media print {{
            .no-print {{ display: none; }}
            body {{ padding: 0; font-size: 10px; }}
            .page-break {{ page-break-after: always; }}
        }}
        .cover-page {{
            min-height: 90vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            border: 3px double #0F172A;
            padding: 40px;
            margin-bottom: 40px;
            text-align: center;
        }}
        .cover-title {{
            font-size: 24px;
            font-weight: 800;
            color: #0F172A;
            letter-spacing: -0.02em;
            margin-bottom: 8px;
        }}
        .cover-subtitle {{
            font-size: 14px;
            color: #475569;
            margin-bottom: 40px;
            font-style: italic;
        }}
        .cover-meta {{
            max-width: 500px;
            margin: 0 auto 40px auto;
            border-collapse: collapse;
            width: 100%;
            text-align: left;
        }}
        .cover-meta td {{
            padding: 8px 12px;
            border-bottom: 1px solid #E2E8F0;
        }}
        .boq-table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 14px;
            margin-bottom: 24px;
        }}
        .boq-table th {{
            background-color: #1E3A8A;
            color: #FFFFFF;
            padding: 8px 10px;
            font-weight: 700;
            border: 1px solid #1E3A8A;
            font-size: 10px;
        }}
        .boq-table td {{
            padding: 6px 10px;
            border: 1px solid #CBD5E1;
            vertical-align: top;
        }}
        .element-header td {{
            background-color: #EFF6FF;
            color: #1E3A8A;
            font-weight: 700;
            padding: 6px 10px;
        }}
        .subtotal-row td {{
            background-color: #F8FAFC;
            border-top: 1px solid #0F172A;
            border-bottom: 3px double #0F172A;
        }}
        .total-amount {{
            font-size: 12px;
            color: #0F172A;
        }}
        .trace {{
            color: #64748B;
            font-style: italic;
        }}
        .text-center {{ text-align: center; }}
        .text-right {{ text-align: right; }}
        .font-bold {{ font-weight: 700; }}
        .font-mono {{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }}
        .bill-header {{ margin-top: 20px; margin-bottom: 10px; }}
        .bill-header h2 {{ margin: 0 0 4px 0; font-size: 16px; color: #0F172A; }}
        .bill-worksection {{ margin: 0; color: #475569; font-weight: 600; font-size: 11px; }}
        .bill-preamble {{ color: #64748B; font-size: 10px; margin: 6px 0 0 0; }}
    </style>
</head>
<body>
    <div class="no-print">
        <button class="btn" onclick="window.print()">Print / Save as PDF</button>
        <button class="btn" style="background-color: #475569;" onclick="window.close()">Close</button>
    </div>

    <!-- COVER PAGE -->
    <div class="cover-page page-break">
        <div style="font-size: 13px; font-weight: 700; color: #2563EB; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 16px;">
            NIQS BESMM4 BUILDING WORKS
        </div>
        <div class="cover-title">
            {html.escape(boq_data.get("title", "BILL OF QUANTITIES").upper())}
        </div>
        <div class="cover-subtitle">
            Prepared in Accordance with the Nigerian Institute of Quantity Surveyors (NIQS) BESMM4 Standard
        </div>

        <table class="cover-meta">
            <tr>
                <td style="font-weight: 700; color: #475569;">Project:</td>
                <td style="font-weight: 700;">{html.escape(project.name)}</td>
            </tr>
            <tr>
                <td style="font-weight: 700; color: #475569;">Employer / Client:</td>
                <td>{html.escape(project.client or "Private Client")}</td>
            </tr>
            <tr>
                <td style="font-weight: 700; color: #475569;">Location:</td>
                <td>{html.escape(project.location or "Nigeria")}</td>
            </tr>
            <tr>
                <td style="font-weight: 700; color: #475569;">Currency:</td>
                <td>{curr} ({sym})</td>
            </tr>
            <tr>
                <td style="font-weight: 700; color: #475569;">Measurement Standard:</td>
                <td>NIQS BESMM4 (Fourth Edition 2015)</td>
            </tr>
            <tr>
                <td style="font-weight: 700; color: #475569;">Taking-Off Engine:</td>
                <td>PlanToBOQ AI Measurement Suite v2.0</td>
            </tr>
        </table>

        <div style="margin-top: 40px; font-size: 10px; color: #94A3B8;">
            PlanToBOQ Production Taking-off & Measurement Engine • All rights reserved.
        </div>
    </div>

    <!-- MAIN SUMMARY -->
    <div class="page-break">
        <div class="bill-header">
            <h2>BILL OF QUANTITIES — GRAND SUMMARY</h2>
            <p class="bill-worksection">PROJECT: {html.escape(project.name.upper())}</p>
        </div>

        <table class="boq-table">
            <thead>
                <tr>
                    <th style="width: 15%;">Bill Nr</th>
                    <th style="width: 50%;">Description / Work Section</th>
                    <th style="width: 15%;">Ref Sheet</th>
                    <th style="width: 20%;">Total Amount ({sym})</th>
                </tr>
            </thead>
            <tbody>
                {"".join(summary_rows)}
                <tr class="subtotal-row" style="background-color: #F1F5F9;">
                    <td colspan="3" class="text-right font-bold">SUB-TOTAL 1 (MEASURED WORKS):</td>
                    <td class="text-right font-bold">{sym}{fmt_num(sub1)}</td>
                </tr>
                <tr>
                    <td class="text-center font-bold">Provisional</td>
                    <td>Add: Contingencies ({c_rate}% of Sub-Total 1)</td>
                    <td class="text-center">Provisional Sum</td>
                    <td class="text-right">{sym}{fmt_num(c_amt)}</td>
                </tr>
                <tr class="subtotal-row" style="background-color: #F1F5F9;">
                    <td colspan="3" class="text-right font-bold">SUB-TOTAL 2:</td>
                    <td class="text-right font-bold">{sym}{fmt_num(sub2)}</td>
                </tr>
                <tr>
                    <td class="text-center font-bold">Statutory</td>
                    <td>Add: Value Added Tax (VAT @ {vat_rate}%)</td>
                    <td class="text-center">Statutory Tax</td>
                    <td class="text-right">{sym}{fmt_num(vat_amt)}</td>
                </tr>
            </tbody>
            <tfoot>
                <tr style="background-color: #EFF6FF; border-top: 2px solid #0F172A; border-bottom: 3px double #0F172A;">
                    <td colspan="3" class="text-right font-bold" style="font-size: 13px; color: #1E3A8A;">TOTAL TENDER SUM CARRIED TO FORM OF TENDER:</td>
                    <td class="text-right font-bold" style="font-size: 14px; color: #1E3A8A;">{sym}{fmt_num(grand)}</td>
                </tr>
            </tfoot>
        </table>
    </div>

    <!-- INDIVIDUAL BILLS -->
    {"".join(bills_html)}

</body>
</html>
"""
    return html_out
