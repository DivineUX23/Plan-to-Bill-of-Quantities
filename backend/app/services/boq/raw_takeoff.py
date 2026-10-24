"""Traditional Quantity Surveyor raw dimension sheet calculations and BOQ integration."""

from __future__ import annotations

import re
import uuid
from typing import Any

from ...schemas import RawTakeoffRow


def _uuid() -> str:
    return uuid.uuid4().hex


def parse_timesing(timesing_str: str | float | int | None) -> float:
    """Parse traditional QS timesing notation like '1', '2/', '2/3/', '4' into a product."""
    if timesing_str is None:
        return 1.0
    if isinstance(timesing_str, (int, float)):
        return float(timesing_str)

    s = str(timesing_str).strip()
    if not s:
        return 1.0

    # Clean notation: '2/3/' -> '2*3'
    parts = re.split(r"[/x*]", s)
    product = 1.0
    for p in parts:
        p_clean = p.strip()
        if p_clean:
            try:
                product *= float(p_clean)
            except ValueError:
                pass
    return product if product > 0 else 1.0


def calculate_squaring(row: dict | RawTakeoffRow) -> float:
    """Calculate squaring (product of timesing and valid dimensions)."""
    if isinstance(row, RawTakeoffRow):
        timesing_val = row.timesing
        d1 = row.dim1
        d2 = row.dim2
        d3 = row.dim3
    else:
        timesing_val = row.get("timesing", "1")
        d1 = row.get("dim1")
        d2 = row.get("dim2")
        d3 = row.get("dim3")

    t = parse_timesing(timesing_val)
    dims = [float(d) for d in [d1, d2, d3] if d is not None and float(d) > 0]

    if not dims:
        return round(t, 2)
    prod = t
    for d in dims:
        prod *= d
    return round(prod, 2)


def convert_raw_takeoff_to_boq_items(rows: list[dict]) -> dict[int, list[dict]]:
    """Group raw dimension sheet entries into BOQ items by bill_number."""
    grouped_by_bill: dict[int, dict[tuple[str, str], dict]] = {}

    for r in rows:
        sq = calculate_squaring(r)
        if sq <= 0:
            continue

        b_num = int(r.get("bill_number") or 2)
        desc = (r.get("description") or "Unspecified item").strip()
        unit = (r.get("unit") or "m²").strip()
        work_sec = r.get("work_section") or ""

        key = (desc, unit)
        bill_dict = grouped_by_bill.setdefault(b_num, {})
        if key not in bill_dict:
            bill_dict[key] = {
                "id": _uuid(),
                "description": desc,
                "unit": unit,
                "work_section": work_sec,
                "quantity": 0.0,
                "traces": [],
            }
        bill_dict[key]["quantity"] += sq
        dim_str = " × ".join(str(d) for d in [r.get("dim1"), r.get("dim2"), r.get("dim3")] if d is not None)
        trace_note = f"Dim Sheet: {r.get('timesing', '1')} [{dim_str}] = {sq:.2f} {unit}"
        bill_dict[key]["traces"].append(trace_note)

    # Format result per bill
    result: dict[int, list[dict]] = {}
    for b_num, items in grouped_by_bill.items():
        result[b_num] = []
        for (desc, unit), itm in items.items():
            result[b_num].append({
                "id": itm["id"],
                "description": desc,
                "unit": unit,
                "quantity": round(itm["quantity"], 2),
                "element": itm["work_section"] or "Measured Work",
                "trace": itm["traces"],
            })

    return result
