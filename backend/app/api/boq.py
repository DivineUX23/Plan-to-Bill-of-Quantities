"""FastAPI router for BESMM4 Bill of Quantities (BOQ) and Raw Dimension Sheets."""

from __future__ import annotations

import io
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import FileResponse, HTMLResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Boq, Project, RawTakeoff
from ..schemas import (
    BoqGenerateRequest,
    BoqOut,
    BoqUpdate,
    RawTakeoffOut,
    RawTakeoffRow,
    RawTakeoffUpdate,
)
from ..services.boq.export_excel import export_boq_xlsx
from ..services.boq.export_html import export_boq_html
from ..services.boq.generator import generate_boq_from_takeoff, recalculate_boq_totals
from ..services.boq.raw_takeoff import calculate_squaring, convert_raw_takeoff_to_boq_items
from ..services.boq.rules import DEFAULT_BENCHMARK_RATES, lookup_besmm4_reference
from ..services.quantities import compute_takeoff

router = APIRouter(prefix="/api", tags=["boq"])


def _get_project_or_404(db: Session, project_id: str) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Project '{project_id}' not found")
    return project


@router.get("/besmm4/pdf", summary="Stream or view official NIQS BESMM4 PDF")
def get_besmm4_pdf():
    """Stream official NIQS BESMM4 PDF for in-browser inspection."""
    candidates = [
        Path(__file__).resolve().parents[3] / "BESMM4 PDF.pdf",
        Path(__file__).resolve().parents[2] / "BESMM4 PDF.pdf",
        Path(__file__).resolve().parents[1] / "BESMM4 PDF.pdf",
        Path("BESMM4 PDF.pdf"),
        Path("backend/BESMM4 PDF.pdf"),
    ]
    pdf_path = next((p for p in candidates if p.exists()), None)
    if not pdf_path:
        raise HTTPException(status_code=404, detail="BESMM4 PDF file not found on server")
    return FileResponse(
        path=str(pdf_path),
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'inline; filename="BESMM4_PDF.pdf"',
            "Accept-Ranges": "bytes",
        },
    )


@router.get("/besmm4/reference", summary="Lookup BESMM4 code and PDF page details")
def get_besmm4_reference(code: str | None = Query(None, description="BESMM4 classification code e.g. 1.14:2.1.1")) -> dict:
    """Lookup BESMM4 clause, work section, and exact PDF page number for a given classification code."""
    return lookup_besmm4_reference(code)


@router.get("/boq/default-rates", summary="Get BESMM4 benchmark unit rates")
def get_default_rates() -> dict[str, float]:
    """Return default benchmark unit rates in Nigerian Naira (₦)."""
    return DEFAULT_BENCHMARK_RATES


@router.post("/projects/{project_id}/boq/generate", response_model=BoqOut, summary="Generate BESMM4 BOQ from Takeoff")
def generate_boq(
    project_id: str,
    req: BoqGenerateRequest,
    db: Session = Depends(get_db),
) -> Boq:
    """Generate or regenerate an Elemental Bill of Quantities from project drawing takeoff."""
    project = _get_project_or_404(db, project_id)
    takeoff = compute_project_takeoff(project)

    currency_sym = "₦" if req.currency == "NGN" else "$" if req.currency == "USD" else "£" if req.currency == "GBP" else req.currency
    boq_dict = generate_boq_from_takeoff(
        project=project,
        takeoff=takeoff,
        rounding_rule=req.rounding_rule,
        currency=req.currency,
        currency_symbol=currency_sym,
        populate_default_rates=req.populate_default_rates,
    )

    # Check if a BOQ already exists for project
    stmt = select(Boq).where(Boq.project_id == project_id).order_by(Boq.created_at.desc())
    boq = db.execute(stmt).scalars().first()

    if boq:
        boq.title = boq_dict["title"]
        boq.currency = boq_dict["currency"]
        boq.currency_symbol = boq_dict["currency_symbol"]
        boq.rounding_rule = boq_dict["rounding_rule"]
        boq.bills = boq_dict["bills"]
        boq.summary = boq_dict["summary"]
    else:
        boq = Boq(
            id=boq_dict["id"],
            project_id=project_id,
            title=boq_dict["title"],
            currency=boq_dict["currency"],
            currency_symbol=boq_dict["currency_symbol"],
            rounding_rule=boq_dict["rounding_rule"],
            bills=boq_dict["bills"],
            summary=boq_dict["summary"],
        )
        db.add(boq)

    db.commit()
    db.refresh(boq)
    return boq


