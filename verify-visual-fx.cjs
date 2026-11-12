'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const code = fs.readFileSync(path.join(__dirname, 'dist', 'visual-fx.js'), 'utf8');

const sandbox = {
  Math,
  limit: (n, a, b) => Math.min(b, Math.max(a, n)),
  console,
  module: { exports: {} }
};
sandbox.window = sandbox;
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const visualFX = sandbox.module.exports || sandbox.visualFX || sandbox.window.visualFX;

console.log('Testing Next-Gen Visual Effects & Transonic Shockwave System (v0.42)...');

// Mock Three.js environment
const mockThree = {
  Group: function() { this.children = []; this.add = function(m) { this.children.push(m); }; },
  Mesh: function(geo, mat) {
    this.geometry = geo;
    this.material = mat;
    this.visible = false;
    this.position = { set: () => {}, copy: () => {} };
    this.scale = { set: () => {} };
    this.quaternion = { copy: () => {} };
  },
  CylinderGeometry: function() { this.rotateX = () => {}; },
  RingGeometry: function() {},
  OctahedronGeometry: function() { this.scale = () => {}; },
  MeshBasicMaterial: function(opt) {
    this.color = opt?.color;
    this.opacity = opt?.opacity ?? 1;
    this.transparent = opt?.transparent ?? false;
    this.clone = () => new mockThree.MeshBasicMaterial(opt);
  },
  Euler: function(x, y, z, order) {},
  Quaternion: function() { this.setFromEuler = () => this; this.copy = () => this; },
  Vector3: function(x = 0, y = 0, z = 0) {
    this.x = x; this.y = y; this.z = z;
    this.applyQuaternion = () => this;
  },
  DoubleSide: 2
};

// 1. Transonic Vapor Cone Intensity Curve
console.log('Testing Prandtl-Glauert Transonic Vapor Cone Physics...');
{
  const scene = new mockThree.Group();
  const vfx = visualFX.createTransonicVFX(mockThree, scene);

  // Below transonic zone (Mach 0.75): should have 0 intensity
  const subIntensity = vfx.calculateTransonicIntensity(0.75);
  assert.strictEqual(subIntensity, 0, 'Mach 0.75 must produce 0 vapor cone intensity');

  // Approaching speed of sound (Mach 0.95): partial condensation
  const transIntensity = vfx.calculateTransonicIntensity(0.95);
  assert.ok(transIntensity > 0.4 && transIntensity < 0.6, `Mach 0.95 should produce ~0.5 intensity, got ${transIntensity.toFixed(2)}`);

  // Sonic boom point (Mach 1.00): peak condensation
  const peakIntensity = vfx.calculateTransonicIntensity(1.00);
  assert.strictEqual(peakIntensity, 1.0, 'Mach 1.00 must reach peak 1.0 vapor cone intensity');

  // Far supersonic (Mach 1.40): condensation attached and invisible
  const superIntensity = vfx.calculateTransonicIntensity(1.40);
  assert.strictEqual(superIntensity, 0, 'Mach 1.40 must have 0 vapor cone intensity');

  console.log(`PASS: Transonic vapor cone curve: M0.75=${subIntensity}, M0.95=${transIntensity.toFixed(2)}, M1.00=${peakIntensity}, M1.40=${superIntensity}`);
}

// 2. Afterburner Mach Shock Diamonds Activation
console.log('Testing Afterburner Mach Shock Diamonds...');
{
  const scene = new mockThree.Group();
  const vfx = visualFX.createTransonicVFX(mockThree, scene);

  // Cruise power (0.75 throttle, no boost)
  const cruiseAB = vfx.calculateAfterburnerIntensity(0.75, false);
  assert.strictEqual(cruiseAB, 0, 'No afterburner on cruise power');

  // Full throttle without boost
  const dryFullAB = vfx.calculateAfterburnerIntensity(1.0, false);
  assert.strictEqual(dryFullAB, 0, 'No afterburner without boost engaged');

  // Full throttle with afterburner boost
  const wetFullAB = vfx.calculateAfterburnerIntensity(1.0, true);
  assert.strictEqual(wetFullAB, 1.0, 'Full boost throttle must trigger max afterburner intensity 1.0');

  console.log(`PASS: Afterburner intensity curve verified: Cruise=${cruiseAB}, DryFull=${dryFullAB}, WetBoost=${wetFullAB}`);
}

// 3. Dynamic Scene Graph Updates
console.log('Testing 3D Scene Updates & Shockwave Transformations...');
{
  const scene = new mockThree.Group();
  const vfx = visualFX.createTransonicVFX(mockThree, scene);

  const mockFlight = {
    x: 0,
    y: 5000,
    z: -10000,
    pitch: 0.05,
    heading: 1.57,
    bank: 0.1,
    power: 1.0,
    boost: true,
    ground: false,
    aircraft: {
      role: 'fighter',
      geometry: [7.5, 0.85, 4.8, -0.22, 1, 1.65]
    }
  };
  const speeds = { mach: 1.01 };

  vfx.update(mockFlight, 0.016, speeds);

  // The VFX group must contain vapor cone, shock ring, and 5 diamonds (7 elements)
  assert.strictEqual(vfx.vfxGroup.children.length, 7, 'Must have 7 VFX elements in scene group');
  console.log(`PASS: 3D Scene updates verified with ${vfx.vfxGroup.children.length} active shockwave meshes`);
}

console.log('ALL VISUAL EFFECTS TESTS PASSED 100%!\n');
