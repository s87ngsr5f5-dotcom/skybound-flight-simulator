"""Build offline all-Taiwan detailed city polygon tiles from an ODbL Taiwan OSM PBF (pyosmium).

Usage:
  python tools/build-taiwan-cities.py <taiwan.osm.pbf> <dist/taiwan-city>

Generates Taipei-grade streamed polygon building tiles across all of Taiwan, Penghu,
and Kinmen outside the existing Taipei detail box [24.97, 121.43, 25.14, 121.65].
Preserves real OpenStreetMap building footprints, height/level tags, and building types
(glass commercial/office vs residential apartments vs industrial/tech cleanrooms).
"""
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

import osmium

# Match region.js coordinate origin & scale exactly
LAT = 25 + (4 + 10.535 / 60) / 60
LON = 121 + (33 + 9.085 / 60) / 60
EAST = 111319.49 * math.cos(math.radians(LAT))

# Existing detailed Taipei box handled by taipei-city.js
TAIPEI_BOUNDS = (24.97, 121.43, 25.14, 121.65)
SIZE = 4800

# Major urban cores outside Taipei for calibrated fallback heights when OSM lacks height/levels
URBAN_CORES = [
    (25.131, 121.744, 0.045, 1.35),  # Keelung Harbor / CBD
    (24.993, 121.301, 0.085, 1.45),  # Taoyuan / Yiwen District
    (24.953, 121.225, 0.065, 1.38),  # Zhongli
    (24.806, 120.971, 0.055, 1.35),  # Hsinchu CBD
    (24.819, 121.028, 0.045, 1.40),  # Zhubei High-Speed Rail / CBD
    (24.775, 121.011, 0.040, 1.25),  # Hsinchu Science Park
    (24.162, 120.643, 0.075, 1.55),  # Taichung 7th District / Xitun
    (24.142, 120.680, 0.070, 1.35),  # Taichung Central / North / West
    (24.076, 120.543, 0.045, 1.20),  # Changhua City
    (23.479, 120.449, 0.050, 1.22),  # Chiayi City
    (22.997, 120.205, 0.070, 1.38),  # Tainan Central / East / Anping
    (22.620, 120.305, 0.095, 1.50),  # Kaohsiung CBD / Asia New Bay / Zuoying
    (22.671, 120.488, 0.045, 1.15),  # Pingtung City
    (24.754, 121.754, 0.045, 1.15),  # Yilan / Luodong
    (23.977, 121.606, 0.050, 1.18),  # Hualien City
    (22.755, 121.148, 0.045, 1.15),  # Taitung City
    (23.571, 119.579, 0.040, 1.10),  # Penghu Magong
    (24.436, 118.322, 0.045, 1.05),  # Kinmen Jincheng
]


def point(lat, lon):
    return ((lon - LON) * EAST, (LAT - lat) * 110772.0)


def parse_num(raw):
    if not raw:
        return 0.0
    try:
        s = raw.lower().replace("meters", "").replace("meter", "").replace("m", "").split(";")[0].strip()
        return float(s)
    except (ValueError, AttributeError):
        return 0.0


def simplify_ring(coords, min_edge=2.0, tol=1.1, max_pts=14):
    """Simplify closed building footprint polygon to compact metric offsets."""
    if len(coords) < 3:
        return coords
    pts = [coords[0]]
    for x, z in coords[1:]:
        if math.hypot(x - pts[-1][0], z - pts[-1][1]) >= min_edge:
            pts.append((x, z))
    if len(pts) < 3:
        return coords[:3]
    # Collinear / low-deviance vertex pruning while keeping rectangle/L-shape corners crisp
    pruned = []
    n = len(pts)
    for i in range(n):
        a = pts[i - 1]
        b = pts[i]
        c = pts[(i + 1) % n]
        abx, abz = b[0] - a[0], b[1] - a[1]
        acx, acz = c[0] - a[0], c[1] - a[1]
        alen = math.hypot(acx, acz)
        if alen > 0.1:
            cross = abs(abx * acz - abz * acx) / alen
            if cross < tol and len(pts) - len(pruned) > 3:
                continue
        pruned.append(b)
    if len(pruned) < 3:
        pruned = pts
    if len(pruned) > max_pts:
        step = len(pruned) / max_pts
        pruned = [pruned[int(i * step)] for i in range(max_pts)]
    return pruned


def urban_boost(lat, lon):
    for ulat, ulon, rad, mul in URBAN_CORES:
        d = math.hypot(lat - ulat, lon - ulon)
        if d < rad:
            t = 1.0 - d / rad
            return 1.0 + (mul - 1.0) * t
    return 1.0


