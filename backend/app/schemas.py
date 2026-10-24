"""API schemas (request/response models)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Point = tuple[float, float]


# --- Sheet geometry (sheet pixel coordinates) -------------------------------------------------


class Wall(BaseModel):
    id: str
    kind: Literal["external", "internal"]
    points: list[Point] = Field(..., min_length=2)
    closed: bool = False
    # Which line the trace follows. Closed external traces are usually drawn on the outer face.
    ref: Literal["centre", "outer", "inner"] = "centre"
    thickness: float | None = Field(None, gt=0, description="Override, metres")
    height: float | None = Field(None, gt=0, description="Override, metres")


class Room(BaseModel):
    id: str
    name: str = "Room"
    points: list[Point] = Field(..., min_length=3)
    floor_finish: str | None = None
    wall_finish: str | None = None
    ceiling_finish: str | None = None
    wall_tile_height: float = Field(0.0, ge=0)
    height: float | None = Field(None, gt=0)
    skirting: bool = True


class Opening(BaseModel):
    id: str
    type: str = Field(..., description="Opening type mark, e.g. D1 / W1")
    x: float
    y: float
    wall_id: str | None = None
    angle: float = 0.0  # degrees, for display alignment along the host wall
    count: int = Field(1, ge=1)


class SheetGeometry(BaseModel):
    walls: list[Wall] = []
    rooms: list[Room] = []
    openings: list[Opening] = []


# --- Projects / sheets ------------------------------------------------------------------------


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    client: str | None = None
    location: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    client: str | None = None
    location: str | None = None
    specs: dict | None = None


class SheetSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    page_index: int
    position: int
    width_px: int
    height_px: int
    render_dpi: float | None
    is_vector: bool
    scale_m_per_px: float | None
    include: bool
    has_substructure: bool
    has_roof: bool
    updated_at: datetime


class SheetOut(SheetSummary):
    project_id: str
    drawing_id: str
    calibration: dict | None
    geometry: SheetGeometry


class SheetUpdate(BaseModel):
    name: str | None = None
    scale_m_per_px: float | None = Field(None, gt=0)
    calibration: dict | None = None
    include: bool | None = None
    has_substructure: bool | None = None
    has_roof: bool | None = None
    geometry: SheetGeometry | None = None


class DrawingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    filename: str
    page_count: int
    created_at: datetime


class ProjectSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    client: str | None
    location: str | None
    created_at: datetime
    updated_at: datetime
    sheet_count: int = 0
    thumbnail_sheet_id: str | None = None


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    client: str | None
    location: str | None
    specs: dict
    created_at: datetime
    updated_at: datetime
    drawings: list[DrawingOut]
    sheets: list[SheetSummary]


# --- Detection --------------------------------------------------------------------------------


class DetectRequest(BaseModel):
    method: Literal["auto", "vector", "raster", "ai"] = "auto"


class DetectResult(BaseModel):
    method: str
    geometry: SheetGeometry
    suggested_scale_m_per_px: float | None = None
    notes: list[str] = []


# --- Takeoff ----------------------------------------------------------------------------------


class TakeoffItem(BaseModel):
    key: str
    description: str
    unit: str
    quantity: float
    trace: list[str] = []


class TakeoffGroup(BaseModel):
    key: str
    title: str
    items: list[TakeoffItem]


class Takeoff(BaseModel):
    project_id: str
    groups: list[TakeoffGroup]
    summary: dict[str, float]
    warnings: list[str]
    sheets: list[str]


# --- BESMM4 Bill of Quantities (Phase 2) ------------------------------------------------------


class BoqItem(BaseModel):
    id: str
    item_ref: str = "A"
    code: str = ""
    element: str = ""
    description: str
    unit: str
    quantity: float
    rate: float = 0.0
    amount: float = 0.0
    trace: list[str] = []
    is_provisional: bool = False


class BoqBill(BaseModel):
    id: str
    bill_number: int
    title: str
    work_section: str = ""
    preamble: str | None = None
    items: list[BoqItem] = []
    subtotal: float = 0.0


class BoqSummary(BaseModel):
    bill_totals: dict[str, float] = {}
    subtotal_1: float = 0.0
    contingency_rate: float = 5.0  # percentage
    contingency_amount: float = 0.0
    subtotal_2: float = 0.0
    overhead_profit_rate: float = 0.0  # percentage
    overhead_profit_amount: float = 0.0
    vat_rate: float = 7.5  # percentage (Nigeria standard)
    vat_amount: float = 0.0
    grand_total: float = 0.0


class BoqOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    title: str
    currency: str = "NGN"
    currency_symbol: str = "₦"
    rounding_rule: str = "besmm4_whole"
    bills: list[BoqBill] = []
    summary: BoqSummary
    created_at: datetime
    updated_at: datetime


class BoqUpdate(BaseModel):
    title: str | None = None
    currency: str | None = None
    currency_symbol: str | None = None
    rounding_rule: str | None = None
    bills: list[BoqBill] | None = None
    summary: BoqSummary | None = None


class BoqGenerateRequest(BaseModel):
    rounding_rule: Literal["besmm4_whole", "two_dp"] = "besmm4_whole"
    currency: str = "NGN"
    populate_default_rates: bool = True


# --- Raw Dimension Sheet Takeoff (Phase 2) -----------------------------------------------------


class RawTakeoffRow(BaseModel):
    id: str
    timesing: str = "1"
    dim1: float | None = None
    dim2: float | None = None
    dim3: float | None = None
    squaring: float = 0.0
    description: str
    unit: str
    bill_number: int = 2
    work_section: str = "Excavating and Filling"


class RawTakeoffOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    title: str
    rows: list[RawTakeoffRow] = []
    updated_at: datetime


class RawTakeoffUpdate(BaseModel):
    title: str | None = None
    rows: list[RawTakeoffRow]

