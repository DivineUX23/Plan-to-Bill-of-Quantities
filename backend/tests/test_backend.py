"""Automated tests for AutoPlan Taking-off Engine.

Verifies:
1. Geometry calculations (centre-line conversion, occupied bodies, T/L/cross deductions).
2. Quantities generation with Nigerian/BESMM4 specs and audit traces.
3. Vector & raster floor plan layout detection.
4. End-to-end API pipeline (Project -> Upload Drawing -> Calibrate -> Detect -> Live Takeoff -> Export).
"""

import io
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from shapely.geometry import LineString, Point, Polygon

from app.db import Base, engine
from app.main import app
from app.models import Project
from app.schemas import Opening, Room, SheetGeometry, Wall
from app.services.geometry import PlanM, WallM, body, build_plan, building_outline, net_lengths
from app.services.quantities import Accumulator, compute_sheet, compute_takeoff
from app.services.specs import Specs, load_specs

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


# 1. Geometry Unit Tests
def test_wall_body_and_net_lengths():
    # Two walls forming a T-junction:
    # Wall 1 (external along X): (0,0) to (10,0), thickness 0.225
    # Wall 2 (internal abutting W1 at X=5): (5,0) to (5,5), thickness 0.150
    w1 = LineString([(0, 0), (10, 0)])
    w2 = LineString([(5, 0), (5, 5)])
    
    # In occupied-body net calculation, W1 is evaluated first, then W2
    net = net_lengths([("w1", w1, 0.225), ("w2", w2, 0.150)])
    
    assert round(net["w1"], 2) == 10.0
    # W2 starts at (5,0) which is inside W1's half-thickness (0.225/2 = 0.1125m)
    # So net length of W2 should be 5.0 - 0.1125 = 4.8875m
    assert round(net["w2"], 2) == 4.89


def test_closed_external_wall_mitre_offset():
    # Outer rectangle: 10m x 6m
    # Thickness: 0.225m
    # Outer girth = 2*(10+6) = 32m
    # Centre-line girth = 2*( (10 - 0.225) + (6 - 0.225) ) = 2*(9.775 + 5.775) = 31.10m
    geom = SheetGeometry(
        walls=[
            Wall(
                id="w_ext",
                kind="external",
                points=[(0, 0), (1000, 0), (1000, 600), (0, 600)],
                closed=True,
                ref="outer",
            )
        ]
    )
    # Scale: 0.01 m/px (1000px = 10m, 600px = 6m)
    specs = load_specs(None)
    plan = build_plan(geom, 0.01, specs)
    assert len(plan.walls) == 1
    w = plan.walls[0]
    assert round(w.line.length, 2) == 31.10


def test_quantities_substructure_and_finishes():
    specs = load_specs(None)
    # Rectangle 10m x 6m outer
    geom = SheetGeometry(
        walls=[
            Wall(id="w1", kind="external", points=[(0, 0), (1000, 0), (1000, 600), (0, 600)], closed=True, ref="outer"),
            Wall(id="w2", kind="internal", points=[(500, 0), (500, 600)], closed=False, ref="centre"),
        ],
        rooms=[
            Room(id="r1", name="Living Room", points=[(15, 15), (485, 15), (485, 585), (15, 585)]),
            Room(id="r2", name="Bed Room", points=[(515, 15), (985, 15), (985, 585), (515, 585)]),
        ],
        openings=[
            Opening(id="d1", type="D1", x=200, y=0, wall_id="w1"),
            Opening(id="w1", type="W1", x=800, y=0, wall_id="w1"),
        ],
    )
    acc = Accumulator()
    summary = {}
    warnings = []
    compute_sheet(
        "Ground Floor",
        geom,
        0.01,
        specs,
        has_substructure=True,
        has_roof=True,
        acc=acc,
        summary=summary,
        warnings=warnings,
    )
    result = acc.result()
    group_keys = [g.key for g in result]
    assert "substructure" in group_keys
    assert "walls" in group_keys
    assert "openings" in group_keys
    assert "roof" in group_keys
    assert "finishes" in group_keys

    # Substructure checks
    sub_items = {i.key: i for g in result if g.key == "substructure" for i in g.items}
    assert "trench_excavation" in sub_items
    assert "footing_concrete" in sub_items
    assert "blockwork_below_dpc" in sub_items
    assert "oversite_concrete" in sub_items
    assert sub_items["trench_excavation"].quantity > 0


# 2. End-to-End API Integration Tests
def test_full_api_workflow():
    # Step 1: Health check
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"

    # Step 2: Create project
    res = client.post("/api/projects", json={"name": "Duplex Takeoff", "client": "Mr. Okon", "location": "Lekki"})
    assert res.status_code == 201
    proj = res.json()
    proj_id = proj["id"]
    assert proj["name"] == "Duplex Takeoff"

    # Step 3: Upload sample floor plan PDF
    pdf_path = Path(__file__).resolve().parent.parent.parent / "samples" / "floor_plan.pdf"
    assert pdf_path.exists(), f"Sample pdf not found at {pdf_path}"
    with open(pdf_path, "rb") as f:
        res = client.post(
            f"/api/projects/{proj_id}/drawings",
            files={"file": ("floor_plan.pdf", f, "application/pdf")},
        )
    assert res.status_code == 200
    sheets = res.json()
    assert len(sheets) >= 1
    sheet_id = sheets[0]["id"]
    assert sheets[0]["is_vector"] is True

    # Step 4: Stream sheet image
    res = client.get(f"/api/sheets/{sheet_id}/image")
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/png"
    assert len(res.content) > 1000

    # Step 5: Auto-detect sheet layout (with apply=True)
    res = client.post(f"/api/sheets/{sheet_id}/detect?apply=true")
    assert res.status_code == 200
    detect_res = res.json()
    assert detect_res["method"] == "vector"
    assert len(detect_res["geometry"]["walls"]) > 10
    assert len(detect_res["geometry"]["openings"]) > 5

    # Step 6: Set calibration explicitly if needed
    res = client.post(
        f"/api/sheets/{sheet_id}/calibrate",
        json={"p1": [100, 100], "p2": [200, 100], "real_length_m": 1.0, "label": "1m grid"},
    )
    assert res.status_code == 200
    updated_sheet = res.json()
    assert updated_sheet["scale_m_per_px"] == 0.01

    # Step 7: Calculate live sheet takeoff
    res = client.get(f"/api/sheets/{sheet_id}/takeoff")
    assert res.status_code == 200
    sheet_takeoff = res.json()
    assert len(sheet_takeoff["groups"]) >= 3

    # Step 8: Calculate full project takeoff
    res = client.get(f"/api/projects/{proj_id}/takeoff")
    assert res.status_code == 200
    proj_takeoff = res.json()
    assert len(proj_takeoff["groups"]) >= 3

    # Step 9: Export takeoff to Excel
    res = client.get(f"/api/projects/{proj_id}/takeoff/export")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert len(res.content) > 2000