@router.get("/projects/{project_id}/boq", response_model=BoqOut, summary="Get project's BESMM4 BOQ")
def get_boq(
    project_id: str,
    db: Session = Depends(get_db),
) -> Boq:
    """Get the latest BOQ for a project. Auto-generates one if none exists."""
    project = _get_project_or_404(db, project_id)
    stmt = select(Boq).where(Boq.project_id == project_id).order_by(Boq.created_at.desc())
    boq = db.execute(stmt).scalars().first()

    if not boq:
        # Auto-generate baseline BOQ from takeoff
        takeoff = compute_takeoff(project)
        boq_dict = generate_boq_from_takeoff(
            project=project,
            takeoff=takeoff,
            rounding_rule="besmm4_whole",
            currency="NGN",
            currency_symbol="₦",
            populate_default_rates=True,
        )
        boq = Boq(
            id=boq_dict["id"],
            project_id=project_id,
            title=boq_dict["title"],
            currency=boq_dict["currency"],
            currency_symbol=boq_dict["currency_symbol"],
            rounding_rule=boq_dict["rounding_rule"],
            bills=boq_dict["bills"],
            summary=boq_dict["summary"],
        )
        db.add(boq)
        db.commit()
        db.refresh(boq)

    return boq


@router.put("/projects/{project_id}/boq", response_model=BoqOut, summary="Update project's BOQ")
def update_boq(
    project_id: str,
    payload: BoqUpdate,
    db: Session = Depends(get_db),
) -> Boq:
    """Save user edits to rates, descriptions, quantities or summary percentages."""
    project = _get_project_or_404(db, project_id)
    stmt = select(Boq).where(Boq.project_id == project_id).order_by(Boq.created_at.desc())
    boq = db.execute(stmt).scalars().first()

    if not boq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No BOQ exists to update. Please generate first.")

    if payload.title is not None:
        boq.title = payload.title
    if payload.currency is not None:
        boq.currency = payload.currency
    if payload.currency_symbol is not None:
        boq.currency_symbol = payload.currency_symbol
    if payload.rounding_rule is not None:
        boq.rounding_rule = payload.rounding_rule

    bills_data = [b.model_dump() for b in payload.bills] if payload.bills is not None else boq.bills
    summary_data = payload.summary.model_dump() if payload.summary is not None else boq.summary

    # Recalculate all amounts, subtotals, contingency, VAT, and grand total
    updated_summary = recalculate_boq_totals(bills_data, summary_data)

    boq.bills = bills_data
    boq.summary = updated_summary

    db.commit()
    db.refresh(boq)
    return boq


@router.get("/projects/{project_id}/boq/export/excel", summary="Export BOQ to Excel (.xlsx)")
def export_excel(
    project_id: str,
    db: Session = Depends(get_db),
):
    """Download multi-tab formatted Excel BOQ matching NIQS BESMM4 format."""
    project = _get_project_or_404(db, project_id)
    stmt = select(Boq).where(Boq.project_id == project_id).order_by(Boq.created_at.desc())
    boq = db.execute(stmt).scalars().first()

    if not boq:
        # Generate on the fly
        takeoff = compute_takeoff(project)
        boq_dict = generate_boq_from_takeoff(project, takeoff)
    else:
        boq_dict = {
            "title": boq.title,
            "currency": boq.currency,
            "currency_symbol": boq.currency_symbol,
            "rounding_rule": boq.rounding_rule,
            "bills": boq.bills,
            "summary": boq.summary,
        }

    excel_bytes = export_boq_xlsx(project, boq_dict)
    filename = f"BOQ_{project.name.replace(' ', '_')}.xlsx"
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/projects/{project_id}/boq/export/html", response_class=HTMLResponse, summary="Printable / PDF HTML view")
def export_html(
    project_id: str,
    db: Session = Depends(get_db),
):
    """Return printable HTML document ready for browser print / Save as PDF."""
    project = _get_project_or_404(db, project_id)
    stmt = select(Boq).where(Boq.project_id == project_id).order_by(Boq.created_at.desc())
    boq = db.execute(stmt).scalars().first()

    if not boq:
        takeoff = compute_takeoff(project)
        boq_dict = generate_boq_from_takeoff(project, takeoff)
    else:
        boq_dict = {
            "title": boq.title,
            "currency": boq.currency,
            "currency_symbol": boq.currency_symbol,
            "rounding_rule": boq.rounding_rule,
            "bills": boq.bills,
            "summary": boq.summary,
        }

    return export_boq_html(project, boq_dict)


# --- Raw Dimension Sheet Endpoints ------------------------------------------------------------


