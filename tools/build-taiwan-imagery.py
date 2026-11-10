"""Prepare the WorldCover map and local 10 m starter tiles for Taiwan."""

import gzip
import json
import math
import sys
from io import BytesIO
from urllib.parse import urlencode
from urllib.request import urlopen
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[1])
DESTINATION = ROOT / "dist" / "satellite"
DESTINATION.mkdir(exist_ok=True)
LAT = 25 + (4 + 10.535 / 60) / 60
LON = 121 + (33 + 9.085 / 60) / 60
EAST = 111319.49 * math.cos(math.radians(LAT))
SPAN = 11520
SIZE = SPAN // 10
LOW_SIZE = SPAN // 40
WMS = "https://titiler.terrascope.be/wms"


def bounds(col, row):
    return (LON + col * SPAN / EAST, LAT - (row + 1) * SPAN / 110772,
            LON + (col + 1) * SPAN / EAST, LAT - row * SPAN / 110772)


@lru_cache(maxsize=20)
def heights(lat, lon):
    path = SOURCE / f"N{lat:02}E{lon:03}.hgt.gz"
    if not path.exists():
        return None
    data = gzip.decompress(path.read_bytes())
    size = math.isqrt(len(data) // 2)
    return np.frombuffer(data, dtype=">i2").reshape(size, size)


def contains_land(col, row):
    west, south, east, north = bounds(col, row)
    for lat in np.linspace(south, north, 25):
        for lon in np.linspace(west, east, 25):
            y, x = math.floor(lat), math.floor(lon)
            grid = heights(y, x)
            if grid is not None:
                n = grid.shape[0] - 1
                if grid[round((y + 1 - lat) * n), round((lon - x) * n)] > 1:
                    return True
    return False


def photograph(west, south, east, north, width, height):
    query = urlencode(dict(service="WMS", request="GetMap", version="1.3.0",
                           layers="esa-worldcover-s2rgbnir-10m-2021-v2_tcc", styles="default",
                           format="image/jpeg", crs="EPSG:4326", time="2021-01-01",
                           bbox=f"{south:.9f},{west:.9f},{north:.9f},{east:.9f}",
                           width=width, height=height))
    with urlopen(WMS + "?" + query, timeout=120) as response:
        data = response.read()
    with Image.open(BytesIO(data)) as image:
        rgb = np.asarray(image.convert("RGB"))
    if rgb.shape != (height, width, 3):
        raise ValueError(f"Unexpected WMS dimensions: {rgb.shape}")
    rgba = np.empty((height, width, 4), np.uint8)
    rgba[:, :, :3] = rgb
    rgba[:, :, 3] = (rgb.max(axis=2) > 5) * 255
    return Image.fromarray(rgba)


def make_tile(pair):
    col, row = pair
    key = f"{col}_{row}"
    high_path = DESTINATION / f"{key}.webp"
    low_path = DESTINATION / f"{key}-low.webp"
    if not (high_path.exists() and low_path.exists()):
        image = photograph(*bounds(col, row), SIZE, SIZE)
        image.save(high_path, quality=91, method=4)
        image.resize((LOW_SIZE, LOW_SIZE), Image.Resampling.LANCZOS).save(low_path, quality=85, method=4)
        print(key, flush=True)
    return key


def make_overview():
    left, top, columns, rows = -30, -14, 36, 46
    west, _, _, north = bounds(left, top)
    _, south, east, _ = bounds(left + columns - 1, top + rows - 1)
    path = DESTINATION / "overview.webp"
    if not path.exists():
        photograph(west, south, east, north, columns * 48, rows * 48).save(path, quality=89, method=4)
    return [left * SPAN, top * SPAN, columns * SPAN, rows * SPAN]


def tile_at(lat, lon):
    return (math.floor((lon - LON) * EAST / SPAN), math.floor((LAT - lat) * 110772 / SPAN))


def main():
    main_island = {(col, row) for row in range(-3, 32) for col in range(-19, 6)
                   if row >= 9 or col >= -10}
    outlying = {(col, row) for row in range(5, 8) for col in range(-30, -26)}  # Kinmen
    outlying.update((col, row) for row in range(-14, -8) for col in range(-16, -10))  # Matsu
    selection = sorted((pair for pair in main_island | outlying if contains_land(*pair)),
                       key=lambda pair: (pair[1], pair[0]))
    tiles = [f"{x}_{z}" for x, z in selection]
    local = {(x, z) for x, z in selection if any(
        abs(x - col) <= 1 and abs(z - row) <= 1
        for col, row in [tile_at(22.666, 121.485), tile_at(22.028, 121.546)]
    )}
    local.update(tile_at(lat, lon) for lat, lon in [
        (24.25, 120.62), (23.59, 119.63), (22.57, 120.35), (24.43, 118.37), (26.16, 119.96)
    ])
    with ThreadPoolExecutor(max_workers=8) as workers:
        overview_task = workers.submit(make_overview)
        baked = sorted(workers.map(make_tile, sorted(local)))
        overview = overview_task.result()
    (ROOT / "dist" / "taiwan-satellite-data.js").write_text(
        "const taiwanSatelliteData=" + json.dumps({"tiles": tiles, "baked": baked, "overview": overview},
                                                 separators=(",", ":")) + ";\n", encoding="utf-8")
    print(f"{len(tiles)} tiles, {sum(f.stat().st_size for f in DESTINATION.glob('*.webp')):,} bytes")


if __name__ == "__main__":
    main()
