"""Export BESMM4 Bill of Quantities to professional multi-tab Excel workbook.

Features:
- Cover Page with formal QS project details
- Grand Summary with dynamic Excel formulas referencing each Bill sheet
- Individual sheets for Bills 1 through 6
- Formulas for Amount (=Qty*Rate) and Bill Subtotals (=SUM(...))
- Proper cell styles, borders, column widths, and currency formatting.
"""

from __future__ import annotations

import io
import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from ...models import Project


def export_boq_xlsx(project: Project, boq_data: dict) -> bytes:
    wb = openpyxl.Workbook()
    # Remove default sheet
    wb.remove(wb.active)

    currency_sym = boq_data.get("currency_symbol", "₦")
    num_fmt_curr = f'"{currency_sym}"#,##0.00'
    num_fmt_qty = "#,##0.00" if boq_data.get("rounding_rule") == "two_dp" else "#,##0"

    # Color Palette (Corporate QS Theme)
    NAVY = "0F172A"
    ROYAL = "1E3A8A"
    LIGHT_BLUE = "DBEAFE"
    MUTED_GRAY = "F1F5F9"
    BORDER_COLOR = "CBD5E1"
    WHITE = "FFFFFF"

    font_cover_title = Font(name="Calibri", size=18, bold=True, color=NAVY)
    font_cover_sub = Font(name="Calibri", size=12, italic=True, color="475569")
    font_cover_meta = Font(name="Calibri", size=11, bold=True, color="334155")
    font_cover_val = Font(name="Calibri", size=11, color="0F172A")

    font_sheet_title = Font(name="Calibri", size=14, bold=True, color=WHITE)
    font_sheet_sub = Font(name="Calibri", size=10, italic=True, color=WHITE)
    font_header = Font(name="Calibri", size=10, bold=True, color=WHITE)
    font_section = Font(name="Calibri", size=10, bold=True, color=ROYAL)
    font_bold = Font(name="Calibri", size=10, bold=True)
    font_regular = Font(name="Calibri", size=10)
    font_trace = Font(name="Calibri", size=8, italic=True, color="64748B")

    fill_title = PatternFill(start_color=NAVY, end_color=NAVY, fill_type="solid")
    fill_header = PatternFill(start_color=ROYAL, end_color=ROYAL, fill_type="solid")
    fill_section = PatternFill(start_color=LIGHT_BLUE, end_color=LIGHT_BLUE, fill_type="solid")
    fill_subtotal = PatternFill(start_color=MUTED_GRAY, end_color=MUTED_GRAY, fill_type="solid")

    thin_border = Border(
        left=Side(style="thin", color=BORDER_COLOR),
        right=Side(style="thin", color=BORDER_COLOR),
        top=Side(style="thin", color=BORDER_COLOR),
        bottom=Side(style="thin", color=BORDER_COLOR),
    )
    double_bottom_border = Border(
        left=Side(style="thin", color=BORDER_COLOR),
        right=Side(style="thin", color=BORDER_COLOR),
        top=Side(style="thin", color=BORDER_COLOR),
        bottom=Side(style="double", color=NAVY),
    )

    # --------------------------------------------------------------------------
    # 1. COVER PAGE SHEET
    # --------------------------------------------------------------------------
    ws_cover = wb.create_sheet(title="Project Info")
    ws_cover.views.sheetView[0].showGridLines = True

    ws_cover.column_dimensions["A"].width = 5
    ws_cover.column_dimensions["B"].width = 24
    ws_cover.column_dimensions["C"].width = 50

    ws_cover.merge_cells("B3:C3")
    ws_cover["B3"] = boq_data.get("title", f"BILL OF QUANTITIES - {project.name.upper()}").upper()
    ws_cover["B3"].font = font_cover_title
    ws_cover["B3"].alignment = Alignment(vertical="center")
    ws_cover.row_dimensions[3].height = 32

    ws_cover.merge_cells("B4:C4")
    ws_cover["B4"] = "PREPARED IN ACCORDANCE WITH NIQS BESMM4 (BUILDING & ENGINEERING STANDARD METHOD OF MEASUREMENT 4TH EDITION)"
    ws_cover["B4"].font = font_cover_sub
    ws_cover["B4"].alignment = Alignment(vertical="center")
    ws_cover.row_dimensions[4].height = 20

    meta_rows = [
        ("PROJECT NAME", project.name),
        ("EMPLOYER / CLIENT", project.client or "Private Client"),
        ("SITE LOCATION", project.location or "Nigeria"),
        ("MEASUREMENT STANDARD", "NIQS BESMM4 (NRM2 / CESMM4 Adaptation)"),
        ("DOCUMENT TYPE", "Firm Elemental Bill of Quantities"),
        ("CURRENCY", f"{boq_data.get('currency', 'NGN')} ({currency_sym})"),
        ("ROUNDING CONVENTION", "BESMM4 Rule 1.5.3 (Tonnes: 2 dp; Others: Nearest whole unit)" if boq_data.get("rounding_rule") == "besmm4_whole" else "Standard (2 Decimal Places)"),
        ("ENGINE / GENERATOR", "AutoPlan AI Taking-Off & Measurement Engine v2.0"),
    ]

    start_r = 7
    for idx, (lbl, val) in enumerate(meta_rows):
        r = start_r + idx
        ws_cover.cell(row=r, column=2, value=lbl).font = font_cover_meta
        ws_cover.cell(row=r, column=3, value=val).font = font_cover_val
        ws_cover.cell(row=r, column=2).border = thin_border
        ws_cover.cell(row=r, column=3).border = thin_border
        ws_cover.row_dimensions[r].height = 22

    # --------------------------------------------------------------------------
    # 2. INDIVIDUAL BILL SHEETS (BILL 1 TO BILL 6)
    # --------------------------------------------------------------------------
    bill_sheet_names: dict[int, str] = {}
    bill_total_cells: dict[int, str] = {}

    for b in boq_data.get("bills", []):
        b_num = b.get("bill_number", 1)
        short_title = f"Bill {b_num}"
        ws = wb.create_sheet(title=short_title)
        ws.views.sheetView[0].showGridLines = True
        bill_sheet_names[b_num] = short_title

        # Header banner
        ws.merge_cells("A1:G1")
        ws["A1"] = f"BILL NR. {b_num}: {b.get('title', '').upper()}"
        ws["A1"].font = font_sheet_title
        ws["A1"].fill = fill_title
        ws["A1"].alignment = Alignment(horizontal="center", vertical="center")
        ws.row_dimensions[1].height = 28

        ws.merge_cells("A2:G2")
        ws["A2"] = f"{project.name.upper()} | {b.get('work_section', '')}"
        ws["A2"].font = font_sheet_sub
        ws["A2"].fill = fill_title
        ws["A2"].alignment = Alignment(horizontal="center", vertical="center")
        ws.row_dimensions[2].height = 18

        # Column headers
        headers = ["Item", "BESMM4 Code", "Description & Specifications", "Qty", "Unit", f"Rate ({currency_sym})", f"Amount ({currency_sym})"]
        r = 4
        for col_idx, h in enumerate(headers, 1):
            c = ws.cell(row=r, column=col_idx, value=h)
            c.font = font_header
            c.fill = fill_header
            c.alignment = Alignment(horizontal="center" if col_idx in (1, 2, 4, 5) else "right" if col_idx in (6, 7) else "left", vertical="center")
        ws.row_dimensions[r].height = 22

        item_rows_start = 5
        curr_r = item_rows_start
        current_element = None

        for itm in b.get("items", []):
            elem = itm.get("element")
            if elem and elem != current_element:
                current_element = elem
                ws.merge_cells(start_row=curr_r, start_column=1, end_row=curr_r, end_column=7)
                c_elem = ws.cell(row=curr_r, column=1, value=elem.upper())
                c_elem.font = font_section
                c_elem.fill = fill_section
                ws.row_dimensions[curr_r].height = 20
                curr_r += 1

            ws.cell(row=curr_r, column=1, value=itm.get("item_ref", "")).font = font_bold
            ws.cell(row=curr_r, column=1).alignment = Alignment(horizontal="center", vertical="top")

            # BESMM4 Code (Rule 1.14.02)
            c_code = ws.cell(row=curr_r, column=2, value=itm.get("code", ""))
            c_code.font = Font(name="Consolas", size=9, bold=True, color=ROYAL)
            c_code.alignment = Alignment(horizontal="center", vertical="top")

            ws.cell(row=curr_r, column=3, value=itm.get("description", "")).font = font_regular
            ws.cell(row=curr_r, column=3).alignment = Alignment(wrap_text=True, vertical="top")

            # Qty
            qty_val = float(itm.get("quantity") or 0.0)
            c_qty = ws.cell(row=curr_r, column=4, value=qty_val)
            c_qty.font = font_bold
            c_qty.alignment = Alignment(horizontal="right", vertical="top")
            c_qty.number_format = num_fmt_qty if itm.get("unit") != "nr" else "#,##0"

            # Unit
            c_unit = ws.cell(row=curr_r, column=5, value=itm.get("unit", ""))
            c_unit.font = font_regular
            c_unit.alignment = Alignment(horizontal="center", vertical="top")

            # Rate
            rate_val = float(itm.get("rate") or 0.0)
            c_rate = ws.cell(row=curr_r, column=6, value=rate_val)
            c_rate.font = font_regular
            c_rate.alignment = Alignment(horizontal="right", vertical="top")
            c_rate.number_format = num_fmt_curr

            # Amount formula = Qty * Rate (Column D * Column F)
            c_amt = ws.cell(row=curr_r, column=7, value=f"=D{curr_r}*F{curr_r}")
            c_amt.font = font_bold
            c_amt.alignment = Alignment(horizontal="right", vertical="top")
            c_amt.number_format = num_fmt_curr

            for col in range(1, 8):
                ws.cell(row=curr_r, column=col).border = thin_border

            curr_r += 1

            # Include audit trace if present
            if itm.get("trace"):
                for tr in itm["trace"][:2]:
                    ws.cell(row=curr_r, column=3, value=f"   Audit Trace: {tr}").font = font_trace
                    for col in range(1, 8):
                        ws.cell(row=curr_r, column=col).border = thin_border
                    curr_r += 1

        # Bill Subtotal row
        subtotal_row = curr_r
        ws.merge_cells(start_row=subtotal_row, start_column=1, end_row=subtotal_row, end_column=6)
        c_sub_label = ws.cell(row=subtotal_row, column=1, value=f"TOTAL BILL NR. {b_num} CARRIED TO MAIN SUMMARY")
        c_sub_label.font = font_bold
        c_sub_label.fill = fill_subtotal
        c_sub_label.alignment = Alignment(horizontal="right", vertical="center")

        # Sum formula (Column G)
        if curr_r > item_rows_start:
            c_sub_val = ws.cell(row=subtotal_row, column=7, value=f"=SUM(G{item_rows_start}:G{curr_r - 1})")
        else:
            c_sub_val = ws.cell(row=subtotal_row, column=7, value=0.0)

        c_sub_val.font = font_bold
        c_sub_val.fill = fill_subtotal
        c_sub_val.alignment = Alignment(horizontal="right", vertical="center")
        c_sub_val.number_format = num_fmt_curr

        for col in range(1, 8):
            ws.cell(row=subtotal_row, column=col).border = double_bottom_border

        bill_total_cells[b_num] = f"'{short_title}'!G{subtotal_row}"

        # Column widths
        ws.column_dimensions["A"].width = 8
        ws.column_dimensions["B"].width = 15
        ws.column_dimensions["C"].width = 56
        ws.column_dimensions["D"].width = 12
        ws.column_dimensions["E"].width = 10
        ws.column_dimensions["F"].width = 18
        ws.column_dimensions["G"].width = 22

    # --------------------------------------------------------------------------
    # 3. GRAND SUMMARY SHEET
    # --------------------------------------------------------------------------
    ws_sum = wb.create_sheet(title="Grand Summary", index=1)
    ws_sum.views.sheetView[0].showGridLines = True

    # Title Banner
    ws_sum.merge_cells("A1:D1")
    ws_sum["A1"] = f"BILL OF QUANTITIES - GRAND SUMMARY"
    ws_sum["A1"].font = font_sheet_title
    ws_sum["A1"].fill = fill_title
    ws_sum["A1"].alignment = Alignment(horizontal="center", vertical="center")
    ws_sum.row_dimensions[1].height = 28

    ws_sum.merge_cells("A2:D2")
    ws_sum["A2"] = f"PROJECT: {project.name.upper()} | NIQS BESMM4 COMPLIANT"
    ws_sum["A2"].font = font_sheet_sub
    ws_sum["A2"].fill = fill_title
    ws_sum["A2"].alignment = Alignment(horizontal="center", vertical="center")
    ws_sum.row_dimensions[2].height = 18

    # Summary table header
    r = 4
    ws_sum.cell(row=r, column=1, value="Bill Nr").font = font_header
    ws_sum.cell(row=r, column=1).fill = fill_header
    ws_sum.cell(row=r, column=1).alignment = Alignment(horizontal="center", vertical="center")

    ws_sum.cell(row=r, column=2, value="Description / Trade Element").font = font_header
    ws_sum.cell(row=r, column=2).fill = fill_header

    ws_sum.cell(row=r, column=3, value="Page / Sheet Ref").font = font_header
    ws_sum.cell(row=r, column=3).fill = fill_header
    ws_sum.cell(row=r, column=3).alignment = Alignment(horizontal="center", vertical="center")

    ws_sum.cell(row=r, column=4, value=f"Total Amount ({currency_sym})").font = font_header
    ws_sum.cell(row=r, column=4).fill = fill_header
    ws_sum.cell(row=r, column=4).alignment = Alignment(horizontal="right", vertical="center")
    ws_sum.row_dimensions[r].height = 22

    start_bills_r = 5
    curr_r = start_bills_r

    for b in boq_data.get("bills", []):
        b_num = b.get("bill_number", 1)
        ws_sum.cell(row=curr_r, column=1, value=f"Bill {b_num}").font = font_bold
        ws_sum.cell(row=curr_r, column=1).alignment = Alignment(horizontal="center")

        ws_sum.cell(row=curr_r, column=2, value=b.get("title", "")).font = font_bold
        ws_sum.cell(row=curr_r, column=3, value=f"Sheet: Bill {b_num}").font = font_regular
        ws_sum.cell(row=curr_r, column=3).alignment = Alignment(horizontal="center")

        cell_ref = bill_total_cells.get(b_num, "0")
        c_amt = ws_sum.cell(row=curr_r, column=4, value=f"={cell_ref}")
        c_amt.font = font_bold
        c_amt.alignment = Alignment(horizontal="right")
        c_amt.number_format = num_fmt_curr

        for col in range(1, 5):
            ws_sum.cell(row=curr_r, column=col).border = thin_border
        curr_r += 1

    end_bills_r = curr_r - 1

    # Sub-Total 1
    r_sub1 = curr_r
    ws_sum.cell(row=r_sub1, column=1, value="").font = font_bold
    ws_sum.cell(row=r_sub1, column=2, value="SUB-TOTAL 1 (MEASURED WORKS)").font = font_bold
    ws_sum.cell(row=r_sub1, column=3, value="").font = font_bold
    c_sub1 = ws_sum.cell(row=r_sub1, column=4, value=f"=SUM(D{start_bills_r}:D{end_bills_r})")
    c_sub1.font = font_bold
    c_sub1.alignment = Alignment(horizontal="right")
    c_sub1.number_format = num_fmt_curr
    for col in range(1, 5):
        ws_sum.cell(row=r_sub1, column=col).border = thin_border
        ws_sum.cell(row=r_sub1, column=col).fill = fill_subtotal
    curr_r += 1

    # Contingency Sum
    r_cont = curr_r
    c_rate = boq_data.get("summary", {}).get("contingency_rate", 5.0)
    ws_sum.cell(row=r_cont, column=1, value="").font = font_regular
    ws_sum.cell(row=r_cont, column=2, value=f"Add: Contingencies ({c_rate}% of Sub-Total 1)").font = font_regular
    ws_sum.cell(row=r_cont, column=3, value="Provisional").font = font_regular
    ws_sum.cell(row=r_cont, column=3).alignment = Alignment(horizontal="center")
    c_cont_amt = ws_sum.cell(row=r_cont, column=4, value=f"=D{r_sub1}*({c_rate}/100)")
    c_cont_amt.font = font_regular
    c_cont_amt.alignment = Alignment(horizontal="right")
    c_cont_amt.number_format = num_fmt_curr
    for col in range(1, 5):
        ws_sum.cell(row=r_cont, column=col).border = thin_border
    curr_r += 1

    # Sub-Total 2
    r_sub2 = curr_r
    ws_sum.cell(row=r_sub2, column=1, value="").font = font_bold
    ws_sum.cell(row=r_sub2, column=2, value="SUB-TOTAL 2").font = font_bold
    ws_sum.cell(row=r_sub2, column=3, value="").font = font_bold
    c_sub2 = ws_sum.cell(row=r_sub2, column=4, value=f"=D{r_sub1}+D{r_cont}")
    c_sub2.font = font_bold
    c_sub2.alignment = Alignment(horizontal="right")
    c_sub2.number_format = num_fmt_curr
    for col in range(1, 5):
        ws_sum.cell(row=r_sub2, column=col).border = thin_border
        ws_sum.cell(row=r_sub2, column=col).fill = fill_subtotal
    curr_r += 1

    # VAT 7.5%
    r_vat = curr_r
    vat_rate = boq_data.get("summary", {}).get("vat_rate", 7.5)
    ws_sum.cell(row=r_vat, column=1, value="").font = font_regular
    ws_sum.cell(row=r_vat, column=2, value=f"Add: Value Added Tax (VAT @ {vat_rate}%)").font = font_regular
    ws_sum.cell(row=r_vat, column=3, value="Statutory").font = font_regular
    ws_sum.cell(row=r_vat, column=3).alignment = Alignment(horizontal="center")
    c_vat_amt = ws_sum.cell(row=r_vat, column=4, value=f"=D{r_sub2}*({vat_rate}/100)")
    c_vat_amt.font = font_regular
    c_vat_amt.alignment = Alignment(horizontal="right")
    c_vat_amt.number_format = num_fmt_curr
    for col in range(1, 5):
        ws_sum.cell(row=r_vat, column=col).border = thin_border
    curr_r += 1

    # Grand Total Tender Sum
    r_grand = curr_r
    ws_sum.cell(row=r_grand, column=1, value="").font = font_cover_title
    ws_sum.cell(row=r_grand, column=2, value="TOTAL TENDER SUM CARRIED TO FORM OF TENDER").font = Font(name="Calibri", size=11, bold=True, color=NAVY)
    ws_sum.cell(row=r_grand, column=3, value="").font = font_bold
    c_grand = ws_sum.cell(row=r_grand, column=4, value=f"=D{r_sub2}+D{r_vat}")
    c_grand.font = Font(name="Calibri", size=12, bold=True, color=NAVY)
    c_grand.alignment = Alignment(horizontal="right")
    c_grand.number_format = num_fmt_curr
    for col in range(1, 5):
        ws_sum.cell(row=r_grand, column=col).border = double_bottom_border
        ws_sum.cell(row=r_grand, column=col).fill = fill_section
    ws_sum.row_dimensions[r_grand].height = 26

    # Summary Column widths
    ws_sum.column_dimensions["A"].width = 12
    ws_sum.column_dimensions["B"].width = 54
    ws_sum.column_dimensions["C"].width = 20
    ws_sum.column_dimensions["D"].width = 26

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
