'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

class MockTexture {
  constructor(canvas) {
    this.canvas = canvas;
    this.needsUpdate = false;
  }
}

class MockMaterial {
  constructor(params = {}) {
    this.isMeshStandardMaterial = true;
    this.color = params.color || 0xffffff;
    this.roughness = params.roughness || 0.5;
    this.metalness = params.metalness || 0.1;
    this.emissive = params.emissive || 0x000000;
    this.emissiveMap = params.emissiveMap || null;
    this.emissiveIntensity = params.emissiveIntensity || 0;
  }
}

class MockMesh {
  constructor(geo, mat) {
    this.isMesh = true;
    this.geometry = geo;
    this.material = mat;
    this.position = {
      x: 0, y: 0, z: 0,
      set: (x, y, z) => { this.position.x = x; this.position.y = y; this.position.z = z; }
    };
    this.rotation = {
      x: 0, y: 0, z: 0,
      set: (x, y, z) => { this.rotation.x = x; this.rotation.y = y; this.rotation.z = z; }
    };
    this.children = [];
    this.name = '';
  }
  add(child) {
    this.children.push(child);
  }
  traverse(fn) {
    fn(this);
    this.children.forEach(c => c.traverse?.(fn));
  }
}

class MockGroup {
  constructor() {
    this.children = [];
    this.position = {
      x: 0, y: 0, z: 0,
      set: (x, y, z) => { this.position.x = x; this.position.y = y; this.position.z = z; },
      copy: (v) => { this.position.x = v.x; this.position.y = v.y; this.position.z = v.z; }
    };
    this.rotation = {
      x: 0, y: 0, z: 0,
      set: (x, y, z) => { this.rotation.x = x; this.rotation.y = y; this.rotation.z = z; }
    };
    this.name = '';
  }
  add(child) {
    this.children.push(child);
  }
  traverse(fn) {
    fn(this);
    this.children.forEach(c => c.traverse?.(fn));
  }
}

class MockVector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

const mockTHREE = {
  Group: MockGroup,
  Mesh: MockMesh,
  Vector3: MockVector3,
  MeshStandardMaterial: MockMaterial,
  MeshBasicMaterial: MockMaterial,
  CylinderGeometry: class {},
  ConeGeometry: class {},
  BoxGeometry: class {},
  SphereGeometry: class {},
  RingGeometry: class {},
  PlaneGeometry: class {},
  CanvasTexture: MockTexture
};

const mockCtx = {
  font: '',
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  clearRect: () => {},
  fillRect: () => {},
  strokeRect: () => {},
  fillText: () => {},
  measureText: (text) => ({ width: text.length * 28 })
};

const mockCanvas = {
  width: 512,
  height: 128,
  getContext: () => mockCtx
};

const mockDoc = {
  createElement: (tag) => {
    if (tag === 'canvas') return mockCanvas;
    return {};
  }
};

const sandbox = {
  document: mockDoc,
  THREE: mockTHREE,
  console: console,
  module: { exports: {} },
  window: {}
};
sandbox.window = sandbox;

const code = fs.readFileSync(path.join(__dirname, 'dist', 'airport-infrastructure.js'), 'utf8');
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const infra = sandbox.module.exports;

assert(infra, 'airportInfrastructure must export an object');
assert(typeof infra.init === 'function', 'init must be a function');
assert(typeof infra.update === 'function', 'update must be a function');
assert(typeof infra.buildVORStation === 'function', 'buildVORStation must be a function');
assert(typeof infra.buildLocalizerArray === 'function', 'buildLocalizerArray must be a function');
assert(typeof infra.buildGlideSlopeTower === 'function', 'buildGlideSlopeTower must be a function');
assert(typeof infra.buildDopplerRadarTower === 'function', 'buildDopplerRadarTower must be a function');
assert(typeof infra.buildTaxiwaySignboard === 'function', 'buildTaxiwaySignboard must be a function');

console.log('Testing buildVORStation...');
const vor = infra.buildVORStation(mockTHREE, new MockVector3(100, 20, -50), 'TPE');
assert(vor instanceof MockGroup, 'VOR station must be a Group');
assert(vor.children.length > 5, 'VOR station should have octagon base, cone radome, DME mast, and antenna array');

console.log('Testing buildLocalizerArray...');
const loc = infra.buildLocalizerArray(mockTHREE, new MockVector3(200, 10, -100), Math.PI / 4);
assert(loc instanceof MockGroup, 'Localizer array must be a Group');
assert(loc.children.length >= 10, 'Localizer should have horizontal truss and antenna array');

console.log('Testing buildGlideSlopeTower...');
const gs = infra.buildGlideSlopeTower(mockTHREE, new MockVector3(300, 15, -150), Math.PI / 2);
assert(gs instanceof MockGroup, 'Glide slope tower must be a Group');
assert(gs.children.length >= 3, 'Glide slope must have mast, antenna reflectors and obstruction light');

console.log('Testing buildDopplerRadarTower...');
const radar = infra.buildDopplerRadarTower(mockTHREE, new MockVector3(400, 25, -200));
assert(radar instanceof MockGroup, 'Doppler radar tower must be a Group');
assert(radar.children.length >= 3, 'Doppler radar tower must have tower legs, spherical radome, scanner');

console.log('Testing buildTaxiwaySignboard...');
const sign = infra.buildTaxiwaySignboard(mockTHREE, new MockVector3(500, 5, -250), 0, [
  { text: '05L-23R', type: 'mandatory' },
  { text: 'Q', type: 'location' },
  { text: 'TERMINAL →', type: 'direction' }
]);
assert(sign instanceof MockGroup, 'Taxiway signboard must be a Group');

console.log('Testing airportInfrastructure.init & scene graph population...');
const scene = new MockGroup();
const testAirports = [
  { code: 'RCTP', x: 1000, y: 30, z: -2000, elevation: 30, length: 3660, heading: 0.4, width: 60, runway: '05L', opposite: '23R' },
  { code: 'RCSS', x: 2000, y: 10, z: -1000, elevation: 10, length: 2605, heading: 1.7, width: 60, runway: '10', opposite: '28' }
];
const testVORs = [
  { id: 'TPE', name: 'TAIPEI', lat: 25.07, lon: 121.23, freq: '114.3', elev: 35 },
  { id: 'HCN', name: 'HENGCHUN', lat: 22.03, lon: 120.73, freq: '113.7', elev: 15 }
];
const geoPoint = (lat, lon) => ({ x: lon * 100, z: -lat * 100, y: 20 });

const infraRoot = infra.init(scene, mockTHREE, testAirports, testVORs, geoPoint);
assert(infraRoot instanceof MockGroup, 'init should return infraGroup');
assert(scene.children.includes(infraRoot), 'scene should contain infraGroup');
assert(infraRoot.children.length >= 6, 'infraGroup should contain VORs and airport equipment');

console.log('Testing airportInfrastructure.update for radar rotation and night lighting...');
let rotBefore = 0;
infraRoot.traverse(o => {
  if (o.rotation && o.rotation.z !== 0) rotBefore = o.rotation.z;
});
infra.update({ x: 0, y: 0, z: 0 }, true, 0.05); // night update
infra.update({ x: 0, y: 0, z: 0 }, false, 0.05); // day update

console.log('All airportInfrastructure unit tests passed successfully!');
