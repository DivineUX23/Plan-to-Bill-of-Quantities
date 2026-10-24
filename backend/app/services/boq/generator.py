"""Elemental Bill of Quantities generator adhering to NIQS BESMM4 rules."""

from __future__ import annotations

import uuid
from typing import Literal

from ...models import Project
from ...schemas import BoqBill, BoqItem, BoqOut, BoqSummary, Takeoff
from ..specs import Specs, load_specs
from .rules import (
    BILL_DEFINITIONS,
    DEFAULT_BENCHMARK_RATES,
    UNIT_ITEM,
    UNIT_KG,
    UNIT_M,
    UNIT_M2,
    UNIT_M3,
    UNIT_NR,
    UNIT_SUM,
    UNIT_TONNE,
    round_besmm4,
)


def _uuid() -> str:
    return uuid.uuid4().hex


def _item_code(bill_num: int, letter: str) -> str:
    return f"{bill_num}/{letter}"


def generate_boq_from_takeoff(
    project: Project,
    takeoff: Takeoff,
    rounding_rule: Literal["besmm4_whole", "two_dp"] = "besmm4_whole",
    currency: str = "NGN",
    currency_symbol: str = "₦",
    populate_default_rates: bool = True,
) -> dict:
    """Generate a complete 6-Bill Elemental BOQ with Grand Summary from Phase 1 Takeoff."""
    specs = load_specs(project.specs)
    rates = DEFAULT_BENCHMARK_RATES if populate_default_rates else {}

    # Map takeoff items by key for fast lookup
    tk_items = {}
    for group in takeoff.groups:
        for itm in group.items:
            tk_items[itm.key] = itm

    # Letters generator for item references A, B, C, ... Z, AA, AB...
    def make_ref(index: int) -> str:
        letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        if index < 26:
            return letters[index]
        return f"{letters[(index // 26) - 1]}{letters[index % 26]}"

    bills_out: list[dict] = []

    # --------------------------------------------------------------------------
    # BILL 1: PRELIMINARIES & GENERAL ITEMS
    # --------------------------------------------------------------------------
    b1_def = BILL_DEFINITIONS[0]
    b1_items = [
        {
            "id": _uuid(),
            "item_ref": "A",
            "code": "1.1:1.1.0",
            "element": "Contract Requirements",
            "description": (
                f"Project Particulars, drawings and general site conditions for the execution of "
                f"works at {project.location or 'the site'} for {project.client or 'the Client'}. "
                f"Complying with statutory notices, building regulations and local authority requirements."
            ),
            "unit": UNIT_SUM,
            "quantity": 1.0,
            "rate": rates.get("prelim_office_facilities", 350000.0) if populate_default_rates else 0.0,
            "amount": rates.get("prelim_office_facilities", 350000.0) if populate_default_rates else 0.0,
            "trace": ["BESMM4 Section 1: Preliminaries"],
            "is_provisional": False,
        },
        {
            "id": _uuid(),
            "item_ref": "B",
            "code": "1.1:2.1.0",
            "element": "Site Facilities",
            "description": (
                "Provide, maintain and dismantle on completion contractor's site administration office, "
                "materials storage shed, welfare and sanitary facilities for workpeople, including connection "
                "to temporary water supply and lighting."
            ),
            "unit": UNIT_ITEM,
            "quantity": 1.0,
            "rate": rates.get("prelim_office_facilities", 300000.0) if populate_default_rates else 0.0,
            "amount": rates.get("prelim_office_facilities", 300000.0) if populate_default_rates else 0.0,
            "trace": ["BESMM4 Section 1: Preliminaries"],
            "is_provisional": False,
        },
        {
            "id": _uuid(),
            "item_ref": "C",
            "code": "1.1:3.1.0",
            "element": "Plant & Tools",
            "description": (
                "Provide and maintain all necessary plant, equipment, concrete mixers, vibrators, scaffolding, "
                "staging, ladders, tackle and small tools required for the proper execution of the works."
            ),
            "unit": UNIT_ITEM,
            "quantity": 1.0,
            "rate": rates.get("prelim_plant_scaffold", 250000.0) if populate_default_rates else 0.0,
            "amount": rates.get("prelim_plant_scaffold", 250000.0) if populate_default_rates else 0.0,
            "trace": ["BESMM4 Section 1: Preliminaries"],
            "is_provisional": False,
        },
        {
            "id": _uuid(),
            "item_ref": "D",
            "code": "1.1:4.1.0",
            "element": "Supervision & Safety",
            "description": (
                "Competent full-time site supervision, engineer / general foreman, setting out the works, "
                "safety equipment, protective clothing (PPE), first-aid facilities, and environmental protection."
            ),
            "unit": UNIT_ITEM,
            "quantity": 1.0,
            "rate": rates.get("prelim_supervision_safety", 200000.0) if populate_default_rates else 0.0,
            "amount": rates.get("prelim_supervision_safety", 200000.0) if populate_default_rates else 0.0,
            "trace": ["BESMM4 Section 1: Preliminaries"],
            "is_provisional": False,
        },
        {
            "id": _uuid(),
            "item_ref": "E",
            "code": "1.1:5.1.0",
            "element": "Quality & Testing",
            "description": (
                "Quality control, taking standard concrete test cubes (sets of 3), sending for compressive "
                "crushing tests at 7 and 28 days at an approved government laboratory, and testing of materials."
            ),
            "unit": UNIT_ITEM,
            "quantity": 1.0,
            "rate": rates.get("prelim_testing_materials", 150000.0) if populate_default_rates else 0.0,
            "amount": rates.get("prelim_testing_materials", 150000.0) if populate_default_rates else 0.0,
            "trace": ["BESMM4 Section 1: Preliminaries"],
            "is_provisional": False,
        },
        {
            "id": _uuid(),
            "item_ref": "F",
            "code": "1.1:6.1.0",
            "element": "Site Security",
            "description": (
                "Site security, watchmen day and night, temporary perimeter hoardings, gates, and warning signs."
            ),
            "unit": UNIT_ITEM,
            "quantity": 1.0,
            "rate": rates.get("prelim_security_hoarding", 180000.0) if populate_default_rates else 0.0,
            "amount": rates.get("prelim_security_hoarding", 180000.0) if populate_default_rates else 0.0,
            "trace": ["BESMM4 Section 1: Preliminaries"],
            "is_provisional": False,
        },
        {
            "id": _uuid(),
            "item_ref": "G",
            "code": "1.1:7.1.0",
            "element": "Cleaning & Handover",
            "description": (
                "Clear away all rubbish, temporary works, surplus plant and materials periodically and on "
                "practical completion; wash floors, clean glass both sides and leave entire building spotless."
            ),
            "unit": UNIT_ITEM,
            "quantity": 1.0,
            "rate": rates.get("prelim_clean_handover", 120000.0) if populate_default_rates else 0.0,
            "amount": rates.get("prelim_clean_handover", 120000.0) if populate_default_rates else 0.0,
            "trace": ["BESMM4 Section 1: Preliminaries"],
            "is_provisional": False,
        },
    ]
    b1_subtotal = sum(i["amount"] for i in b1_items)
    bills_out.append(
        {
            "id": _uuid(),
            "bill_number": 1,
            "title": b1_def["title"],
            "work_section": b1_def["work_section"],
            "preamble": b1_def["preamble"],
            "items": b1_items,
            "subtotal": round(b1_subtotal, 2),
        }
    )

    # --------------------------------------------------------------------------
    # BILL 2: SUBSTRUCTURE (ALL PROVISIONAL)
    # --------------------------------------------------------------------------
    b2_def = BILL_DEFINITIONS[1]
    b2_items: list[dict] = []
    b2_raw = [
        # (tk_key, code, element, description, unit, rate_key, is_prov)
        (
            "site_clearance",
            "1.5:1.1.1",
            "Site Preparation",
            "Clear the site of all shrubs, bushes, tall grasses, rubbish, small trees of girth not exceeding 600mm, and burn or cart away debris.",
            UNIT_M2,
            "site_clearance",
            True,
        ),
        (
            "topsoil_strip",
            "1.5:2.1.1",
            "Excavation",
            f"Excavate top vegetable soil average {int(specs.topsoil_depth * 1000)}mm deep, preserve and deposit on site where directed in spoil heaps for landscaping.",
            UNIT_M2,
            "topsoil_strip",
            True,
        ),
        (
            "trench_excavation",
            "1.5:3.1.1",
            "Excavation",
            f"Excavate foundation trench starting from stripped ground level, width {int(specs.trench_width * 1000)}mm, depth not exceeding 1.50m.",
            UNIT_M3,
            "trench_excavation",
            True,
        ),
        (
            "trench_disposal",
            "1.5:4.1.1",
            "Earthwork",
            "Remove surplus excavated material from site, cart away to approved government dumpsite.",
            UNIT_M3,
            "trench_disposal",
            True,
        ),
        (
            "trench_backfill",
            "1.5:5.1.1",
            "Earthwork",
            "Return, fill and thoroughly ram selected excavated material around foundation walls and footings in 150mm consolidated layers.",
            UNIT_M3,
            "trench_backfill",
            True,
        ),
        (
            "hardcore_filling",
            "1.5:6.1.1",
            "Earthwork",
            f"Imported clean hard laterite / hardcore filling under floor bed, well watered, leveled and consolidated in 150mm layers (average {int(specs.hardcore_thickness * 1000)}mm thick).",
            UNIT_M3,
            "hardcore_filling",
            True,
        ),
        (
            "anti_termite",
            "1.5:7.1.1",
            "Pest Treatment",
            "Approved chemical anti-termite treatment (Premise / Termidor or equivalent) sprayed evenly over hardcore surface and around foundation perimeter trench.",
            UNIT_M2,
            "anti_termite",
            True,
        ),
        (
            "dpm",
            "1.19:1.1.1",
            "Waterproofing",
            "1000 gauge polythene damp proof membrane (DPM) laid over sand blinding under floor slab with 150mm end and side laps.",
            UNIT_M2,
            "dpm",
            True,
        ),
        (
            "dpc",
            "1.19:2.1.1",
            "Waterproofing",
            "Bitumen felt damp proof course (DPC) bedded in cement mortar (1:3) under 225mm and 150mm block walls at plinth level.",
            UNIT_M2,
            "dpc",
            True,
        ),
        (
            "blinding_concrete",
            "1.11:1.1.1",
            "Concrete Work",
            f"Plain mass in-situ concrete (1:3:6 - 15 N/mm²) in {int(specs.blinding_thickness * 1000)}mm thick blinding to bottom of foundation trenches.",
            UNIT_M3,
            "blinding_concrete",
            True,
        ),
        (
            "footing_concrete",
            "1.11:1.2.1",
            "Concrete Work",
            f"Vibrated reinforced in-situ concrete grade C20/25 (1:2:4) in strip footing (width {int(specs.footing_width * 1000)}mm, thickness {int(specs.footing_thickness * 1000)}mm).",
            UNIT_M3,
            "footing_concrete",
            True,
        ),
        (
            "oversite_concrete",
            "1.11:2.1.1",
            "Concrete Work",
            f"Vibrated reinforced in-situ concrete grade C20/25 (1:2:4) in {int(specs.oversite_thickness * 1000)}mm thick ground floor bed / oversite slab laid on DPM.",
            UNIT_M3,
            "oversite_concrete",
            True,
        ),
        (
            "slab_mesh",
            "1.11:2.2.1",
            "Reinforcement",
            "Fabric reinforcement BRC Mesh Ref. A142 (weight 2.22 kg/m²) in ground floor bed with 200mm side and end laps.",
            UNIT_M2,
            "slab_mesh",
            True,
        ),
        (
            "slab_edge",
            "1.11:2.3.1",
            "Formwork",
            f"Sawn timber formwork to edge of ground floor bed {int(specs.oversite_thickness * 1000)}mm high, including propping and strutting.",
            UNIT_M,
            "slab_edge_formwork",
            True,
        ),
        (
            "substructure_blockwork",
            "1.14:1.1.1",
            "Blockwork",
            f"{int(specs.substructure_wall_thickness * 1000)}mm thick vibrated sandcrete blockwork filled solid with 1:3:6 mass concrete, bedded in cement-sand mortar (1:4) in foundation walls from top of footing to DPC level.",
            UNIT_M2,
            "substructure_blockwork",
            True,
        ),
    ]

    for idx, (k, code, elem, desc, unit, rate_k, is_prov) in enumerate(b2_raw):
        tk = tk_items.get(k)
        raw_qty = tk.quantity if tk else 0.0
        trace = tk.trace if tk else []
        qty = round_besmm4(raw_qty, unit, rounding_rule)
        rate = rates.get(rate_k, 0.0) if populate_default_rates else 0.0
        amount = round(qty * rate, 2)
        b2_items.append(
            {
                "id": _uuid(),
                "item_ref": make_ref(idx),
                "code": code,
                "element": elem,
                "description": desc,
                "unit": unit,
                "quantity": qty,
                "rate": rate,
                "amount": amount,
                "trace": trace,
                "is_provisional": is_prov,
            }
        )

    b2_subtotal = sum(i["amount"] for i in b2_items)
    bills_out.append(
        {
            "id": _uuid(),
            "bill_number": 2,
            "title": b2_def["title"],
            "work_section": b2_def["work_section"],
            "preamble": b2_def["preamble"],
            "items": b2_items,
            "subtotal": round(b2_subtotal, 2),
        }
    )

    # --------------------------------------------------------------------------
    # BILL 3: SUPERSTRUCTURE
    # --------------------------------------------------------------------------
    b3_def = BILL_DEFINITIONS[2]
    b3_items: list[dict] = []
    item_counter_3 = 0

    # Element 1: Lintels & Concrete Frame
    if "lintel_concrete" in tk_items:
        tk = tk_items["lintel_concrete"]
        qty = round_besmm4(tk.quantity, UNIT_M3, rounding_rule)
        rate = rates.get("lintel_concrete", 0.0)
        b3_items.append(
            {
                "id": _uuid(),
                "item_ref": make_ref(item_counter_3),
                "code": "1.11:3.1.1",
                "element": "Frame & Lintels",
                "description": f"Vibrated reinforced in-situ concrete grade C20/25 (1:2:4) in lintel beams over doors and windows ({int(specs.lintel_depth * 1000)}mm deep).",
                "unit": UNIT_M3,
                "quantity": qty,
                "rate": rate,
                "amount": round(qty * rate, 2),
                "trace": tk.trace,
                "is_provisional": False,
            }
        )
        item_counter_3 += 1

    if "lintel_formwork" in tk_items:
        tk = tk_items["lintel_formwork"]
        qty = round_besmm4(tk.quantity, UNIT_M2, rounding_rule)
        rate = rates.get("lintel_formwork", 0.0)
        b3_items.append(
            {
                "id": _uuid(),
                "item_ref": make_ref(item_counter_3),
                "code": "1.11:3.2.1",
                "element": "Frame & Lintels",
                "description": "Sawn timber formwork to sides and soffits of lintel beams including propping not exceeding 3.50m high.",
                "unit": UNIT_M2,
                "quantity": qty,
                "rate": rate,
                "amount": round(qty * rate, 2),
                "trace": tk.trace,
                "is_provisional": False,
            }
        )
        item_counter_3 += 1

    if "lintel_rebar" in tk_items:
        tk = tk_items["lintel_rebar"]
        # Convert kg to tonnes per BESMM4 Work Section 11 / 1.5.3
        rebar_tonnes = tk.quantity / 1000.0
        qty = round_besmm4(rebar_tonnes, UNIT_TONNE, rounding_rule)
        rate = rates.get("lintel_rebar_tonne", 0.0)
        b3_items.append(
            {
                "id": _uuid(),
                "item_ref": make_ref(item_counter_3),
                "code": "1.11:3.3.1",
                "element": "Frame & Lintels",
                "description": "High yield tensile steel bar reinforcement (Y10, Y12) cut, bent and tied in position in lintels including tying wire and spacer blocks.",
                "unit": UNIT_TONNE,
                "quantity": qty,
                "rate": rate,
                "amount": round(qty * rate, 2),
                "trace": tk.trace,
                "is_provisional": False,
            }
        )
        item_counter_3 += 1

    # Element 2: Blockwork
    ext_t_mm = int(specs.external_wall_thickness * 1000)
    ext_key = f"blockwork_external_{ext_t_mm}"
    if ext_key in tk_items:
        tk = tk_items[ext_key]
        qty = round_besmm4(tk.quantity, UNIT_M2, rounding_rule)
        rate = rates.get("blockwork_external_225", 0.0)
        b3_items.append(
            {
                "id": _uuid(),
                "item_ref": make_ref(item_counter_3),
                "code": "1.14:2.1.1",
                "element": "Superstructure Walling",
                "description": (
                    f"{ext_t_mm}mm thick hollow sandcrete blockwork bedded and jointed in cement-sand mortar (1:4), "
                    f"in external superstructure walls (deducting openings > 0.50 m²)."
                ),
                "unit": UNIT_M2,
                "quantity": qty,
                "rate": rate,
                "amount": round(qty * rate, 2),
                "trace": tk.trace,
                "is_provisional": False,
            }
        )
        item_counter_3 += 1

    int_t_mm = int(specs.internal_wall_thickness * 1000)
    int_key = f"blockwork_internal_{int_t_mm}"
    if int_key in tk_items:
        tk = tk_items[int_key]
        qty = round_besmm4(tk.quantity, UNIT_M2, rounding_rule)
        rate = rates.get("blockwork_internal_150", 0.0)
        b3_items.append(
            {
                "id": _uuid(),
                "item_ref": make_ref(item_counter_3),
                "code": "1.14:2.2.1",
                "element": "Superstructure Walling",
                "description": (
                    f"{int_t_mm}mm thick hollow sandcrete blockwork bedded and jointed in cement-sand mortar (1:4), "
                    f"in internal partition walls (deducting openings > 0.50 m²)."
                ),
                "unit": UNIT_M2,
                "quantity": qty,
                "rate": rate,
                "amount": round(qty * rate, 2),
                "trace": tk.trace,
                "is_provisional": False,
            }
        )
        item_counter_3 += 1

    # Element 3: Roof
    if "roof_covering" in tk_items:
        tk = tk_items["roof_covering"]
        # Timber carcass is measured over the slope area
        qty_carcass = round_besmm4(tk.quantity, UNIT_M2, rounding_rule)
        rate_carcass = rates.get("timber_roof_carcass", 0.0)
        b3_items.append(
            {
                "id": _uuid(),
                "item_ref": make_ref(item_counter_3),
                "code": "1.16:1.1.1",
                "element": "Roof Structure",
                "description": (
                    f"Sawn hardwood timber roof structure comprising trusses, rafters, purlins, king posts, "
                    f"tie beams and 100x75mm wall plates anchored to blockwork with hoop iron (pitch {specs.roof_pitch_deg}°)."
                ),
                "unit": UNIT_M2,
                "quantity": qty_carcass,
                "rate": rate_carcass,
                "amount": round(qty_carcass * rate_carcass, 2),
                "trace": [f"Measured over roof slope area {qty_carcass} m²"],
                "is_provisional": False,
            }
        )
        item_counter_3 += 1

        qty_covering = round_besmm4(tk.quantity, UNIT_M2, rounding_rule)
        rate_covering = rates.get("roof_covering", 0.0)
        b3_items.append(
            {
                "id": _uuid(),
                "item_ref": make_ref(item_counter_3),
                "code": "1.17:1.1.1",
                "element": "Roof Covering",
                "description": (
                    "0.55mm prepainted aluminium longspan roofing sheets (corrugated/step-tile profile) "
                    "fixed to hardwood purlins with drive screws and neoprene washers with 150mm end laps."
                ),
                "unit": UNIT_M2,
                "quantity": qty_covering,
                "rate": rate_covering,
                "amount": round(qty_covering * rate_covering, 2),
                "trace": tk.trace,
                "is_provisional": False,
            }
        )
        item_counter_3 += 1

    if "roof_ridge" in tk_items:
        tk = tk_items["roof_ridge"]
        qty = round_besmm4(tk.quantity, UNIT_M, rounding_rule)
        rate = rates.get("roof_ridge", 0.0)
        b3_items.append(
            {
                "id": _uuid(),
                "item_ref": make_ref(item_counter_3),
                "code": "1.17:1.2.1",
                "element": "Roof Covering",
                "description": "Matching 0.55mm gauge aluminium ridge and hip capping, 450mm girth, fixed to purlins.",
                "unit": UNIT_M,
                "quantity": qty,
                "rate": rate,
                "amount": round(qty * rate, 2),
                "trace": tk.trace,
                "is_provisional": False,
            }
        )
        item_counter_3 += 1

    if "fascia_board" in tk_items:
        tk = tk_items["fascia_board"]
        qty = round_besmm4(tk.quantity, UNIT_M, rounding_rule)
        rate = rates.get("fascia_board", 0.0)
        b3_items.append(
            {
                "id": _uuid(),
                "item_ref": make_ref(item_counter_3),
                "code": "1.16:1.2.1",
                "element": "Roof Trim",
                "description": "25 x 300mm seasoned hardwood fascia / barge board securely nailed to rafter feet.",
                "unit": UNIT_M,
                "quantity": qty,
                "rate": rate,
                "amount": round(qty * rate, 2),
                "trace": tk.trace,
                "is_provisional": False,
            }
        )
        item_counter_3 += 1

    # Element 4 & 5: Doors & Windows from openings schedule
    for k, tk in tk_items.items():
        if k.startswith("door_"):
            qty = round_besmm4(tk.quantity, UNIT_NR, rounding_rule)
            mark = k.replace("door_", "").upper()
            rate = rates.get("door_standard_d1" if "1" in mark else "door_standard_d2", rates.get("door_generic", 75000.0))
            b3_items.append(
                {
                    "id": _uuid(),
                    "item_ref": make_ref(item_counter_3),
                    "code": "1.24:1.1.1",
                    "element": "Doors",
                    "description": (
                        f"Supply and install Door Mark '{mark}': {tk.description}, complete with seasoned hardwood frame, "
                        f"architraves, 3 nr 100mm brass butt hinges, 3-lever mortice lockset and door stop."
                    ),
                    "unit": UNIT_NR,
                    "quantity": qty,
                    "rate": rate,
                    "amount": round(qty * rate, 2),
                    "trace": tk.trace,
                    "is_provisional": False,
                }
            )
            item_counter_3 += 1

        elif k.startswith("window_"):
            qty = round_besmm4(tk.quantity, UNIT_NR, rounding_rule)
            mark = k.replace("window_", "").upper()
            rate = rates.get("window_standard_w1" if "1" in mark else "window_standard_w2", rates.get("window_generic", 55000.0))
            b3_items.append(
                {
                    "id": _uuid(),
                    "item_ref": make_ref(item_counter_3),
                    "code": "1.23:1.1.1",
                    "element": "Windows",
                    "description": (
                        f"Supply and fix Window Mark '{mark}': {tk.description}, powder-coated aluminium framed sliding / "
                        f"casement window glazed with 5mm tinted glass, complete with subframe, insect flyscreen, and heavy-duty burglar-proof bars."
                    ),
                    "unit": UNIT_NR,
                    "quantity": qty,
                    "rate": rate,
                    "amount": round(qty * rate, 2),
                    "trace": tk.trace,
                    "is_provisional": False,
                }
            )
            item_counter_3 += 1

    b3_subtotal = sum(i["amount"] for i in b3_items)
    bills_out.append(
        {
            "id": _uuid(),
            "bill_number": 3,
            "title": b3_def["title"],
            "work_section": b3_def["work_section"],
            "preamble": b3_def["preamble"],
            "items": b3_items,
            "subtotal": round(b3_subtotal, 2),
        }
    )

    # --------------------------------------------------------------------------
    # BILL 4: FINISHES (FLOOR, WALL, CEILING & DECORATION)
    # --------------------------------------------------------------------------
    b4_def = BILL_DEFINITIONS[3]
    b4_items: list[dict] = []
    item_counter_4 = 0

    # Aggregate finishes from takeoff items
    for k, tk in tk_items.items():
        if k.startswith("screed_"):
            qty = round_besmm4(tk.quantity, UNIT_M2, rounding_rule)
            rate = rates.get("floor_screed", 0.0)
            b4_items.append(
                {
                    "id": _uuid(),
                    "item_ref": make_ref(item_counter_4),
                    "code": "1.28:1.1.1",
                    "element": "Floor Finishes",
                    "description": "38mm thick cement and sand (1:3) bed / screed finished smooth to receive tile finish.",
                    "unit": UNIT_M2,
                    "quantity": qty,
                    "rate": rate,
                    "amount": round(qty * rate, 2),
                    "trace": tk.trace,
                    "is_provisional": False,
                }
            )
            item_counter_4 += 1

        elif k.startswith("finish_floor_"):
            qty = round_besmm4(tk.quantity, UNIT_M2, rounding_rule)
            rate = rates.get("floor_tiles", 0.0)
            b4_items.append(
                {
                    "id": _uuid(),
                    "item_ref": make_ref(item_counter_4),
                    "code": "1.28:1.2.1",
                    "element": "Floor Finishes",
                    "description": f"Supply and lay 600x600mm vitrified / ceramic floor tiles ({tk.description}) bedded in cement slurry and pointed with matching grout.",
                    "unit": UNIT_M2,
                    "quantity": qty,
                    "rate": rate,
                    "amount": round(qty * rate, 2),
                    "trace": tk.trace,
                    "is_provisional": False,
                }
            )
            item_counter_4 += 1

        elif k.startswith("skirting_"):
            qty = round_besmm4(tk.quantity, UNIT_M, rounding_rule)
            rate = rates.get("tile_skirting", 0.0)
            b4_items.append(
                {
                    "id": _uuid(),
                    "item_ref": make_ref(item_counter_4),
                    "code": "1.28:1.3.1",
                    "element": "Floor Finishes",
                    "description": f"100mm high matching tile skirting bedded in cement mortar and pointed in neat grout to walls (less door openings).",
                    "unit": UNIT_M,
                    "quantity": qty,
                    "rate": rate,
                    "amount": round(qty * rate, 2),
                    "trace": tk.trace,
                    "is_provisional": False,
                }
            )
            item_counter_4 += 1

        elif k.startswith("plaster_"):
            qty = round_besmm4(tk.quantity, UNIT_M2, rounding_rule)
            rate = rates.get("internal_plaster", 0.0)
            b4_items.append(
                {
                    "id": _uuid(),
                    "item_ref": make_ref(item_counter_4),
                    "code": "1.28:2.1.1",
                    "element": "Wall Finishes",
                    "description": "15mm thick cement and sand (1:4) plaster to internal block walls finished with steel trowel.",
                    "unit": UNIT_M2,
                    "quantity": qty,
                    "rate": rate,
                    "amount": round(qty * rate, 2),
                    "trace": tk.trace,
                    "is_provisional": False,
                }
            )
            item_counter_4 += 1

        elif k.startswith("render_"):
            qty = round_besmm4(tk.quantity, UNIT_M2, rounding_rule)
            rate = rates.get("external_render", 0.0)
            b4_items.append(
                {
                    "id": _uuid(),
                    "item_ref": make_ref(item_counter_4),
                    "code": "1.28:2.2.1",
                    "element": "Wall Finishes",
                    "description": "15mm thick cement and sand (1:3) water-repellent render to external block surfaces finished with wood float.",
                    "unit": UNIT_M2,
                    "quantity": qty,
                    "rate": rate,
                    "amount": round(qty * rate, 2),
                    "trace": tk.trace,
                    "is_provisional": False,
                }
            )
            item_counter_4 += 1

        elif k.startswith("wall_tile_"):
            qty = round_besmm4(tk.quantity, UNIT_M2, rounding_rule)
            rate = rates.get("wall_tiles", 0.0)
            b4_items.append(
                {
                    "id": _uuid(),
                    "item_ref": make_ref(item_counter_4),
                    "code": "1.28:2.3.1",
                    "element": "Wall Finishes",
                    "description": "300x450mm glazed ceramic wall tiles fixed to plastered walls with adhesive and pointed with white cement grout in bathrooms and wet areas.",
                    "unit": UNIT_M2,
                    "quantity": qty,
                    "rate": rate,
                    "amount": round(qty * rate, 2),
                    "trace": tk.trace,
                    "is_provisional": False,
                }
            )
            item_counter_4 += 1

        elif k.startswith("finish_ceiling_"):
            qty = round_besmm4(tk.quantity, UNIT_M2, rounding_rule)
            rate = rates.get("pop_ceiling", 0.0)
            b4_items.append(
                {
                    "id": _uuid(),
                    "item_ref": make_ref(item_counter_4),
                    "code": "1.28:3.1.1",
                    "element": "Ceiling Finishes",
                    "description": f"Plaster of Paris (POP) / PVC suspended ceiling panels on and including 50x50mm hardwood noggings and suspension wires ({tk.description}).",
                    "unit": UNIT_M2,
                    "quantity": qty,
                    "rate": rate,
                    "amount": round(qty * rate, 2),
                    "trace": tk.trace,
                    "is_provisional": False,
                }
            )
            item_counter_4 += 1

        elif k.startswith("cornice_"):
            qty = round_besmm4(tk.quantity, UNIT_M, rounding_rule)
            rate = rates.get("pop_cornice", 0.0)
            b4_items.append(
                {
                    "id": _uuid(),
                    "item_ref": make_ref(item_counter_4),
                    "code": "1.28:3.2.1",
                    "element": "Ceiling Finishes",
                    "description": "100mm decorative POP cornice fixed at wall and ceiling junctions with adhesive and screws.",
                    "unit": UNIT_M,
                    "quantity": qty,
                    "rate": rate,
                    "amount": round(qty * rate, 2),
                    "trace": tk.trace,
                    "is_provisional": False,
                }
            )
            item_counter_4 += 1

        elif k.startswith("paint_internal_"):
            qty = round_besmm4(tk.quantity, UNIT_M2, rounding_rule)
            rate = rates.get("internal_paint", 0.0)
            b4_items.append(
                {
                    "id": _uuid(),
                    "item_ref": make_ref(item_counter_4),
                    "code": "1.29:1.1.1",
                    "element": "Painting & Decoration",
                    "description": "Prepare, screed and apply two coats of premium washable emulsion paint to plastered internal walls and ceilings.",
                    "unit": UNIT_M2,
                    "quantity": qty,
                    "rate": rate,
                    "amount": round(qty * rate, 2),
                    "trace": tk.trace,
                    "is_provisional": False,
                }
            )
            item_counter_4 += 1

        elif k.startswith("paint_external_"):
            qty = round_besmm4(tk.quantity, UNIT_M2, rounding_rule)
            rate = rates.get("external_paint", 0.0)
            b4_items.append(
                {
                    "id": _uuid(),
                    "item_ref": make_ref(item_counter_4),
                    "code": "1.29:1.2.1",
                    "element": "Painting & Decoration",
                    "description": "Prepare and apply two coats of weather-resistant external acrylic / texcote paint to rendered external wall surfaces.",
                    "unit": UNIT_M2,
                    "quantity": qty,
                    "rate": rate,
                    "amount": round(qty * rate, 2),
                    "trace": tk.trace,
                    "is_provisional": False,
                }
            )
            item_counter_4 += 1

    b4_subtotal = sum(i["amount"] for i in b4_items)
    bills_out.append(
        {
            "id": _uuid(),
            "bill_number": 4,
            "title": b4_def["title"],
            "work_section": b4_def["work_section"],
            "preamble": b4_def["preamble"],
            "items": b4_items,
            "subtotal": round(b4_subtotal, 2),
        }
    )

    # --------------------------------------------------------------------------
    # BILL 5: SERVICES INSTALLATIONS (PROVISIONAL SUMS)
    # --------------------------------------------------------------------------
    b5_def = BILL_DEFINITIONS[4]
    b5_items = [
        {
            "id": _uuid(),
            "item_ref": "A",
            "code": "1.38:1.1.0",
            "element": "Mechanical & Plumbing",
            "description": (
                "Allow the Provisional Sum for complete cold and hot water plumbing pipework, overhead storage tank, "
                "water booster pump, sanitary appliances (water closets, wash hand basins, showers, kitchen sinks) "
                "and connection to mains."
            ),
            "unit": UNIT_SUM,
            "quantity": 1.0,
            "rate": rates.get("plumbing_services", 1200000.0) if populate_default_rates else 0.0,
            "amount": rates.get("plumbing_services", 1200000.0) if populate_default_rates else 0.0,
            "trace": ["BESMM4 Section 38: Mechanical Services"],
            "is_provisional": True,
        },
        {
            "id": _uuid(),
            "item_ref": "B",
            "code": "1.39:1.1.0",
            "element": "Electrical Services",
            "description": (
                "Allow the Provisional Sum for complete conduit piping, wiring, lighting fittings, ceiling fans, "
                "13A socket outlets, AC points, distribution board, changeover switch, earthing installation and NEPA/PHCN service connection."
            ),
            "unit": UNIT_SUM,
            "quantity": 1.0,
            "rate": rates.get("electrical_services", 1500000.0) if populate_default_rates else 0.0,
            "amount": rates.get("electrical_services", 1500000.0) if populate_default_rates else 0.0,
            "trace": ["BESMM4 Section 39: Electrical Services"],
            "is_provisional": True,
        },
        {
            "id": _uuid(),
            "item_ref": "C",
            "code": "1.34:1.1.0",
            "element": "Drainage & Waste",
            "description": (
                "Allow the Provisional Sum for construction of septic tank, soakaway pit, inspection chambers, "
                "and 100mm/150mm PVC soil and waste drain pipes from building to septic system."
            ),
            "unit": UNIT_SUM,
            "quantity": 1.0,
            "rate": rates.get("drainage_septic", 850000.0) if populate_default_rates else 0.0,
            "amount": rates.get("drainage_septic", 850000.0) if populate_default_rates else 0.0,
            "trace": ["BESMM4 Section 34: Drainage Below Ground"],
            "is_provisional": True,
        },
    ]
    b5_subtotal = sum(i["amount"] for i in b5_items)
    bills_out.append(
        {
            "id": _uuid(),
            "bill_number": 5,
            "title": b5_def["title"],
            "work_section": b5_def["work_section"],
            "preamble": b5_def["preamble"],
            "items": b5_items,
            "subtotal": round(b5_subtotal, 2),
        }
    )

    # --------------------------------------------------------------------------
    # BILL 6: EXTERNAL WORKS
    # --------------------------------------------------------------------------
    b6_def = BILL_DEFINITIONS[5]
    b6_items = [
        {
            "id": _uuid(),
            "item_ref": "A",
            "code": "1.35:1.1.1",
            "element": "Paved Surfacing",
            "description": (
                "Supply and lay 60mm thick heavy-duty interlocking concrete paving stones on sand bed to driveway and perimeter walkways."
            ),
            "unit": UNIT_SUM,
            "quantity": 1.0,
            "rate": rates.get("external_paving", 800000.0) if populate_default_rates else 0.0,
            "amount": rates.get("external_paving", 800000.0) if populate_default_rates else 0.0,
            "trace": ["BESMM4 Section 35: Site Works"],
            "is_provisional": True,
        },
        {
            "id": _uuid(),
            "item_ref": "B",
            "code": "1.35:2.1.1",
            "element": "Perimeter Drainage",
            "description": (
                "Precast concrete perimeter storm water drain channels (300x300mm) including reinforced precast slab cover."
            ),
            "unit": UNIT_SUM,
            "quantity": 1.0,
            "rate": rates.get("external_drainage", 600000.0) if populate_default_rates else 0.0,
            "amount": rates.get("external_drainage", 600000.0) if populate_default_rates else 0.0,
            "trace": ["BESMM4 Section 35: Site Works"],
            "is_provisional": True,
        },
        {
            "id": _uuid(),
            "item_ref": "C",
            "code": "1.37:1.1.1",
            "element": "Soft Landscaping",
            "description": (
                "Prepare topsoil, plant carpet grass (Paspalum / Bermuda grass), perimeter ornamental shrubs, and site leveling."
            ),
            "unit": UNIT_SUM,
            "quantity": 1.0,
            "rate": rates.get("external_landscaping", 400000.0) if populate_default_rates else 0.0,
            "amount": rates.get("external_landscaping", 400000.0) if populate_default_rates else 0.0,
            "trace": ["BESMM4 Section 37: Soft Landscaping"],
            "is_provisional": True,
        },
    ]
    b6_subtotal = sum(i["amount"] for i in b6_items)
    bills_out.append(
        {
            "id": _uuid(),
            "bill_number": 6,
            "title": b6_def["title"],
            "work_section": b6_def["work_section"],
            "preamble": b6_def["preamble"],
            "items": b6_items,
            "subtotal": round(b6_subtotal, 2),
        }
    )

    # --------------------------------------------------------------------------
    # GRAND SUMMARY CALCULATIONS
    # --------------------------------------------------------------------------
    bill_totals = {str(b["bill_number"]): b["subtotal"] for b in bills_out}
    subtotal_1 = sum(bill_totals.values())

    contingency_rate = 5.0
    contingency_amount = round(subtotal_1 * (contingency_rate / 100.0), 2)
    subtotal_2 = round(subtotal_1 + contingency_amount, 2)

    overhead_profit_rate = 0.0
    overhead_profit_amount = round(subtotal_2 * (overhead_profit_rate / 100.0), 2)

    vat_rate = 7.5  # Nigerian standard VAT rate
    vat_base = subtotal_2 + overhead_profit_amount
    vat_amount = round(vat_base * (vat_rate / 100.0), 2)

    grand_total = round(vat_base + vat_amount, 2)

    summary = {
        "bill_totals": bill_totals,
        "subtotal_1": round(subtotal_1, 2),
        "contingency_rate": contingency_rate,
        "contingency_amount": contingency_amount,
        "subtotal_2": subtotal_2,
        "overhead_profit_rate": overhead_profit_rate,
        "overhead_profit_amount": overhead_profit_amount,
        "vat_rate": vat_rate,
        "vat_amount": vat_amount,
        "grand_total": grand_total,
    }

    return {
        "id": _uuid(),
        "project_id": project.id,
        "title": f"Bill of Quantities - {project.name}",
        "currency": currency,
        "currency_symbol": currency_symbol,
        "rounding_rule": rounding_rule,
        "bills": bills_out,
        "summary": summary,
    }


