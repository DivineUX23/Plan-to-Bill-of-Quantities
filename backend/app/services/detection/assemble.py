"""Shared wall assembly used by both the vector and raster detectors.

Input: wall *rectangles* (centre segment + thickness) in sheet-pixel space, plus evidence for
openings. Output: clean centre-line walls (merged across openings, snapped at junctions), door /
window openings, and room polygons.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field

import numpy as np
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import polygonize, unary_union

from ...schemas import Opening, Room, SheetGeometry, Wall


@dataclass
class Seg:
    a: np.ndarray
    b: np.ndarray
    t: float
    id: str = ""
    kind: str = "internal"

    @property
    def length(self) -> float:
        return float(np.linalg.norm(self.b - self.a))

    @property
    def dir(self) -> np.ndarray:
        d = self.b - self.a
        n = np.linalg.norm(d)
        return d / n if n else np.array([1.0, 0.0])

    @property
    def angle(self) -> float:
        d = self.dir
        return math.degrees(math.atan2(d[1], d[0])) % 180.0

    def line(self) -> LineString:
        return LineString([tuple(self.a), tuple(self.b)])


@dataclass
class OpeningCandidate:
    kind: str  # door | window
    centre: np.ndarray
    width_px: float
    angle: float
    seg: Seg | None = None


@dataclass
class Evidence:
    """Callable hooks the detectors provide to classify a gap between collinear wall pieces."""

    classify_gap: callable  # (centre, direction, gap_len, thickness) -> "door" | "window" | None


@dataclass
class Label:
    text: str
    x: float
    y: float


@dataclass
class Assembly:
    walls: list[Seg] = field(default_factory=list)
    openings: list[OpeningCandidate] = field(default_factory=list)
    rooms: list[tuple[str, Polygon]] = field(default_factory=list)


def _angle_diff(a: float, b: float) -> float:
    d = abs(a - b) % 180.0
    return min(d, 180.0 - d)


def rect_to_seg(poly: Polygon, min_aspect: float = 1.8) -> Seg | None:
    """Treat a near-rectangular polygon as a wall piece."""
    if poly.is_empty or poly.area <= 0:
        return None
    mrr = poly.minimum_rotated_rectangle
    if not isinstance(mrr, Polygon) or mrr.area <= 0:
        return None
    if poly.area / mrr.area < 0.8:
        return None
    c = np.array(mrr.exterior.coords[:4])
    e1, e2 = c[1] - c[0], c[2] - c[1]
    l1, l2 = np.linalg.norm(e1), np.linalg.norm(e2)
    if l1 >= l2:
        long_len, t = l1, l2
        a, b = (c[0] + c[3]) / 2, (c[1] + c[2]) / 2
    else:
        long_len, t = l2, l1
        a, b = (c[0] + c[1]) / 2, (c[3] + c[2]) / 2
    if t <= 0 or long_len / t < min_aspect:
        return None
    return Seg(a.astype(float), b.astype(float), float(t))


# ----------------------------------------------------------------------------- merging


def merge_collinear(segs: list[Seg], evidence: Evidence, t_max: float) -> tuple[list[Seg], list[OpeningCandidate]]:
    """Merge collinear pieces of the same wall, bridging gaps that contain a door or window."""
    used = [False] * len(segs)
    merged: list[Seg] = []
    openings: list[OpeningCandidate] = []

    for i, s in enumerate(segs):
        if used[i]:
            continue
        group = [s]
        used[i] = True
        d = s.dir
        n = np.array([-d[1], d[0]])
        rho = float(np.dot(s.a, n))
        for j in range(i + 1, len(segs)):
            if used[j]:
                continue
            o = segs[j]
            if _angle_diff(o.angle, s.angle) > 3:
                continue
            if not (0.6 <= o.t / s.t <= 1.65):
                continue
            mid = (o.a + o.b) / 2
            if abs(float(np.dot(mid, n)) - rho) > max(s.t, o.t) * 0.5:
                continue
            group.append(o)
            used[j] = True

        # Project onto the group direction and sweep along it.
        t = float(np.median([g.t for g in group]))
        origin = s.a
        intervals = sorted(
            (min(np.dot(g.a - origin, d), np.dot(g.b - origin, d)), max(np.dot(g.a - origin, d), np.dot(g.b - origin, d)))
            for g in group
        )
        mean_off = float(np.mean([np.dot((g.a + g.b) / 2 - origin, n) for g in group]))
        base = origin + n * mean_off
        max_gap = 12 * max(t, 0.6 * t_max)

        cur_lo, cur_hi = intervals[0]
        pending: list[OpeningCandidate] = []
        for lo, hi in intervals[1:]:
            gap = lo - cur_hi
            if gap <= 0.3 * t:
                cur_hi = max(cur_hi, hi)
                continue
            kind = None
            if gap <= max_gap:
                centre = base + d * ((cur_hi + lo) / 2)
                kind = evidence.classify_gap(centre, d, gap, t)
            if kind:
                pending.append(OpeningCandidate(kind, base + d * ((cur_hi + lo) / 2), gap, s.angle))
                cur_hi = max(cur_hi, hi)
            else:
                seg = Seg(base + d * cur_lo, base + d * cur_hi, t)
                merged.append(seg)
                for p in pending:
                    p.seg = seg
                openings.extend(pending)
                pending = []
                cur_lo, cur_hi = lo, hi
        seg = Seg(base + d * cur_lo, base + d * cur_hi, t)
        merged.append(seg)
        for p in pending:
            p.seg = seg
        openings.extend(pending)

    return merged, openings


# ----------------------------------------------------------------------------- junctions


def _line_intersection(p: np.ndarray, r: np.ndarray, q: np.ndarray, s: np.ndarray) -> np.ndarray | None:
    cross = r[0] * s[1] - r[1] * s[0]
    if abs(cross) < 1e-9:
        return None
    t = ((q - p)[0] * s[1] - (q - p)[1] * s[0]) / cross
    return p + t * r


def snap_junctions(segs: list[Seg]) -> None:
    """Move wall ends to the intersection with abutting walls (closes L, T and corner overlaps)."""
    for i, s in enumerate(segs):
        for end in ("a", "b"):
            e = getattr(s, end)
            best, best_d = None, None
            for j, o in enumerate(segs):
                if i == j or _angle_diff(s.angle, o.angle) < 20:
                    continue
                p = _line_intersection(s.a, s.dir, o.a, o.dir)
                if p is None:
                    continue
                dist = float(np.linalg.norm(p - e))
                if dist > max(s.t, o.t) * 1.1 + 1.0:
                    continue
                along = float(np.dot(p - o.a, o.dir))
                if along < -o.t * 1.1 or along > o.length + o.t * 1.1:
                    continue
                # Don't flip the segment's direction by snapping across its other end.
                other_end = s.b if end == "a" else s.a
                if np.linalg.norm(p - other_end) < s.t:
                    continue
                if best_d is None or dist < best_d:
                    best, best_d = p, dist
            if best is not None:
                setattr(s, end, best.astype(float))


# ----------------------------------------------------------------------------- classification & rooms


DIM_RE = re.compile(
    r"^\s*(\d+(\.\d+)?\s*(m|mm|cm)|\d+\s*'\s*(-?\s*\d+(\.\d+)?\s*(\"|''))?|\d+(\.\d+)?\s*(\"|''))\s*$", re.I
)
ROOM_DIM_RE = re.compile(r"\d+\s*['\"]?\s*[x×]\s*\d+", re.I)


def is_dimension_text(t: str) -> bool:
    return bool(DIM_RE.match(t)) or bool(ROOM_DIM_RE.search(t)) or t.strip().lower() in {"x", "×"}


def assemble(segs: list[Seg], openings: list[OpeningCandidate], labels: list[Label]) -> Assembly:
    segs = [s for s in segs if s.length >= max(s.t, 2.0)]
    for k, s in enumerate(segs):
        s.id = f"w{k + 1}"

    t_max = max((s.t for s in segs), default=1.0)
    lines = [s.line() for s in segs]
    faces: list[Polygon] = []
    if lines:
        noded = unary_union(lines)
        min_face = (3 * t_max) ** 2
        faces = [f for f in polygonize(noded) if f.area > min_face]

    ring = None
    if faces:
        outline = unary_union(faces)
        polys = [outline] if isinstance(outline, Polygon) else list(getattr(outline, "geoms", []))
        if polys:
            ring = max(polys, key=lambda p: p.area).exterior

    for s in segs:
        on_ring = False
        if ring is not None and s.length > 0:
            near = s.line().intersection(ring.buffer(max(s.t * 0.6, 1.5)))
            on_ring = near.length >= 0.6 * s.length
        s.kind = "external" if on_ring or s.t >= 0.8 * t_max else "internal"

    # Rooms: faces minus wall bodies, labelled from text inside.
    rooms: list[tuple[str, Polygon]] = []
    if faces:
        bodies = unary_union([s.line().buffer(s.t / 2, cap_style="flat", join_style="mitre") for s in segs])
        for face in faces:
            inner = face.difference(bodies)
            if inner.is_empty:
                continue
            if not isinstance(inner, Polygon):
                inner = max(getattr(inner, "geoms", []), key=lambda p: p.area, default=None)
                if inner is None:
                    continue
            if inner.area < (4 * t_max) ** 2:
                continue
            inner = inner.simplify(max(1.0, t_max * 0.15))
            words = [lb for lb in labels if face.contains(Point(lb.x, lb.y)) and not is_dimension_text(lb.text)]
            words.sort(key=lambda lb: (round(lb.y / max(t_max, 1)), lb.x))
            name = " ".join(w.text for w in words).strip() or f"Room {len(rooms) + 1}"
            rooms.append((name, inner))

    return Assembly(walls=segs, openings=openings, rooms=rooms)


def to_geometry(asm: Assembly, opening_type_for) -> SheetGeometry:
    """Convert an assembly to editor geometry. `opening_type_for(kind, width_px)` -> mark."""
    walls = [
        Wall(id=s.id, kind=s.kind, points=[(round(float(s.a[0]), 1), round(float(s.a[1]), 1)),
                                            (round(float(s.b[0]), 1), round(float(s.b[1]), 1))])
        for s in asm.walls
    ]
    ids = {id(s): s.id for s in asm.walls}
    openings = []
    for k, o in enumerate(asm.openings):
        if o.seg is None or id(o.seg) not in ids:
            continue
        openings.append(
            Opening(
                id=f"o{k + 1}",
                type=opening_type_for(o.kind, o.width_px),
                x=round(float(o.centre[0]), 1),
                y=round(float(o.centre[1]), 1),
                wall_id=ids[id(o.seg)],
                angle=round(o.angle, 1),
            )
        )
    rooms = [
        Room(id=f"r{k + 1}", name=name.title() if name.isupper() is False and name.islower() else name,
             points=[(round(x, 1), round(y, 1)) for x, y in list(poly.exterior.coords)[:-1]])
        for k, (name, poly) in enumerate(asm.rooms)
    ]
    return SheetGeometry(walls=walls, rooms=rooms, openings=openings)
