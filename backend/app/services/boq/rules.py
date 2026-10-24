"""NIQS BESMM4 measurement rules, work sections, descriptions, and default rate benchmarks."""

from __future__ import annotations

import math
from typing import Literal

# Measurement unit codes per BESMM4
UNIT_M3 = "m³"
UNIT_M2 = "m²"
UNIT_M = "m"
UNIT_NR = "nr"
UNIT_ITEM = "Item"
UNIT_SUM = "Sum"
UNIT_TONNE = "t"
UNIT_KG = "kg"

# Work Sections per BESMM4 Part 4.1 Building Works
WORK_SECTIONS = {
    1: "Preliminaries",
    2: "Off-Site Manufactured Materials, Components or Buildings",
    3: "Demolition",
    4: "Alterations, Repairs and Conservation",
    5: "Excavating and Filling",
    6: "Ground Remediation and Soil Stabilisation",
    7: "Piling",
    8: "Underpinning",
    9: "Diaphragm Walls and Embedded Retaining Walls",
    10: "Crib Walls, Gabions and Reinforced Earth",
    11: "Insitu Concrete Works",
    12: "Precast / Composite Concrete",
    13: "Precast Concrete",
    14: "Masonry",
    15: "Structural Metalwork",
    16: "Carpentry",
    17: "Sheet Roof Coverings",
    18: "Tile and Slate Roof and Wall Coverings",
    19: "Waterproofing",
    20: "Proprietary Linings and Partitions",
    21: "Cladding and Covering",
    22: "General Joinery",
    23: "Windows, Screens and Lights",
    24: "Doors, Shutters and Hatches",
    25: "Stairs, Walkways and Balustrades",
    26: "Metalwork",
    27: "Glazing",
    28: "Floor, Wall, Ceiling and Roof Finishings",
    29: "Decoration",
    30: "Suspended Ceiling",
    31: "Insulation, Fire Stopping and Fire Protection",
    32: "Furniture, Fittings and Equipment",
    33: "Drainage Above Ground",
    34: "Drainage Below Ground",
    35: "Site Works",
    36: "Fencing",
    37: "Soft Landscaping",
    38: "Mechanical Services",
    39: "Electrical Services",
    40: "Transportation",
}


def format_besmm4_code(work_section: int, col1: int = 1, col2: int = 1, col3: int = 1) -> str:
    """Format an item classification code strictly according to NIQS BESMM4 Clause 1.14.02.
    
    Rule 1.14.02 defines cross references in the classification tables as:
        work section number : number from first column . number from second column . number from third column
    Example 1a: 1.5:6.1.1 (Excavating and filling)
    Example 1b: 1.11:22.1 (Insitu concrete works)
    """
    return f"1.{work_section}:{col1}.{col2}.{col3}"

# Standard Elemental Bills in Nigerian Quantity Surveying Practice
BILL_DEFINITIONS = [
    {
        "bill_number": 1,
        "title": "Preliminaries & General Items",
        "work_section": "Work Section 1: Preliminaries",
        "preamble": (
            "The Contractor is referred to the Conditions of Contract, Project Drawings, "
            "and Specifications. Prices inserted herein shall include all costs in connection "
            "with complying with these requirements."
        ),
    },
    {
        "bill_number": 2,
        "title": "Substructure (All Provisional)",
        "work_section": "Work Sections 5, 11, 14, 19",
        "preamble": (
            "All measurements in this Bill are provisional and subject to re-measurement on completion "
            "in accordance with NIQS BESMM4. Foundation depths are taken from existing ground level."
        ),
    },
    {
        "bill_number": 3,
        "title": "Superstructure (Frame, Walls, Roof, Doors & Windows)",
        "work_section": "Work Sections 11, 14, 16, 17, 22, 23, 24",
        "preamble": (
            "Blockwork measured net in accordance with BESMM4 Rule 1.5.4; voids not exceeding 0.50 m² "
            "are not deducted. Doors and windows are inclusive of frames, ironmongery and glazing."
        ),
    },
    {
        "bill_number": 4,
        "title": "Finishes (Floor, Wall, Ceiling & Painting)",
        "work_section": "Work Sections 28, 29",
        "preamble": (
            "Internal and external plaster and render measured net. Tiling includes all preparatory screeds, "
            "adhesives, grout and neat cutting around openings."
        ),
    },
    {
        "bill_number": 5,
        "title": "Services Installations (Provisional Sums)",
        "work_section": "Work Sections 38, 39",
        "preamble": (
            "Provisional sums for specialized mechanical, electrical and plumbing installations to be "
            "executed by approved domestic sub-contractors or Nominated Sub-contractors."
        ),
    },
    {
        "bill_number": 6,
        "title": "External Works (Site Works & Drainage)",
        "work_section": "Work Section 35",
        "preamble": (
            "Paved walkways, perimeter drain channels, landscaping and boundary features measured in accordance "
            "with Work Section 35."
        ),
    },
]