class TaiwanExtractor(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.tiles = defaultdict(list)
        self.counts = defaultdict(int)

    def way(self, way):
        tags = dict(way.tags)
        btag = tags.get("building")
        if btag in (None, "no") or not way.is_closed() or len(way.nodes) < 4:
            return
        pts = [(n.location.lat, n.location.lon) for n in way.nodes if n.location.valid()]
        if len(pts) < 4:
            return
        pts.pop()
        lat = sum(y for y, _ in pts) / len(pts)
        lon = sum(x for _, x in pts) / len(pts)
        # Skip existing Taipei detail bounds so taipei-city tiles remain exclusive inside Taipei
        if TAIPEI_BOUNDS[0] <= lat <= TAIPEI_BOUNDS[2] and TAIPEI_BOUNDS[1] <= lon <= TAIPEI_BOUNDS[3]:
            return
        # Restrict to Taiwan + Penghu + Kinmen + Matsu
        if not (21.8 <= lat <= 26.4 and 118.1 <= lon <= 122.2):
            return

        mcoords = [point(y, x) for y, x in pts]
        area = abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(mcoords, mcoords[1:] + mcoords[:1]))) * 0.5
        if area < 28:
            return

        cx = sum(p[0] for p in mcoords) / len(mcoords)
        cz = sum(p[1] for p in mcoords) / len(mcoords)
        simp = simplify_ring(mcoords)
        if len(simp) < 3:
            return

        measured = parse_num(tags.get("height"))
        levels = parse_num(tags.get("building:levels"))
        tall_type = btag in {"tower", "skyscraper", "commercial", "office", "hotel", "cathedral"}
        if levels > 0 and measured > levels * 6.5 + 28 and not tall_type:
            # Guard against occasional OSM residential height typos (e.g. feet mislabeled as m)
            measured = 0.0

        height = measured if measured >= 2.5 else (levels * 3.35 if levels >= 1 else 0.0)
        if height >= 2.5:
            self.counts["taggedHeight"] += 1
        else:
            boost = urban_boost(lat, lon)
            if btag in {"garage", "shed", "roof", "carport", "greenhouse", "hut"}:
                height = 4.0
            elif btag in {"commercial", "office", "hotel", "retail"}:
                base_h = 16.0 if area < 700 else 28.0 if area < 2000 else 38.0
                height = (base_h + (way.id % 6) * 4.2) * boost
            elif btag in {"apartments", "dormitory"}:
                base_h = 16.0 if area < 500 else 24.0
                height = (base_h + (way.id % 7) * 3.4) * boost
            elif btag in {"industrial", "warehouse", "manufacture", "hangar"}:
                height = 10.0 + (way.id % 4) * 2.5
            elif btag in {"hospital", "university", "school", "college", "public", "civic", "stadium", "train_station"}:
                height = (14.0 + (way.id % 5) * 3.2) * max(1.0, boost * 0.92)
            else:
                # Generic building=yes in urban vs rural zones
                if area > 1400 and boost > 1.12:
                    height = (18.0 + (way.id % 7) * 3.6) * boost
                elif area > 450 and boost > 1.08:
                    height = (13.5 + (way.id % 6) * 2.8) * boost
                else:
                    height = (7.2 + (way.id % 5) * 2.6) * (0.95 if boost < 1.05 else boost)
            self.counts["estimatedHeight"] += 1

        height = round(min(390.0, max(3.5, height)), 1)
        if btag in {"commercial", "office", "retail", "hotel", "mall", "public", "civic"} or height >= 36.0:
            kind = 1
        elif btag in {"industrial", "warehouse", "manufacture", "hangar"}:
            kind = 2
        else:
            kind = 0

        rel = []
        for vx, vz in simp:
            dx = int(round(vx - cx))
            dz = int(round(vz - cz))
            if rel and dx == rel[-2] and dz == rel[-1]:
                continue
            rel.extend((dx, dz))
        if len(rel) >= 6 and rel[0] == rel[-2] and rel[1] == rel[-1]:
            rel = rel[:-2]
        if len(rel) < 6:
            return

        tx = math.floor(cx / SIZE)
        tz = math.floor(cz / SIZE)
        tile_key = f"{tx}_{tz}"
        self.tiles[tile_key].append([
            round(cx, 1), round(cz, 1), height, way.id % 8, kind, rel
        ])
        self.counts["buildings"] += 1


def main():
    pbf_path = Path(sys.argv[1])
    out_dir = Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)
    # Remove stale json tiles
    for old in out_dir.glob("*.json"):
        old.unlink()

    ext = TaiwanExtractor()
    ext.apply_file(str(pbf_path), locations=True, idx="flex_mem")

    manifest_tiles = []
    for key, buildings in sorted(ext.tiles.items()):
        if not buildings:
            continue
        cx, tz = map(int, key.split("_"))
        (out_dir / f"{key}.json").write_text(
            json.dumps({"b": buildings}, separators=(",", ":")), encoding="utf8"
        )
        manifest_tiles.append([key, (cx + 0.5) * SIZE, (tz + 0.5) * SIZE, len(buildings)])

    manifest = {
        "bounds": [21.8, 118.1, 26.4, 122.2],
        "exclude": list(TAIPEI_BOUNDS),
        "tileSize": SIZE,
        "source": "OpenStreetMap / Geofabrik Taiwan PBF, acquired 2026-11-08",
        "license": "ODbL-1.0",
        "attribution": "© OpenStreetMap contributors",
        "counts": dict(ext.counts),
        "tiles": manifest_tiles,
    }
    (out_dir / "index.json").write_text(json.dumps(manifest, separators=(",", ":")), encoding="utf8")
    total_mb = sum(f.stat().st_size for f in out_dir.glob("*.json")) / (1024 * 1024)
    print(json.dumps({
        "tiles": len(manifest_tiles),
        "totalMB": round(total_mb, 2),
        **ext.counts
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
