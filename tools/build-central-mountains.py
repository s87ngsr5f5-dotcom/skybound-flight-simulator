"""Build a 120 m Central Range elevation layer from local Tilezen Skadi HGT files."""

import base64
import gzip
import json
import math
import struct
import sys
from functools import lru_cache
from pathlib import Path

SOURCE = Path(sys.argv[1])
OUTPUT = Path(__file__).resolve().parents[1] / "dist" / "central-mountains.js"
LAT = 25 + (4 + 10.535 / 60) / 60
LON = 121 + (33 + 9.085 / 60) / 60
EAST_SCALE = 111319.49 * math.cos(math.radians(LAT))
SPAN = 11520
STEP = 120


@lru_cache(maxsize=8)
def tile(lat, lon):
    path = SOURCE / f"N{lat}E{lon}.hgt.gz"
    if not path.exists():
        return None, 0
    data = gzip.decompress(path.read_bytes())
    return data, math.isqrt(len(data) // 2)


def elevation(x, z):
    lat, lon = LAT - z / 110772, LON + x / EAST_SCALE
    south, west = math.floor(lat), math.floor(lon)
    data, size = tile(south, west)
    if not data:
        return 0
    row = round((south + 1 - lat) * (size - 1))
    col = round((lon - west) * (size - 1))
    return max(0, struct.unpack_from(">h", data, 2 * (row * size + col))[0])


tiles = {}
for row in range(2, 24):
    for col in range(-14, 3):
        x, z = col * SPAN, row * SPAN
        if max(elevation(x + i, z + j) for i in range(0, SPAN + 1, 960)
               for j in range(0, SPAN + 1, 960)) < 850:
            continue
        heights = [elevation(x + i, z + j) for j in range(0, SPAN + 1, STEP)
                   for i in range(0, SPAN + 1, STEP)]
        tiles[f"{col}:{row}"] = base64.b64encode(
            struct.pack(f"<{len(heights)}H", *heights)).decode("ascii")

OUTPUT.write_text(
    "// Tilezen Skadi elevation samples, 120 m spacing. See REGIONAL.txt.\n"
    "registerCentralMountains({\n" + ",\n".join(
        f"  {json.dumps(key)}:{json.dumps(value)}" for key, value in tiles.items()
    ) + "\n});\n", encoding="utf-8")
print(f"{len(tiles)} mountain tiles, {OUTPUT.stat().st_size:,} bytes")