def round_besmm4(qty: float, unit: str, mode: str = "besmm4_whole") -> float:
    """Apply rounding convention according to NIQS BESMM4 Rule 1.5.3.

    Rule 1.5.3:
    - Quantities measured in tonnes shall be given to two places of decimals.
    - Other quantities shall be given to the nearest whole unit, except that any
      quantities less than one unit shall be given as one unit.

    If mode is 'two_dp', quantities are rounded to 2 decimal places.
    """
    if qty is None or qty <= 0:
        return 0.0

    if mode == "two_dp":
        return round(qty, 2)

    # BESMM4 whole unit rounding
    if unit in (UNIT_TONNE, "t", "tonnes"):
        return round(qty, 2)

    rounded = round(qty)
    return float(max(1, rounded))


# Default Benchmark Unit Rates in Nigerian Naira (₦) for 2024-2026 Nigerian construction market
DEFAULT_BENCHMARK_RATES: dict[str, float] = {
    # Preliminaries (Fixed Lump Sums per item)
    "prelim_office_facilities": 350000.0,
    "prelim_plant_scaffold": 250000.0,
    "prelim_supervision_safety": 200000.0,
    "prelim_testing_materials": 150000.0,
    "prelim_security_hoarding": 180000.0,
    "prelim_clean_handover": 120000.0,

    # Substructure - Excavation & Earthwork
    "site_clearance": 650.0,            # ₦/m²
    "topsoil_strip": 950.0,             # ₦/m²
    "trench_excavation": 4500.0,        # ₦/m³
    "trench_disposal": 3200.0,          # ₦/m³
    "trench_backfill": 2200.0,          # ₦/m³
    "hardcore_filling": 8500.0,         # ₦/m³
    "anti_termite": 850.0,              # ₦/m²
    "dpm": 1200.0,                      # ₦/m²
    "dpc": 1800.0,                      # ₦/m²

    # Substructure - Concrete & Blockwork
    "blinding_concrete": 65000.0,       # ₦/m³ plain mass concrete 1:3:6
    "footing_concrete": 95000.0,        # ₦/m³ reinforced concrete 1:2:4
    "oversite_concrete": 95000.0,       # ₦/m³ reinforced concrete 1:2:4
    "slab_mesh": 3800.0,                # ₦/m² BRC A142 fabric
    "slab_edge_formwork": 2500.0,       # ₦/m
    "substructure_blockwork": 13500.0,  # ₦/m² 225mm sandcrete filled solid

    # Superstructure - Concrete & Walls
    "lintel_concrete": 110000.0,        # ₦/m³ reinforced concrete 1:2:4
    "lintel_formwork": 4500.0,          # ₦/m² sawn timber formwork
    "lintel_rebar_tonne": 1450000.0,    # ₦/tonne high-yield rebar
    "blockwork_external_225": 12500.0,  # ₦/m² 225mm hollow sandcrete blockwork
    "blockwork_internal_150": 9500.0,   # ₦/m² 150mm hollow sandcrete blockwork

    # Superstructure - Roofing
    "timber_roof_carcass": 7500.0,      # ₦/m² timber trusses, purlins, wall plate
    "roof_covering": 9800.0,            # ₦/m² 0.55mm aluminium longspan
    "roof_ridge": 3500.0,               # ₦/m aluminium ridge cap
    "fascia_board": 4200.0,             # ₦/m 25x300mm hardwood fascia

    # Openings - Doors & Windows
    "door_standard_d1": 85000.0,        # ₦/nr 900x2100mm solid panel door complete
    "door_standard_d2": 65000.0,        # ₦/nr 750x2100mm semi-solid flush door complete
    "door_generic": 75000.0,            # ₦/nr
    "window_standard_w1": 68000.0,      # ₦/nr 1200x1200mm aluminium glazed window complete
    "window_standard_w2": 38000.0,      # ₦/nr 600x600mm aluminium glazed window complete
    "window_generic": 55000.0,          # ₦/nr

    # Finishes
    "floor_screed": 3200.0,             # ₦/m² 38mm cement sand screed
    "floor_tiles": 14500.0,             # ₦/m² 600x600 vitrified floor tiles
    "tile_skirting": 1800.0,            # ₦/m 100mm tile skirting
    "internal_plaster": 3500.0,         # ₦/m² 15mm cement sand plaster
    "external_render": 3800.0,          # ₦/m² 15mm cement sand render
    "wall_tiles": 13500.0,              # ₦/m² ceramic wall tiles
    "pop_ceiling": 8500.0,              # ₦/m² POP ceiling on timber noggings
    "pop_cornice": 2200.0,              # ₦/m decorative POP cornice
    "internal_paint": 1800.0,           # ₦/m² 2 coats emulsion
    "external_paint": 2600.0,           # ₦/m² 2 coats texcote/weather shield

    # Services (Provisional Sums)
    "plumbing_services": 1200000.0,
    "electrical_services": 1500000.0,
    "drainage_septic": 850000.0,

    # External Works (Provisional Sums)
    "external_paving": 800000.0,
    "external_drainage": 600000.0,
    "external_landscaping": 400000.0,
}

