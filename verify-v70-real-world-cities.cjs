const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const distDir = path.join(__dirname, 'dist');

function readDist(file) {
  return fs.readFileSync(path.join(distDir, file), 'utf8');
}

// 1. Parse syntax for modified scripts
for (const file of ['region.js', 'world-city.js', 'taiwan-city.js', 'flight.js']) {
  const code = readDist(file);
  assert.doesNotThrow(() => new vm.Script(code, { filename: file }), `${file} parses cleanly`);
}

// 2. Execute region.js + building-collision.js + world-city.js in a sandbox
{
  const THREE = (() => {
    class Color {
      constructor(hex = 0xffffff) { this.r = 1; this.g = 1; this.b = 1; this.setHex(hex); }
      setHex(hex) {
        this.r = ((hex >> 16) & 255) / 255;
        this.g = ((hex >> 8) & 255) / 255;
        this.b = (hex & 255) / 255;
        return this;
      }
      clone() { const c = new Color(); c.r = this.r; c.g = this.g; c.b = this.b; return c; }
      offsetHSL(h, s, l) { this.r = Math.max(0, Math.min(1, this.r + l)); this.g = Math.max(0, Math.min(1, this.g + l)); this.b = Math.max(0, Math.min(1, this.b + l)); return this; }
    }
    class Vector2 { constructor(x = 0, y = 0) { this.x = x; this.y = y; } }
    class Object3D {
      constructor() {
        this.children = []; this.userData = {}; this.position = { set() {} }; this.rotation = { set() {} };
        this.scale = { set() {} }; this.matrix = {};
      }
      add(c) { this.children.push(c); }
      remove(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); }
      updateMatrix() {}
      traverse(fn) { fn(this); for (const c of this.children) c.traverse(fn); }
    }
    class Group extends Object3D {}
    class Mesh extends Object3D { constructor(g, m) { super(); this.geometry = g; this.material = m; } }
    class InstancedMesh extends Mesh {
      constructor(g, m, c) { super(g, m); this.count = c; this.instanceMatrix = {}; this.instanceColor = {}; }
      setMatrixAt() {}
      setColorAt() {}
    }
    class BufferGeometry {
      constructor() { this.attrs = {}; }
      setAttribute(k, v) { this.attrs[k] = v; }
      addGroup() {}
      computeBoundingSphere() {}
      dispose() {}
    }
    class Float32BufferAttribute { constructor(a, n) { this.array = a; this.itemSize = n; } }
    class CanvasTexture { constructor() { this.repeat = { set() {} }; } }
    class MeshStandardMaterial { constructor(o) { Object.assign(this, o); } }
    return {
      Color, Vector2, Object3D, Group, Mesh, InstancedMesh, BufferGeometry, Float32BufferAttribute,
      BufferAttribute: Float32BufferAttribute, CanvasTexture, MeshStandardMaterial,
      RepeatWrapping: 1, SRGBColorSpace: 'srgb',
      ShapeUtils: { triangulateShape: (c) => c.length >= 3 ? [[0, 1, 2], ...(c.length >= 4 ? [[0, 2, 3]] : [])] : [] }
    };
  })();

  const sandbox = {
    console, Math, Number, Array, Object, String, Set, Map, Promise, Uint16Array, Float32Array,
    performance: { now: () => 0 },
    atob: s => Buffer.from(s, 'base64').toString('binary'),
    THREE,
    document: {
      createElement: () => ({
        width: 0, height: 0,
        getContext: () => ({ fillStyle: '', fillRect() {} })
      })
    },
    fetch: () => Promise.resolve({ ok: false })
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readDist('elevation.js'), sandbox);
  vm.runInContext(readDist('regional-elevation.js'), sandbox);
  vm.runInContext(readDist('kinmen-elevation.js'), sandbox);
  vm.runInContext(readDist('island-elevation.js'), sandbox);
  vm.runInContext(readDist('narita-elevation.js'), sandbox);
  vm.runInContext(readDist('region.js'), sandbox);
  vm.runInContext(readDist('building-collision.js'), sandbox);
  vm.runInContext(readDist('world-city.js'), sandbox);

  // Verify coastal & reclaimed terrain heights are dry urban ground, and HK Central sits near harborfront
  const checkLand = [
    ['Tokyo Odaiba', 35.625, 139.776, 3, 45],
    ['Osaka Kobe Port', 34.668, 135.215, 3, 45],
    ['Osaka Rinku', 34.412, 135.318, 3, 45],
    ['HK Tsim Sha Tsui', 22.298, 114.172, 3, 45],
    ['HK Central Harborfront', 22.2852, 114.1581, 3, 65],
    ['Okinawa Shuri Peak', 26.217, 127.719, 80, 220],
  ];
  for (const [label, lat, lon, minH, maxH] of checkLand) {
    const p = sandbox.geoPoint(lat, lon);
    const h = sandbox.regionalHeight(p.x, p.z);
    assert.ok(h >= minH && h <= maxH, `${label} terrain height ${h.toFixed(1)}m within [${minH}, ${maxH}]`);
  }

  const scene = new THREE.Group();
  const wc = sandbox.createWorldCity(scene, (x, z) => sandbox.regionalHeight(x, z), sandbox.allAirports);
  assert.ok(wc && wc.root && typeof wc.inside === 'function', 'createWorldCity returns valid API');
  for (const code of ['RJTT', 'RJAA', 'RJBB', 'ROAH', 'VHHH', 'RKSI', 'WSSS', 'RPLL', 'VTBS']) {
    const ap = sandbox.allAirports.find(a => a.code === code);
    assert.ok(ap && wc.inside(ap.lat, ap.lon), `worldCity.inside() covers international hub ${code}`);
  }
  assert.strictEqual(wc.inside(25.0339, 121.5645), false, 'worldCity.inside() returns false for Taipei 101');
  assert.strictEqual(Object.keys(wc.REG_PALETTES).length, 8, 'REG_PALETTES defines palettes for all 8 overseas regions');
}

