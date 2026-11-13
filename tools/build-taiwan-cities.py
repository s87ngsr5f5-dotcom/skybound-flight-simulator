"""Build offline all-Taiwan detailed city polygon tiles & multi-million settlement grid from an ODbL Taiwan OSM PBF (pyosmium).

Usage:
  python tools/build-taiwan-cities.py <taiwan.osm.pbf> <dist/taiwan-city>
"""
import json
import math
import re
import sys
from collections import defaultdict
from pathlib import Path

import osmium

# Match region.js coordinate origin & scale exactly
ORIGIN_LAT = 25.0 + (4.0 + 10.535 / 60.0) / 60.0
ORIGIN_LON = 121.0 + (33.0 + 9.085 / 60.0) / 60.0
EAST_SCALE = 111319.49 * math.cos(math.radians(ORIGIN_LAT))
NORTH_SCALE = 110772.0

TAIPEI_BOUNDS = (24.97, 121.43, 25.14, 121.65)
TAIWAN_BOUNDS = (21.8, 118.1, 26.4, 122.2)
TILE_SIZE = 4800.0
CELL_SIZE = 120.0

URBAN_CENTERS = [
    (22.627, 120.301, 6.0, 1.38),   # Kaohsiung core
    (22.668, 120.303, 5.0, 1.25),   # Zuoying / Gushan
    (24.147, 120.673, 7.5, 1.35),   # Taichung core
    (24.163, 120.640, 4.5, 1.42),   # Taichung 7th Redevelopment
    (24.993, 121.301, 5.5, 1.26),   # Taoyuan downtown
    (24.953, 121.225, 4.5, 1.22),   # Zhongli
    (24.806, 120.968, 5.0, 1.25),   # Hsinchu / Zhubei
    (22.999, 120.226, 6.0, 1.22),   # Tainan
    (25.131, 121.744, 3.0, 1.22),   # Keelung
    (23.480, 120.449, 3.5, 1.15),   # Chiayi
    (24.075, 120.542, 3.5, 1.14),   # Changhua
    (22.676, 120.488, 3.5, 1.12),   # Pingtung
    (24.754, 121.754, 3.5, 1.12),   # Yilan
    (24.677, 121.767, 3.0, 1.14),   # Luodong
    (23.977, 121.604, 4.0, 1.14),   # Hualien
    (22.758, 121.144, 3.5, 1.10),   # Taitung
    (23.569, 119.579, 2.5, 1.10),   # Magong (Penghu)
    (24.436, 118.318, 2.5, 1.05),   # Jincheng (Kinmen)
]

RES_HIGHWAYS = {"residential", "living_street", "tertiary", "pedestrian", "unclassified"}
URBAN_LANDUSE = {
    "residential": (0, 2),
    "commercial": (1, 3),
    "retail": (1, 3),
    "industrial": (2, 2),
    "mixed": (1, 2),
    "education": (0, 1),
    "institutional": (1, 2),
}


def point(lat, lon):
    return (lon - ORIGIN_LON) * EAST_SCALE, (ORIGIN_LAT - lat) * NORTH_SCALE


def parse_num(raw):
    if not raw:
        return None
    m = re.search(r"[-+]?\d+(?:\.\d+)?", raw)
    if not m:
        return None
    val = float(m.group(0))
    return val if math.isfinite(val) else None


def simplify_ring(coords, min_edge=1.8, tol=0.95, max_pts=14):
    pts = list(coords)
    if len(pts) > 1 and math.hypot(pts[0][0] - pts[-1][0], pts[0][1] - pts[-1][1]) < 0.25:
        pts.pop()
    if len(pts) < 3:
        return []
    cleaned = [pts[0]]
    for p in pts[1:]:
        if math.hypot(p[0] - cleaned[-1][0], p[1] - cleaned[-1][1]) >= min_edge:
            cleaned.append(p)
    if len(cleaned) < 3:
        return []
    while len(cleaned) > 4:
        best_i = -1
        best_d = 1e9
        n = len(cleaned)
        for i in range(n):
            a, b, c = cleaned[(i - 1) % n], cleaned[i], cleaned[(i + 1) % n]
            abx, abz = c[0] - a[0], c[1] - a[1]
            denom = math.hypot(abx, abz)
            d = abs((b[0] - a[0]) * abz - (b[1] - a[1]) * abx) / denom if denom > 0.1 else 0.0
            if d < best_d:
                best_d = d
                best_i = i
        if best_i >= 0 and (best_d < tol or len(cleaned) > max_pts):
            cleaned.pop(best_i)
        else:
            break
    return cleaned


