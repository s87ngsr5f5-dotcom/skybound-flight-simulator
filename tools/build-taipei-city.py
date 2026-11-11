"""Build offline Taipei city tiles from an ODbL Taiwan OSM PBF (pyosmium).

Usage: python tools/build-taipei-city.py taiwan.osm.pbf dist/taipei-city
Preserves footprint geometry; absent building heights are explicitly estimated.
"""
import json
import math
import sys
from collections import defaultdict
from pathlib import Path
import osmium

BOUNDS = [24.97, 121.43, 25.14, 121.65]
LAT = 25 + (4 + 10.535 / 60) / 60
LON = 121 + (33 + 9.085 / 60) / 60
EAST = 111319.49 * math.cos(math.radians(LAT))
SIZE = 1600
tiles = defaultdict(lambda: {"b": [], "r": [], "w": []})
names = []
counts = defaultdict(int)

def point(lat, lon):
    return [round((lon - LON) * EAST, 1), round((LAT - lat) * 110772, 1)]

def number(s):
    try:
        return float(s.lower().replace("meters", "").replace("m", "").split(";")[0].strip())
    except (ValueError, AttributeError):
        return 0

class Extract(osmium.SimpleHandler):
    def way(self, way):
        tags = dict(way.tags)
        building = tags.get("building") not in (None, "no")
        road = tags.get("highway") in {"motorway", "trunk", "primary", "secondary", "tertiary", "residential", "motorway_link", "trunk_link", "primary_link"}
        water = tags.get("natural") == "water" or tags.get("waterway") == "riverbank"
        if not (building or road or water) or len(way.nodes) < 2:
            return
        p = [(n.lat, n.lon) for n in way.nodes if n.location.valid()]
        if len(p) < 2:
            return
        lat = sum(y for y, x in p) / len(p)
        lon = sum(x for y, x in p) / len(p)
        if not (BOUNDS[0] < lat < BOUNDS[2] and BOUNDS[1] < lon < BOUNDS[3]):
            return
        coords = [point(y, x) for y, x in p]
        x, z = point(lat, lon)
        tile = tiles[f"{math.floor(x / SIZE)}_{math.floor(z / SIZE)}"]
        if building and way.is_closed() and len(coords) >= 4:
            coords.pop()
            # Remove consecutive duplicate vertices and negligible sheds.
            coords = [v for i, v in enumerate(coords) if v != coords[i - 1]]
            area = abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(coords, coords[1:] + coords[:1]))) / 2
            if area < 20 or len(coords) < 3:
                return
            measured = number(tags.get("height"))
            levels = number(tags.get("building:levels"))
            height = measured or levels * 3.2
            if height < 2:
                # Deterministic local approximation; never described as surveyed.
                height = 4 if tags.get("building") in {"garage", "shed", "roof"} else (8 + way.id % 5 * 3.2 if area < 1100 else 15 + way.id % 6 * 3.2)
                counts["estimatedHeight"] += 1
            else:
                counts["taggedHeight"] += 1
            kind = 1 if tags.get("building") in {"commercial", "office", "retail"} else 2 if tags.get("building") in {"industrial", "warehouse"} else 0
            tile["b"].append([x, z, round(min(510, height), 1), way.id % 8, kind, [n for v in coords for n in (round(v[0] - x, 1), round(v[1] - z, 1))]])
            counts["buildings"] += 1
            if measured > 80 or tags.get("name") in {"臺北101", "台北101", "臺北大巨蛋", "圓山大飯店"}:
                names.append([tags.get("name", ""), lat, lon, height, way.id])
        elif road and tags.get("tunnel") != "yes":
            kind = tags["highway"]
            width = number(tags.get("width")) or max(5.5, number(tags.get("lanes")) * 3.25)
            if not tags.get("width") and not tags.get("lanes"):
                width = {"motorway": 17, "trunk": 15, "primary": 19, "secondary": 15, "tertiary": 11}.get(kind, 7)
            tile["r"].append([round(min(38, width), 1), int(tags.get("bridge") not in (None, "no")), [n for v in coords for n in v]])
            counts["roads"] += 1
        elif water and way.is_closed() and len(coords) >= 4:
            tile["w"].append([n for v in coords[:-1] for n in v])
            counts["waterPolygons"] += 1

Extract().apply_file(sys.argv[1], locations=True, idx="flex_mem")
out = Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
manifest = {"bounds": BOUNDS, "tileSize": SIZE, "source": "OpenStreetMap / Geofabrik Taiwan PBF, acquired 2026-11-08", "license": "ODbL-1.0", "attribution": "© OpenStreetMap contributors", "counts": dict(counts), "tiles": []}
for key, data in sorted(tiles.items()):
    cx, cz = map(int, key.split("_"))
    name = key + ".json"
    (out / name).write_text(json.dumps(data, separators=(",", ":")), encoding="utf8")
    manifest["tiles"].append([key, (cx + .5) * SIZE, (cz + .5) * SIZE, len(data["b"])])
(out / "index.json").write_text(json.dumps(manifest, separators=(",", ":")), encoding="utf8")
print(json.dumps({"tiles": len(tiles), **counts, "tallBuildings": names}, ensure_ascii=False))