# ---------------------------------------------------------------------------
# NIQS BESMM4 PDF Page Mapping & Specification Cross-Reference Engine
# ---------------------------------------------------------------------------

BESMM4_CODING_RULES_PAGE = 20  # Clause 1.14.02 Cross references in classification tables

BESMM4_SECTION_PAGES: dict[int, dict] = {
    1: {"page": 48, "title": "Preliminaries", "tabulated_page": 48},
    2: {"page": 82, "title": "Off-Site Manufactured Materials, Components or Buildings", "tabulated_page": 83},
    3: {"page": 115, "title": "Demolition", "tabulated_page": 116},
    4: {"page": 120, "title": "Alterations, Repairs and Conservation", "tabulated_page": 122},
    5: {"page": 131, "title": "Excavating and Filling", "tabulated_page": 132},
    6: {"page": 145, "title": "Ground Remediation and Soil Stabilisation", "tabulated_page": 146},
    7: {"page": 149, "title": "Piling", "tabulated_page": 150},
    8: {"page": 154, "title": "Underpinning", "tabulated_page": 155},
    9: {"page": 156, "title": "Diaphragm Walls and Embedded Retaining Walls", "tabulated_page": 157},
    10: {"page": 158, "title": "Crib Walls, Gabions and Reinforced Earth", "tabulated_page": 159},
    11: {"page": 161, "title": "Insitu Concrete Works", "tabulated_page": 163},
    12: {"page": 174, "title": "Precast / Composite Concrete", "tabulated_page": 175},
    13: {"page": 176, "title": "Precast Concrete", "tabulated_page": 177},
    14: {"page": 179, "title": "Masonry", "tabulated_page": 180},
    15: {"page": 188, "title": "Structural Metalwork", "tabulated_page": 190},
    16: {"page": 195, "title": "Carpentry", "tabulated_page": 196},
    17: {"page": 199, "title": "Sheet Roof Coverings", "tabulated_page": 200},
    18: {"page": 205, "title": "Tile and Slate Roof and Wall Coverings", "tabulated_page": 206},
    19: {"page": 209, "title": "Waterproofing", "tabulated_page": 210},
    20: {"page": 213, "title": "Proprietary Linings and Partitions", "tabulated_page": 215},
    21: {"page": 220, "title": "Cladding and Covering", "tabulated_page": 221},
    22: {"page": 224, "title": "General Joinery", "tabulated_page": 226},
    23: {"page": 232, "title": "Windows, Screens and Lights", "tabulated_page": 233},
    24: {"page": 235, "title": "Doors, Shutters and Hatches", "tabulated_page": 236},
    25: {"page": 238, "title": "Stairs, Walkways and Balustrades", "tabulated_page": 239},
    26: {"page": 241, "title": "Metalwork", "tabulated_page": 242},
    27: {"page": 244, "title": "Glazing", "tabulated_page": 245},
    28: {"page": 247, "title": "Floor, Wall, Ceiling and Roof Finishings", "tabulated_page": 249},
    29: {"page": 257, "title": "Decoration", "tabulated_page": 258},
    30: {"page": 260, "title": "Suspended Ceiling", "tabulated_page": 261},
    31: {"page": 264, "title": "Insulation, Fire Stopping and Fire Protection", "tabulated_page": 265},
    32: {"page": 266, "title": "Furniture, Fittings and Equipment", "tabulated_page": 267},
    33: {"page": 268, "title": "Drainage Above Ground", "tabulated_page": 269},
    34: {"page": 273, "title": "Drainage Below Ground", "tabulated_page": 275},
    35: {"page": 282, "title": "Site Works", "tabulated_page": 284},
    36: {"page": 291, "title": "Fencing", "tabulated_page": 292},
    37: {"page": 294, "title": "Soft Landscaping", "tabulated_page": 295},
    38: {"page": 299, "title": "Mechanical Services", "tabulated_page": 302},
    39: {"page": 310, "title": "Electrical Services", "tabulated_page": 313},
    40: {"page": 319, "title": "Transportation", "tabulated_page": 320},
}

