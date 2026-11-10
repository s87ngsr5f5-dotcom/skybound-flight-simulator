"""Build detailed island terrain from the local Tilezen Skadi HGT files."""

import base64
import gzip
import json
import math
import sys
from functools import lru_cache
from pathlib import Path

import numpy as np

SOURCE = Path(sys.argv[1])
OUTPUT = Path(__file__).resolve().parents[1] / "dist" / "island-elevation.js"
LAT = 25 + (4 + 10.535 / 60) / 60
LON = 121 + (33 + 9.085 / 60) / 60
EAST = 111319.49 * math.cos(math.radians(LAT))
STEP = 40


@lru_cache
def samples(lat, lon):
    raw = gzip.decompress((SOURCE / f"N{lat:02}E{lon:03}.hgt.gz").read_bytes())
    n = math.isqrt(len(raw) // 2)
    return np.frombuffer(raw, dtype=">i2").reshape(n, n)


def terrain(x, z):
    lat, lon = LAT - z / 110772, LON + x / EAST
    y, u = math.floor(lat), math.floor(lon)
    tile = samples(y, u)
    n = tile.shape[0] - 1
    return max(0, int(tile[round((y + 1 - lat) * n), round((lon - u) * n)]))


regions = {
    "綠島": (121.430, 22.610, 121.529, 22.700),
    "蘭嶼": (121.465, 21.930, 121.611, 22.107),
    "小琉球": (120.341, 22.300, 120.416, 22.379),
    "龜山島": (121.911, 24.826, 121.989, 24.871),
    "南竿北竿": (119.880, 26.108, 120.045, 26.264),
    "莒光": (119.895, 25.950, 120.014, 26.008),
    "東引": (120.416, 26.330, 120.520, 26.414),
}
grids = []
for west, south, east, north in regions.values():
    x = math.floor((west - LON) * EAST / STEP) * STEP
    z = math.floor((LAT - north) * 110772 / STEP) * STEP
    columns = math.ceil(((east - LON) * EAST - x) / STEP) + 1
    rows = math.ceil(((LAT - south) * 110772 - z) / STEP) + 1
    values = np.fromiter((terrain(x + i * STEP, z + j * STEP)
                          for j in range(rows) for i in range(columns)), dtype="<u2")
    grids.append([x, z, columns, rows, base64.b64encode(values.tobytes()).decode()])
OUTPUT.write_text("const islandElevationData=" + json.dumps(grids, separators=(",", ":")) + ";\n", encoding="utf-8")
