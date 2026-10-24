"""Sheets API endpoints: editor canvas operations, calibration, detection, and live sheet takeoff."""

from __future__ import annotations

import math
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Drawing, Project, Sheet
from ..schemas import DetectRequest, DetectResult, SheetGeometry, SheetOut, SheetUpdate, Takeoff
from ..services.detection import detect_sheet_layout
from ..services.quantities import compute_sheet_takeoff
from ..services.specs import load_specs
from ..services.storage import get_blob

router = APIRouter(prefix="/api/sheets", tags=["sheets"])


class CalibrateRequest(BaseModel):
    p1: tuple[float, float]
    p2: tuple[float, float]
    real_length_m: float = Field(..., gt=0)
    label: str = ""


@router.get("/{sheet_id}", response_model=SheetOut)
def get_sheet(sheet_id: str, db: Session = Depends(get_db)):
    sheet = db.query(Sheet).filter(Sheet.id == sheet_id).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")
    return sheet


@router.patch("/{sheet_id}", response_model=SheetOut)
def update_sheet(sheet_id: str, data: SheetUpdate, db: Session = Depends(get_db)):
    sheet = db.query(Sheet).filter(Sheet.id == sheet_id).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")

    if data.name is not None:
        sheet.name = data.name
    if data.scale_m_per_px is not None:
        sheet.scale_m_per_px = data.scale_m_per_px
    if data.calibration is not None:
        sheet.calibration = data.calibration
    if data.include is not None:
        sheet.include = data.include
    if data.has_substructure is not None:
        sheet.has_substructure = data.has_substructure
    if data.has_roof is not None:
        sheet.has_roof = data.has_roof
    if data.geometry is not None:
        sheet.geometry = data.geometry.model_dump()

    db.commit()
    db.refresh(sheet)
    return sheet


@router.get("/{sheet_id}/image")
def get_sheet_image(sheet_id: str, db: Session = Depends(get_db)):
    sheet = db.query(Sheet).filter(Sheet.id == sheet_id).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")
    blob = get_blob(db, sheet.image_blob_id)
    if not blob:
        raise HTTPException(status_code=404, detail="Sheet image data not found")
    return Response(
        content=blob.data,
        media_type=blob.content_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.post("/{sheet_id}/calibrate", response_model=SheetOut)
def calibrate_sheet(sheet_id: str, data: CalibrateRequest, db: Session = Depends(get_db)):
    sheet = db.query(Sheet).filter(Sheet.id == sheet_id).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")

    dx = data.p2[0] - data.p1[0]
    dy = data.p2[1] - data.p1[1]
    pixel_dist = math.sqrt(dx * dx + dy * dy)
    if pixel_dist < 5:
        raise HTTPException(status_code=400, detail="Points are too close to calibrate accurately.")

    scale = data.real_length_m / pixel_dist
    sheet.scale_m_per_px = scale
    sheet.calibration = {
        "p1": data.p1,
        "p2": data.p2,
        "pixel_distance": round(pixel_dist, 2),
        "real_length_m": data.real_length_m,
        "label": data.label,
    }
    db.commit()
    db.refresh(sheet)
    return sheet


@router.post("/{sheet_id}/detect", response_model=DetectResult)
async def detect_sheet(
    sheet_id: str,
    req: DetectRequest = DetectRequest(),
    apply: bool = Query(False, description="Whether to automatically save detected geometry to sheet"),
    db: Session = Depends(get_db),
):
    sheet = db.query(Sheet).filter(Sheet.id == sheet_id).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")

    drawing = db.query(Drawing).filter(Drawing.id == sheet.drawing_id).first()
    if not drawing:
        raise HTTPException(status_code=404, detail="Drawing not found")

    raw_blob = get_blob(db, drawing.blob_id)
    img_blob = get_blob(db, sheet.image_blob_id)
    if not raw_blob or not img_blob:
        raise HTTPException(status_code=404, detail="Drawing blob missing")

    project = db.query(Project).filter(Project.id == sheet.project_id).first()
    specs = load_specs(project.specs if project else None)

    result = await detect_sheet_layout(
        method=req.method,
        raw_file_bytes=raw_blob.data,
        file_content_type=drawing.content_type,
        page_index=sheet.page_index,
        sheet_image_bytes=img_blob.data,
        width_px=sheet.width_px,
        height_px=sheet.height_px,
        is_vector=sheet.is_vector,
        specs=specs,
    )

    if apply and result.geometry.walls:
        sheet.geometry = result.geometry.model_dump()
        if sheet.scale_m_per_px is None and result.suggested_scale_m_per_px:
            sheet.scale_m_per_px = result.suggested_scale_m_per_px
            sheet.calibration = {
                "source": "auto_detected_dimension",
                "scale_m_per_px": result.suggested_scale_m_per_px,
            }
        db.commit()

    return result


@router.get("/{sheet_id}/takeoff", response_model=Takeoff)
def get_live_sheet_takeoff(sheet_id: str, db: Session = Depends(get_db)):
    sheet = db.query(Sheet).filter(Sheet.id == sheet_id).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Sheet not found")
    project = db.query(Project).filter(Project.id == sheet.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return compute_sheet_takeoff(sheet, project)