def recalculate_boq_totals(bills: list[dict], summary: dict) -> dict:
    """Recalculate live subtotals, contingency, VAT, and Grand Total whenever item rates change."""
    bill_totals = {}
    for b in bills:
        subtotal = 0.0
        for itm in b.get("items", []):
            qty = float(itm.get("quantity") or 0.0)
            rate = float(itm.get("rate") or 0.0)
            amount = round(qty * rate, 2)
            itm["amount"] = amount
            subtotal += amount
        b["subtotal"] = round(subtotal, 2)
        bill_totals[str(b.get("bill_number"))] = b["subtotal"]

    subtotal_1 = sum(bill_totals.values())

    c_rate = float(summary.get("contingency_rate", 5.0))
    c_amount = round(subtotal_1 * (c_rate / 100.0), 2)
    subtotal_2 = round(subtotal_1 + c_amount, 2)

    op_rate = float(summary.get("overhead_profit_rate", 0.0))
    op_amount = round(subtotal_2 * (op_rate / 100.0), 2)

    vat_rate = float(summary.get("vat_rate", 7.5))
    vat_base = subtotal_2 + op_amount
    vat_amount = round(vat_base * (vat_rate / 100.0), 2)

    grand_total = round(vat_base + vat_amount, 2)

    updated_summary = {
        "bill_totals": bill_totals,
        "subtotal_1": round(subtotal_1, 2),
        "contingency_rate": c_rate,
        "contingency_amount": c_amount,
        "subtotal_2": subtotal_2,
        "overhead_profit_rate": op_rate,
        "overhead_profit_amount": op_amount,
        "vat_rate": vat_rate,
        "vat_amount": vat_amount,
        "grand_total": grand_total,
    }

    return updated_summary
