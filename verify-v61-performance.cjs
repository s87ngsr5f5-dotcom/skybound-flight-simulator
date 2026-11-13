'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

console.log('1. Verifying HiDPI Sharpness, Micro-Detail Shader & Satellite Tile Upgrades...');
const flightJs = fs.readFileSync(path.join(__dirname, 'dist/flight.js'), 'utf8');
assert.ok(/scale=\{low:\.75,balanced:1\.5,high:2\}/.test(flightJs), 'Desktop balanced DPR scale must be raised to 1.5 and high to 2');
assert.ok(flightJs.includes('Math.max(.88,resolutionScale'), 'Dynamic resolution floor must be >= 0.88 to keep ground crisp');
assert.ok(flightJs.includes('closeFade') && flightJs.includes('detailGain'), 'terrainPhoto shader must include close-range micro-detail enhancement');
assert.ok(flightJs.includes('nextHudDraw=now+33'), 'Main render loop must throttle high-frequency 2D HUD canvas repaints');

const satJs = fs.readFileSync(path.join(__dirname, 'dist/taiwan-satellite.js'), 'utf8');
assert.ok(satJs.includes('Math.min(16,renderer.capabilities.getMaxAnisotropy())'), 'Satellite textures must use up to 16x anisotropy');
assert.ok(satJs.includes("quality==='ultra'?9:quality==='high'?6:quality==='satellite'?5:quality==='balanced'?4:0"), 'Satellite high-res tile ring must supply 4+ high-res 1152px tiles in balanced');

console.log('2. Verifying Zero-Alloc Fast Quad Triangulation & Cached Landmarks...');
for (const file of ['dist/taipei-city.js', 'dist/taiwan-city.js']) {
  const code = fs.readFileSync(path.join(__dirname, file), 'utf8');
  assert.ok(code.includes('function emitUpTri') && code.includes('function triFlat'), `${file} must implement fast allocation-free emitUpTri/triFlat`);
  assert.ok(code.includes('if(n===3){') && code.includes('if(n===4){'), `${file} must bypass ShapeUtils.triangulateShape for triangles & convex quads`);
}
const twJs = fs.readFileSync(path.join(__dirname, 'dist/taiwan-city.js'), 'utf8');
assert.ok(twJs.includes('g.userData.grounded=true'), 'taiwan-city.js must cache landmark ground heights instead of sampling every frame');
assert.ok(twJs.includes('THREE.InstancedMesh') && twJs.includes('refreshInfill'), 'taiwan-city.js must render millions of settlements via batched GPU InstancedMesh');

console.log('3. Verifying Multi-Million All-Taiwan Buildings & Settlements Grid...');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'dist/taiwan-city/index.json'), 'utf8'));
assert.ok(manifest.counts.buildings >= 450000, `Expected >=450k real OSM footprints, got ${manifest.counts.buildings}`);
assert.ok(manifest.counts.settlementCells >= 400000, `Expected >=400k settlement grid cells, got ${manifest.counts.settlementCells}`);
assert.ok(manifest.counts.infillBuildings >= 3000000, `Expected >=3M settlement infill buildings, got ${manifest.counts.infillBuildings}`);
assert.ok(manifest.counts.taiwanTotalBuildings >= 4000000, `Expected >=4M total Taiwan buildings, got ${manifest.counts.taiwanTotalBuildings}`);

const settlements = JSON.parse(fs.readFileSync(path.join(__dirname, 'dist/taiwan-city/settlements.json'), 'utf8'));
assert.equal(settlements.cellSize, 120);
assert.equal(settlements.tileSize, 4800);
assert.equal(settlements.chunkSize, 24000);
assert.ok(Array.isArray(settlements.chunks) && settlements.chunks.length >= 90, `Expected >=90 settlement chunks across Taiwan, got ${settlements.chunks?.length}`);
for (const [ck] of settlements.chunks.slice(0, 10)) {
  const chunkData = JSON.parse(fs.readFileSync(path.join(__dirname, 'dist/taiwan-city/settlements', ck + '.json'), 'utf8'));
  for (const [k, arr] of Object.entries(chunkData.tiles)) {
    assert.equal(arr.length % 3, 0, `Tile ${ck}/${k} stride-3 check`);
    assert.ok(arr.every(Number.isInteger), `Tile ${ck}/${k} integer check`);
  }
}