SECTION_SPECIFIC_RULES: dict[int, list[str]] = {
    1: [
        "Rule 1.1: Preliminaries items are classified as time-related charges, fixed charges, or cost-based sums.",
        "Rule 1.1.2: Pricing shall include all obligations and restrictions imposed by the Employer or local authorities.",
        "Rule 1.1.4: Protection of works, environmental safeguards, and site safety compliance are deemed included.",
    ],
    5: [
        "Rule M5: Quantities given for excavation and filling are the bulk before excavating or the net void to be filled; no allowance for bulking or working space unless specified.",
        "Rule C3: Depth classification ranges for excavations are given in 1.50m stages (e.g. not exceeding 1.50m, 1.50m-3.00m).",
        "Rule M12: Earthwork support deemed necessary to uphold sides of excavations is measured in square metres (m²).",
        "Rule C8: Disposal of water and keeping excavations free of ground or surface water is deemed included in the rates.",
    ],
    11: [
        "Rule M1: Concrete is measured net without deduction for the volume occupied by reinforcement, conduits, or voids <= 0.10 m³.",
        "Rule M22: Formwork is measured to all contact surfaces of concrete requiring temporary support during placing and curing.",
        "Rule M18: Reinforcement bars are measured in tonnes or kilograms based on nominal cross-sectional area and density (7,850 kg/m³).",
        "Rule C1: In-situ concrete mix ratio (e.g. 1:2:4, 1:3:6) and nominal aggregate size must be stated in the item description.",
    ],
    14: [
        "Rule M6: Block walling is measured net in square metres (m²); openings and voids not exceeding 0.50 m² are not deducted.",
        "Rule C1: Nominal wall thickness, block compressive strength (min 3.45 N/mm²), and mortar mix (1:3 or 1:4) must be specified.",
        "Rule M14: Plumbing angles, bonding at junctions, rough cutting, and building-in wall ties are deemed included.",
        "Rule M20: Foundation walling below damp-proof course (DPC) level is measured separately from superstructure walling.",
    ],
    16: [
        "Rule M1: Structural timber framing, rafters, purlins and trusses are measured net according to nominal structural sizes.",
        "Rule C4: Preservative treatment (fungicidal/insecticidal pressure impregnation) must be stated.",
        "Rule M8: Joints, scarfs, halving, birdsmouths, and metal framing anchors are deemed included in carcass carpentry.",
    ],
    17: [
        "Rule M1: Sheet roof coverings are measured net area covered in square metres (m²); end and side laps are not added.",
        "Rule M4: Ridge, hip, and valley cappings, flashings, and aprons are measured in linear metres (m).",
        "Rule C2: Fixing accessories, neoprene washers, self-tapping screws, and anti-condensation underlay must be stated.",
    ],
    19: [
        "Rule M1: Damp-proof courses (DPC) are measured in linear metres (m) for widths <= 300mm, or square metres (m²) for widths > 300mm.",
        "Rule M2: Damp-proof membranes (DPM) are measured net in square metres (m²); laps not added.",
        "Rule C1: Material specification (e.g. 1000-gauge virgin polythene or 3-ply bituminous felt) must be specified.",
    ],
    23: [
        "Rule M1: Windows are measured as complete numbered units (nr) stating overall frame dimensions (width x height).",
        "Rule C2: Glazing thickness (e.g. 5mm tinted float glass), ironmongery (friction stays, latches), and sub-frame fixing included.",
    ],
    24: [
        "Rule M1: Doors are measured as complete numbered units (nr) stating overall frame sizes and door leaf type.",
        "Rule C3: Hinges, locks, architraves, stops, and ironmongery sets are deemed included or separately scheduled.",
    ],
    28: [
        "Rule M1: Floor screeds, plastering, rendering, and wall finishes are measured net in square metres (m²).",
        "Rule M6: Openings and voids not exceeding 0.50 m² are not deducted from wall or ceiling finishes.",
        "Rule C2: Skirtings, dividing strips, and nosings are measured in linear metres (m).",
    ],
    29: [
        "Rule M1: Painting and decorative coatings are measured net in square metres (m²) on the surface treated.",
        "Rule C1: Surface preparation, priming, number of undercoats and finishing coats must be stated in the description.",
    ],
    34: [
        "Rule M1: Drain trenches and pipes are measured in linear metres (m) stating internal diameter and depth stage.",
        "Rule M5: Manholes and inspection chambers are measured as complete units (nr) stating internal dimensions and depth.",
    ],
    35: [
        "Rule M1: Interlocking concrete block paving and slab paving are measured net in square metres (m²).",
        "Rule C2: Sand bed, sub-base preparation, and edge restraints are measured or deemed included per specification.",
    ],
    38: [
        "Rule 1.38: Mechanical installations, sanitary appliances, and plumbing are measured as enumerated items (nr) or Provisional Sums.",
    ],
    39: [
        "Rule 1.39: Electrical installations, conduits, wiring, and distribution boards are measured as enumerated points or Provisional Sums.",
    ],
}