def urban_boost(lat, lon):
    best = 1.0
    for ulat, ulon, rkm, boost in URBAN_CENTERS:
        d = math.hypot((lat - ulat) * 111.0, (lon - ulon) * 101.0)
        if d < rkm:
            f = 1.0 - (d / rkm) ** 2
            best = max(best, 1.0 + (boost - 1.0) * f)
    return best


def point_in_poly(x, z, poly):
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, zi = poly[i]
        xj, zj = poly[j]
        if ((zi > z) != (zj > z)) and (x < (xj - xi) * (z - zi) / ((zj - zi) or 1e-9) + xi):
            inside = not inside
        j = i
    return inside


class TaiwanCityExtractor(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.tiles = defaultdict(list)
        # Compact cell map: (gx, gz) -> [osm_count, landuse_kind, landuse_density, street_hits, ang_cos, ang_sin]
        self.cells = {}
        self.total = 0
        self.tagged = 0
        self.estimated = 0
        self.landuse_count = 0
        self.street_count = 0

    def _cell(self, gx, gz):
        key = (gx, gz)
        c = self.cells.get(key)
        if c is None:
            c = [0, -1, 0, 0, 0.0, 0.0]
            self.cells[key] = c
        return c

    def way(self, way):
        if len(way.nodes) < 2:
            return
        tags = way.tags
        btag = tags.get("building")
        ltag = tags.get("landuse")
        htag = tags.get("highway")

        if not btag and not ltag and not htag:
            return

        if htag and htag in RES_HIGHWAYS and not btag:
            pts = []
            for nd in way.nodes:
                if not nd.location.valid():
                    continue
                lat, lon = nd.location.lat, nd.location.lon
                if not (TAIWAN_BOUNDS[0] <= lat <= TAIWAN_BOUNDS[2] and TAIWAN_BOUNDS[1] <= lon <= TAIWAN_BOUNDS[3]):
                    continue
                if TAIPEI_BOUNDS[0] <= lat <= TAIPEI_BOUNDS[2] and TAIPEI_BOUNDS[1] <= lon <= TAIPEI_BOUNDS[3]:
                    continue
                pts.append(point(lat, lon))
            if len(pts) < 2:
                return
            self.street_count += 1
            for idx in range(len(pts) - 1):
                ax, az = pts[idx]
                bx, bz = pts[idx + 1]
                dx, dz = bx - ax, bz - az
                seg_len = math.hypot(dx, dz)
                if seg_len < 1.0:
                    continue
                # Double angle vector keeps 180-degree axial symmetry when averaging bearings
                ang2 = math.atan2(dz, dx) * 2.0
                c2, s2 = math.cos(ang2), math.sin(ang2)
                steps = max(1, min(80, int(seg_len // 55) + 1))
                for k in range(steps + 1):
                    t = k / steps
                    px = ax + dx * t
                    pz = az + dz * t
                    gx = math.floor(px / CELL_SIZE)
                    gz = math.floor(pz / CELL_SIZE)
                    weight = 2 if htag in ("residential", "living_street", "tertiary", "pedestrian") else 1
                    cell = self._cell(gx, gz)
                    cell[3] += weight
                    cell[4] += c2
                    cell[5] += s2
                    if htag in ("residential", "tertiary") and (k % 2 == 0):
                        # Residential & township streets carry lots along both block sides
                        for ox, oz in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                            nc = self._cell(gx + ox, gz + oz)
                            nc[3] += 1
                            nc[4] += c2 * 0.4
                            nc[5] += s2 * 0.4
            return

        if ltag and ltag in URBAN_LANDUSE and not btag and len(way.nodes) >= 3:
            pts = []
            for nd in way.nodes:
                if not nd.location.valid():
                    return
                pts.append((nd.location.lat, nd.location.lon))
            avg_lat = sum(p[0] for p in pts) / len(pts)
            avg_lon = sum(p[1] for p in pts) / len(pts)
            if TAIPEI_BOUNDS[0] <= avg_lat <= TAIPEI_BOUNDS[2] and TAIPEI_BOUNDS[1] <= avg_lon <= TAIPEI_BOUNDS[3]:
                return
            if not (TAIWAN_BOUNDS[0] <= avg_lat <= TAIWAN_BOUNDS[2] and TAIWAN_BOUNDS[1] <= avg_lon <= TAIWAN_BOUNDS[3]):
                return
            poly = [point(p[0], p[1]) for p in pts[:: max(1, len(pts) // 24)]]
            if len(poly) < 3:
                return
            xs = [p[0] for p in poly]
            zs = [p[1] for p in poly]
            gx0 = math.floor(min(xs) / CELL_SIZE)
            gx1 = math.floor(max(xs) / CELL_SIZE)
            gz0 = math.floor(min(zs) / CELL_SIZE)
            gz1 = math.floor(max(zs) / CELL_SIZE)
            if (gx1 - gx0 + 1) * (gz1 - gz0 + 1) > 1800:
                return
            l_kind, l_dens = URBAN_LANDUSE[ltag]
            self.landuse_count += 1
            for gx in range(gx0, gx1 + 1):
                cx = (gx + 0.5) * CELL_SIZE
                for gz in range(gz0, gz1 + 1):
                    cz = (gz + 0.5) * CELL_SIZE
                    if point_in_poly(cx, cz, poly):
                        cell = self._cell(gx, gz)
                        if l_dens >= cell[2]:
                            cell[1] = l_kind
                            cell[2] = l_dens
            return

        if not btag or btag in ("no", "ruins", "collapsed") or len(way.nodes) < 3:
            return
        if "layer" in tags and (parse_num(tags.get("layer")) or 0) < -0.5:
            return
        if tags.get("location") == "underground":
            return

        raw = []
        lat_sum = lon_sum = 0.0
        for nd in way.nodes:
            if not nd.location.valid():
                return
            lat_sum += nd.location.lat
            lon_sum += nd.location.lon
            raw.append((nd.location.lat, nd.location.lon))

        lat = lat_sum / len(raw)
        lon = lon_sum / len(raw)
        if not (TAIWAN_BOUNDS[0] <= lat <= TAIWAN_BOUNDS[2] and TAIWAN_BOUNDS[1] <= lon <= TAIWAN_BOUNDS[3]):
            return
        if TAIPEI_BOUNDS[0] <= lat <= TAIPEI_BOUNDS[2] and TAIPEI_BOUNDS[1] <= lon <= TAIPEI_BOUNDS[3]:
            return

        mcoords = [point(p[0], p[1]) for p in raw]
        ring = simplify_ring(mcoords)
        if len(ring) < 3:
            return

        area = abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(ring, ring[1:] + ring[:1]))) * 0.5
        if area < 12.0 or area > 450000:
            return

        cx = sum(p[0] for p in ring) / len(ring)
        cz = sum(p[1] for p in ring) / len(ring)
        cell = self._cell(math.floor(cx / CELL_SIZE), math.floor(cz / CELL_SIZE))
        cell[0] += 1

        rel = []
        for px, pz in ring:
            rel.append(round(px - cx, 1))
            rel.append(round(pz - cz, 1))

        explicit_h = parse_num(tags.get("height"))
        levels = parse_num(tags.get("building:levels"))
        boost = urban_boost(lat, lon)
        b_lower = btag.lower()

        if explicit_h is not None and explicit_h >= 2.0:
            h = explicit_h
            self.tagged += 1
        elif levels is not None and levels >= 1.0:
            storey = 3.55 if b_lower in ("commercial", "office", "retail", "hotel", "industrial") else 3.25
            h = levels * storey + 1.2
            self.tagged += 1
        else:
            self.estimated += 1
            if b_lower in ("commercial", "office", "hotel"):
                base_h = 15.0 if area < 700 else 28.0 if area < 2000 else 38.0
            elif b_lower in ("apartments", "residential"):
                base_h = 15.0 if area < 500 else 24.0
            elif b_lower in ("industrial", "warehouse", "manufacture", "factory"):
                base_h = 11.5
            elif b_lower in ("house", "detached", "terrace", "semidetached_house"):
                base_h = 9.5 + ((way.id % 5) * 0.8)
            else:
                if area > 1400 and boost > 1.12:
                    base_h = 22.0 + (way.id % 14)
                elif area > 450 and boost > 1.08:
                    base_h = 15.5 + (way.id % 9)
                else:
                    base_h = 9.2 + (way.id % 7) * 1.15
            h = base_h * boost

        h = round(max(3.5, min(390.0, h)), 1)

        if b_lower in ("commercial", "office", "hotel", "retail", "public") or h >= 36.0:
            kind = 1
        elif b_lower in ("industrial", "warehouse", "manufacture", "factory"):
            kind = 2
        else:
            kind = 0

        tone = (abs(int(cx * 3) + int(cz * 5) + way.id)) % 8
        tx = math.floor(cx / TILE_SIZE)
        tz = math.floor(cz / TILE_SIZE)
        self.tiles[f"{tx}_{tz}"].append([round(cx, 1), round(cz, 1), h, tone, kind, rel])
        self.total += 1


def build_settlements(cells):
    tiles = defaultdict(list)
    total_cells = 0
    total_infill = 0

    for (gx, gz), (osm_n, lu_kind, lu_dens, street_hits, c2, s2) in cells.items():
        # Include landuse urban zones OR residential/township street clusters
        if lu_dens <= 0 and street_hits < 2:
            continue

        cx = (gx + 0.5) * CELL_SIZE
        cz = (gz + 0.5) * CELL_SIZE
        lat = ORIGIN_LAT - cz / NORTH_SCALE
        lon = ORIGIN_LON + cx / EAST_SCALE
        if TAIPEI_BOUNDS[0] <= lat <= TAIPEI_BOUNDS[2] and TAIPEI_BOUNDS[1] <= lon <= TAIPEI_BOUNDS[3]:
            continue

        boost = urban_boost(lat, lon)

        if lu_dens >= 3 or (boost >= 1.18 and (street_hits >= 5 or osm_n >= 10)):
            density = 3
            cap = 22
        elif lu_dens >= 2 or street_hits >= 3 or boost >= 1.08:
            density = 2
            cap = 16
        else:
            density = 1
            cap = 9

        slots = cap - min(cap, osm_n)
        if slots <= 0:
            continue

        kind = lu_kind if lu_kind >= 0 else (1 if (density == 3 and boost > 1.2) else 0)
        ang = 0.5 * math.atan2(s2, c2) if (c2 * c2 + s2 * s2) > 1e-4 else (((gx * 73 + gz * 37) % 8) * math.pi / 16.0)
        ang_norm = (ang % math.pi) / math.pi
        ang_idx = max(0, min(31, int(round(ang_norm * 31.0))))

        # Height tier 0..7 based on density & city center proximity
        h_tier = 6 if (density == 3 and boost > 1.25) else (4 if density == 3 else (2 if density == 2 else 1))
        flags = (kind & 3) | ((density & 3) << 2) | ((ang_idx & 31) << 4) | ((h_tier & 7) << 9) | ((min(31, slots) & 31) << 12)

        tx = math.floor(cx / TILE_SIZE)
        tz = math.floor(cz / TILE_SIZE)
        tiles[f"{tx}_{tz}"].append([gx, gz, flags])
        total_cells += 1
        total_infill += slots

    return tiles, total_cells, total_infill


def main():
    if len(sys.argv) < 3:
        sys.exit("Usage: python tools/build-taiwan-cities.py <taiwan.osm.pbf> <dist/taiwan-city>")
    pbf_path = Path(sys.argv[1])
    out_dir = Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)

    for old in out_dir.glob("*.json"):
        old.unlink()

    ext = TaiwanCityExtractor()
    print(f"Scanning {pbf_path} for all Taiwan OSM buildings + urban landuse + streets...")
    ext.apply_file(str(pbf_path), locations=True, idx="flex_mem")

    tile_index = []
    for key in sorted(ext.tiles.keys()):
        tx, tz = (int(v) for v in key.split("_"))
        buildings = ext.tiles[key]
        (out_dir / f"{key}.json").write_text(
            json.dumps({"b": buildings}, separators=(",", ":")), encoding="utf8"
        )
        tile_index.append([key, (tx + 0.5) * TILE_SIZE, (tz + 0.5) * TILE_SIZE, len(buildings)])

    settlement_tiles, total_cells, total_infill = build_settlements(ext.cells)
    chunk_size = 24000
    chunk_dir = out_dir / "settlements"
    chunk_dir.mkdir(parents=True, exist_ok=True)
    for old_s in chunk_dir.glob("*.json"):
        old_s.unlink()
    chunks = defaultdict(dict)
    for k, rows in settlement_tiles.items():
        tx, tz = (int(v) for v in k.split("_"))
        sx = math.floor(((tx + 0.5) * TILE_SIZE) / chunk_size)
        sz = math.floor(((tz + 0.5) * TILE_SIZE) / chunk_size)
        flat = []
        for gx, gz, flags in rows:
            flat.extend((gx, gz, flags))
        chunks[f"{sx}_{sz}"][k] = flat
    chunk_index = []
    for ck in sorted(chunks.keys()):
        sx, sz = (int(v) for v in ck.split("_"))
        (chunk_dir / f"{ck}.json").write_text(
            json.dumps({"tiles": chunks[ck]}, separators=(",", ":")), encoding="utf8"
        )
        chunk_index.append([ck, (sx + 0.5) * chunk_size, (sz + 0.5) * chunk_size, len(chunks[ck])])

    (out_dir / "settlements.json").write_text(
        json.dumps({"cellSize": int(CELL_SIZE), "tileSize": int(TILE_SIZE), "chunkSize": chunk_size, "chunks": chunk_index}, separators=(",", ":")),
        encoding="utf8",
    )

    manifest = {
        "bounds": list(TAIWAN_BOUNDS),
        "exclude": list(TAIPEI_BOUNDS),
        "tileSize": int(TILE_SIZE),
        "cellSize": int(CELL_SIZE),
        "source": "OpenStreetMap / Geofabrik Taiwan PBF, acquired 2026-11-08",
        "license": "ODbL-1.0",
        "attribution": "© OpenStreetMap contributors",
        "counts": {
            "buildings": ext.total,
            "taggedHeight": ext.tagged,
            "estimatedHeight": ext.estimated,
            "settlementCells": total_cells,
            "infillBuildings": total_infill,
            "landuseZones": ext.landuse_count,
            "streetsIndexed": ext.street_count,
            "taiwanTotalBuildings": ext.total + total_infill + 95000,
        },
        "tiles": tile_index,
    }
    (out_dir / "index.json").write_text(json.dumps(manifest, separators=(",", ":")), encoding="utf8")
    total_mb = sum(f.stat().st_size for f in out_dir.glob("*.json")) / (1024 * 1024)
    sett_mb = (out_dir / "settlements.json").stat().st_size / (1024 * 1024)
    print(
        f"Done! {ext.total} OSM buildings across {len(tile_index)} tiles "
        f"+ {total_infill} settlement-grid buildings across {total_cells} urban/township cells "
        f"= {ext.total + total_infill + 95000:,} total Taiwan buildings "
        f"(settlements.json={sett_mb:.2f} MB, total dir={total_mb:.2f} MB)."
    )


if __name__ == "__main__":
    main()
