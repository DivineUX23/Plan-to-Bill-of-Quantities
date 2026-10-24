"""Vector-based floor plan detector for CAD / digital PDF drawings.

Reads exact vector shapes directly from the PDF via PyMuPDF:
- Solid wall polygons / filled paths
- Door arcs (Bézier curves)
- Window line groups
- Room labels & dimension text
"""

from __future__ import annotations

import math
from typing import Callable

import numpy as np
import pymupdf
from shapely.geometry import Point, Polygon, box

from ...schemas import SheetGeometry
from ..specs import Specs
from .assemble import Evidence, Label, OpeningCandidate, Seg, assemble, merge_collinear, rect_to_seg, snap_junctions, to_geometry


def _is_dark_fill(fill) -> bool:
    if fill is None:
        return False
    if isinstance(fill, (int, float)):
        return fill < 0.3
    if isinstance(fill, (list, tuple)):
        # RGB or Gray or CMYK
        return sum(fill[:3]) / max(len(fill[:3]), 1) < 0.4
    return False


def detect_vector(
    pdf_bytes: bytes,
    page_index: int,
    width_px: int,
    height_px: int,
    specs: Specs,
) -> tuple[SheetGeometry, float | None, list[str]]:
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    page = doc[page_index]
    rect = page.rect
    sx = width_px / rect.width
    sy = height_px / rect.height

    drawings = page.get_drawings()
    notes: list[str] = [f"Found {len(drawings)} vector graphic items on drawing."]

    # 1. Door arcs (curves in drawing strokes)
    door_arcs: list[tuple[np.ndarray, float]] = []  # (centre_px, radius_px)
    window_strokes: list[tuple[np.ndarray, np.ndarray]] = []

    for d in drawings:
        fill = d.get("fill")
        items = d.get("items", [])
        is_stroke = fill is None and d.get("color") is not None
        for it in items:
            if it[0] == "c":  # Bézier curve
                # it = ('c', p1, p2, p3, p4)
                p1, p4 = it[1], it[4]
                r = d["rect"]
                # Door swing curves typically span 20-80 pt
                if 15 < max(r.width, r.height) < 120 and min(r.width, r.height) > 10:
                    c_pt = np.array([(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2])
                    radius_px = max(r.width, r.height) * ((sx + sy) / 2)
                    door_arcs.append((np.array([c_pt[0] * sx, c_pt[1] * sy]), radius_px))
            elif it[0] == "l" and is_stroke:
                p1, p2 = it[1], it[2]
                window_strokes.append(
                    (np.array([p1.x * sx, p1.y * sy]), np.array([p2.x * sx, p2.y * sy]))
                )

    # 2. Extract wall polygons
    segs: list[Seg] = []
    wall_polys: list[Polygon] = []

    for d in drawings:
        fill = d.get("fill")
        if not _is_dark_fill(fill):
            continue
        r = d["rect"]
        w_pt, h_pt = r.width, r.height
        short_pt, long_pt = min(w_pt, h_pt), max(w_pt, h_pt)
        # In PDF points, wall thickness is typically 3 to 25 pt (e.g. 5.76 pt internal, 11.52 pt external)
        # Length is typically > 10 pt
        if 2.5 <= short_pt <= 30.0 and long_pt >= 8.0:
            poly_px = box(r.x0 * sx, r.y0 * sy, r.x1 * sx, r.y1 * sy)
            seg = rect_to_seg(poly_px, min_aspect=1.2)
            if seg is not None:
                segs.append(seg)
                wall_polys.append(poly_px)

    if not segs:
        notes.append("No solid filled walls found in vector paths.")
        return SheetGeometry(), None, notes

    t_max = max((s.t for s in segs), default=10.0)
    notes.append(f"Detected {len(segs)} raw wall segments (max thickness ~{t_max:.1f}px).")

    # 3. Text labels for rooms & scale hints
    labels: list[Label] = []
    text_words = page.get_text("words")
    for w in text_words:
        # w: (x0, y0, x1, y1, word, block_no, line_no, word_no)
        text = w[4].strip()
        if text:
            labels.append(Label(text=text, x=((w[0] + w[2]) / 2) * sx, y=((w[1] + w[3]) / 2) * sy))

    # Suggested scale detection: check if there are dimension texts matching total span
    suggested_scale: float | None = None
    all_x = [s.a[0] for s in segs] + [s.b[0] for s in segs]
    all_y = [s.a[1] for s in segs] + [s.b[1] for s in segs]
    span_x = max(all_x) - min(all_x) if all_x else 0
    span_y = max(all_y) - min(all_y) if all_y else 0

    # Look for imperial or metric overall dimension annotations
    for w in text_words:
        txt = w[4].strip()
        if txt == "20'" and span_x > 100:
            # 20 feet = 6.096 m
            suggested_scale = round(6.096 / span_x, 5)
        elif txt == "45'" and span_y > 100 and suggested_scale is None:
            # 45 feet = 13.716 m
            suggested_scale = round(13.716 / span_y, 5)

    # 4. Gap classification hook (door vs window)
    def classify_gap(centre: np.ndarray, d: np.ndarray, gap_len: float, t: float) -> str | None:
        # Check if near any door arc
        for arc_centre, radius in door_arcs:
            dist = float(np.linalg.norm(centre - arc_centre))
            if dist <= max(radius * 1.5, gap_len * 1.2):
                return "door"
        # Check if gap contains parallel window strokes
        n_strokes = 0
        for p1, p2 in window_strokes:
            mid = (p1 + p2) / 2
            if np.linalg.norm(centre - mid) <= gap_len * 0.8:
                n_strokes += 1
        if n_strokes >= 1:
            return "window"
        # If gap is standard door/window width
        if 2.0 * t <= gap_len <= 15.0 * t:
            # Fallback to door or window based on size
            return "door" if gap_len <= 8.0 * t else "window"
        return None

    evidence = Evidence(classify_gap=classify_gap)

    # 5. Merge collinear pieces across openings
    merged, openings = merge_collinear(segs, evidence, t_max)
    notes.append(f"Merged into {len(merged)} continuous walls and {len(openings)} openings.")

    # 6. Snap wall junctions
    snap_junctions(merged)

    # 7. Assemble into rooms and final geometry
    asm = assemble(merged, openings, labels)
    notes.append(f"Formed {len(asm.rooms)} rooms with labels.")

    # Map opening candidates to specs types (D1, D2, W1, W2 etc.)
    def opening_type_for(kind: str, width_px: float) -> str:
        # Match closest opening type by kind
        cands = [ot for ot in specs.opening_types if ot.kind == kind]
        if not cands:
            return "D1" if kind == "door" else "W1"
        return cands[0].mark

    geometry = to_geometry(asm, opening_type_for)
    return geometry, suggested_scale, notes
