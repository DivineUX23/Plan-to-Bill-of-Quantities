"""Projects API endpoints."""

from __future__ import annotations

import io
from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Drawing, Project, Sheet
from ..schemas import (
    DrawingOut,
    ProjectCreate,
    ProjectOut,
    ProjectSummary,
    ProjectUpdate,
    SheetSummary,
    Takeoff,
)
from ..services.export_takeoff import export_takeoff_xlsx
from ..services.pdf import render, sniff_type
from ..services.quantities import compute_takeoff
from ..services.specs import default_specs, load_specs
from ..services.storage import delete_blob, save_blob

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=list[ProjectSummary])
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.created_at.desc()).all()
    out = []
    for p in projects:
        thumb_sheet = p.sheets[0].id if p.sheets else None
        out.append(
            ProjectSummary(
                id=p.id,
                name=p.name,
                client=p.client,
                location=p.location,
                created_at=p.created_at,
                updated_at=p.updated_at,
                sheet_count=len(p.sheets),
                thumbnail_sheet_id=thumb_sheet,
            )
        )
    return out


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(data: ProjectCreate, db: Session = Depends(get_db)):
    project = Project(
        name=data.name,
        client=data.client,
        location=data.location,
        specs=default_specs(),
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(project_id: str, data: ProjectUpdate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if data.name is not None:
        project.name = data.name
    if data.client is not None:
        project.client = data.client
    if data.location is not None:
        project.location = data.location
    if data.specs is not None:
        # Validate through Specs model
        validated = load_specs(data.specs).model_dump()
        project.specs = validated
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    # Clean up blobs
    for drawing in project.drawings:
        delete_blob(db, drawing.blob_id)
    for sheet in project.sheets:
        delete_blob(db, sheet.image_blob_id)
    db.delete(project)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{project_id}/drawings", response_model=list[SheetSummary])
async def upload_drawing(
    project_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    content_type = sniff_type(content, file.content_type, file.filename or "")

    # Save original drawing blob
    doc_blob_id = save_blob(db, content, content_type)

    # Render pages
    try:
        pages = render(content, content_type)
    except Exception as e:
        delete_blob(db, doc_blob_id)
        raise HTTPException(status_code=400, detail=str(e))

    drawing = Drawing(
        project_id=project.id,
        filename=file.filename or "drawing",
        content_type=content_type,
        blob_id=doc_blob_id,
        page_count=len(pages),
    )
    db.add(drawing)
    db.flush()

    new_sheets: list[Sheet] = []
    base_pos = len(project.sheets)
    for i, p in enumerate(pages):
        img_blob_id = save_blob(db, p.png, "image/png")
        name = f"Page {i + 1}" if len(pages) > 1 else (file.filename or "Sheet 1")
        sheet = Sheet(
            project_id=project.id,
            drawing_id=drawing.id,
            page_index=p.index,
            position=base_pos + i,
            name=name,
            image_blob_id=img_blob_id,
            width_px=p.width_px,
            height_px=p.height_px,
            render_dpi=p.dpi,
            is_vector=p.is_vector,
            geometry={},
        )
        db.add(sheet)
        new_sheets.append(sheet)

    db.commit()
    for s in new_sheets:
        db.refresh(s)
    return new_sheets


@router.get("/{project_id}/takeoff", response_model=Takeoff)
def get_project_takeoff(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return compute_takeoff(project)


@router.get("/{project_id}/takeoff/export")
def export_project_takeoff(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    takeoff = compute_takeoff(project)
    xlsx_bytes = export_takeoff_xlsx(project, takeoff)
    filename = f"{project.name.replace(' ', '_')}_Takeoff.xlsx"
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
