"""Build the highway layer from Taiwan NLSC road centerlines (data.gov.tw/73232)."""
import json
import sys
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile

import shapefile
from pyproj import Transformer

express = {"台61", "台62", "台64", "台65", "台66", "台68", "台72", "台74", "台76", "台78",
           "台82", "台84", "台86", "台88"}
project = Transformer.from_crs(3826, 4326, always_xy=True)
roads = []
with ZipFile(sys.argv[1]) as archive:
    def part(extension):
        return BytesIO(archive.read(next(name for name in archive.namelist() if name.endswith("." + extension))))

    data = shapefile.Reader(shp=part("shp"), shx=part("shx"), dbf=part("dbf"), encoding="utf8")
    for item in data.iterShapeRecords():
        record, shape = item.record, item.shape
        national = record["ROADCLASS1"].startswith("H")
        if not national and not (record["ROADNUM"] in express and record["ROADCLASS2"] == "9421001"):
            continue
        if "隧道" in record["BRITUNNAME"]:
            continue
        ramp = "交流道" in record["ROADNAME"] or "系統" in record["ROADNAME"]
        bridge = "橋" in record["BRITUNNAME"]
        for start, end in zip(shape.parts, [*shape.parts[1:], len(shape.points)]):
            points = shape.points[start:end]
            if len(points) < 2:
                continue
            x, y = zip(*points)
            lon, lat = project.transform(x, y)
            if not (21.8 < lat[0] < 25.4 and 119.8 < lon[0] < 122.2):
                continue
            coords = [round(value, 5) for xy in zip(lat, lon) for value in xy]
            roads.append([8 if ramp else 13 if national else 10, int(bridge), coords])
Path(sys.argv[2]).write_text("// Source: Taiwan NLSC road centerlines, 2026-04-09. See README.md.\n"
    + "const taiwanHighways=" + json.dumps(roads, separators=(",", ":")) + ";\n", encoding="utf8")
print(len(roads), "highway and ramp segments")
