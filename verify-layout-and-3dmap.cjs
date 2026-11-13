'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const distDir = path.join(__dirname, 'dist');
const overviewJs = fs.readFileSync(path.join(distDir, 'taiwan-overview.js'), 'utf8');
const flightJs = fs.readFileSync(path.join(distDir, 'flight.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
const plannerCss = fs.readFileSync(path.join(distDir, 'planner.css'), 'utf8');
const glassCss = fs.readFileSync(path.join(distDir, 'glass-flight.css'), 'utf8');
const mobileCss = fs.readFileSync(path.join(distDir, 'mobile-flight.css'), 'utf8');
const mpCss = fs.readFileSync(path.join(distDir, 'multiplayer.css'), 'utf8');

console.log('1. Testing taiwan-overview.js 3D oblique camera, airways corridors, pillars & declutterLabels...');
// Minimal Three.js mock supporting Vector3, Matrix4, Sprite, OrthographicCamera projection
function makeVec3(x = 0, y = 0, z = 0) {
  return {
    x, y, z,
    set(nx, ny, nz) { this.x = nx; this.y = ny; this.z = nz; return this; },
    copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; },
    clone() { return makeVec3(this.x, this.y, this.z); },
    normalize() {
      const len = Math.hypot(this.x, this.y, this.z) || 1;
      this.x /= len; this.y /= len; this.z /= len; return this;
    },
    setFromMatrixColumn(mat, col) {
      if (col === 0) { this.x = 1; this.y = 0; this.z = 0; }
      else if (col === 1) { this.x = 0; this.y = 0.8; this.z = -0.6; }
      return this;
    },
    project(cam) {
      // Realistic orthographic-like projection onto [-1, 1] using cam frustum & cam lookAt(center)
      const dx = this.x - (cam._lookX || 0);
      const dy = this.y - (cam._lookY || 0);
      const dz = this.z - (cam._lookZ || 0);
      const rx = dx;
      // Rotate Y/Z by tilt when cam.position.y < 660000
      const isTop = cam.position.z === (cam._lookZ || 0);
      const ry = isTop ? -dz : (dy * 0.58 - dz * 0.81);
      const halfW = (cam.right - cam.left) / 2 || 300000;
      const halfH = (cam.top - cam.bottom) / 2 || 265000;
      this.x = rx / halfW;
      this.y = ry / halfH;
      this.z = 0;
      return this;
    }
  };
}
class MockObj {
  constructor() {
    this.position = makeVec3();
    this.rotation = { x: 0, y: 0, z: 0 };
    this.scale = { x: 1, y: 1, z: 1, set(x, y, z) { this.x = x; this.y = y; this.z = z; }, setScalar(s) { this.x = s; this.y = s; this.z = s; } };
    this.center = { x: 0.5, y: 0.5, set(x, y) { this.x = x; this.y = y; } };
    this.children = [];
    this.userData = {};
    this.visible = true;
    this.material = {};
    this.geometry = { dispose() {}, attributes: { position: { array: new Float32Array(6), needsUpdate: false } } };
  }
  add(...args) { this.children.push(...args); }
  remove(o) { const i = this.children.indexOf(o); if (i >= 0) this.children.splice(i, 1); }
  clone() { return new MockObj(); }
  lookAt(x, y, z) { this._lookX = x; this._lookY = y; this._lookZ = z; }
  updateProjectionMatrix() {}
  updateMatrixWorld() {}
}
class MockGeo {
  constructor() { this.attributes = { position: { count: 9, getX: () => 0, getZ: () => 0, setY: () => {}, array: new Float32Array(27), needsUpdate: false } }; }
  rotateX() { return this; }
  translate() { return this; }
  setAttribute() {}
  setFromPoints(pts) { this.attributes.position.array = new Float32Array(pts.length * 3); return this; }
  dispose() {}
}
const mockTHREE = {
  Scene: MockObj,
  Group: MockObj,
  OrthographicCamera: class extends MockObj { constructor(l, r, t, b, n, f) { super(); this.left = l; this.right = r; this.top = t; this.bottom = b; this.up = makeVec3(0, 1, 0); } },
  Color: class { constructor(v) { this.v = v; } copy() { return this; } lerp() { return this; } multiplyScalar() { return this; } toArray() {} },
  PlaneGeometry: MockGeo,
  BufferGeometry: MockGeo,
  CylinderGeometry: MockGeo,
  ShapeGeometry: MockGeo,
  RingGeometry: MockGeo,
  BufferAttribute: class { constructor(a, n) { this.a = a; this.n = n; } },
  Shape: class { moveTo() {} lineTo() {} closePath() {} },
  MeshBasicMaterial: class { constructor(opts) { Object.assign(this, opts); } },
  LineBasicMaterial: class { constructor(opts) { Object.assign(this, opts); } },
  SpriteMaterial: class { constructor(opts) { Object.assign(this, opts); } },
  CanvasTexture: class {},
  Mesh: class extends MockObj { constructor(g, m) { super(); this.geometry = g || new MockGeo(); this.material = m || {}; } },
  Line: class extends MockObj { constructor(g, m) { super(); this.geometry = g || new MockGeo(); this.material = m || {}; } },
  Sprite: class extends MockObj { constructor(m) { super(); this.material = m || {}; } },
  Vector3: function (x, y, z) { return makeVec3(x, y, z); }
};

function geoPoint(lat, lon) {
  return { x: (lon - 120.9) * 101000, z: -(lat - 23.7) * 111000 };
}

const mockDoc = {
  createElement(tag) {
    if (tag === 'canvas') {
      return {
        width: 0, height: 0,
        getContext: () => ({ font: '', measureText: t => ({ width: t.length * 12 }), fillRect() {}, strokeRect() {}, beginPath() {}, roundRect() {}, fill() {}, stroke() {}, fillText() {} })
      };
    }
    return {};
  },
  getElementById: () => ({ hidden: false })
};

const sandbox = {
  THREE: mockTHREE,
  geoPoint,
  regionalHeight: () => 50,
  taiwanSatelliteData: { overview: [-261000, -47700, 387000, 396000] },
  loadTaiwanAtlas: () => Promise.reject(new Error('offline')),
  allAirports: [
    { code: 'RCTP', shortName: '桃園', ...geoPoint(25.0777, 121.2328) },
    { code: 'RCSS', shortName: '松山', ...geoPoint(25.0694, 121.5517) },
    { code: 'RCKH', shortName: '高雄', ...geoPoint(22.5771, 120.3500) },
    { code: 'RCMQ', shortName: '台中', ...geoPoint(24.2647, 120.6206) },
    { code: 'RCYU', shortName: '花蓮', ...geoPoint(24.0231, 121.6178) },
  ],
  airwaysNav: {
    ensureVORCoordinates() {},
    getVORStations: () => [
      { id: 'HLG', ...geoPoint(24.64, 120.78) },
      { id: 'APU', ...geoPoint(25.18, 121.52) },
      { id: 'TNN', ...geoPoint(22.95, 120.20) },
    ],
    civilAirways: [{ id: 'W4', waypoints: ['APU', 'HLG', 'TNN'] }]
  },
  document: mockDoc,
  performance: { now: () => 1000 },
  console,
  Math
};
vm.createContext(sandbox);
vm.runInContext(overviewJs, sandbox);

const ov = sandbox.createTaiwanOverview();
assert.strictEqual(ov.viewState.mode, '3d', 'Overview should default to 3d oblique relief mode');
assert.strictEqual(ov.setViewMode('top'), 'top', 'setViewMode("top") must switch to flat ortho mode');
assert.strictEqual(ov.setViewMode('3d'), '3d', 'setViewMode("3d") must switch back to 3D tilt');

ov.resize(1280, 720);
const zoomRes = ov.zoomBy(1.8);
assert(zoomRes.zoom > 1.7 && zoomRes.scalePx > 100, 'zoomBy must zoom frustum and expand scalePx');
assert.strictEqual(ov.resetView().zoom, 1, 'resetView must restore zoom = 1');

let renderedCount = 0;
ov.draw({ render() { renderedCount++; } }, {
  x: geoPoint(25.07, 121.23).x,
  y: 10500,
  z: geoPoint(25.07, 121.23).z,
  heading: 0.2,
  departure: { code: 'RCTP', ...geoPoint(25.0777, 121.2328) },
  destination: { code: 'RCKH', ...geoPoint(22.5771, 120.3500) },
  route: []
});
assert.strictEqual(renderedCount, 1, 'draw() must render scene cleanly');
assert(ov.airportLabels.get('RCKH').visible, 'Destination label RCKH must stay visible after declutter');
assert(ov.airportLabels.get('RCTP').visible, 'Departure label RCTP must stay visible after declutter');

// Verify crowded APU VOR near RCSS doesn't crash or force overlap
const visibleSprites = [...ov.airportLabels.values(), ...ov.vorLabels].filter(s => s.visible);
assert(visibleSprites.length >= 3, 'Multiple well-separated airport/VOR sprites must remain visible');

console.log('2. Checking HTML, JS, and CSS anti-overlap & 3D overview controls...');
assert(indexHtml.includes('id="ovViewModeBtn"'), 'index.html must expose 3D/top view switch button');
assert(indexHtml.includes('id="ovZoomInBtn"') && indexHtml.includes('id="ovZoomOutBtn"'), 'index.html must expose overview zoom buttons');
assert(!/<details id="multiplayerSection"[^>]*\bopen\b/.test(indexHtml), '#multiplayerSection must be collapsed by default on landing page so primary #fly button stays above fold');
assert(flightJs.includes('--hdr-h'), 'flight.js resize() must sync dynamic --hdr-h CSS variable');
assert(flightJs.includes('setViewMode') && flightJs.includes('zoomBy') && flightJs.includes('panBy'), 'flight.js must wire 3D overview controls');
assert(mpCss.includes('top: var(--hdr-h'), 'multiplayer.css dropdown/combat/formation chips must align below dynamic --hdr-h');
assert(glassCss.includes('#tacticalGuide') && glassCss.includes('left: 39%') && glassCss.includes('92px'), 'glass-flight.css must separate #tacticalGuide from touch controls in both orientations');
assert(plannerCss.includes('#overviewScale') && plannerCss.includes('top: var(--hdr-h'), 'planner.css must anchor #overviewScale safely under header');
assert(mobileCss.includes('top: var(--hdr-h'), 'mobile-flight.css must align overlay panels under header');

console.log('ALL 3D MAP DECLUTTER & LAYOUT CHECKS PASSED!');
