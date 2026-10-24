"""Drawing ingestion: render PDF pages / images to sheet images and expose vector content."""

from __future__ import annotations

import io
from dataclasses import dataclass

import numpy as np
import pymupdf
from PIL import Image

from ..config import get_settings

PDF_TYPES = {"application/pdf"}
IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp", "image/tiff", "image/bmp"}
MAX_PAGES = 30


class DrawingError(ValueError):
    pass


@dataclass
class RenderedPage:
    index: int
    png: bytes
    width_px: int
    height_px: int
    dpi: float | None
    is_vector: bool


def sniff_type(data: bytes, declared: str | None, filename: str) -> str:
    if data[:5] == b"%PDF-":
        return "application/pdf"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if declared in IMAGE_TYPES:
        return declared
    raise DrawingError("Unsupported file. Upload a PDF, PNG or JPG drawing.")


def _dpi_for(width_pt: float, height_pt: float) -> int:
    s = get_settings()
    longest_in = max(width_pt, height_pt) / 72.0
    return int(min(s.render_max_dpi, s.render_max_px / longest_in))


def render(data: bytes, content_type: str) -> list[RenderedPage]:
    if content_type in PDF_TYPES:
        return _render_pdf(data)
    return [_render_image(data)]


def _render_pdf(data: bytes) -> list[RenderedPage]:
    try:
        doc = pymupdf.open(stream=data, filetype="pdf")
    except Exception as e:  # noqa: BLE001
        raise DrawingError("This PDF couldn't be opened. Is it password-protected or damaged?") from e
    if doc.page_count == 0:
        raise DrawingError("The PDF has no pages.")
    pages = []
    for i, page in enumerate(doc):
        if i >= MAX_PAGES:
            break
        dpi = _dpi_for(page.rect.width, page.rect.height)
        pix = page.get_pixmap(dpi=dpi, alpha=False)
        is_vector = len(page.get_drawings()) > 20
        pages.append(RenderedPage(i, pix.tobytes("png"), pix.width, pix.height, dpi, is_vector))
    return pages


def _render_image(data: bytes) -> RenderedPage:
    s = get_settings()
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except Exception as e:  # noqa: BLE001
        raise DrawingError("This image couldn't be read.") from e
    img = img.convert("RGB")
    scale = min(1.0, s.render_max_px / max(img.size))
    if scale < 1.0:
        img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return RenderedPage(0, buf.getvalue(), img.width, img.height, None, False)


def open_page(data: bytes, index: int) -> pymupdf.Page:
    doc = pymupdf.open(stream=data, filetype="pdf")
    return doc[index]


def png_to_gray(png: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(png)).convert("L")
    return np.array(img)
