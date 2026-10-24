"""Plan geometry in real-world units (metres).

Conventions
-----------
* Wall traces are converted to **centre-lines**. Closed external traces drawn on the outer face
  are offset inwards by half the wall thickness (mitred), so girths follow the QS centre-line
  method.
* Net wall lengths use the "occupied body" rule: walls are processed in order (external first)
  and each centre-line is clipped by the bodies of walls already counted. This deducts half the
  abutting thickness at T-junctions, a full thickness at crossings, and nothing at L-corners,
  which is exactly what's needed to measure walling without double-counting.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from shapely import make_valid
from shapely.geometry import LineString, MultiPolygon, Point, Polygon
from shapely.geometry.base import BaseGeometry
from shapely.ops import polygonize, substring, unary_union

from ..schemas import Opening, Room, SheetGeometry, Wall
from .specs import Specs

# Open wall ends are shortened by this much before building bodies, so tiny drafting
# imprecision at L-corners can't accidentally trim the adjoining wall.
END_TOLERANCE_M = 0.02


@dataclass
class WallM:
    id: str
    kind: str
    line: LineString  # centre-line, metres
    thickness: float
    height: float
    closed: bool


@dataclass
class OpeningM:
    id: str
    mark: str
    kind: str  # door | window
    width: float
    height: float
    point: Point
    count: int
    wall: WallM | None


@dataclass
class RoomM:
    id: str
    name: str
    polygon: Polygon
    source: Room


@dataclass
class PlanM:
    walls: list[WallM] = field(default_factory=list)
    openings: list[OpeningM] = field(default_factory=list)
    rooms: list[RoomM] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def external(self) -> list[WallM]:
        return [w for w in self.walls if w.kind == "external"]

    @property
    def internal(self) -> list[WallM]:
        return [w for w in self.walls if w.kind == "internal"]


# --- Helpers ---------------------------------------------------------------------------------


def largest_polygon(geom: BaseGeometry) -> Polygon | None:
    if geom is None or geom.is_empty:
        return None
    if isinstance(geom, Polygon):
        return geom
    polys = [g for g in getattr(geom, "geoms", []) if isinstance(g, Polygon)]
    if not polys:
        polys = [p for g in getattr(geom, "geoms", []) for p in getattr(g, "geoms", []) if isinstance(p, Polygon)]
    return max(polys, key=lambda p: p.area) if polys else None


def clean_polygon(points: list[tuple[float, float]]) -> Polygon | None:
    if len(points) < 3:
        return None
    poly = Polygon(points)
    if not poly.is_valid:
        poly = largest_polygon(make_valid(poly))
    return poly if poly is not None and poly.area > 0 else None


def body(line: LineString, width: float) -> BaseGeometry:
    """Wall body polygon: centre-line buffered with flat caps and mitred joins."""
    if line.is_empty or width <= 0:
        return Polygon()
    if not line.is_ring and line.length > 2 * END_TOLERANCE_M:
        line = substring(line, END_TOLERANCE_M, line.length - END_TOLERANCE_M)
    return line.buffer(width / 2, cap_style="flat", join_style="mitre", mitre_limit=5)


def net_lengths(items: list[tuple[str, LineString, float]]) -> dict[str, float]:
    """Net length of each line after clipping by bodies of previously processed lines."""
    occupied: BaseGeometry | None = None
    out: dict[str, float] = {}
    for key, line, width in items:
        net = line if occupied is None else line.difference(occupied)
        out[key] = out.get(key, 0.0) + net.length
        b = body(line, width)
        occupied = b if occupied is None else unary_union([occupied, b])
    return out


# --- Conversion from sheet pixels --------------------------------------------------------------


def _scaled(points, s: float) -> list[tuple[float, float]]:
    return [(float(x) * s, float(y) * s) for x, y in points]


def wall_centreline(wall: Wall, s: float, thickness: float) -> LineString | None:
    pts = _scaled(wall.points, s)
    if wall.closed and len(pts) >= 3:
        poly = clean_polygon(pts)
        if poly is None:
            return None
        if wall.ref == "outer":
            poly = largest_polygon(poly.buffer(-thickness / 2, join_style="mitre"))
        elif wall.ref == "inner":
            poly = largest_polygon(poly.buffer(thickness / 2, join_style="mitre"))
        if poly is None:
            return None
        return LineString(poly.exterior.coords)
    line = LineString(pts)
    return line if line.length > 0 else None


def build_plan(geometry: SheetGeometry, scale: float, specs: Specs) -> PlanM:
    plan = PlanM()

    for w in geometry.walls:
        t = w.thickness or (specs.external_wall_thickness if w.kind == "external" else specs.internal_wall_thickness)
        line = wall_centreline(w, scale, t)
        if line is None:
            plan.warnings.append(f"Wall {w.id} is degenerate and was skipped.")
            continue
        plan.walls.append(WallM(w.id, w.kind, line, t, w.height or specs.wall_height, w.closed))

    # External walls first so internal walls are trimmed to their inner face.
    plan.walls.sort(key=lambda w: 0 if w.kind == "external" else 1)
    by_id = {w.id: w for w in plan.walls}

    for o in geometry.openings:
        otype = specs.opening_type(o.type)
        if otype is None:
            plan.warnings.append(f"Opening {o.id} uses unknown type '{o.type}' and was skipped.")
            continue
        pt = Point(o.x * scale, o.y * scale)
        host = by_id.get(o.wall_id) if o.wall_id else None
        if host is None and plan.walls:
            nearest = min(plan.walls, key=lambda w: w.line.distance(pt))
            if nearest.line.distance(pt) <= max(0.5, nearest.thickness * 2):
                host = nearest
        if host is None:
            plan.warnings.append(f"{otype.mark} opening {o.id} isn't on a wall; it is counted but not deducted.")
        plan.openings.append(OpeningM(o.id, otype.mark, otype.kind, otype.width, otype.height, pt, o.count, host))

    for r in geometry.rooms:
        poly = clean_polygon(_scaled(r.points, scale))
        if poly is None:
            plan.warnings.append(f"Room '{r.name}' has no area and was skipped.")
            continue
        plan.rooms.append(RoomM(r.id, r.name, poly, r))

    return plan


# --- Building outline ---------------------------------------------------------------------------


@dataclass
class Outline:
    centre: Polygon  # polygon bounded by external wall centre-lines
    outer: Polygon  # external face
    inner: Polygon  # internal face of external walls
    thickness: float


def building_outline(plan: PlanM) -> Outline | None:
    ext = plan.external
    if not ext:
        return None
    merged = unary_union([w.line for w in ext])
    faces = list(polygonize(merged))
    if not faces:
        return None
    centre = largest_polygon(unary_union(faces))
    if centre is None:
        return None
    # Weighted average thickness of external walls
    total = sum(w.line.length for w in ext) or 1.0
    t = sum(w.thickness * w.line.length for w in ext) / total
    outer = largest_polygon(centre.buffer(t / 2, join_style="mitre"))
    inner = largest_polygon(centre.buffer(-t / 2, join_style="mitre"))
    if outer is None or inner is None:
        return None
    return Outline(centre=centre, outer=outer, inner=inner, thickness=t)


def min_rect_dims(poly: Polygon) -> tuple[float, float]:
    """(long, short) side of the minimum rotated rectangle."""
    rect = poly.minimum_rotated_rectangle
    if not isinstance(rect, Polygon):
        return (0.0, 0.0)
    c = list(rect.exterior.coords)
    a = math.dist(c[0], c[1])
    b = math.dist(c[1], c[2])
    return (max(a, b), min(a, b))


def as_polygons(geom: BaseGeometry) -> list[Polygon]:
    if isinstance(geom, Polygon):
        return [geom]
    if isinstance(geom, MultiPolygon):
        return list(geom.geoms)
    return []


def openings_near_room(room: RoomM, openings: list[OpeningM]) -> list[OpeningM]:
    out = []
    boundary = room.polygon.exterior
    for o in openings:
        tol = (o.wall.thickness / 2 if o.wall else 0.15) + 0.12
        if boundary.distance(o.point) <= tol:
            out.append(o)
    return out
