"""Extract representative OpenStreetMap building volumes around Taiwan airports."""
import json
import math
import sys
from pathlib import Path

import osmium

centers = [
    (25.06, 121.55, 7), (25.08, 121.23, 6), (24.25, 120.62, 5), (24.15, 120.67, 7),
    (22.58, 120.35, 6), (22.63, 120.30, 7), (24.00, 121.61, 5), (22.76, 121.14, 4),
    (24.43, 118.36, 4), (23.56, 119.63, 4)
]


def near(lat, lon):
    return any(abs(lat - y) < r / 110 and abs(lon - x) < r / 101 for y, x, r in centers)


class CityExtractor(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.cells = {}

    def way(self, way):
        if not way.tags.get("building") or len(way.nodes) < 4 or not way.is_closed():
            return
        first = way.nodes[0].location
        if not first.valid() or not near(first.lat, first.lon):
            return
        if 25.05 <= first.lat <= 25.08 and 121.52 <= first.lon <= 121.58:
            return  # Existing detailed Taipei footprint layer.
        points = [(n.lat, n.lon) for n in way.nodes if n.location.valid()]
        lat, lon = zip(*points)
        y, x = (min(lat) + max(lat)) / 2, (min(lon) + max(lon)) / 2
        width = round((max(lon) - min(lon)) * math.cos(math.radians(y)) * 111319)
        depth = round((max(lat) - min(lat)) * 110772)
        if min(width, depth) < 4:
            return
        try:
            height = float(way.tags.get("height", "").replace("m", "").strip())
        except ValueError:
            try:
                height = float(way.tags.get("building:levels", "0")) * 3.2 + 1
            except ValueError:
                height = 0
        if height <= 1:
            height = 4 + (way.id % 6) * 1.6 if max(width, depth) < 24 else 7 + (way.id % 9) * 1.8
        cell = (round(y * 3400), round(x * 3150))
        size = width * depth * max(5, height)
        if cell not in self.cells or size > self.cells[cell][0]:
            self.cells[cell] = (size, [round(y, 5), round(x, 5), min(width, 260), min(depth, 260),
                                      round(min(500, height)), way.id % 7])


extract = CityExtractor()
extract.apply_file(sys.argv[1], locations=True, idx="flex_mem")
volumes = [row for _, row in extract.cells.values()]
Path(sys.argv[2]).write_text("// © OpenStreetMap contributors, ODbL. See README.md.\n"
    + "const airportCityVolumes=" + json.dumps(volumes, separators=(",", ":")) + ";\n", encoding="utf8")
print(len(volumes), "building volumes")
