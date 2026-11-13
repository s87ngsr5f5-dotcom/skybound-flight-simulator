"""Extract island-wide Taiwan highway & arterial road network (motorway, trunk, primary, secondary)
from taiwan-airport-map.osm.pbf into compact 24km sharded JSON chunks for dist/taiwan-city/roads/.
"""
import json
import math
import sys
from collections import defaultdict
from pathlib import Path
import osmium

ORIGIN_LAT = 25.0 + (4.0 + 10.535 / 60.0) / 60.0
ORIGIN_LON = 121.0 + (33.0 + 9.085 / 60.0) / 60.0
EAST_SCALE = 111319.49 * math.cos(math.radians(ORIGIN_LAT))
NORTH_SCALE = 110772.0

TAIPEI_BOUNDS = (24.97, 121.43, 25.14, 121.65)
TAIWAN_BOUNDS = (21.8, 118.1, 26.4, 122.2)
CHUNK_SIZE = 24000.0

ROAD_WIDTHS = {
    "motorway": 24,
    "motorway_link": 11,
    "trunk": 20,
    "trunk_link": 10,
    "primary": 15,
    "secondary": 11,
}


def point(lat, lon):
    return (lon - ORIGIN_LON) * EAST_SCALE, (ORIGIN_LAT - lat) * NORTH_SCALE


def simplify_line(coords, min_seg=18.0, tol=3.5):
    pts = list(coords)
    if len(pts) < 2:
        return []
    out = [pts[0]]
    for p in pts[1:-1]:
        if math.hypot(p[0] - out[-1][0], p[1] - out[-1][1]) >= min_seg:
            out.append(p)
    out.append(pts[-1])
    if len(out) <= 2:
        return out if math.hypot(out[-1][0] - out[0][0], out[-1][1] - out[0][1]) >= 8.0 else []
    kept = [out[0]]
    for i in range(1, len(out) - 1):
        a, b, c = kept[-1], out[i], out[i + 1]
        vx, vz = c[0] - a[0], c[1] - a[1]
        seg = math.hypot(vx, vz)
        if seg > 0.1:
            d = abs((b[0] - a[0]) * vz - (b[1] - a[1]) * vx) / seg
            if d < tol:
                continue
        kept.append(b)
    kept.append(out[-1])
    return kept if len(kept) >= 2 else []


class RoadHandler(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.chunks = defaultdict(list)
        self.count = 0

    def way(self, w):
        hw = w.tags.get("highway")
        if hw not in ROAD_WIDTHS:
            return
        tunnel = w.tags.get("tunnel")
        if tunnel in ("yes", "building_passage"):
            return
        coords = []
        valid_any = False
        for n in w.nodes:
            if not n.location.valid():
                continue
            lat, lon = n.location.lat, n.location.lon
            if not (TAIWAN_BOUNDS[0] <= lat <= TAIWAN_BOUNDS[2] and TAIWAN_BOUNDS[1] <= lon <= TAIWAN_BOUNDS[3]):
                continue
            if not (TAIPEI_BOUNDS[0] <= lat <= TAIPEI_BOUNDS[2] and TAIPEI_BOUNDS[1] <= lon <= TAIPEI_BOUNDS[3]):
                valid_any = True
            coords.append(point(lat, lon))
        if not valid_any or len(coords) < 2:
            return
        simp = simplify_line(coords)
        if not simp:
            return
        bridge = 1 if w.tags.get("bridge") in ("yes", "viaduct", "movable") or hw == "motorway" and w.tags.get("layer") in ("1", "2", "3") else 0
        width = ROAD_WIDTHS[hw]
        lanes_tag = w.tags.get("lanes")
        if lanes_tag and lanes_tag.isdigit():
            lanes = max(1, min(8, int(lanes_tag)))
            width = max(8, min(30, round(lanes * 3.8 + (4 if hw in ("motorway", "trunk") else 2))))
        mid = simp[len(simp) // 2]
        cx = math.floor(mid[0] / CHUNK_SIZE)
        cz = math.floor(mid[1] / CHUNK_SIZE)
        flat = []
        for px, pz in simp:
            flat.append(round(px, 1))
            flat.append(round(pz, 1))
        self.chunks[f"{cx}_{cz}"].append([width, bridge, flat])
        self.count += 1


def main():
    pbf = Path(sys.argv[1])
    out_dir = Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("*.json"):
        old.unlink()
    h = RoadHandler()
    print(f"Extracting Taiwan OSM roads from {pbf} ...")
    h.apply_file(str(pbf), locations=True)
    chunk_meta = []
    for ck, roads in sorted(h.chunks.items()):
        sx, sz = (int(v) for v in ck.split("_"))
        center_x = (sx + 0.5) * CHUNK_SIZE
        center_z = (sz + 0.5) * CHUNK_SIZE
        (out_dir / f"{ck}.json").write_text(json.dumps({"r": roads}, separators=(",", ":")), encoding="utf-8")
        chunk_meta.append([ck, round(center_x), round(center_z), len(roads)])
    index = {
        "license": "ODbL-1.0",
        "chunkSize": int(CHUNK_SIZE),
        "roads": h.count,
        "chunks": chunk_meta,
    }
    (out_dir / "index.json").write_text(json.dumps(index, separators=(",", ":")), encoding="utf-8")
    total_mb = sum(f.stat().st_size for f in out_dir.glob("*.json")) / (1024 * 1024)
    print(f"Done: {h.count} roads in {len(chunk_meta)} chunks ({total_mb:.2f} MB)")


if __name__ == "__main__":
    main()