@router.get("/projects/{project_id}/raw-takeoff", response_model=RawTakeoffOut, summary="Get raw dimension sheet")
def get_raw_takeoff(
    project_id: str,
    db: Session = Depends(get_db),
) -> RawTakeoff:
    """Get raw dimension sheet entries for traditional QS taking-off."""
    project = _get_project_or_404(db, project_id)
    stmt = select(RawTakeoff).where(RawTakeoff.project_id == project_id).order_by(RawTakeoff.created_at.desc())
    raw = db.execute(stmt).scalars().first()

    if not raw:
        # Create initial sample dimension sheet
        raw = RawTakeoff(
            project_id=project_id,
            title=f"Dimension Sheet - {project.name}",
            rows=[
                {
                    "id": "1",
                    "timesing": "1",
                    "dim1": 15.0,
                    "dim2": 12.0,
                    "dim3": None,
                    "squaring": 180.0,
                    "description": "Clear site of shrubs and small bushes",
                    "unit": "m²",
                    "bill_number": 2,
                    "work_section": "Excavating and Filling",
                },
                {
                    "id": "2",
                    "timesing": "2/",
                    "dim1": 14.5,
                    "dim2": 0.675,
                    "dim3": 0.90,
                    "squaring": 17.62,
                    "description": "Trench excavation for foundation walls",
                    "unit": "m³",
                    "bill_number": 2,
                    "work_section": "Excavating and Filling",
                },
            ],
        )
        db.add(raw)
        db.commit()
        db.refresh(raw)

    return raw


@router.put("/projects/{project_id}/raw-takeoff", response_model=RawTakeoffOut, summary="Save raw dimension sheet")
def update_raw_takeoff(
    project_id: str,
    payload: RawTakeoffUpdate,
    db: Session = Depends(get_db),
) -> RawTakeoff:
    """Save raw dimension sheet entries, automatically calculating squaring for each row."""
    project = _get_project_or_404(db, project_id)
    stmt = select(RawTakeoff).where(RawTakeoff.project_id == project_id).order_by(RawTakeoff.created_at.desc())
    raw = db.execute(stmt).scalars().first()

    rows_dict = []
    for r in payload.rows:
        rd = r.model_dump()
        rd["squaring"] = calculate_squaring(rd)
        rows_dict.append(rd)

    if not raw:
        raw = RawTakeoff(
            project_id=project_id,
            title=payload.title or f"Dimension Sheet - {project.name}",
            rows=rows_dict,
        )
        db.add(raw)
    else:
        if payload.title:
            raw.title = payload.title
        raw.rows = rows_dict

    db.commit()
    db.refresh(raw)
    return raw


@router.post("/projects/{project_id}/raw-takeoff/convert", response_model=BoqOut, summary="Convert raw dimension sheet into BOQ items")
def convert_raw_takeoff(
    project_id: str,
    db: Session = Depends(get_db),
) -> Boq:
    """Aggregate raw dimension sheet squaring into BOQ items and append them to the active BOQ."""
    project = _get_project_or_404(db, project_id)
    stmt_raw = select(RawTakeoff).where(RawTakeoff.project_id == project_id).order_by(RawTakeoff.created_at.desc())
    raw = db.execute(stmt_raw).scalars().first()

    if not raw or not raw.rows:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No raw dimension sheet rows to convert")

    grouped = convert_raw_takeoff_to_boq_items(raw.rows)

    # Get active BOQ
    stmt_boq = select(Boq).where(Boq.project_id == project_id).order_by(Boq.created_at.desc())
    boq = db.execute(stmt_boq).scalars().first()

    if not boq:
        takeoff = compute_takeoff(project)
        boq_dict = generate_boq_from_takeoff(project, takeoff)
        boq = Boq(
            id=boq_dict["id"],
            project_id=project_id,
            title=boq_dict["title"],
            currency=boq_dict["currency"],
            currency_symbol=boq_dict["currency_symbol"],
            rounding_rule=boq_dict["rounding_rule"],
            bills=boq_dict["bills"],
            summary=boq_dict["summary"],
        )
        db.add(boq)

    # Append converted items into the respective bill
    bills = list(boq.bills)
    for b_num, new_items in grouped.items():
        # Find bill
        target_bill = next((b for b in bills if b.get("bill_number") == b_num), None)
        if target_bill:
            for itm in new_items:
                # Add item ref letter
                idx = len(target_bill.get("items", []))
                letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                ref = letters[idx % 26] if idx < 26 else f"{letters[(idx // 26) - 1]}{letters[idx % 26]}"
                target_bill["items"].append({
                    "id": itm["id"],
                    "item_ref": ref,
                    "code": f"{b_num}.{idx + 1}",
                    "element": itm.get("element", "Measured Work"),
                    "description": itm["description"],
                    "unit": itm["unit"],
                    "quantity": itm["quantity"],
                    "rate": 0.0,
                    "amount": 0.0,
                    "trace": itm.get("trace", []),
                    "is_provisional": True,
                })

    updated_summary = recalculate_boq_totals(bills, boq.summary)
    boq.bills = bills
    boq.summary = updated_summary

    db.commit()
    db.refresh(boq)
    return boq
