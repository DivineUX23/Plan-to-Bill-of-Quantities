"""Takeoff calculator: turns plan geometry and project specs into measured quantities.

Every quantity carries a human-readable trace (a digital dimension sheet) so a QS can audit how
it was derived. Quantities are kept at full precision internally and rounded to 2 dp on output;
BESMM4 rounding conventions are applied later, when the BOQ is built (Phase 2).
"""

from __future__ import annotations

import math
import re
from collections import OrderedDict
from dataclasses import dataclass, field

from ..models import Project, Sheet
from ..schemas import SheetGeometry, Takeoff, TakeoffGroup, TakeoffItem
from .geometry import (
    OpeningM,
    PlanM,
    build_plan,
    building_outline,
    min_rect_dims,
    net_lengths,
    openings_near_room,
)
from .specs import Specs, load_specs

GROUP_TITLES = OrderedDict(
    [
        ("substructure", "Substructure"),
        ("walls", "Walls & lintels"),
        ("openings", "Doors & windows"),
        ("roof", "Roof"),
        ("finishes", "Finishes"),
    ]
)

DOOR_HEAD_HEIGHT = 2.1  # windows are assumed to align with door heads when tiling bands are cut


def f2(x: float) -> str:
    return f"{x:,.2f}"


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


def mm(x: float) -> str:
    return f"{x * 1000:.0f}mm"


@dataclass
class _Item:
    description: str
    unit: str
    quantity: float = 0.0
    trace: list[str] = field(default_factory=list)


class Accumulator:
    def __init__(self) -> None:
        self.groups: OrderedDict[str, OrderedDict[str, _Item]] = OrderedDict((k, OrderedDict()) for k in GROUP_TITLES)

    def add(self, group: str, key: str, description: str, unit: str, qty: float, trace: str | list[str]) -> None:
        if qty is None or (abs(qty) < 1e-9 and unit != "nr"):
            return
        items = self.groups[group]
        item = items.get(key)
        if item is None:
            item = items[key] = _Item(description, unit)
        item.quantity += qty
        item.trace.extend([trace] if isinstance(trace, str) else trace)

    def result(self) -> list[TakeoffGroup]:
        out = []
        for gkey, items in self.groups.items():
            if not items:
                continue
            out.append(
                TakeoffGroup(
                    key=gkey,
                    title=GROUP_TITLES[gkey],
                    items=[
                        TakeoffItem(key=k, description=i.description, unit=i.unit, quantity=round(i.quantity, 2), trace=i.trace)
                        for k, i in items.items()
                    ],
                )
            )
        return out


def _void(o: OpeningM, specs: Specs) -> float:
    """Deductible area of one opening (all instances)."""
    a = o.width * o.height
    return a * o.count if a > specs.min_void_deduction else 0.0


def _finish_parts(finish: str) -> tuple[str, str | None]:
    """'Plaster & emulsion paint' -> ('Plaster', 'emulsion paint')."""
    parts = [p.strip() for p in finish.split("&", 1)]
    return parts[0], (parts[1] if len(parts) > 1 else None)


