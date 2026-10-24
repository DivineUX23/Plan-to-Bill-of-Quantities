"""Tests for Phase 2: BESMM4 Bill of Quantities (BOQ) and Raw Dimension Sheets."""

import io
import openpyxl
import pytest
from fastapi.testclient import TestClient

from app.db import Base, engine, SessionLocal
from app.main import app
from app.models import Project, Sheet
from app.services.boq.export_excel import export_boq_xlsx
from app.services.boq.export_html import export_boq_html
from app.services.boq.generator import generate_boq_from_takeoff, recalculate_boq_totals
from app.services.boq.raw_takeoff import calculate_squaring, convert_raw_takeoff_to_boq_items
from app.services.boq.rules import round_besmm4
from app.services.quantities import compute_takeoff

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def test_besmm4_rounding_rules():
    """Verify Rule 1.5.3: tonnes to 2 dp, other quantities to nearest whole unit (min 1)."""
    assert round_besmm4(0.4, "m³", "besmm4_whole") == 1.0
    assert round_besmm4(14.2, "m³", "besmm4_whole") == 14.0
    assert round_besmm4(14.8, "m³", "besmm4_whole") == 15.0
    # Tonnes to 2 dp
    assert round_besmm4(0.437, "t", "besmm4_whole") == 0.44
    assert round_besmm4(1.284, "tonnes", "besmm4_whole") == 1.28
    # Two dp mode override
    assert round_besmm4(14.24, "m³", "two_dp") == 14.24


def test_raw_takeoff_squaring():
    """Verify traditional QS timesing and squaring calculations."""
    # Linear: 1 * 15.0 = 15.0
    assert calculate_squaring({"timesing": "1", "dim1": 15.0}) == 15.0
    # Area: 2/ * 10.0 * 5.0 = 100.0
    assert calculate_squaring({"timesing": "2/", "dim1": 10.0, "dim2": 5.0}) == 100.0
    # Volume: 2/3/ * 4.0 * 2.0 * 1.5 = 6 * 12 = 72.0
    assert calculate_squaring({"timesing": "2/3/", "dim1": 4.0, "dim2": 2.0, "dim3": 1.5}) == 72.0


def test_boq_generation_and_export():
    """Test full BOQ generation, recalculation, and Excel/HTML export."""
    db = SessionLocal()
    project = Project(
        name="Lekki Duplex Prototype",
        client="Mr. Adebayo",
        location="Lekki Phase 1, Lagos",
        specs={
            "external_wall_thickness": 0.225,
            "internal_wall_thickness": 0.150,
            "wall_height": 3.0,
            "trench_width": 0.675,
            "trench_depth": 0.90,
        },
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    # Add a calibrated sheet with rectangular geometry
    sheet = Sheet(
        project_id=project.id,
        drawing_id="d1",
        name="Ground Floor",
        image_blob_id="b1",
        width_px=1000,
        height_px=800,
        scale_m_per_px=0.01,  # 1px = 10mm
        geometry={
            "walls": [
                {
                    "id": "w1",
                    "kind": "external",
                    "points": [[100, 100], [900, 100], [900, 700], [100, 700]],
                    "closed": True,
                    "ref": "outer",
                    "thickness": 0.225,
                }
            ],
            "rooms": [
                {
                    "id": "r1",
                    "name": "Main Living",
                    "points": [[100, 100], [900, 100], [900, 700], [100, 700]],
                    "floor_finish": "600x600 vitrified tiles",
                    "wall_finish": "Plaster & emulsion paint",
                    "ceiling_finish": "POP ceiling",
                }
            ],
            "openings": [],
        },
    )
    db.add(sheet)
    db.commit()

    # Generate takeoff
    takeoff = compute_takeoff(project)
    assert len(takeoff.groups) > 0

    # Generate BOQ
    boq_dict = generate_boq_from_takeoff(
        project=project,
        takeoff=takeoff,
        rounding_rule="besmm4_whole",
        populate_default_rates=True,
    )
    assert len(boq_dict["bills"]) == 6  # Bills 1 to 6
    assert boq_dict["summary"]["grand_total"] > 0
    assert boq_dict["summary"]["vat_rate"] == 7.5

    # Test Excel Export
    excel_bytes = export_boq_xlsx(project, boq_dict)
    assert len(excel_bytes) > 2000
    wb = openpyxl.load_workbook(io.BytesIO(excel_bytes))
    sheet_names = wb.sheetnames
    assert "Project Info" in sheet_names
    assert "Grand Summary" in sheet_names
    assert "Bill 2" in sheet_names

    # Test HTML Export
    html_content = export_boq_html(project, boq_dict)
    assert "NIQS BESMM4" in html_content
    assert "Lekki Duplex Prototype" in html_content
    assert "TOTAL TENDER SUM" in html_content
    db.close()


def test_boq_api_endpoints():
    """Verify REST API endpoints for BOQ generation, update, and export."""
    # 1. Create a project
    create_res = client.post("/api/projects", json={"name": "Victoria Island Villa", "location": "Lagos"})
    assert create_res.status_code == 201
    p_id = create_res.json()["id"]

    # 2. Get BOQ (should auto-generate)
    boq_res = client.get(f"/api/projects/{p_id}/boq")
    assert boq_res.status_code == 200
    boq_data = boq_res.json()
    assert len(boq_data["bills"]) == 6
    assert boq_data["currency"] == "NGN"

    # 3. Update unit rate of an item and verify live summary recalculation
    b2 = boq_data["bills"][1]  # Substructure
    assert len(b2["items"]) > 0
    item0 = b2["items"][0]
    original_rate = item0["rate"]
    new_rate = original_rate + 500.0
    item0["rate"] = new_rate

    update_res = client.put(
        f"/api/projects/{p_id}/boq",
        json={
            "bills": boq_data["bills"],
            "summary": boq_data["summary"],
        },
    )
    assert update_res.status_code == 200
    updated_boq = update_res.json()
    updated_item0 = updated_boq["bills"][1]["items"][0]
    assert updated_item0["rate"] == new_rate
    assert updated_item0["amount"] == round(updated_item0["quantity"] * new_rate, 2)

    # 4. Download Excel
    xlsx_res = client.get(f"/api/projects/{p_id}/boq/export/excel")
    assert xlsx_res.status_code == 200
    assert xlsx_res.headers["content-type"].startswith("application/vnd.openxmlformats")

    # 5. Raw Takeoff endpoint
    raw_res = client.get(f"/api/projects/{p_id}/raw-takeoff")
    assert raw_res.status_code == 200
    raw_data = raw_res.json()
    assert len(raw_data["rows"]) >= 1

    # Update raw takeoff
    raw_data["rows"].append({
        "id": "test_row_3",
        "timesing": "3/",
        "dim1": 8.0,
        "dim2": 0.225,
        "dim3": 3.0,
        "squaring": 0.0,
        "description": "Extra blockwork in boundary wall",
        "unit": "m³",
        "bill_number": 3,
        "work_section": "Masonry",
    })
    raw_put = client.put(f"/api/projects/{p_id}/raw-takeoff", json={"rows": raw_data["rows"]})
    assert raw_put.status_code == 200
    # 3 * 8 * 0.225 * 3 = 16.2
    assert raw_put.json()["rows"][-1]["squaring"] == 16.2