// 3. Validate extracted real OSM data in dist/world-city/
{
  const wcDir = path.join(distDir, 'world-city');
  const idxPath = path.join(wcDir, 'index.json');
  const roadIdxPath = path.join(wcDir, 'roads', 'index.json');
  const settlePath = path.join(wcDir, 'settlements.json');
  assert.ok(fs.existsSync(idxPath), 'dist/world-city/index.json exists');
  assert.ok(fs.existsSync(roadIdxPath), 'dist/world-city/roads/index.json exists');
  assert.ok(fs.existsSync(settlePath), 'dist/world-city/settlements.json exists');

  const idx = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
  const rIdx = JSON.parse(fs.readFileSync(roadIdxPath, 'utf8'));
  assert.ok(idx.counts.buildings >= 400000, `world-city indexes >= 400k real OSM buildings (actual: ${idx.counts.buildings})`);
  assert.ok(rIdx.counts.ribbons >= 100000, `world-city roads index >= 100k road ribbons (actual: ${rIdx.counts.ribbons})`);

  const expectedRegions = ['JP_TYO', 'JP_KIX', 'JP_OKA', 'HK_HKG', 'KR_ICN', 'SG_SIN', 'PH_MNL', 'TH_BKK'];
  for (const reg of expectedRegions) {
    const rc = idx.regions[reg]?.counts;
    assert.ok(rc, `world-city index includes region ${reg}`);
    assert.ok(rc.buildingsKept >= 15000, `${reg} keeps >= 15,000 real OSM buildings (actual: ${rc.buildingsKept})`);
    assert.ok(rc.taggedHeight >= 1000, `${reg} includes real OSM tagged heights/levels (actual: ${rc.taggedHeight})`);
    assert.ok(rc.roadRibbons >= 3000, `${reg} includes real OSM road ribbons (actual: ${rc.roadRibbons})`);
  }

  // Check every international airport has real OSM building tiles within 18 km
  const regionCode = readDist('region.js');
  const regSb = {
    console, Math, Number, Array, Object, String, Set, Map, Uint16Array,
    atob: s => Buffer.from(s, 'base64').toString('binary')
  };
  regSb.window = regSb; regSb.globalThis = regSb;
  vm.createContext(regSb);
  vm.runInContext(regionCode, regSb);
  for (const code of ['RJTT', 'RJAA', 'RJBB', 'ROAH', 'VHHH', 'RKSI', 'WSSS', 'RPLL', 'VTBS']) {
    const ap = regSb.allAirports.find(a => a.code === code);
    const nearby = idx.tiles.filter(t => Math.hypot(t[1] - ap.x, t[2] - ap.z) < 18000);
    const bCount = nearby.reduce((s, t) => s + t[3], 0);
    assert.ok(nearby.length >= 2 && bCount >= 500, `${code} has ${bCount} real OSM buildings across ${nearby.length} tiles within 18km`);
  }

  // Verify sample tile schema & pitched house presence (kind === 3) + Cloudflare file limits
  let pitchedCount = 0;
  for (let i = 0; i < Math.min(24, idx.tiles.length); i += 3) {
    const tileFile = path.join(wcDir, idx.tiles[i][0] + '.json');
    assert.ok(fs.existsSync(tileFile), `tile file ${idx.tiles[i][0]}.json exists`);
    assert.ok(fs.statSync(tileFile).size < 5 * 1024 * 1024, `tile file ${idx.tiles[i][0]}.json < 5 MB`);
    const td = JSON.parse(fs.readFileSync(tileFile, 'utf8'));
    assert.ok(Array.isArray(td.b) && td.b.length > 0, `tile ${idx.tiles[i][0]} contains buildings`);
    for (const b of td.b) {
      assert.strictEqual(b.length, 6, 'building tuple has [dx, dz, h, tone, kind, coords]');
      assert.ok(b[2] >= 3 && b[5].length >= 6, 'valid building height & polygon coordinates');
      if (b[4] === 3) pitchedCount++;
    }
  }
  assert.ok(pitchedCount > 0, 'real OSM tiles classify low-rise homes as pitched-roof kind=3');
}

