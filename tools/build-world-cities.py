#!/usr/bin/env python3
"""Extract real OpenStreetMap building footprints, heights, roof types, roads, and
suburban settlement cells for all 8 international flight regions into dist/world-city/.

Uses the exact same regionalOrigin / eastScale / northScale coordinate projection as
dist/region.js and dist/taiwan-city.js so every street and building aligns 1:1 with
airports, runways, and landmarks.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import pathlib
import time
from collections import defaultdict

import osmium

ROOT = pathlib.Path(__file__).resolve().parents[1]
WORLD_CITY_DIR = ROOT / "dist" / "world-city"
DEFAULT_CACHE = ROOT.parent / "osm-cache"

# Must match dist/region.js L2-5 identically
ORIGIN_LAT = 25 + (4 + 10.535 / 60) / 60
ORIGIN_LON = 121 + (33 + 9.085 / 60) / 60
EAST_SCALE = 111319.49 * math.cos(math.radians(ORIGIN_LAT))
NORTH_SCALE = 110772.0

TILE_SIZE = 4800
CELL_SIZE = 120
MAX_TILE_BUILDINGS = 3200
MAX_POLY_VERTS = 14
MIN_AREA_M2 = 18.0
RDP_EPSILON_M = 0.90

# Region definitions: regId -> metadata & bboxes
# Each region PBF comes from osm-cache/<pbf>.
REGIONS = [
    {
        "id": 0,
        "code": "JP_TYO",
        "name": "Tokyo Bay, Haneda & Narita",
        "pbf": "kanto-latest.osm.pbf",
        "boxes": [
            (35.39, 139.56, 35.80, 140.15),  # Tokyo 23 wards, Haneda, Kawasaki, Yokohama, Chiba Bay
            (35.67, 140.20, 35.86, 140.48),  # Narita Airport & Narita City corridor
        ],
        "cbd": [(35.681, 139.767, 14.0), (35.455, 139.633, 6.0)],
        "floor_h": 3.2,
        "house_rate": 0.72,
    },
    {
        "id": 1,
        "code": "JP_KIX",
        "name": "Osaka Bay, Kansai & Kobe",
        "pbf": "kansai-latest.osm.pbf",
        "boxes": [(34.34, 135.12, 34.80, 135.66)],
        "cbd": [(34.694, 135.502, 11.0), (34.690, 135.195, 6.0)],
        "floor_h": 3.2,
        "house_rate": 0.70,
    },
    {
        "id": 2,
        "code": "JP_OKA",
        "name": "Okinawa Naha & Chatan",
        "pbf": "kyushu-latest.osm.pbf",
        "boxes": [(26.06, 127.58, 26.48, 127.92)],
        "cbd": [(26.215, 127.684, 5.5)],
        "floor_h": 3.1,
        "house_rate": 0.45,
    },
    {
        "id": 3,
        "code": "HK_HKG",
        "name": "Hong Kong & Chek Lap Kok",
        "pbf": "hk.osm.pbf",
        "boxes": [(22.18, 113.84, 22.54, 114.34)],
        "cbd": [(22.284, 114.158, 6.5), (22.312, 114.170, 8.5)],
        "floor_h": 3.3,
        "house_rate": 0.25,
    },
    {
        "id": 4,
        "code": "KR_ICN",
        "name": "Seoul & Incheon Songdo",
        "pbf": "south-korea-latest.osm.pbf",
        "boxes": [(37.33, 126.36, 37.68, 127.18)],
        "cbd": [(37.555, 126.985, 13.0), (37.508, 127.060, 10.0), (37.392, 126.640, 6.0)],
        "floor_h": 3.1,
        "house_rate": 0.35,
    },
    {
        "id": 5,
        "code": "SG_SIN",
        "name": "Singapore Marina Bay & Changi",
        "pbf": "sg.osm.pbf",
        "boxes": [(1.21, 103.60, 1.48, 104.04)],
        "cbd": [(1.284, 103.854, 5.5)],
        "floor_h": 3.3,
        "house_rate": 0.48,
    },
    {
        "id": 6,
        "code": "PH_MNL",
        "name": "Metro Manila, Makati & NAIA",
        "pbf": "philippines-latest.osm.pbf",
        "boxes": [(14.38, 120.88, 14.76, 121.15)],
        "cbd": [(14.556, 121.024, 5.5), (14.550, 121.050, 4.0)],
        "floor_h": 3.1,
        "house_rate": 0.78,
    },
    {
        "id": 7,
        "code": "TH_BKK",
        "name": "Bangkok Chao Phraya & Suvarnabhumi",
        "pbf": "thailand-latest.osm.pbf",
        "boxes": [(13.56, 100.40, 13.94, 100.88)],
        "cbd": [(13.735, 100.545, 9.5)],
        "floor_h": 3.2,
        "house_rate": 0.68,
    },
]

ROAD_WIDTHS = {
    "motorway": 24,
    "trunk": 20,
    "primary": 16,
    "secondary": 12,
    "tertiary": 9,
}

PITCHED_ROOF_SHAPES = {
    "gabled", "hipped", "half-hipped", "pyramidal", "gambrel", "mansard",
    "pitched", "saltbox", "skillion", "dome", "onion",
}
HOUSE_TAGS = {
    "house", "detached", "semidetached_house", "terrace", "bungalow",
    "farm", "farm_auxiliary", "hut", "cabin", "cottage", "villa",
    "static_caravan", "houseboat", "ger", "stilt_house",
}
APARTMENT_TAGS = {"apartments", "dormitory", "hotel", "residential", "retail", "mixed"}
COMMERCIAL_TAGS = {
    "office", "commercial", "hospital", "university", "college",
    "civic", "public", "government", "bank", "terminal", "tower", "skyscraper",
}
INDUSTRIAL_TAGS = {
    "industrial", "warehouse", "hangar", "factory", "manufacture",
    "depot", "train_station", "transportation", "supermarket", "mall",
    "stadium", "sports_hall", "greenhouse", "roof", "garages", "barn", "shed",
    "parking", "school",
}
HERITAGE_TAGS = {
    "temple", "shrine", "place_of_worship", "palace", "castle",
    "pagoda", "monastery", "mosque", "church", "cathedral", "chapel",
}


def geo_point(lat: float, lon: float) -> tuple[float, float]:
    return (
        (lon - ORIGIN_LON) * EAST_SCALE,
        (ORIGIN_LAT - lat) * NORTH_SCALE,
    )


def in_boxes(lat: float, lon: float, boxes: list[tuple[float, float, float, float]]) -> bool:
    for s, w, n, e in boxes:
        if s <= lat <= n and w <= lon <= e:
            return True
    return False


def union_box(boxes: list[tuple[float, float, float, float]]) -> tuple[float, float, float, float]:
    return (
        min(b[0] for b in boxes),
        min(b[1] for b in boxes),
        max(b[2] for b in boxes),
        max(b[3] for b in boxes),
    )


def parse_height(tags) -> tuple[float | None, bool]:
    raw_h = tags.get("height") or tags.get("building:height")
    if raw_h:
        s = raw_h.split(";")[0].strip().lower()
        mult = 0.3048 if ("ft" in s or "'" in s) else 1.0
        num = ""
        for ch in s:
            if ch in "0123456789.-":
                num += ch
            elif num:
                break
        if num and num not in ("-", "."):
            try:
                val = float(num) * mult
                if 2.5 <= val <= 650.0:
                    return val, True
            except ValueError:
                pass
    return None, False


def parse_levels(tags) -> float | None:
    raw = tags.get("building:levels")
    if not raw:
        return None
    s = raw.split(";")[0].strip()
    try:
        v = float(s)
        if 0.5 <= v <= 160:
            return v
    except ValueError:
        pass
    return None


def parse_color_tone(tags, key_seed: int) -> float:
    base = (key_seed * 2654435761 & 0xFFFF) / 65536.0
    col = (tags.get("roof:colour") or tags.get("building:colour") or "").strip().lower()
    if not col:
        return round(base, 3)
    # Bias tone bucket [0..1] when OSM has explicit color tags
    if any(k in col for k in ("red", "maroon", "crimson", "brown", "terracotta", "brick", "orange", "coral")):
        return round(0.05 + (base * 0.17), 3)
    if any(k in col for k in ("blue", "navy", "azure", "cyan", "slate")):
        return round(0.25 + (base * 0.17), 3)
    if any(k in col for k in ("green", "olive", "teal", "emerald")):
        return round(0.45 + (base * 0.14), 3)
    if any(k in col for k in ("gold", "yellow", "ochre", "amber", "beige", "tan", "sand", "cream")):
        return round(0.62 + (base * 0.16), 3)
    if col.startswith("#") and len(col) == 7:
        try:
            r = int(col[1:3], 16)
            g = int(col[3:5], 16)
            b = int(col[5:7], 16)
            if r > g + 25 and r > b + 20:
                return round(0.05 + (base * 0.17), 3)
            if b > r + 18 and b >= g:
                return round(0.25 + (base * 0.17), 3)
            if g > r + 15 and g > b + 12:
                return round(0.45 + (base * 0.14), 3)
            if r > 175 and g > 155 and b < 145:
                return round(0.62 + (base * 0.16), 3)
            lum = (r + g + b) / (3 * 255.0)
            return round(0.79 + min(0.20, lum * 0.20), 3)
        except ValueError:
            pass
    if any(k in col for k in ("white", "silver", "light")):
        return round(0.84 + (base * 0.15), 3)
    return round(base, 3)


def poly_area(pts: list[tuple[float, float]]) -> float:
    n = len(pts)
    if n < 3:
        return 0.0
    s = 0.0
    x0, z0 = pts[-1]
    for x1, z1 in pts:
        s += x0 * z1 - x1 * z0
        x0, z0 = x1, z1
    return abs(s) * 0.5


def point_line_dist_sq(p, a, b) -> float:
    ax, az = a
    bx, bz = b
    px, pz = p
    vx, vz = bx - ax, bz - az
    l2 = vx * vx + vz * vz
    if l2 <= 1e-6:
        dx, dz = px - ax, pz - az
        return dx * dx + dz * dz
    t = max(0.0, min(1.0, ((px - ax) * vx + (pz - az) * vz) / l2))
    qx, qz = ax + vx * t, az + vz * t
    return (px - qx) ** 2 + (pz - qz) ** 2


def rdp_ring(pts: list[tuple[float, float]], eps: float, max_verts: int) -> list[tuple[float, float]]:
    if len(pts) <= 4:
        return pts

    # Deduplicate consecutive short segments first
    cleaned = [pts[0]]
    for pt in pts[1:]:
        if math.hypot(pt[0] - cleaned[-1][0], pt[1] - cleaned[-1][1]) >= 0.65:
            cleaned.append(pt)
    if len(cleaned) >= 2 and math.hypot(cleaned[0][0] - cleaned[-1][0], cleaned[0][1] - cleaned[-1][1]) < 0.65:
        cleaned.pop()
    if len(cleaned) <= 4:
        return cleaned

    def simplify_open(seq, e2):
        keep = [False] * len(seq)
        keep[0] = True
        keep[-1] = True
        stack = [(0, len(seq) - 1)]
        while stack:
            i0, i1 = stack.pop()
            if i1 - i0 <= 1:
                continue
            a, b = seq[i0], seq[i1]
            best_d2 = -1.0
            best_i = -1
            for k in range(i0 + 1, i1):
                d2 = point_line_dist_sq(seq[k], a, b)
                if d2 > best_d2:
                    best_d2 = d2
                    best_i = k
            if best_d2 > e2 and best_i >= 0:
                keep[best_i] = True
                stack.append((i0, best_i))
                stack.append((best_i, i1))
        return [seq[i] for i in range(len(seq)) if keep[i]]

    tol = eps
    res = cleaned
    for _ in range(4):
        seq = res + [res[0]]
        cand = simplify_open(seq, tol * tol)
        if len(cand) >= 4:
            cand = cand[:-1]
        res = cand if len(cand) >= 3 else res
        if len(res) <= max_verts:
            break
        tol *= 1.45
    return res[:max_verts] if len(res) > max_verts else res


def dist_to_segments_sq(x: float, z: float, segs: list[tuple[float, float, float, float]]) -> float:
    best = 1e18
    for ax, az, bx, bz in segs:
        vx, vz = bx - ax, bz - az
        l2 = vx * vx + vz * vz
        if l2 <= 1e-3:
            d2 = (x - ax) ** 2 + (z - az) ** 2
        else:
            t = max(0.0, min(1.0, ((x - ax) * vx + (z - az) * vz) / l2))
            qx, qz = ax + vx * t, az + vz * t
            d2 = (x - qx) ** 2 + (z - qz) ** 2
        if d2 < best:
            best = d2
    return best


class CombinedRegionScanner(osmium.SimpleHandler):
    """Single-pass handler extracting runways, roads, landuse, AND building/multipolygon footprints."""

    def __init__(self, reg):
        super().__init__()
        self.reg = reg
        self.boxes = reg["boxes"]
        self.cbd_pts = [(geo_point(lat, lon), rkm * 1000.0) for lat, lon, rkm in reg["cbd"]]
        self.road_tiles = defaultdict(list)
        self.runways: list[tuple[float, float, float, float]] = []
        self.settlement_cells: dict[tuple[int, int], int] = {}
        self.landuse_zones = 0
        self.tiles = defaultdict(list)
        self.tagged_h = 0
        self.est_h = 0
        self.raw_count = 0
        self.rel_count = 0

    def _mark_cell(self, x: float, z: float, weight: int):
        key = (math.floor(x / CELL_SIZE), math.floor(z / CELL_SIZE))
        prev = self.settlement_cells.get(key, 0)
        if weight > prev:
            self.settlement_cells[key] = weight

    def _cbd_factor(self, x: float, z: float) -> float:
        best = 0.0
        for (cx, cz), rm in self.cbd_pts:
            d = math.hypot(x - cx, z - cz)
            if d < rm:
                best = max(best, 1.0 - d / rm)
        return best

    def way(self, w):
        tags = w.tags
        aero = tags.get("aeroway")
        hw = tags.get("highway")
        lu = tags.get("landuse")
        if not aero and not hw and not lu:
            return
        pts = []
        ok_in = False
        for nd in w.nodes:
            if not nd.location.valid():
                continue
            lat, lon = nd.location.lat, nd.location.lon
            if not ok_in and in_boxes(lat, lon, self.boxes):
                ok_in = True
            pts.append(geo_point(lat, lon))
        if not ok_in or len(pts) < 2:
            return

        if aero == "runway":
            for i in range(len(pts) - 1):
                self.runways.append((pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]))
            return

        if lu in ("residential", "commercial", "retail", "industrial") and len(pts) >= 3:
            xs = [p[0] for p in pts]
            zs = [p[1] for p in pts]
            minx, maxx = min(xs), max(xs)
            minz, maxz = min(zs), max(zs)
            if (maxx - minx) < 12000 and (maxz - minz) < 12000:
                self.landuse_zones += 1
                wgt = 2 if lu in ("commercial", "retail") else 1
                cx0, cx1 = math.floor(minx / CELL_SIZE), math.floor(maxx / CELL_SIZE)
                cz0, cz1 = math.floor(minz / CELL_SIZE), math.floor(maxz / CELL_SIZE)
                if (cx1 - cx0 + 1) * (cz1 - cz0 + 1) <= 1200:
                    for gx in range(cx0, cx1 + 1):
                        for gz in range(cz0, cz1 + 1):
                            self.settlement_cells[(gx, gz)] = max(self.settlement_cells.get((gx, gz), 0), wgt)

        if hw in ROAD_WIDTHS:
            width = ROAD_WIDTHS[hw]
            step = 1 if hw in ("motorway", "trunk", "primary") else 2
            simp = [pts[0]]
            for p in pts[1:-1]:
                if math.hypot(p[0] - simp[-1][0], p[1] - simp[-1][1]) >= (16.0 * step):
                    simp.append(p)
            simp.append(pts[-1])
            by_tile = defaultdict(list)
            for i in range(len(simp) - 1):
                ax, az = simp[i]
                bx, bz = simp[i + 1]
                mx, mz = (ax + bx) * 0.5, (az + bz) * 0.5
                tx, tz = math.floor(mx / TILE_SIZE), math.floor(mz / TILE_SIZE)
                by_tile[(tx, tz)].append((ax, az, bx, bz))
            for (tx, tz), segs in by_tile.items():
                cx = (tx + 0.5) * TILE_SIZE
                cz = (tz + 0.5) * TILE_SIZE
                chain = [segs[0][0] - cx, segs[0][1] - cz, segs[0][2] - cx, segs[0][3] - cz]
                for ax, az, bx, bz in segs[1:]:
                    if abs(ax - cx - chain[-2]) < 0.2 and abs(az - cz - chain[-1]) < 0.2:
                        chain.extend([bx - cx, bz - cz])
                    else:
                        self.road_tiles[(tx, tz)].append([width, [round(v, 1) for v in chain]])
                        chain = [ax - cx, az - cz, bx - cx, bz - cz]
                self.road_tiles[(tx, tz)].append([width, [round(v, 1) for v in chain]])

        if hw in ("residential", "unclassified", "tertiary", "living_street", "secondary"):
            for i in range(len(pts) - 1):
                ax, az = pts[i]
                bx, bz = pts[i + 1]
                self._mark_cell((ax + bx) * 0.5, (az + bz) * 0.5, 1)

    def area(self, a):
        tags = a.tags
        btag = tags.get("building")
        if not btag or btag in ("no", "ruins", "collapsed"):
            return
        if tags.get("aeroway") in ("runway", "taxiway", "apron"):
            return

        rings = []
        try:
            for ring in a.outer_rings():
                pts = []
                inside = False
                for nr in ring:
                    if not nr.location.valid():
                        continue
                    lat, lon = nr.location.lat, nr.location.lon
                    if not inside and in_boxes(lat, lon, self.boxes):
                        inside = True
                    pts.append(geo_point(lat, lon))
                if inside and len(pts) >= 4:
                    if math.hypot(pts[0][0] - pts[-1][0], pts[0][1] - pts[-1][1]) < 0.05:
                        pts.pop()
                    if len(pts) >= 3:
                        rings.append(pts)
        except osmium.InvalidLocationError:
            return

        if not rings:
            return

        btag_l = btag.lower()
        roof_shape = (tags.get("roof:shape") or "").strip().lower()
        explicit_h, has_h = parse_height(tags)
        levels = parse_levels(tags)

        for pts in rings:
            area_m2 = poly_area(pts)
            if area_m2 < MIN_AREA_M2:
                continue

            xs = [p[0] for p in pts]
            zs = [p[1] for p in pts]
            cx = sum(xs) / len(xs)
            cz = sum(zs) / len(zs)

            if (max(xs) - min(xs)) > 480 or (max(zs) - min(zs)) > 480:
                continue

            cbd = self._cbd_factor(cx, cz)
            seed = (a.orig_id() if hasattr(a, "orig_id") else int(abs(cx * 31 + cz * 17)))
            tone = parse_color_tone(tags, seed)

            if has_h and explicit_h is not None:
                h = explicit_h
                self.tagged_h += 1
            elif levels is not None:
                fh = self.reg["floor_h"]
                if btag_l in COMMERCIAL_TAGS or cbd > 0.45:
                    fh += 0.35
                h = max(3.5, levels * fh + (1.6 if roof_shape in PITCHED_ROOF_SHAPES else 0.4))
                self.tagged_h += 1
            else:
                self.est_h += 1
                rng = ((seed * 1103515245 + 12345) & 0xFFFF) / 65536.0
                if btag_l in HOUSE_TAGS:
                    h = 5.4 + (rng * 3.6) + (2.0 if area_m2 > 140 else 0.0)
                elif btag_l in HERITAGE_TAGS:
                    h = 11.0 + rng * 10.0
                elif btag_l in INDUSTRIAL_TAGS:
                    h = 8.0 + min(12.0, math.sqrt(area_m2) * 0.16) + rng * 3.5
                elif btag_l == "apartments":
                    base_fl = 4 + rng * 7 + cbd * (14 if self.reg["code"] in ("HK_HKG", "KR_ICN", "SG_SIN") else 8)
                    h = base_fl * self.reg["floor_h"]
                elif btag_l in COMMERCIAL_TAGS:
                    h = (5 + rng * 8 + cbd * 28) * 3.6
                else:
                    if area_m2 < 185 and cbd < 0.25:
                        h = 5.6 + rng * 4.4
                    elif area_m2 < 300 and cbd < 0.5:
                        h = 7.5 + rng * 7.5 + cbd * 12.0
                    else:
                        mult = 26.0 if self.reg["code"] in ("HK_HKG", "KR_ICN", "JP_TYO") else 18.0
                        h = 9.0 + rng * 9.0 + cbd * mult + min(18.0, math.sqrt(area_m2) * 0.25)

            h = round(max(3.2, min(580.0, h)), 1)

            if (
                btag_l in HERITAGE_TAGS
                or (tags.get("amenity") == "place_of_worship" and h < 65)
                or tags.get("historic") in ("temple", "palace", "castle", "shrine")
            ):
                kind = 4
            elif h >= 68.0 or btag_l in ("skyscraper", "tower"):
                kind = 5
            elif btag_l in INDUSTRIAL_TAGS or tags.get("aeroway") == "hangar":
                kind = 2
            elif btag_l in COMMERCIAL_TAGS or tags.get("aeroway") == "terminal":
                kind = 1
            elif roof_shape == "flat":
                kind = 1 if h >= 36.0 else 0
            elif roof_shape in PITCHED_ROOF_SHAPES and h <= 22.0 and area_m2 <= 900.0:
                kind = 3
            elif btag_l in HOUSE_TAGS and h <= 16.0:
                kind = 3
            elif h <= 12.2 and area_m2 <= 240.0 and btag_l in ("yes", "residential"):
                kind = 3 if (((seed % 100) / 100.0) < self.reg["house_rate"]) else 0
            elif h >= 34.0 and cbd > 0.35 and btag_l != "apartments":
                kind = 1
            else:
                kind = 0

            tx = math.floor(cx / TILE_SIZE)
            tz = math.floor(cz / TILE_SIZE)
            tcx = (tx + 0.5) * TILE_SIZE
            tcz = (tz + 0.5) * TILE_SIZE

            simp = rdp_ring(pts, RDP_EPSILON_M, MAX_POLY_VERTS)
            if len(simp) < 3:
                continue
            coords = []
            for px, pz in simp:
                coords.append(round(px - tcx, 1))
                coords.append(round(pz - tcz, 1))

            priority = (
                (2000.0 if kind in (4, 5) else 800.0 if kind in (1, 2) else 0.0)
                + h * 8.0
                + min(400.0, area_m2 * 0.4)
            )
            entry = [
                round(cx - tcx, 1),
                round(cz - tcz, 1),
                h,
                tone,
                kind,
                coords,
            ]
            self.tiles[(tx, tz)].append((priority, area_m2, cx, cz, entry))
            self.raw_count += 1
            if not a.from_way():
                self.rel_count += 1


def thin_tile_buildings(items: list[tuple], max_keep: int) -> list[list]:
    if len(items) <= max_keep:
        return [it[4] for it in items]
    items.sort(key=lambda it: -it[0])
    kept = []
    seen_cells: dict[tuple[int, int], int] = {}
    for priority, area_m2, cx, cz, entry in items:
        h = entry[2]
        kind = entry[4]
        if h >= 15.5 or kind in (1, 2, 4, 5) or area_m2 >= 240.0 or len(kept) < max_keep * 0.35:
            kept.append(entry)
            cell = (math.floor(cx / 22.0), math.floor(cz / 22.0))
            seen_cells[cell] = seen_cells.get(cell, 0) + 1
        else:
            cell = (math.floor(cx / 22.0), math.floor(cz / 22.0))
            cnt = seen_cells.get(cell, 0)
            if cnt < 1 or (len(kept) < max_keep * 0.75 and cnt < 2):
                seen_cells[cell] = cnt + 1
                kept.append(entry)
        if len(kept) >= max_keep:
            break
    return kept


def process_region(reg: dict, cache_dir: pathlib.Path) -> dict:
    pbf = cache_dir / reg["pbf"]
    if not pbf.exists():
        raise FileNotFoundError(f"Missing PBF for {reg['code']}: {pbf}")

    t0 = time.time()
    print(f"[{reg['code']}] Single-pass extraction from {pbf.name}...", flush=True)
    scanner = CombinedRegionScanner(reg)
    scanner.apply_file(str(pbf), locations=True, idx="flex_mem")
    print(
        f"[{reg['code']}] Scan done in {time.time() - t0:.1f}s: "
        f"raw={scanner.raw_count} (rels={scanner.rel_count}), tiles={len(scanner.tiles)}, "
        f"runways={len(scanner.runways)}, roadTiles={len(scanner.road_tiles)}",
        flush=True,
    )

    tile_records = []
    kept_total = 0
    tile_counts = {}
    runways = scanner.runways
    for (tx, tz), raw_list in sorted(scanner.tiles.items()):
        key = f"{tx}_{tz}"
        tcx = round((tx + 0.5) * TILE_SIZE, 1)
        tcz = round((tz + 0.5) * TILE_SIZE, 1)
        filtered = (
            [it for it in raw_list if dist_to_segments_sq(it[2], it[3], runways) >= 52.0 * 52.0]
            if runways else raw_list
        )
        kept = thin_tile_buildings(filtered, MAX_TILE_BUILDINGS)
        if not kept:
            continue
        tile_counts[key] = len(kept)
        kept_total += len(kept)
        out_path = WORLD_CITY_DIR / f"{key}.json"
        out_path.write_text(
            json.dumps({"r": reg["id"], "x": tcx, "z": tcz, "b": kept}, separators=(",", ":")),
            encoding="utf-8",
        )
        tile_records.append([key, tcx, tcz, len(kept), reg["id"]])

    roads_dir = WORLD_CITY_DIR / "roads"
    roads_dir.mkdir(parents=True, exist_ok=True)
    road_records = []
    road_segs = 0
    for (tx, tz), roads in sorted(scanner.road_tiles.items()):
        if not roads:
            continue
        key = f"{tx}_{tz}"
        tcx = round((tx + 0.5) * TILE_SIZE, 1)
        tcz = round((tz + 0.5) * TILE_SIZE, 1)
        (roads_dir / f"{key}.json").write_text(
            json.dumps({"r": reg["id"], "x": tcx, "z": tcz, "s": roads}, separators=(",", ":")),
            encoding="utf-8",
        )
        road_records.append([key, tcx, tcz, len(roads), reg["id"]])
        road_segs += len(roads)

    settlement_cells = []
    infill_total = 0
    for (gx, gz), wgt in sorted(scanner.settlement_cells.items()):
        cx = (gx + 0.5) * CELL_SIZE
        cz = (gz + 0.5) * CELL_SIZE
        tkey = f"{math.floor(cx / TILE_SIZE)}_{math.floor(cz / TILE_SIZE)}"
        if tile_counts.get(tkey, 0) >= 650:
            continue
        if runways and dist_to_segments_sq(cx, cz, runways) < 95.0 * 95.0:
            continue
        settlement_cells.append([gx, gz, wgt, reg["id"]])
        infill_total += 8 + wgt * 4

    return {
        "reg": reg,
        "tiles": tile_records,
        "roads": road_records,
        "settlements": settlement_cells,
        "counts": {
            "buildingsKept": kept_total,
            "buildingsRaw": scanner.raw_count,
            "multipolygonRels": scanner.rel_count,
            "taggedHeight": scanner.tagged_h,
            "estimatedHeight": scanner.est_h,
            "roadRibbons": road_segs,
            "settlementCells": len(settlement_cells),
            "infillBuildings": infill_total,
        },
    }


def write_merged_indexes(region_results: dict[str, dict]):
    WORLD_CITY_DIR.mkdir(parents=True, exist_ok=True)
    roads_dir = WORLD_CITY_DIR / "roads"
    roads_dir.mkdir(parents=True, exist_ok=True)

    # Preserve existing regions if running subset via --region
    idx_path = WORLD_CITY_DIR / "index.json"
    road_idx_path = roads_dir / "index.json"
    settle_path = WORLD_CITY_DIR / "settlements.json"

    existing_tiles = {}
    existing_regions = {}
    if idx_path.exists():
        old = json.loads(idx_path.read_text(encoding="utf-8"))
        for rec in old.get("tiles", []):
            existing_tiles[rec[0]] = rec
        existing_regions = old.get("regions", {})

    existing_roads = {}
    if road_idx_path.exists():
        old_r = json.loads(road_idx_path.read_text(encoding="utf-8"))
        for rec in old_r.get("tiles", []):
            existing_roads[rec[0]] = rec

    existing_settlements = {}
    if settle_path.exists():
        old_s = json.loads(settle_path.read_text(encoding="utf-8"))
        for rec in old_s.get("cells", []):
            if len(rec) >= 4:
                existing_settlements[(rec[0], rec[1])] = rec

    for code, res in region_results.items():
        rid = res["reg"]["id"]
        existing_tiles = {k: v for k, v in existing_tiles.items() if len(v) < 5 or v[4] != rid}
        for rec in res["tiles"]:
            existing_tiles[rec[0]] = rec
        existing_roads = {k: v for k, v in existing_roads.items() if len(v) < 5 or v[4] != rid}
        for rec in res["roads"]:
            existing_roads[rec[0]] = rec
        existing_settlements = {k: v for k, v in existing_settlements.items() if v[3] != rid}
        for rec in res["settlements"]:
            existing_settlements[(rec[0], rec[1])] = rec
        existing_regions[code] = {
            "id": rid,
            "name": res["reg"]["name"],
            "boxes": res["reg"]["boxes"],
            "counts": res["counts"],
        }

    all_tiles = sorted(existing_tiles.values(), key=lambda r: r[0])
    all_roads = sorted(existing_roads.values(), key=lambda r: r[0])
    all_cells = sorted(existing_settlements.values(), key=lambda r: (r[3], r[0], r[1]))

    totals = {
        "buildings": sum(r["counts"]["buildingsKept"] for r in existing_regions.values()),
        "buildingsRaw": sum(r["counts"].get("buildingsRaw", 0) for r in existing_regions.values()),
        "taggedHeight": sum(r["counts"]["taggedHeight"] for r in existing_regions.values()),
        "roadRibbons": sum(r["counts"]["roadRibbons"] for r in existing_regions.values()),
        "settlementCells": len(all_cells),
        "tiles": len(all_tiles),
        "roadTiles": len(all_roads),
    }

    idx_path.write_text(
        json.dumps(
            {
                "tileSize": TILE_SIZE,
                "cellSize": CELL_SIZE,
                "source": "OpenStreetMap / Geofabrik & BBBike Regional PBFs",
                "license": "ODbL-1.0",
                "attribution": "© OpenStreetMap contributors",
                "regions": existing_regions,
                "counts": totals,
                "tiles": all_tiles,
            },
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )

    road_idx_path.write_text(
        json.dumps(
            {
                "tileSize": TILE_SIZE,
                "counts": {"tiles": len(all_roads), "ribbons": totals["roadRibbons"]},
                "tiles": all_roads,
            },
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )

    settle_path.write_text(
        json.dumps(
            {
                "cellSize": CELL_SIZE,
                "counts": {"cells": len(all_cells)},
                "cells": all_cells,
            },
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    print(f"Wrote dist/world-city indexes: {totals}", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cache", type=pathlib.Path, default=DEFAULT_CACHE)
    parser.add_argument("--region", nargs="*", help="Subset of region codes (e.g. HK_HKG JP_TYO)")
    args = parser.parse_args()

    WORLD_CITY_DIR.mkdir(parents=True, exist_ok=True)
    selected = REGIONS
    if args.region:
        wanted = set(args.region)
        selected = [r for r in REGIONS if r["code"] in wanted]
        if not selected:
            raise SystemExit(f"No matching region codes in {args.region}")

    results = {}
    for reg in selected:
        results[reg["code"]] = process_region(reg, args.cache)
    write_merged_indexes(results)


if __name__ == "__main__":
    main()
