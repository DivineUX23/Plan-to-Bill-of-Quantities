"""Project specifications: the parameters that turn plan geometry into quantities.

Defaults reflect common Nigerian residential practice (sandcrete blockwork, strip foundations,
German floor, pitched roof) and are all editable per project. All dimensions are in metres.
"""

from typing import Literal

from pydantic import BaseModel, Field


class OpeningType(BaseModel):
    mark: str = Field(..., description="Schedule mark, e.g. D1, W1")
    kind: Literal["door", "window"]
    width: float = Field(..., gt=0)
    height: float = Field(..., gt=0)
    description: str = ""


class FinishOptions(BaseModel):
    floor: list[str] = ["Ceramic floor tiles", "Porcelain floor tiles", "Terrazzo", "Cement screed only"]
    wall: list[str] = ["Plaster & emulsion paint", "Plaster & wall tiles", "Plaster & textured paint"]
    ceiling: list[str] = ["PVC ceiling", "POP ceiling", "Asbestos-free ceiling board", "Plywood ceiling"]


class Specs(BaseModel):
    # --- Walls -------------------------------------------------------------------------------
    external_wall_thickness: float = Field(0.225, gt=0, description="External blockwork thickness")
    internal_wall_thickness: float = Field(0.150, gt=0, description="Internal blockwork thickness")
    wall_height: float = Field(3.0, gt=0, description="Blockwork height from DPC to wall plate")
    room_height: float = Field(3.0, gt=0, description="Finished floor to ceiling")
    min_void_deduction: float = Field(0.5, ge=0, description="Only voids larger than this (m²) are deducted")

    # --- Lintels -----------------------------------------------------------------------------
    lintel_mode: Literal["individual", "continuous", "none"] = "individual"
    lintel_depth: float = Field(0.225, ge=0)
    lintel_bearing: float = Field(0.15, ge=0, description="Bearing each side of opening")
    lintel_rebar_kg_per_m3: float = Field(120, ge=0)

    # --- Substructure ------------------------------------------------------------------------
    foundation_internal_walls: bool = True
    trench_width: float = Field(0.675, gt=0)
    trench_depth: float = Field(0.9, gt=0, description="Ground level to underside of footing")
    footing_width: float = Field(0.675, gt=0)
    footing_thickness: float = Field(0.15, gt=0)
    blinding_thickness: float = Field(0.0, ge=0)
    substructure_wall_thickness: float = Field(0.225, gt=0, description="Blockwork below DPC")
    dpc_height: float = Field(0.45, ge=0, description="Ground level to DPC / finished floor")
    oversite_thickness: float = Field(0.15, gt=0, description="Ground floor slab")
    hardcore_thickness: float = Field(0.15, ge=0)
    site_clearance_margin: float = Field(2.0, ge=0, description="Working space around building")
    topsoil_depth: float = Field(0.15, ge=0)
    slab_mesh: bool = True

    # --- Roof --------------------------------------------------------------------------------
    roof_type: Literal["hip", "gable", "flat"] = "hip"
    roof_pitch_deg: float = Field(30, ge=0, lt=80)
    roof_overhang: float = Field(0.6, ge=0)

    # --- Openings & finishes -----------------------------------------------------------------
    opening_types: list[OpeningType] = [
        OpeningType(mark="D1", kind="door", width=0.9, height=2.1, description="Main entrance door"),
        OpeningType(mark="D2", kind="door", width=0.9, height=2.1, description="Internal flush door"),
        OpeningType(mark="D3", kind="door", width=0.75, height=2.1, description="Toilet / bath door"),
        OpeningType(mark="W1", kind="window", width=1.2, height=1.2, description="Casement window"),
        OpeningType(mark="W2", kind="window", width=0.6, height=0.6, description="Toilet window"),
    ]
    finish_options: FinishOptions = FinishOptions()
    default_floor_finish: str = "Ceramic floor tiles"
    default_wall_finish: str = "Plaster & emulsion paint"
    default_ceiling_finish: str = "PVC ceiling"
    skirting_height: float = Field(0.1, ge=0)
    external_finish: str = "Render & weather-shield paint"

    # --- Editor ------------------------------------------------------------------------------
    external_trace_reference: Literal["outer", "centre"] = Field(
        "outer", description="Whether new external wall traces follow the outer face or centre line"
    )

    def opening_type(self, mark: str) -> OpeningType | None:
        return next((t for t in self.opening_types if t.mark == mark), None)


def default_specs() -> dict:
    return Specs().model_dump()


def load_specs(raw: dict | None) -> Specs:
    """Merge stored specs over defaults so newly added fields always have values."""
    merged = default_specs()
    if raw:
        merged.update({k: v for k, v in raw.items() if v is not None})
    return Specs.model_validate(merged)