// 4. Verify taiwan-city.js, flight.js, index.html, and iphone.html integration
{
  const twCity = readDist('taiwan-city.js');
  assert.ok(twCity.includes('hasWorldOsmCities') && twCity.includes('if(!hasWorldOsmCities)'), 'taiwan-city.js disables radial mock scatter when world-city is active');
  assert.ok(twCity.includes('createInfillPitchedGeometry') && twCity.includes('infillHouseGeo'), 'taiwan-city.js upgrades Taiwan suburban infill houses with pitched roofs');

  const flight = readDist('flight.js');
  assert.ok(flight.includes('createWorldCity'), 'flight.js instantiates worldCity');
  assert.ok(flight.includes('worldCity.update(') && flight.includes('worldCity.blocked?.(x,z)'), 'flight.js streams worldCity and masks trees');
  assert.ok(flight.includes('!(taiwanCity.stats?.ready||worldCity.stats?.ready)'), 'flight.js hides fallback cityLiteVolumes boxes over real OSM cities');

  for (const htmlName of ['index.html', 'iphone.html']) {
    const html = readDist(htmlName);
    const wcPos = html.indexOf('world-city.js?v=70');
    const twPos = html.indexOf('taiwan-city.js?v=62&r=69&u=70');
    assert.ok(wcPos > 0 && twPos > wcPos, `${htmlName} loads world-city.js?v=70 before taiwan-city.js`);
    assert.ok(html.includes('flight.js?v=roll31&r=69&u=70'), `${htmlName} loads cache-busted flight.js`);
  }
}

console.log('verify-v70-real-world-cities: OK (8 real OSM international cities, pitched roofs, regional palettes, coastal terrain & runtime integration verified)');
