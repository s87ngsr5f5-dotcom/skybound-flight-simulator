"""Prepare the Taipei texture from an open Copernicus Sentinel-2 scene."""

import math
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.transform import from_bounds
from rasterio.vrt import WarpedVRT
from rasterio.enums import Resampling

SCENE = "S2A_51RUH_20250114_0_L2A"
URL = f"https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/51/R/UH/2025/1/{SCENE}/TCI.tif"
LAT = 25 + (4 + 10.535 / 60) / 60
LON = 121 + (33 + 9.085 / 60) / 60
EAST_SCALE = 111319.49 * math.cos(math.radians(LAT))
LEFT, TOP, RIGHT, BOTTOM = -20000, -18000, 19000, 15500
WIDTH, HEIGHT = 3900, 3350
BOUNDS = (LON + LEFT / EAST_SCALE, LAT - BOTTOM / 110772,
          LON + RIGHT / EAST_SCALE, LAT - TOP / 110772)
OUTPUT = Path(__file__).resolve().parents[1] / "dist" / "taipei-sentinel.webp"

with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif"):
    with rasterio.open(URL) as source, WarpedVRT(
        source, crs="EPSG:4326", transform=from_bounds(*BOUNDS, WIDTH, HEIGHT),
        width=WIDTH, height=HEIGHT, resampling=Resampling.bilinear
    ) as reprojected:
        rgb = reprojected.read([1, 2, 3])

if (rgb.max(axis=0) == 0).mean() > .002:
    raise RuntimeError("Selected Sentinel image does not cover the Taipei texture")
image = Image.fromarray(np.moveaxis(rgb, 0, -1))
image.save(OUTPUT, quality=87, method=5)
image.resize((WIDTH // 2, HEIGHT // 2), Image.Resampling.LANCZOS).save(
    OUTPUT.with_stem(OUTPUT.stem + "-mobile"), quality=85, method=5
)
print(f"{SCENE}: {WIDTH} x {HEIGHT}, {OUTPUT.stat().st_size:,} bytes")