def lookup_besmm4_reference(code: str | None = None) -> dict:
    """Parse a BESMM4 classification code (Clause 1.14.02) and return full PDF reference metadata."""
    import re

    code_str = (code or "1.14:2.1.1").strip()
    m = re.match(r"^(?:1\.)?(\d+)(?::(\d+)(?:\.(\d+))?(?:\.(\d+))?)?", code_str)
    if m:
        ws = int(m.group(1))
        col1 = int(m.group(2)) if m.group(2) else 1
        col2 = int(m.group(3)) if m.group(3) else 1
        col3 = int(m.group(4)) if m.group(4) else 1
    else:
        ws, col1, col2, col3 = 14, 1, 1, 1

    sec_info = BESMM4_SECTION_PAGES.get(ws, {"page": 179, "title": WORK_SECTIONS.get(ws, f"Work Section {ws}"), "tabulated_page": 180})
    rules = SECTION_SPECIFIC_RULES.get(ws, [
        f"Work Section 1.{ws} is measured in accordance with NIQS BESMM4 Part 4.1.",
        "Items are measured net in position unless otherwise stated in the coverage rules.",
        "Labor, material waste, cutting, fixing, and plant are deemed included in unit rates.",
    ])

    return {
        "code": code_str,
        "work_section_number": ws,
        "work_section_code": f"1.{ws}",
        "section_title": sec_info["title"],
        "page": sec_info["page"],
        "tabulated_page": sec_info.get("tabulated_page", sec_info["page"]),
        "coding_rules_page": BESMM4_CODING_RULES_PAGE,
        "standard": "NIQS BESMM4 (Building and Engineering Standard Method of Measurement 4th Edition)",
        "clause_ref": "Clause 1.14.02",
        "divisions": {
            "part": "Part 4.1 Building Works",
            "work_section": f"Section {ws}: {sec_info['title']}",
            "col1": f"First Division {col1} (Work Category)",
            "col2": f"Second Division {col2} (Material / Geometry)",
            "col3": f"Third Division {col3} (Specification / Mortar / Finish)",
        },
        "measurement_rules": rules,
        "pdf_url": f"/api/besmm4/pdf#page={sec_info['page']}",
    }

