"""Raster-based floor plan detector for scanned plans or bitmap images.

Uses computer vision:
1. Adaptive / Otsu thresholding to separate ink from paper.
2. Morphological opening sized to wall thickness to eliminate thin text, dimension lines, and hatchings.
3. Contour / polygon simplification to extract wall bounding boxes and centre-lines.
4. Feeds into assemble.py for merging and room discovery.
"""

from __future__ import annotations

import cv2
import numpy as np

from ...schemas import SheetGeometry
from ..specs import Specs
from .assemble import Evidence, Label, Seg, assemble, merge_collinear, rect_to_seg, snap_junctions, to_geometry


def detect_raster(
    img_bgr: np.ndarray,
    specs: Specs,
) -> tuple[SheetGeometry, float | None, list[str]]:
    notes: list[str] = ["Running computer vision raster analysis."]
    h, w = img_bgr.shape[:2]
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    # 1. Binarize (black ink on white background -> white ink on black background)
    # Otsu thresholding
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # Estimate wall thickness from distance transform
    dist = cv2.distanceTransform(thresh, cv2.DIST_L2, 5)
    max_d = float(np.max(dist)) if np.max(dist) > 0 else 5.0
    est_wall_thickness = max(4, int(max_d * 0.8))

    # 2. Morphological opening: filter out thin lines (dimension lines, text, hatching)
    # Kernel size equal to ~50% of wall thickness removes thin lines while keeping walls
    k_size = max(3, int(est_wall_thickness * 0.5))
    if k_size % 2 == 0:
        k_size += 1
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k_size, k_size))
    wall_mask = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)

    # Closing to bridge tiny noise gaps
    wall_mask = cv2.morphologyEx(wall_mask, cv2.MORPH_CLOSE, kernel)

    # 3. Find contours of wall areas
    contours, hierarchy = cv2.findContours(wall_mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    notes.append(f"Found {len(contours)} candidate contours after morphological filtering.")

    segs: list[Seg] = []
    min_area = (est_wall_thickness * 2) ** 2

    for c in contours:
        area = cv2.contourArea(c)
        if area < min_area:
            continue
        # Approximate contour with polygon
        eps = 0.02 * cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, eps, True)
        if len(approx) < 4:
            continue

        rect = cv2.minAreaRect(c)
        (cx, cy), (rw, rh), angle = rect
        short, long_ = min(rw, rh), max(rw, rh)
        if short < 3 or long_ < est_wall_thickness * 2:
            continue
        if long_ / max(short, 1) < 1.4:
            continue

        # Convert minAreaRect to Seg
        box_pts = cv2.boxPoints(rect)
        # Find which side is long
        d01 = np.linalg.norm(box_pts[1] - box_pts[0])
        d12 = np.linalg.norm(box_pts[2] - box_pts[1])
        if d01 >= d12:
            pt_a = (box_pts[0] + box_pts[3]) / 2
            pt_b = (box_pts[1] + box_pts[2]) / 2
            t = d12
        else:
            pt_a = (box_pts[0] + box_pts[1]) / 2
            pt_b = (box_pts[3] + box_pts[2]) / 2
            t = d01
        segs.append(Seg(pt_a.astype(float), pt_b.astype(float), float(t)))

    if not segs:
        notes.append("No linear wall structures identified from raster mask.")
        return SheetGeometry(), None, notes

    t_max = max((s.t for s in segs), default=10.0)
    notes.append(f"Extracted {len(segs)} initial wall segments.")

    # 4. Gap classification
    def classify_gap(centre: np.ndarray, d: np.ndarray, gap_len: float, t: float) -> str | None:
        if 2.0 * t <= gap_len <= 15.0 * t:
            return "door" if gap_len <= 8.0 * t else "window"
        return None

    evidence = Evidence(classify_gap=classify_gap)

    # 5. Merge and snap
    merged, openings = merge_collinear(segs, evidence, t_max)
    snap_junctions(merged)

    # 6. Assemble
    labels: list[Label] = []
    asm = assemble(merged, openings, labels)

    def opening_type_for(kind: str, width_px: float) -> str:
        cands = [ot for ot in specs.opening_types if ot.kind == kind]
        return cands[0].mark if cands else ("D1" if kind == "door" else "W1")

    geometry = to_geometry(asm, opening_type_for)
    return geometry, None, notes
