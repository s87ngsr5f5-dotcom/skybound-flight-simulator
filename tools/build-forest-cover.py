"""Generate the game's tree cover grid from ESA WorldCover 2021 v200 tiles."""
import argparse
import base64
from pathlib import Path

import numpy as np
import rasterio
from rasterio.windows import Window


def build(source, destination):
    west, north, east, south = 120.0, 25.35, 122.10, 21.85
    sample, resolution = 15, 1 / 12000
    step = sample * resolution
    columns = round((east - west) / step)
    rows = round((north - south) / step)
    density = np.empty((rows, columns), dtype=np.uint8)
    split = round((north - 24) / step)
    for tile, tile_north, start, stop in [
        ("N24E120", 27, 0, split),
        ("N21E120", 24, split, rows),
    ]:
        name = f"ESA_WorldCover_10m_2021_v200_{tile}_Map.tif"
        with rasterio.open(source / name) as dataset:
            for row in range(start, stop, 32):
                size = min(32, stop - row)
                offset = round((tile_north - (north - row * step)) / resolution)
                pixels = dataset.read(1, window=Window(0, offset, columns * sample, size * sample))
                tree = (pixels == 10).reshape(size, sample, columns, sample).mean(axis=(1, 3))
                density[row:row + size] = np.rint(tree * 15)
    flat = density.ravel()
    edges = np.flatnonzero(np.r_[True, flat[1:] != flat[:-1], True])
    encoded = bytearray()
    for start, end in zip(edges[:-1], edges[1:]):
        value, length = int(flat[start]) << 4, int(end - start)
        while length > 16:
            encoded.append(value | 15)
            length -= 16
        encoded.append(value | (length - 1))
    data = base64.b64encode(encoded).decode("ascii")
    destination.write_text(
        "// ESA WorldCover 2021 v200, class 10 aggregated to tree-cover fraction. See README.md.\n"
        f"const worldCoverTrees = {{west:{west},north:{north},step:{step},columns:{columns},rows:{rows},runs:'{data}'}};\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("tiles", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    build(args.tiles, args.output)
