"""Unified detection service.

Dispatches between Vector, Raster, and optional AI Vision detectors.
"""

from __future__ import annotations

import io
import cv2
import numpy as np
from PIL import Image

from ...schemas import DetectResult, SheetGeometry
from ..specs import Specs
from .ai_vision import detect_ai_vision
from .raster import detect_raster
from .vector import detect_vector


async def detect_sheet_layout(
    method: str,
    raw_file_bytes: bytes,
    file_content_type: str,
    page_index: int,
    sheet_image_bytes: bytes,
    width_px: int,
    height_px: int,
    is_vector: bool,
    specs: Specs,
) -> DetectResult:
    notes: list[str] = []
    geom = SheetGeometry()
    suggested_scale: float | None = None
    actual_method = method

    # 1. AI Vision if explicitly chosen
    if method == "ai":
        geom, suggested_scale, ai_notes = await detect_ai_vision(sheet_image_bytes, width_px, height_px, specs)
        notes.extend(ai_notes)
        return DetectResult(method="ai", geometry=geom, suggested_scale_m_per_px=suggested_scale, notes=notes)

    # 2. Vector detection if vector PDF or auto
    if method in ("auto", "vector") and file_content_type == "application/pdf":
        try:
            geom, suggested_scale, v_notes = detect_vector(
                raw_file_bytes, page_index, width_px, height_px, specs
            )
            notes.extend(v_notes)
            if geom.walls or method == "vector":
                actual_method = "vector"
                return DetectResult(
                    method=actual_method,
                    geometry=geom,
                    suggested_scale_m_per_px=suggested_scale,
                    notes=notes,
                )
        except Exception as e:
            notes.append(f"Vector detection encountered an issue: {e}. Falling back to raster.")

    # 3. Raster CV fallback
    actual_method = "raster"
    try:
        # Convert sheet_image_bytes (PNG) to OpenCV BGR
        pil_img = Image.open(io.BytesIO(sheet_image_bytes)).convert("RGB")
        img_bgr = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        geom, r_scale, r_notes = detect_raster(img_bgr, specs)
        notes.extend(r_notes)
        if suggested_scale is None:
            suggested_scale = r_scale
    except Exception as e:
        notes.append(f"Raster detection error: {e}")

    return DetectResult(
        method=actual_method,
        geometry=geom,
        suggested_scale_m_per_px=suggested_scale,
        notes=notes,
    )
