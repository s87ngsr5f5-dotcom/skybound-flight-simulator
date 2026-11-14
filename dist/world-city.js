/* Real OpenStreetMap 1:1 International City Scenery Streaming Module (v0.70)
 * Streams real building footprints, heights, regional residential pitched roofs,
 * heritage roofs, roads, and suburban settlements across 8 international regions.
 */
function createWorldCity(scene, ground, airports = []) {
  const root = new THREE.Group();
  root.name = 'World real OSM cities';
  scene.add(root);

  const WORLD_BOUNDS = [
    [35.37, 139.54, 35.87, 140.50], // 0: JP_TYO (Tokyo/Haneda/Yokohama/Chiba/Narita)
    [34.32, 135.10, 34.82, 135.68], // 1: JP_KIX (Osaka/Kansai/Kobe)
    [26.05, 127.56, 26.50, 127.94], // 2: JP_OKA (Okinawa Naha/Shuri/Chatan)
    [22.17, 113.83, 22.55, 114.35], // 3: HK_HKG (Hong Kong)
    [37.32, 126.35, 37.69, 127.20], // 4: KR_ICN (Seoul/Incheon/Songdo)
    [1.20, 103.59, 1.49, 104.05],   // 5: SG_SIN (Singapore)
    [14.37, 120.87, 14.77, 121.16], // 6: PH_MNL (Manila/Makati/BGC)
    [13.55, 100.39, 13.95, 100.89]  // 7: TH_BKK (Bangkok/Suvarnabhumi)
  ];

  function inside(lat, lon) {
    for (const b of WORLD_BOUNDS) {
      if (lat >= b[0] && lat <= b[2] && lon >= b[1] && lon <= b[3]) return true;
    }
    return false;
  }

  function makeCanvas(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // Facade & roof procedural textures
  const aptWallTex = makeCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#d7dadf';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) {
      g.fillStyle = 'rgba(0,0,0,0.06)';
      g.fillRect(0, y, w, 3);
      for (let x = 4; x < w; x += 24) {
        const lit = ((x * 7 + y * 13) % 19) < 7;
        g.fillStyle = lit ? '#9fb5c8' : '#536270';
        g.fillRect(x, y + 6, 14, 16);
        g.fillStyle = 'rgba(255,255,255,0.22)';
        g.fillRect(x, y + 23, 15, 2);
      }
    }
  });
  aptWallTex.repeat.set(0.14, 0.14);

  const houseWallTex = makeCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#ebe6dc';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 48) {
      g.fillStyle = 'rgba(0,0,0,0.045)';
      g.fillRect(0, y, w, 2);
      for (let x = 10; x < w; x += 36) {
        g.fillStyle = '#3f4b56';
        g.fillRect(x, y + 12, 18, 22);
        g.fillStyle = '#d8d5cc';
        g.fillRect(x + 8, y + 12, 2, 22);
        g.fillRect(x, y + 22, 18, 2);
      }
    }
  });
  houseWallTex.repeat.set(0.18, 0.18);

  const glassWallTex = makeCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#89a3ba';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 24) {
      g.fillStyle = 'rgba(18,32,48,0.28)';
      g.fillRect(0, y, w, 4);
      for (let x = 0; x < w; x += 16) {
        const warm = ((x * 11 + y * 17) % 13) === 0;
        g.fillStyle = warm ? 'rgba(220,235,248,0.55)' : 'rgba(155,190,220,0.28)';
        g.fillRect(x + 1, y + 5, 13, 18);
      }
    }
  });
  glassWallTex.repeat.set(0.10, 0.10);

  const pitchedRoofTex = makeCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#dcdcdc';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) {
      g.fillStyle = 'rgba(0,0,0,0.16)';
      g.fillRect(0, y, w, 3);
      g.fillStyle = 'rgba(255,255,255,0.10)';
      g.fillRect(0, y + 3, w, 2);
      const off = (y / 16) % 2 ? 8 : 0;
      for (let x = off; x < w; x += 16) {
        g.fillStyle = 'rgba(0,0,0,0.08)';
        g.fillRect(x, y, 2, 16);
      }
    }
  });
  pitchedRoofTex.repeat.set(0.32, 0.32);

  const flatRoofTex = makeCanvas(128, 128, (g, w, h) => {
    g.fillStyle = '#cfcfcc';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 420; i++) {
      g.fillStyle = i % 2 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)';
      g.fillRect((i * 47) % w, (i * 83) % h, 3, 3);
    }
  });
  flatRoofTex.repeat.set(0.18, 0.18);

  const nightEmissiveTex = makeCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#000000';
    g.fillRect(0, 0, w, h);
    for (let y = 6; y < h; y += 24) {
      for (let x = 4; x < w; x += 20) {
        const s = (x * 37 + y * 53) % 29;
        if (s < 11) {
          g.fillStyle = s < 5 ? '#ffe2a8' : s < 8 ? '#ffd38c' : '#cde4ff';
          g.fillRect(x, y, 10, 12);
        }
      }
    }
  });
  nightEmissiveTex.repeat.set(0.12, 0.12);

  const roadTex = makeCanvas(128, 128, (g, w, h) => {
    g.fillStyle = '#2d3238';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#6c737c';
    g.fillRect(0, 0, 5, h);
    g.fillRect(w - 5, 0, 5, h);
    g.fillStyle = '#e5c158';
    for (let y = 6; y < h; y += 32) g.fillRect(w / 2 - 2, y, 4, 18);
  });

  const aptMat = new THREE.MeshStandardMaterial({
    map: aptWallTex,
    emissiveMap: nightEmissiveTex,
    emissive: new THREE.Color('#ffcf86'),
    emissiveIntensity: 0,
    vertexColors: true,
    roughness: 0.78,
    metalness: 0.06
  });
  const houseMat = new THREE.MeshStandardMaterial({
    map: houseWallTex,
    emissiveMap: nightEmissiveTex,
    emissive: new THREE.Color('#ffdca4'),
    emissiveIntensity: 0,
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.04
  });
  const glassMat = new THREE.MeshStandardMaterial({
    map: glassWallTex,
    emissiveMap: nightEmissiveTex,
    emissive: new THREE.Color('#cfe6ff'),
    emissiveIntensity: 0,
    vertexColors: true,
    roughness: 0.28,
    metalness: 0.55
  });
  const indMat = new THREE.MeshStandardMaterial({
    map: flatRoofTex,
    vertexColors: true,
    roughness: 0.65,
    metalness: 0.25
  });
  const pitchedRoofMat = new THREE.MeshStandardMaterial({
    map: pitchedRoofTex,
    vertexColors: true,
    roughness: 0.70,
    metalness: 0.10
  });
  const flatRoofMat = new THREE.MeshStandardMaterial({
    map: flatRoofTex,
    vertexColors: true,
    roughness: 0.90,
    metalness: 0.04
  });
  const heritageMat = new THREE.MeshStandardMaterial({
    map: pitchedRoofTex,
    vertexColors: true,
    roughness: 0.45,
    metalness: 0.28
  });
  const roadMat = new THREE.MeshStandardMaterial({
    map: roadTex,
    roughness: 0.92,
    metalness: 0.04,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2
  });

  // Region-authentic house wall, roof, and apartment color palettes:
  // 0: JP_TYO, 1: JP_KIX, 2: JP_OKA, 3: HK_HKG, 4: KR_ICN, 5: SG_SIN, 6: PH_MNL, 7: TH_BKK
  const REG_PALETTES = {
    0: { // Tokyo: beige/cream stucco walls + dark charcoal/navy/warm-brown kawara roofs
      houseWall: [0xe9e2d5, 0xddd6c9, 0xe4dcd1, 0xcfd4d8, 0xd8cbbd],
      houseRoof: [0x353d47, 0x2b3648, 0x4b423c, 0x5c3e35, 0x2f353b],
      aptWall: [0xe3e0da, 0xd5d8dd, 0xcacfd4, 0xdad2c7],
      aptRoof: [0x7b8086, 0x6c7177],
      glassWall: [0x829eb8, 0x6f8ca6, 0x99b3c9],
      indWall: [0x9aa4ad, 0x8996a1],
      heritageRoof: [0x3f4e45, 0x6b3a2e, 0x3b4248]
    },
    1: { // Osaka/Kansai: warm plaster & wood-tone houses + dark/cedar-brown kawara roofs
      houseWall: [0xe7dfd2, 0xdcd4c6, 0xe2d6c5, 0xd3d5d8, 0xcabaa8],
      houseRoof: [0x3a3d42, 0x523c33, 0x2d3846, 0x454549, 0x663a2e],
      aptWall: [0xe0dcd5, 0xd2d5da, 0xcdc6bd, 0xd8cfc4],
      aptRoof: [0x787d83, 0x6a6e73],
      glassWall: [0x809cb5, 0x718aa3, 0x92aec4],
      indWall: [0x959fa8, 0x86929c],
      heritageRoof: [0x4c6252, 0x3c4347, 0x733a2c]
    },
    2: { // Okinawa: Typhoon-bright coral cream walls + iconic Ryukyu red-terracotta roofs
      houseWall: [0xf3eee6, 0xebe3d5, 0xe8dfd0, 0xe5e6e2],
      houseRoof: [0xb84a32, 0xc75438, 0xa8432d, 0xd06743, 0x8a5241],
      aptWall: [0xedeae2, 0xe3dfd6, 0xddd7cb],
      aptRoof: [0xd2cfc8, 0xbab7b0],
      glassWall: [0x7da4be, 0x8cb3c7],
      indWall: [0xa8b1b7, 0x96a1a8],
      heritageRoof: [0xc4442b, 0xaa3622, 0xd69f3b]
    },
    3: { // Hong Kong: Dense pastel peach/mint/cream/tan residential slabs + sapphire glass CBD
      houseWall: [0xf0e4d6, 0xe6dfd3, 0xdde5de, 0xead7cc],
      houseRoof: [0x9d4b37, 0x7c4637, 0x555c63, 0x886145],
      aptWall: [0xecd8cb, 0xe5decb, 0xd4dfd8, 0xdfe4ea, 0xead5c0, 0xcfd7dc],
      aptRoof: [0x767b81, 0x666b72],
      glassWall: [0x6e98ba, 0x5b82a4, 0x8fb5d1, 0x708b9e],
      indWall: [0x8f99a3, 0x7f8a94],
      heritageRoof: [0x3c6b4d, 0xb88635, 0x8c3a2b]
    },
    4: { // Seoul / Incheon: crisp light-grey & ivory Korea 'apart' blocks + sleek glass towers
      houseWall: [0xe6dfd7, 0xd9cfc5, 0xc9b5a6, 0xded9d2],
      houseRoof: [0x59423a, 0x454e58, 0x7d4235, 0x3b4843],
      aptWall: [0xe7e9ec, 0xdce0e5, 0xd5d8dd, 0xe4dfd6, 0xced4dc],
      aptRoof: [0x81878e, 0x70777e],
      glassWall: [0x789cc0, 0x6689ad, 0x95b6d4],
      indWall: [0x9aa4ae, 0x8a959f],
      heritageRoof: [0x385746, 0x4d545a, 0x8c3e32]
    },
    5: { // Singapore: clean tropical pastel HDB blocks + red-clay colonial shophouse roofs
      houseWall: [0xf1eadf, 0xe6e0d2, 0xdae6df, 0xf2dfd5],
      houseRoof: [0xaf4934, 0xbf553d, 0x8f4131, 0x555b62],
      aptWall: [0xefe8dc, 0xdde7e0, 0xe9dcd3, 0xe2e8ee, 0xede2cb],
      aptRoof: [0x7d8387, 0x8b867d],
      glassWall: [0x6398ad, 0x76aec2, 0x568499],
      indWall: [0x98a4ab, 0x86939a],
      heritageRoof: [0xb44c32, 0xc89a38, 0x2f6853]
    },
    6: { // Manila: sun-baked stucco + terracotta, cobalt-blue & weathered galvanized-metal roofs
      houseWall: [0xeadbc8, 0xf0e4d2, 0xe2cfb8, 0xdad5cd, 0xecd2c0],
      houseRoof: [0xa64833, 0x3c6282, 0x8b6647, 0x6e7b84, 0xb85e3c],
      aptWall: [0xe6ded2, 0xdad4c9, 0xd5dade, 0xe8d9c8],
      aptRoof: [0x7c7a75, 0x6f7378],
      glassWall: [0x779cb4, 0x6488a1, 0x8fb2c7],
      indWall: [0x939ba1, 0x828c94],
      heritageRoof: [0xa64730, 0x56636e, 0xc78f3c]
    },
    7: { // Bangkok: cream/ochre walls + bright terracotta/burnt-orange/teal Thai roofs & gold Wats
      houseWall: [0xefe5d2, 0xe8d8be, 0xf3ecde, 0xdfd3be],
      houseRoof: [0xc45433, 0x3b6f75, 0x2f5f87, 0xb3422b, 0x7a5743],
      aptWall: [0xeae0ce, 0xded6c8, 0xd6d9de, 0xe8d9c4],
      aptRoof: [0x7c7b75, 0x6d7074],
      glassWall: [0x7d9fb8, 0x8db0c7, 0x6c89a0],
      indWall: [0x959ea6, 0x848f97],
      heritageRoof: [0xd99b26, 0xb83824, 0x25784d]
    }
  };

  function pickColor(arr, tone, fallbackSalt) {
    if (!arr || !arr.length) return new THREE.Color(0xc8c8c8);
    const f = Math.max(0, Math.min(0.999, Number.isFinite(tone) ? tone : fallbackSalt));
    const hex = arr[Math.floor(f * arr.length) % arr.length];
    const c = new THREE.Color(hex);
    const j = (f * 13.7 - Math.floor(f * 13.7) - 0.5) * 0.08;
    c.offsetHSL(0, 0, j);
    return c;
  }

  // Known hero monument coords matching taiwan-city.js so OSM footprints don't clip hero towers
  const HERO_MASKS = [
    [35.71006, 139.81070, 95],   // Tokyo Skytree
    [35.65858, 139.74543, 85],   // Tokyo Tower
    [35.78580, 140.31830, 45],   // Narita-san Pagoda
    [22.28520, 114.15810, 95],   // HK Central IFC
    [22.28480, 114.15930, 42],   // HK BOC Hero Prism
    [22.30340, 114.16020, 75],   // HK ICC
    [37.51250, 127.10250, 85],   // Seoul Lotte
    [37.55120, 126.98820, 60],   // N Seoul Tower
    [1.28340, 103.86070, 105],   // Marina Bay Sands
    [1.28160, 103.86360, 70],    // Gardens by the Bay Supertrees
    [26.21450, 127.68400, 65],   // Okinawa Shuri Hero Plaza
    [26.21700, 127.71950, 55],   // Okinawa Shuri Real Site
    [14.53420, 121.00080, 65],   // Manila MOA Eye Ferris Wheel
    [34.68730, 135.52620, 75],   // Osaka Castle
    [34.70550, 135.48960, 70],   // Osaka Umeda Sky Building
    [13.75000, 100.49130, 100],  // Bangkok Grand Palace
    [13.72360, 100.52830, 60]    // Bangkok MahaNakhon
  ].map(([lat, lon, r]) => {
    const p = typeof geoPoint === 'function' ? geoPoint(lat, lon) : { x: 0, z: 0 };
    return { x: p.x, z: p.z, rSq: r * r };
  });

  function inHeroMask(x, z) {
    for (const h of HERO_MASKS) {
      const dx = x - h.x, dz = z - h.z;
      if (dx * dx + dz * dz < h.rSq) return true;
    }
    return false;
  }

  function isInAirportZone(x, z) {
    if (typeof runwayCoordinates !== 'function') return false;
    for (const a of airports) {
      if (!a || !a.length) continue;
      if (Math.abs(x - a.x) > a.length + 500 || Math.abs(z - a.z) > a.length + 500) continue;
      const { along, cross } = runwayCoordinates(x, z, a);
      if (Math.abs(along) <= a.length * 0.5 + 140 && Math.abs(cross) <= a.width * 0.5 + 85) return true;
    }
    return false;
  }

  function safeGround(x, z) {
    const raw = ground(x, z);
    // Reclaimed harbor/canal edges may evaluate right near 0; keep real OSM land buildings visible >= 1.5m
    return raw > 1.2 ? raw : 2.2;
  }

  function buffers() { return { p: [], n: [], uv: [], c: [] }; }

  function pushTri(out, ax, ay, az, bx, by, bz, cx, cy, cz, cr, cg, cb, nx, ny, nz, u0, v0, u1, v1, u2, v2) {
    out.p.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    out.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    out.uv.push(u0, v0, u1, v1, u2, v2);
    out.c.push(cr, cg, cb, cr, cg, cb, cr, cg, cb);
  }

  function emitSlopedTri(out, ax, ay, az, bx, by, bz, cx, cy, cz, cr, cg, cb, uvScale = 0.12) {
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    if (ny < 0) {
      nx = -nx; ny = -ny; nz = -nz;
      pushTri(out, ax, ay, az, cx, cy, cz, bx, by, bz, cr, cg, cb, nx, ny, nz,
        ax * uvScale, az * uvScale, cx * uvScale, cz * uvScale, bx * uvScale, bz * uvScale);
    } else {
      pushTri(out, ax, ay, az, bx, by, bz, cx, cy, cz, cr, cg, cb, nx, ny, nz,
        ax * uvScale, az * uvScale, bx * uvScale, bz * uvScale, cx * uvScale, cz * uvScale);
    }
  }

  function emitUpPoly(out, pts, y, col, uvScale = 0.25) {
    const cr = col.r, cg = col.g, cb = col.b;
    const emit = (p0, p1, p2) => {
      if ((p1[1] - p0[1]) * (p2[0] - p0[0]) - (p1[0] - p0[0]) * (p2[1] - p0[1]) > 0) {
        pushTri(out, p0[0], y, p0[1], p1[0], y, p1[1], p2[0], y, p2[1], cr, cg, cb, 0, 1, 0,
          p0[0] * uvScale, p0[1] * uvScale, p1[0] * uvScale, p1[1] * uvScale, p2[0] * uvScale, p2[1] * uvScale);
      } else {
        pushTri(out, p0[0], y, p0[1], p2[0], y, p2[1], p1[0], y, p1[1], cr, cg, cb, 0, 1, 0,
          p0[0] * uvScale, p0[1] * uvScale, p2[0] * uvScale, p2[1] * uvScale, p1[0] * uvScale, p1[1] * uvScale);
      }
    };
    if (pts.length === 3) { emit(pts[0], pts[1], pts[2]); return; }
    const contour = pts.map(p => new THREE.Vector2(p[0], p[1]));
    for (const ids of THREE.ShapeUtils.triangulateShape(contour, [])) {
      emit(pts[ids[0]], pts[ids[1]], pts[ids[2]]);
    }
  }

  function emitWalls(out, pts, minY, topY, cx, cz, col) {
    const cr = col.r, cg = col.g, cb = col.b;
    const h = topY - minY;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const ex = b[0] - a[0], ez = b[1] - a[1];
      const len = Math.hypot(ex, ez);
      if (len < 0.35) continue;
      let nx = ez / len, nz = -ex / len;
      const mx = (a[0] + b[0]) * 0.5 - cx, mz = (a[1] + b[1]) * 0.5 - cz;
      const flip = mx * nx + mz * nz < 0;
      if (flip) { nx = -nx; nz = -nz; }
      const s = 0.08 * (1 - 0.14 * Math.abs(nx));
      const wr = cr - s, wg = cg - s, wb = cb - s;
      if (!flip) {
        pushTri(out, a[0], minY, a[1], b[0], minY, b[1], b[0], topY, b[1], wr, wg, wb, nx, 0, nz, 0, 0, len, 0, len, h);
        pushTri(out, a[0], minY, a[1], b[0], topY, b[1], a[0], topY, a[1], wr, wg, wb, nx, 0, nz, 0, 0, len, h, 0, h);
      } else {
        pushTri(out, a[0], minY, a[1], a[0], topY, a[1], b[0], topY, b[1], wr, wg, wb, nx, 0, nz, 0, 0, 0, h, len, h);
        pushTri(out, a[0], minY, a[1], b[0], topY, b[1], b[0], minY, b[1], wr, wg, wb, nx, 0, nz, 0, 0, len, h, len, 0);
      }
    }
  }

  function emitPitchedRoof(out, pts, cx, cz, eaveY, peakY, col, insetFrac = 0.20) {
    // Orient main ridge along footprint's longest edge
    let bestLen = -1, ux = 1, uz = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const l = dx * dx + dz * dz;
      if (l > bestLen) {
        bestLen = l;
        const d = Math.sqrt(l) || 1;
        ux = dx / d; uz = dz / d;
      }
    }
    const vx = -uz, vz = ux;
    let uMin = 1e9, uMax = -1e9, vMin = 1e9, vMax = -1e9;
    for (const p of pts) {
      const dx = p[0] - cx, dz = p[1] - cz;
      const u = dx * ux + dz * uz;
      const v = dx * vx + dz * vz;
      if (u < uMin) uMin = u;
      if (u > uMax) uMax = u;
      if (v < vMin) vMin = v;
      if (v > vMax) vMax = v;
    }
    const uSpan = uMax - uMin;
    const trim = Math.min(uSpan * insetFrac, Math.max(0.8, (vMax - vMin) * 0.45));
    const uA = uMin + trim, uB = uMax - trim;
    const rx0 = cx + ux * uA, rz0 = cz + uz * uA;
    const rx1 = cx + ux * uB, rz1 = cz + uz * uB;
    const singlePeak = Math.hypot(rx1 - rx0, rz1 - rz0) < 0.8;
    const cr = col.r, cg = col.g, cb = col.b;

    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if (singlePeak) {
        emitSlopedTri(out, a[0], eaveY, a[1], b[0], eaveY, b[1], (rx0 + rx1) * 0.5, peakY, (rz0 + rz1) * 0.5, cr, cg, cb);
        continue;
      }
      const ua = ((a[0] - cx) * ux + (a[1] - cz) * uz) >= (uMin + uMax) * 0.5 ? 1 : 0;
      const ub = ((b[0] - cx) * ux + (b[1] - cz) * uz) >= (uMin + uMax) * 0.5 ? 1 : 0;
      const raX = ua ? rx1 : rx0, raZ = ua ? rz1 : rz0;
      const rbX = ub ? rx1 : rx0, rbZ = ub ? rz1 : rz0;
      if (ua === ub) {
        emitSlopedTri(out, a[0], eaveY, a[1], b[0], eaveY, b[1], raX, peakY, raZ, cr, cg, cb);
      } else {
        emitSlopedTri(out, a[0], eaveY, a[1], b[0], eaveY, b[1], rbX, peakY, rbZ, cr, cg, cb);
        emitSlopedTri(out, a[0], eaveY, a[1], rbX, peakY, rbZ, raX, peakY, raZ, cr, cg, cb);
      }
    }
  }

  function addLayerMesh(group, data, mat, name) {
    if (!data.p.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(data.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(data.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(data.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(data.c, 3));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.name = name;
    m.receiveShadow = true;
    group.add(m);
  }

  function* buildTile(key, data, tileRegId) {
    const regId = data.r ?? tileRegId ?? 0;
    const pal = REG_PALETTES[regId] || REG_PALETTES[0];
    const group = new THREE.Group();
    group.name = 'World city tile ' + key;
    group.userData.masks = [];
    group.userData.obstacles = [];

    const aptBuf = buffers();
    const houseBuf = buffers();
    const glassBuf = buffers();
    const indBuf = buffers();
    const pitchedBuf = buffers();
    const flatBuf = buffers();
    const heritageBuf = buffers();

    const list = data.b || [];
    for (let idx = 0; idx < list.length; idx++) {
      const item = list[idx];
      const bx = data.x + item[0], bz = data.z + item[1];
      const h = item[2], tone = item[3], kind = item[4], raw = item[5];
      if (!raw || raw.length < 6) continue;
      if (isInAirportZone(bx, bz) || inHeroMask(bx, bz)) continue;

      const pts = [];
      let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
      for (let i = 0; i < raw.length; i += 2) {
        const px = data.x + raw[i], pz = data.z + raw[i + 1];
        pts.push([px, pz]);
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (pz < minZ) minZ = pz;
        if (pz > maxZ) maxZ = pz;
      }
      if (pts.length < 3) continue;

      const gY = safeGround(bx, bz);
      let baseG = gY;
      for (let i = 0; i < pts.length; i++) {
        const gp = safeGround(pts[i][0], pts[i][1]);
        if (gp < baseG) baseG = gp;
      }
      const minY = baseG - 2.6;
      const topY = gY + h;

      if (h >= 10 && typeof BuildingCollision !== 'undefined' && BuildingCollision.add) {
        BuildingCollision.add('wc_' + key, minX, minZ, maxX, maxZ, topY, minY);
      }

      if (group.userData.masks.length < 180) {
        group.userData.masks.push([bx, bz, Math.max(8, Math.max(maxX - minX, maxZ - minZ) * 0.55)]);
      }

      if (kind === 3) {
        // Real pitched-roof residential house!
        const wCol = pickColor(pal.houseWall, tone, 0.3);
        const rCol = pickColor(pal.houseRoof, (tone * 1.37) % 1, 0.2);
        const eaveH = Math.max(2.6, h - Math.min(3.2, Math.max(1.2, Math.min(maxX - minX, maxZ - minZ) * 0.24)));
        const eaveY = gY + eaveH;
        emitWalls(houseBuf, pts, minY, eaveY, bx, bz, wCol);
        if (pts.length > 5) emitUpPoly(pitchedBuf, pts, eaveY, rCol);
        emitPitchedRoof(pitchedBuf, pts, bx, bz, eaveY, topY, rCol, 0.18);
      } else if (kind === 4) {
        // Cultural temple / shrine / heritage structure with tiered pitched roof
        const wCol = new THREE.Color(0xefe6d8);
        const rCol = pickColor(pal.heritageRoof, tone, 0.1);
        const eaveY = gY + h * 0.62;
        emitWalls(houseBuf, pts, minY, eaveY, bx, bz, wCol);
        if (pts.length > 5) emitUpPoly(heritageBuf, pts, eaveY, rCol);
        emitPitchedRoof(heritageBuf, pts, bx, bz, eaveY, topY, rCol, 0.26);
      } else if (kind === 2) {
        // Industrial warehouse / hangar / station hall
        const wCol = pickColor(pal.indWall, tone, 0.4);
        const rCol = new THREE.Color(0x88939c).offsetHSL(0, 0, (tone - 0.5) * 0.08);
        emitWalls(indBuf, pts, minY, topY - 0.8, bx, bz, wCol);
        emitPitchedRoof(flatBuf, pts, bx, bz, topY - 0.8, topY + 0.6, rCol, 0.08);
      } else if (kind === 1 || kind === 5) {
        // Commercial office / glass skyscraper
        const wCol = pickColor(pal.glassWall, tone, 0.5);
        const rCol = new THREE.Color(0x6c757e);
        emitWalls(glassBuf, pts, minY, topY, bx, bz, wCol);
        emitUpPoly(flatBuf, pts, topY, rCol);
        // Setback crown / rooftop mechanical core on tall towers
        if (h >= 28 && (maxX - minX) > 14 && (maxZ - minZ) > 14) {
          const cw = Math.max(6, (maxX - minX) * 0.42), cd = Math.max(6, (maxZ - minZ) * 0.42), ch = Math.min(7.5, h * 0.08);
          const cap = [[bx - cw / 2, bz - cd / 2], [bx + cw / 2, bz - cd / 2], [bx + cw / 2, bz + cd / 2], [bx - cw / 2, bz + cd / 2]];
          emitWalls(indBuf, cap, topY, topY + ch, bx, bz, rCol);
          emitUpPoly(flatBuf, cap, topY + ch, rCol);
        }
      } else {
        // Concrete apartment / shophouse (`kind === 0`)
        const wCol = pickColor(pal.aptWall, tone, 0.5);
        const rCol = pickColor(pal.aptRoof, (tone * 1.7) % 1, 0.3);
        emitWalls(aptBuf, pts, minY, topY, bx, bz, wCol);
        emitUpPoly(flatBuf, pts, topY, rCol);
        if (h >= 12 && (maxX - minX) > 11 && (maxZ - minZ) > 11 && ((idx & 1) === 0)) {
          const pw = Math.min(8, (maxX - minX) * 0.28), pd = Math.min(8, (maxZ - minZ) * 0.28);
          const pent = [[bx - pw / 2, bz - pd / 2], [bx + pw / 2, bz - pd / 2], [bx + pw / 2, bz + pd / 2], [bx - pw / 2, bz + pd / 2]];
          emitWalls(aptBuf, pent, topY, topY + 2.4, bx, bz, rCol);
          emitUpPoly(flatBuf, pent, topY + 2.4, rCol);
        }
      }

      if ((idx & 255) === 255) yield;
    }

    addLayerMesh(group, aptBuf, aptMat, 'World apartments');
    addLayerMesh(group, houseBuf, houseMat, 'World houses');
    addLayerMesh(group, glassBuf, glassMat, 'World towers');
    addLayerMesh(group, indBuf, indMat, 'World industrial');
    addLayerMesh(group, pitchedBuf, pitchedRoofMat, 'World pitched roofs');
    addLayerMesh(group, flatBuf, flatRoofMat, 'World flat roofs');
    addLayerMesh(group, heritageBuf, heritageMat, 'World heritage roofs');
    return group;
  }

  function* buildRoadChunk(key, data) {
    const group = new THREE.Group();
    group.name = 'World road tile ' + key;
    const out = buffers();
    for (const [width, pts] of (data.s || [])) {
      const half = width * 0.5;
      for (let i = 0; i < pts.length - 2; i += 2) {
        const ax = data.x + pts[i], az = data.z + pts[i + 1];
        const bx = data.x + pts[i + 2], bz = data.z + pts[i + 3];
        if (isInAirportZone((ax + bx) * 0.5, (az + bz) * 0.5)) continue;
        const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
        if (len < 3) continue;
        const raw0 = ground(ax, az), raw1 = ground(bx, bz);
        if (raw0 < 0.35 && raw1 < 0.35) continue;
        const px = -dz / len * half, pz = dx / len * half;
        const y0 = Math.max(0.5, safeGround(ax, az)) + 0.35;
        const y1 = Math.max(0.5, safeGround(bx, bz)) + 0.35;
        const vEnd = len * 0.08;
        pushTri(out, ax - px, y0, az - pz, ax + px, y0, az + pz, bx + px, y1, bz + pz, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 1, vEnd);
        pushTri(out, ax - px, y0, az - pz, bx + px, y1, bz + pz, bx - px, y1, bz - pz, 1, 1, 1, 0, 1, 0, 0, 0, 1, vEnd, 0, vEnd);
      }
    }
    if (out.p.length) addLayerMesh(group, out, roadMat, 'World roads');
    return group;
  }

  // Pitched-roof residential infill geometry for sparse rural/suburban fringes
  function createPitchedHouseGeo() {
    const pts = [];
    const nrms = [];
    const uvs = [];
    const cols = [];
    const addT = (a, b, c, cr, cg, cb) => {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      pts.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      nrms.push(nx / l, ny / l, nz / l, nx / l, ny / l, nz / l, nx / l, ny / l, nz / l);
      uvs.push(0, 0, 1, 0, 0.5, 1);
      cols.push(cr, cg, cb, cr, cg, cb, cr, cg, cb);
    };
    const q = (a, b, c, d, shade) => { addT(a, b, c, shade, shade, shade); addT(a, c, d, shade, shade, shade); };
    const hw = 0.5, hd = 0.5, eh = 0.68, ph = 1.0;
    // 4 vertical walls (tinted neutral wall base; instance color multiplies)
    q([-hw, 0, hd], [hw, 0, hd], [hw, eh, hd], [-hw, eh, hd], 0.96);
    q([hw, 0, -hd], [-hw, 0, -hd], [-hw, eh, -hd], [hw, eh, -hd], 0.88);
    q([hw, 0, hd], [hw, 0, -hd], [hw, eh, -hd], [hw, eh, hd], 0.92);
    q([-hw, 0, -hd], [-hw, 0, hd], [-hw, eh, hd], [-hw, eh, -hd], 0.84);
    // Hipped roof crest (darker roof contrast via vertex color)
    const r = 0.28;
    q([-hw, eh, hd], [hw, eh, hd], [r, ph, 0], [-r, ph, 0], 0.52);
    q([hw, eh, -hd], [-hw, eh, -hd], [-r, ph, 0], [r, ph, 0], 0.44);
    addT([hw, eh, hd], [hw, eh, -hd], [r, ph, 0], 0.48, 0.48, 0.48);
    addT([-hw, eh, -hd], [-hw, eh, hd], [-r, ph, 0], 0.40, 0.40, 0.40);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrms, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    return geo;
  }

  const MAX_INFILL = 1200;
  const infillGeo = createPitchedHouseGeo();
  const infillMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.82,
    metalness: 0.05
  });
  const infillMesh = new THREE.InstancedMesh(infillGeo, infillMat, MAX_INFILL);
  infillMesh.name = 'World suburban houses infill';
  infillMesh.count = 0;
  infillMesh.frustumCulled = false;
  root.add(infillMesh);

  let tiles = [], roadTiles = [], settlementCells = [];
  let tileSize = 4800, cellSize = 120, ready = false;
  const loaded = new Map(), loading = new Set(), jobs = [];
  const loadedRoads = new Map(), loadingRoads = new Set(), roadJobs = [];
  let lastInfillX = 1e9, lastInfillZ = 1e9;
  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();

  const stats = { ready: false, loadedTiles: 0, totalTiles: 0, maskRevision: 0 };

  function markMaskDirty() { stats.maskRevision++; }

  function addTileMasksToStats(tile) {
    if (tile && tile.userData?.masks?.length) markMaskDirty();
  }

  function refreshInfill(x, z, range) {
    if (!settlementCells.length) { infillMesh.count = 0; return; }
    lastInfillX = x; lastInfillZ = z;
    let count = 0;
    const maxR = Math.min(range, 8500);
    const rSq = maxR * maxR;
    for (let i = 0; i < settlementCells.length && count < MAX_INFILL; i++) {
      const [gx, gz, wgt, rid] = settlementCells[i];
      const cx = (gx + 0.5) * cellSize, cz = (gz + 0.5) * cellSize;
      const dx = cx - x, dz = cz - z;
      if (dx * dx + dz * dz > rSq) continue;
      if (isInAirportZone(cx, cz) || inHeroMask(cx, cz)) continue;
      const pal = REG_PALETTES[rid] || REG_PALETTES[0];
      const houses = 4 + wgt * 3;
      const gy = safeGround(cx, cz);
      for (let k = 0; k < houses && count < MAX_INFILL; k++) {
        const s = ((gx * 73856093) ^ (gz * 19349663) ^ (k * 83492791)) >>> 0;
        const ox = cx + (((s & 255) / 255) - 0.5) * (cellSize * 0.85);
        const oz = cz + ((((s >> 8) & 255) / 255) - 0.5) * (cellSize * 0.85);
        const rot = ((s >> 16) & 63) / 64 * Math.PI * 2;
        const w = 8 + ((s >> 22) & 7);
        const d = 7 + ((s >> 25) & 7);
        const h = wgt > 1 ? 8 + (s % 7) : 5.5 + (s % 4);
        dummy.position.set(ox, gy - 1.0, oz);
        dummy.rotation.set(0, rot, 0);
        dummy.scale.set(w, h, d);
        dummy.updateMatrix();
        infillMesh.setMatrixAt(count, dummy.matrix);
        const wc = pal.houseWall[(s >> 3) % pal.houseWall.length];
        tmpColor.setHex(wc);
        infillMesh.setColorAt(count, tmpColor);
        count++;
      }
    }
    infillMesh.count = count;
    infillMesh.instanceMatrix.needsUpdate = true;
    if (infillMesh.instanceColor) infillMesh.instanceColor.needsUpdate = true;
  }

  function blocked(x, z) {
    for (const tile of loaded.values()) {
      for (const [mx, mz, mr] of (tile.userData?.masks || [])) {
        const dx = x - mx, dz = z - mz;
        if (dx * dx + dz * dz < mr * mr) return true;
      }
    }
    return false;
  }

  function releaseTile(map, key) {
    const g = map.get(key);
    if (!g) return;
    if (map === loaded && typeof BuildingCollision !== 'undefined' && BuildingCollision.clearGroup) {
      BuildingCollision.clearGroup('wc_' + key);
    }
    root.remove(g);
    g.traverse(obj => { if (obj.geometry) obj.geometry.dispose(); });
    map.delete(key);
  }

  function update(dt, x, z, quality = 'high', day = 1, wet = false) {
    const night = Math.max(0, Math.min(1, (0.72 - day) * 2.2));
    aptMat.emissiveIntensity = night * 0.85;
    houseMat.emissiveIntensity = night * 0.72;
    glassMat.emissiveIntensity = night * 0.95;
    roadMat.roughness = wet ? 0.35 : 0.92;

    if (!ready || !tiles.length) return;
    const range = quality === 'low' ? 9500 : quality === 'medium' ? 14500 : 21000;
    const maxTiles = quality === 'low' ? 6 : quality === 'medium' ? 12 : 20;
    const rSq = range * range;

    // Prioritize nearest tiles
    const wanted = [];
    for (const rec of tiles) {
      const dx = rec[1] - x, dz = rec[2] - z;
      const dSq = dx * dx + dz * dz;
      if (dSq <= rSq) wanted.push([dSq, rec]);
    }
    wanted.sort((a, b) => a[0] - b[0]);
    const activeKeys = new Set();
    for (let i = 0; i < wanted.length && i < maxTiles; i++) {
      const rec = wanted[i][1];
      const key = rec[0];
      activeKeys.add(key);
      if (!loaded.has(key) && !loading.has(key) && loading.size < 4) {
        loading.add(key);
        fetch('world-city/' + key + '.json?v=70')
          .then(r => (r.ok ? r.json() : null))
          .then(data => {
            if (data) jobs.push({ key, regId: rec[4], it: buildTile(key, data, rec[4]) });
            else loading.delete(key);
          })
          .catch(() => loading.delete(key));
      }
    }
    for (const key of Array.from(loaded.keys())) {
      if (!activeKeys.has(key)) {
        releaseTile(loaded, key);
        markMaskDirty();
      }
    }

    // Stream matching roads
    const roadWanted = new Set();
    for (const rec of roadTiles) {
      const dx = rec[1] - x, dz = rec[2] - z;
      if (dx * dx + dz * dz <= rSq) {
        const key = rec[0];
        roadWanted.add(key);
        if (!loadedRoads.has(key) && !loadingRoads.has(key) && loadingRoads.size < 3) {
          loadingRoads.add(key);
          fetch('world-city/roads/' + key + '.json?v=70')
            .then(r => (r.ok ? r.json() : null))
            .then(data => {
              if (data) roadJobs.push({ key, it: buildRoadChunk(key, data) });
              else loadingRoads.delete(key);
            })
            .catch(() => loadingRoads.delete(key));
        }
      }
    }
    for (const key of Array.from(loadedRoads.keys())) {
      if (!roadWanted.has(key)) releaseTile(loadedRoads, key);
    }

    // Time-budgeted geometry construction
    const deadline = performance.now() + 3.2;
    while (jobs.length && performance.now() < deadline) {
      const job = jobs[0];
      const step = job.it.next();
      if (step.done) {
        jobs.shift();
        loading.delete(job.key);
        if (step.value) {
          root.add(step.value);
          loaded.set(job.key, step.value);
          addTileMasksToStats(step.value);
        }
      }
    }
    while (roadJobs.length && performance.now() < deadline + 1.2) {
      const job = roadJobs[0];
      const step = job.it.next();
      if (step.done) {
        roadJobs.shift();
        loadingRoads.delete(job.key);
        if (step.value) {
          root.add(step.value);
          loadedRoads.set(job.key, step.value);
        }
      }
    }

    stats.loadedTiles = loaded.size;
    if (Math.hypot(x - lastInfillX, z - lastInfillZ) > 950) refreshInfill(x, z, range);
  }

  Promise.all([
    fetch('world-city/index.json?v=70').then(r => (r.ok ? r.json() : null)).catch(() => null),
    fetch('world-city/roads/index.json?v=70').then(r => (r.ok ? r.json() : null)).catch(() => null),
    fetch('world-city/settlements.json?v=70').then(r => (r.ok ? r.json() : null)).catch(() => null)
  ]).then(([idx, rIdx, sIdx]) => {
    if (idx && Array.isArray(idx.tiles)) {
      tiles = idx.tiles;
      tileSize = idx.tileSize || 4800;
      cellSize = idx.cellSize || 120;
      ready = tiles.length > 0;
      stats.ready = ready;
      stats.totalTiles = tiles.length;
    }
    if (rIdx && Array.isArray(rIdx.tiles)) roadTiles = rIdx.tiles;
    if (sIdx && Array.isArray(sIdx.cells)) settlementCells = sIdx.cells;
  });

  const api = { root, inside, blocked, update, stats, REG_PALETTES };
  if (typeof window !== 'undefined') window.__SKYBOUND_WORLD_CITY = api;
  return api;
}