def compute_sheet(
    name: str,
    geometry: SheetGeometry,
    scale: float,
    specs: Specs,
    has_substructure: bool,
    has_roof: bool,
    acc: Accumulator,
    summary: dict[str, float],
    warnings: list[str],
) -> None:
    plan: PlanM = build_plan(geometry, scale, specs)
    warnings.extend(f"{name}: {w}" for w in plan.warnings)
    outline = building_outline(plan)
    if plan.external and outline is None:
        warnings.append(f"{name}: external walls don't form a closed loop, so slab, roof and external finishes were skipped.")

    # ---------------------------------------------------------------- Walls (above DPC)
    net = net_lengths([(w.id, w.line, w.thickness) for w in plan.walls])
    ext_len = sum(net[w.id] for w in plan.external)
    int_len = sum(net[w.id] for w in plan.internal)
    summary["external_girth_centre_m"] = summary.get("external_girth_centre_m", 0) + ext_len
    summary["internal_wall_length_m"] = summary.get("internal_wall_length_m", 0) + int_len

    groups: dict[tuple[str, float], dict] = {}
    for w in plan.walls:
        g = groups.setdefault((w.kind, w.thickness), {"len": 0.0, "gross": 0.0, "heights": set(), "openings": [], "ids": set()})
        g["len"] += net[w.id]
        g["gross"] += net[w.id] * w.height
        g["heights"].add(round(w.height, 3))
        g["ids"].add(w.id)
    for o in plan.openings:
        if o.wall is not None:
            groups[(o.wall.kind, o.wall.thickness)]["openings"].append(o)

    lintel_conc = 0.0
    lintel_form = 0.0
    lintel_trace: list[str] = []
    for (kind, t), g in groups.items():
        voids = sum(_void(o, specs) for o in g["openings"])
        n_open = sum(o.count for o in g["openings"])
        lintel_area = 0.0
        if specs.lintel_mode == "individual":
            for o in g["openings"]:
                ll = o.width + 2 * specs.lintel_bearing
                lintel_area += ll * specs.lintel_depth * o.count
                lintel_conc += ll * t * specs.lintel_depth * o.count
                lintel_form += (o.width * t + 2 * ll * specs.lintel_depth) * o.count
            if g["openings"]:
                lintel_trace.append(f"{name}: {n_open} nr over {kind} openings in {mm(t)} walls")
        elif specs.lintel_mode == "continuous":
            lintel_area = g["len"] * specs.lintel_depth
            lintel_conc += g["len"] * t * specs.lintel_depth
            lintel_form += 2 * g["len"] * specs.lintel_depth + sum(o.width * t * o.count for o in g["openings"])
            lintel_trace.append(f"{name}: band {f2(g['len'])} m × {mm(t)} × {mm(specs.lintel_depth)} ({kind})")

        h = next(iter(g["heights"])) if len(g["heights"]) == 1 else None
        trace = [
            f"{name}: {f2(g['len'])} m net length"
            + (f" × {f2(h)} m high = {f2(g['gross'])} m²" if h else f" (mixed heights) = {f2(g['gross'])} m²")
        ]
        if voids:
            trace.append(f"less openings {f2(voids)} m² ({n_open} nr, voids > {specs.min_void_deduction} m²)")
        if lintel_area:
            trace.append(f"less lintels {f2(lintel_area)} m²")
        acc.add(
            "walls",
            f"blockwork_{kind}_{round(t * 1000)}",
            f"{mm(t)} sandcrete blockwork in {kind} walls",
            "m²",
            g["gross"] - voids - lintel_area,
            trace,
        )
        acc.add("walls", f"girth_{kind}", f"{kind.capitalize()} wall length (centre-line, net)", "m", g["len"],
                f"{name}: {mm(t)} walls {f2(g['len'])} m")

    if lintel_conc:
        acc.add("walls", "lintel_concrete", f"Reinforced concrete lintels, {mm(specs.lintel_depth)} deep", "m³", lintel_conc, lintel_trace)
        acc.add("walls", "lintel_formwork", "Formwork to sides and soffits of lintels", "m²", lintel_form, lintel_trace)
        acc.add("walls", "lintel_rebar", f"Reinforcement to lintels (@ {specs.lintel_rebar_kg_per_m3:g} kg/m³)", "kg",
                lintel_conc * specs.lintel_rebar_kg_per_m3, f"{name}: {f2(lintel_conc)} m³ × {specs.lintel_rebar_kg_per_m3:g} kg/m³")

    # ---------------------------------------------------------------- Openings
    for o in plan.openings:
        otype = specs.opening_type(o.mark)
        desc = otype.description if otype and otype.description else o.kind.capitalize()
        acc.add("openings", f"opening_{o.mark}", f"{o.mark}: {desc} ({mm(o.width)} × {mm(o.height)})", "nr", o.count,
                f"{name}: {o.count} nr")
    summary["door_count"] = summary.get("door_count", 0) + sum(o.count for o in plan.openings if o.kind == "door")
    summary["window_count"] = summary.get("window_count", 0) + sum(o.count for o in plan.openings if o.kind == "window")

    # ---------------------------------------------------------------- Substructure
    slab_area = None
    if has_substructure and plan.walls:
        found_walls = plan.external + (plan.internal if specs.foundation_internal_walls else [])
        trench_net = net_lengths([(w.id, w.line, specs.trench_width) for w in found_walls])
        lt = sum(trench_net.values())
        sub_net = net_lengths([(w.id, w.line, specs.substructure_wall_thickness) for w in found_walls])
        lb = sum(sub_net.values())
        lb_int = sum(sub_net[w.id] for w in found_walls if w.kind == "internal")

        tw, td = specs.trench_width, specs.trench_depth
        exc = lt * tw * td
        blind = lt * specs.footing_width * specs.blinding_thickness
        foot = lt * specs.footing_width * specs.footing_thickness
        below_gl_h = max(0.0, td - specs.footing_thickness - specs.blinding_thickness)
        wall_h = below_gl_h + specs.dpc_height
        wall_below_gl_vol = lb * specs.substructure_wall_thickness * below_gl_h
        backfill = max(0.0, exc - blind - foot - wall_below_gl_vol)
        disposal = exc - backfill

        if outline is not None:
            site = outline.outer.buffer(specs.site_clearance_margin, join_style="mitre").area
            acc.add("substructure", "site_clearance", "Clear site of shrubs and vegetation", "m²", site,
                    f"{name}: building footprint + {f2(specs.site_clearance_margin)} m working space = {f2(site)} m²")
            if specs.topsoil_depth > 0:
                acc.add("substructure", "topsoil", f"Excavate topsoil average {mm(specs.topsoil_depth)} deep", "m²", site,
                        f"{name}: {f2(site)} m²")
        acc.add("substructure", "trench_excavation", f"Excavate foundation trench, {mm(tw)} wide, not exceeding {f2(td)} m deep", "m³", exc,
                f"{name}: {f2(lt)} m trench length × {f2(tw)} × {f2(td)} = {f2(exc)} m³")
        if blind:
            acc.add("substructure", "blinding", f"Plain concrete blinding {mm(specs.blinding_thickness)} thick", "m³", blind,
                    f"{name}: {f2(lt)} × {f2(specs.footing_width)} × {f2(specs.blinding_thickness)}")
        acc.add("substructure", "footing_concrete", f"Concrete in strip foundations, {mm(specs.footing_width)} × {mm(specs.footing_thickness)}", "m³", foot,
                f"{name}: {f2(lt)} m × {f2(specs.footing_width)} × {f2(specs.footing_thickness)} = {f2(foot)} m³")
        acc.add("substructure", "blockwork_below_dpc", f"{mm(specs.substructure_wall_thickness)} sandcrete blockwork below DPC (filled solid)", "m²", lb * wall_h,
                f"{name}: {f2(lb)} m × {f2(wall_h)} m ({f2(below_gl_h)} below GL + {f2(specs.dpc_height)} to DPC)")
        acc.add("substructure", "dpc", f"Damp proof course, {mm(specs.substructure_wall_thickness)} wide", "m", lb, f"{name}: {f2(lb)} m")
        acc.add("substructure", "backfill", "Return fill and ram excavated material around foundations", "m³", backfill,
                f"{name}: {f2(exc)} excavation − {f2(foot + blind)} concrete − {f2(wall_below_gl_vol)} blockwork below GL")
        acc.add("substructure", "disposal", "Remove surplus excavated material from site", "m³", disposal,
                f"{name}: {f2(exc)} − {f2(backfill)} backfill")

        if outline is not None:
            slab_area = max(0.0, outline.inner.area - lb_int * specs.substructure_wall_thickness)
            fill_t = max(0.0, specs.dpc_height - specs.oversite_thickness - specs.hardcore_thickness)
            st = (f"{name}: {f2(outline.inner.area)} m² inside external walls − "
                  f"{f2(lb_int)} m × {f2(specs.substructure_wall_thickness)} internal walls = {f2(slab_area)} m²")
            if fill_t:
                acc.add("substructure", "earth_filling", f"Laterite filling to make up levels, {mm(fill_t)} thick", "m³", slab_area * fill_t,
                        [st, f"× {f2(fill_t)} m"])
            if specs.hardcore_thickness:
                acc.add("substructure", "hardcore", f"Hardcore filling {mm(specs.hardcore_thickness)} thick, blinded", "m³",
                        slab_area * specs.hardcore_thickness, [st, f"× {f2(specs.hardcore_thickness)} m"])
            acc.add("substructure", "anti_termite", "Anti-termite treatment to oversite", "m²", slab_area, st)
            acc.add("substructure", "dpm", "Polythene damp proof membrane", "m²", slab_area, st)
            acc.add("substructure", "oversite_concrete", f"Concrete in ground floor slab {mm(specs.oversite_thickness)} thick", "m³",
                    slab_area * specs.oversite_thickness, [st, f"× {f2(specs.oversite_thickness)} m"])
            if specs.slab_mesh:
                acc.add("substructure", "slab_mesh", "Fabric reinforcement (A142 or equal) to slab", "m²", slab_area, st)

    # ---------------------------------------------------------------- Roof
    if has_roof and outline is not None:
        p = math.radians(specs.roof_pitch_deg)
        roof_plan = outline.outer.buffer(specs.roof_overhang, join_style="mitre")
        plan_area = roof_plan.area
        slope_area = plan_area if specs.roof_type == "flat" else plan_area / math.cos(p)
        long_, short = min_rect_dims(roof_plan)
        rt = f"{name}: plan {f2(plan_area)} m² (incl. {f2(specs.roof_overhang)} m overhang)"
        acc.add("roof", "roof_covering", f"Roof covering to {specs.roof_type} roof, {specs.roof_pitch_deg:g}° pitch", "m²", slope_area,
                [rt, f"÷ cos {specs.roof_pitch_deg:g}° = {f2(slope_area)} m² on slope" if specs.roof_type != "flat" else "flat roof"])
        acc.add("roof", "roof_plan_area", "Roof plan area (for information)", "m²", plan_area, rt)
        eaves = roof_plan.area - outline.outer.area
        acc.add("roof", "eaves_soffit", "Soffit lining to eaves overhang", "m²", eaves, f"{name}: {f2(plan_area)} − {f2(outline.outer.area)} footprint")
        if specs.roof_type == "hip":
            rise = (short / 2) * math.tan(p)
            hip = math.sqrt(2 * (short / 2) ** 2 + rise**2)
            acc.add("roof", "fascia", "Fascia board", "m", roof_plan.exterior.length, f"{name}: roof perimeter")
            acc.add("roof", "ridge", "Ridge capping (approx., rectangular plan)", "m", max(0.0, long_ - short), f"{name}: {f2(long_)} − {f2(short)}")
            acc.add("roof", "hips", "Hip capping (approx., rectangular plan)", "m", 4 * hip, f"{name}: 4 nr × {f2(hip)} m")
        elif specs.roof_type == "gable":
            acc.add("roof", "fascia", "Fascia board to eaves", "m", 2 * long_, f"{name}: 2 × {f2(long_)} m")
            acc.add("roof", "barge", "Barge board to gables", "m", 2 * short / math.cos(p), f"{name}: 2 × {f2(short)} ÷ cos pitch")
            acc.add("roof", "ridge", "Ridge capping (approx., rectangular plan)", "m", long_, f"{name}: {f2(long_)} m")
        else:
            acc.add("roof", "fascia", "Fascia / parapet edge", "m", roof_plan.exterior.length, f"{name}: roof perimeter")

    # ---------------------------------------------------------------- Finishes
    if outline is not None:
        summary["gross_external_area_m2"] = summary.get("gross_external_area_m2", 0) + outline.outer.area
        summary["gross_internal_area_m2"] = summary.get("gross_internal_area_m2", 0) + outline.inner.area
        summary["external_girth_outer_m"] = summary.get("external_girth_outer_m", 0) + outline.outer.exterior.length

        ext_openings = [o for o in plan.openings if o.wall is not None and o.wall.kind == "external"]
        ext_h = (plan.external[0].height if plan.external else specs.wall_height) + (specs.dpc_height if has_substructure else 0)
        ext_girth = outline.outer.exterior.length
        ext_voids = sum(_void(o, specs) for o in ext_openings)
        ext_area = ext_girth * ext_h - ext_voids
        base, paint = _finish_parts(specs.external_finish)
        et = [f"{name}: {f2(ext_girth)} m outer girth × {f2(ext_h)} m = {f2(ext_girth * ext_h)} m²", f"less openings {f2(ext_voids)} m²"]
        acc.add("finishes", "external_render", f"External {base.lower()} to walls", "m²", ext_area, et)
        if paint:
            acc.add("finishes", f"external_{slug(paint)}", f"{paint[0].upper() + paint[1:]} to external walls", "m²", ext_area, et)

    if plan.rooms:
        summary["room_count"] = summary.get("room_count", 0) + len(plan.rooms)
        for r in plan.rooms:
            src = r.source
            ff = src.floor_finish or specs.default_floor_finish
            wf = src.wall_finish or specs.default_wall_finish
            cf = src.ceiling_finish or specs.default_ceiling_finish
            h = src.height or specs.room_height
            area = r.polygon.area
            perim = r.polygon.exterior.length
            near = openings_near_room(r, plan.openings)
            voids = sum(_void(o, specs) for o in near)
            door_w = sum(o.width * o.count for o in near if o.kind == "door")
            wall_net = perim * h - voids
            rn = f"{name} / {r.name}"

            acc.add("finishes", "floor_screed", "Cement-sand screed to floors", "m²", area, f"{rn}: {f2(area)} m²")
            if "screed only" not in ff.lower():
                acc.add("finishes", f"floor_{slug(ff)}", f"{ff} to floors", "m²", area, f"{rn}: {f2(area)} m²")
                if src.skirting and specs.skirting_height > 0:
                    acc.add("finishes", f"skirting_{slug(ff)}", f"{ff} skirting {mm(specs.skirting_height)} high", "m",
                            max(0.0, perim - door_w), f"{rn}: {f2(perim)} m perimeter − {f2(door_w)} m doors")
            acc.add("finishes", f"ceiling_{slug(cf)}", cf, "m²", area, f"{rn}: {f2(area)} m²")

            base, finish = _finish_parts(wf)
            acc.add("finishes", "internal_plaster", f"Internal {base.lower()} to walls", "m²", wall_net,
                    [f"{rn}: {f2(perim)} m × {f2(h)} m = {f2(perim * h)} m²", f"less openings {f2(voids)} m²"])
            tile_area = 0.0
            if "tile" in wf.lower():
                th = src.wall_tile_height or h
                band_voids = 0.0
                for o in near:
                    if o.kind == "door":
                        band_voids += o.width * min(o.height, th) * o.count
                    else:
                        sill = DOOR_HEAD_HEIGHT - o.height
                        band_voids += o.width * max(0.0, min(th, DOOR_HEAD_HEIGHT) - sill) * o.count
                tile_area = max(0.0, perim * th - band_voids)
                acc.add("finishes", "wall_tiles", "Wall tiles", "m²", tile_area,
                        f"{rn}: {f2(perim)} m × {f2(th)} m − {f2(band_voids)} m² openings")
            paint_area = max(0.0, wall_net - tile_area)
            if finish and "tile" not in finish.lower():
                acc.add("finishes", f"paint_{slug(finish)}", f"{finish[0].upper() + finish[1:]} to internal walls", "m²", paint_area,
                        f"{rn}: {f2(wall_net)} m² − {f2(tile_area)} m² tiles")
            elif tile_area < wall_net - 0.01:
                acc.add("finishes", "paint_emulsion_paint", "Emulsion paint to internal walls", "m²", paint_area,
                        f"{rn}: {f2(wall_net)} m² above tiling")
    elif outline is not None and plan.walls:
        warnings.append(f"{name}: no rooms traced. Internal finishes are estimated from walls using default finishes.")
        h = specs.room_height
        int_t = specs.internal_wall_thickness
        floor = max(0.0, outline.inner.area - int_len * int_t)
        int_open = [o for o in plan.openings if o.wall is not None and o.wall.kind == "internal"]
        ext_open = [o for o in plan.openings if o.wall is not None and o.wall.kind == "external"]
        wall_len = outline.inner.exterior.length + 2 * int_len
        voids = sum(_void(o, specs) for o in ext_open) + 2 * sum(_void(o, specs) for o in int_open)
        doors = sum(o.width * o.count for o in ext_open if o.kind == "door") + 2 * sum(o.width * o.count for o in int_open if o.kind == "door")
        ft = f"{name}: {f2(outline.inner.area)} m² − internal walls {f2(int_len * int_t)} m² (estimated)"
        acc.add("finishes", "floor_screed", "Cement-sand screed to floors", "m²", floor, ft)
        acc.add("finishes", f"floor_{slug(specs.default_floor_finish)}", f"{specs.default_floor_finish} to floors", "m²", floor, ft)
        acc.add("finishes", f"ceiling_{slug(specs.default_ceiling_finish)}", specs.default_ceiling_finish, "m²", floor, ft)
        base, finish = _finish_parts(specs.default_wall_finish)
        wt = [f"{name}: ({f2(outline.inner.exterior.length)} inner girth + 2 × {f2(int_len)} internal walls) × {f2(h)} m",
              f"less openings {f2(voids)} m² (estimated)"]
        acc.add("finishes", "internal_plaster", f"Internal {base.lower()} to walls", "m²", wall_len * h - voids, wt)
        if finish:
            acc.add("finishes", f"paint_{slug(finish)}", f"{finish[0].upper() + finish[1:]} to internal walls", "m²", wall_len * h - voids, wt)
        acc.add("finishes", f"skirting_{slug(specs.default_floor_finish)}", f"{specs.default_floor_finish} skirting {mm(specs.skirting_height)} high",
                "m", max(0.0, wall_len - doors), f"{name}: {f2(wall_len)} m − {f2(doors)} m doors (estimated)")