console.log('4. Benchmarking Fast Polygon Triangulation & GPU InstancedMesh Settlement Placement...');
let triangulateCalls = 0;
let instCounts = [];
class DummyColor {
  constructor(h) { this.r = 0.7; this.g = 0.7; this.b = 0.7; }
  clone() { return new DummyColor(); }
  multiplyScalar() { return this; }
}
class DummyMat { constructor(o) { Object.assign(this, o); } }
class DummyGeom {
  constructor() {
    this.attributes = {
      position: { count: 3, array: new Float32Array(9) },
      normal: { count: 3, array: new Float32Array(9) },
      uv: { count: 3, array: new Float32Array(6) }
    };
  }
  setAttribute(k, v) { this.attributes[k] = v; }
  toNonIndexed() { return new DummyGeom(); }
  applyMatrix4() { return this; }
  addGroup() {}
  translate() {}
  computeBoundingSphere() {}
  clone() { return new DummyGeom(); }
  dispose() {}
}
class DummyVec2 { constructor(x, y) { this.x = x; this.y = y; } }
class DummyObj3D {
  constructor() {
    this.position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
    this.rotation = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
    this.scale = { x: 1, y: 1, z: 1, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
    this.matrix = {};
    this.matrixWorld = {};
    this.children = [];
    this.userData = {};
  }
  add(c) { this.children.push(c); }
  remove() {}
  traverse() {}
  updateMatrix() {}
  updateMatrixWorld() {}
}
class DummyMesh extends DummyObj3D {
  constructor(g, m) { super(); this.geometry = g; this.material = m; }
}
class DummyGroup extends DummyObj3D {}
class DummyInstancedMesh extends DummyObj3D {
  constructor(g, m, maxCount) {
    super();
    this.maxCount = maxCount;
    this.count = 0;
    this.instanceMatrix = { needsUpdate: false };
    this.instanceColor = { needsUpdate: false };
    instCounts.push(this);
  }
  setMatrixAt() {}
  setColorAt() {}
}
const mockDoc = {
  createElement: () => ({
    width: 0, height: 0,
    getContext: () => ({
      fillStyle: '', strokeStyle: '', lineWidth: 1,
      fillRect() {}, strokeRect() {}, clearRect() {}, beginPath() {}, arc() {}, ellipse() {}, fill() {}, stroke() {}, moveTo() {}, lineTo() {},
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} })
    })
  })
};
const ctx = vm.createContext({
  console, Math, Map, Set, Number, Boolean, Array, Promise, Float32Array,
  document: mockDoc,
  performance: { now: () => 0 },
  touchControls: { mode: { value: 'desktop' } },
  latLon: (x, z) => ({ lat: 25.0696 - z / 110772, lon: 121.5525 + x / 100800 }),
  geoPoint: (lat, lon) => ({ x: (lon - 121.5525) * 100800, z: (25.0696 - lat) * 110772 }),
  runwayCoordinates: () => ({ along: 9999, cross: 9999 }),
  airportSurroundingsContains: () => false,
  fetch: (url) => {
    if (url.startsWith('taiwan-city/index.json')) return Promise.resolve({ ok: true, json: () => Promise.resolve(manifest) });
    if (url.startsWith('taiwan-city/settlements.json')) return Promise.resolve({ ok: true, json: () => Promise.resolve(settlements) });
    const cm = url.match(/^taiwan-city\/settlements\/([^?]+)\.json/);
    if (cm) {
      const p = path.join(__dirname, 'dist/taiwan-city/settlements', cm[1] + '.json');
      if (fs.existsSync(p)) return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(fs.readFileSync(p, 'utf8'))) });
    }
    return Promise.resolve({ ok: false, status: 404 });
  },
  THREE: {
    Group: DummyGroup, Color: DummyColor, CanvasTexture: class { constructor() {} },
    RepeatWrapping: 1, SRGBColorSpace: 'srgb', EquirectangularReflectionMapping: 303,
    DoubleSide: 2, Vector2: DummyVec2, BoxGeometry: DummyGeom, CylinderGeometry: DummyGeom,
    ConeGeometry: DummyGeom, SphereGeometry: DummyGeom, ExtrudeGeometry: DummyGeom, Shape: class { moveTo(){} lineTo(){} closePath(){} },
    BufferGeometry: DummyGeom, BufferAttribute: class { constructor(a, w) { this.array = a; this.itemSize = w; this.count = a ? a.length / (w || 3) : 0; } }, Float32BufferAttribute: class { constructor(a, w) { this.array = a; this.itemSize = w; this.count = a ? a.length / (w || 3) : 0; } },
    Mesh: DummyMesh, InstancedMesh: DummyInstancedMesh, Object3D: DummyObj3D,
    MeshStandardMaterial: DummyMat, MeshPhysicalMaterial: DummyMat,
    ShapeUtils: { triangulateShape: () => { triangulateCalls++; return [[0, 1, 2], [0, 2, 3]]; } }
  },
  module: { exports: {} }
});
vm.runInContext(twJs, ctx);
const twCity = ctx.module.exports.createTaiwanCity(new DummyGroup(), () => 18, []);
// Trigger fetch & async settlement resolution around Taichung (lat 24.15, lon 120.67)
const tcPt = ctx.geoPoint(24.15, 120.67);
twCity.update(0.016, tcPt.x, tcPt.z, 'balanced', 1, false);
setImmediate(() => setImmediate(() => {
  twCity.update(0.016, tcPt.x, tcPt.z, 'balanced', 1, false);
  const totalInst = instCounts.reduce((s, im) => s + im.count, 0);
  assert.ok(totalInst >= 1500, `Expected >=1500 active nearby infill instances in Taichung downtown, got ${totalInst}`);
  assert.equal(triangulateCalls, 0, 'Instanced/quad fast path should not invoke ShapeUtils.triangulateShape unnecessarily');

  for (const htmlName of ['index.html', 'iphone.html']) {
    const html = fs.readFileSync(path.join(__dirname, 'dist', htmlName), 'utf8');
    assert.ok(html.includes('>0.61<'), `${htmlName} must display version 0.61`);
    assert.ok(html.includes('taiwan-city.js?v=61'), `${htmlName} must load taiwan-city.js?v=61`);
  }
  console.log(`  PASS: v0.61 verified (${manifest.counts.taiwanTotalBuildings.toLocaleString()} total Taiwan buildings, ${totalInst} live Taichung infill instances in 3 InstancedMeshes).`);
}));