def compute_takeoff(project: Project) -> Takeoff:
    specs = load_specs(project.specs)
    acc = Accumulator()
    summary: dict[str, float] = {}
    warnings: list[str] = []
    used: list[str] = []

    for sheet in project.sheets:
        if not sheet.include:
            continue
        geometry = SheetGeometry.model_validate(sheet.geometry or {})
        if not (geometry.walls or geometry.rooms or geometry.openings):
            continue
        if not sheet.scale_m_per_px:
            warnings.append(f"{sheet.name}: scale not set. Calibrate the sheet to include it in the takeoff.")
            continue
        used.append(sheet.name)
        compute_sheet(sheet.name, geometry, sheet.scale_m_per_px, specs, sheet.has_substructure, sheet.has_roof, acc, summary, warnings)

    if not used and not warnings:
        warnings.append("Nothing to measure yet. Trace or auto-detect walls on a calibrated sheet.")

    return Takeoff(
        project_id=project.id,
        groups=acc.result(),
        summary={k: round(v, 2) for k, v in summary.items()},
        warnings=warnings,
        sheets=used,
    )


def compute_sheet_takeoff(sheet: Sheet, project: Project) -> Takeoff:
    """Takeoff for a single sheet (used by the editor's live panel)."""
    specs = load_specs(project.specs)
    acc = Accumulator()
    summary: dict[str, float] = {}
    warnings: list[str] = []
    geometry = SheetGeometry.model_validate(sheet.geometry or {})
    if sheet.scale_m_per_px:
        compute_sheet(sheet.name, geometry, sheet.scale_m_per_px, specs, sheet.has_substructure, sheet.has_roof, acc, summary, warnings)
    else:
        warnings.append("Set the scale to see quantities.")
    return Takeoff(project_id=project.id, groups=acc.result(), summary={k: round(v, 2) for k, v in summary.items()},
                   warnings=warnings, sheets=[sheet.name])
