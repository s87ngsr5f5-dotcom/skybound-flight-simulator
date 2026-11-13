'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

class MockColor {
  constructor(hex = 0) {
    this.hex = hex;
  }
  setHex(h) {
    this.hex = h;
  }
  getHex() {
    return this.hex;
  }
}

class MockMaterial {
  constructor(params = {}) {
    this.isMeshStandardMaterial = true;
    this.color = new MockColor(params.color || 0);
    this.emissive = new MockColor(params.emissive || 0);
    this.emissiveIntensity = params.emissiveIntensity || 0;
    this.roughness = params.roughness || 0.5;
    this.metalness = params.metalness || 0.5;
    this.visible = params.visible !== false;
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
    this.userData = {};
    this.name = '';
  }
  add(child) {
    this.children.push(child);
  }
}

class MockGroup {
  constructor() {
    this.children = [];
    this.position = {
      x: 0, y: 0, z: 0,
      set: (x, y, z) => { this.position.x = x; this.position.y = y; this.position.z = z; }
    };
    this.rotation = {
      x: 0, y: 0, z: 0,
      set: (x, y, z) => { this.rotation.x = x; this.rotation.y = y; this.rotation.z = z; }
    };
    this.userData = {};
    this.name = '';
  }
  add(child) {
    this.children.push(child);
  }
}

const mockTHREE = {
  Group: MockGroup,
  Mesh: MockMesh,
  Vector2: class { constructor(x=0, y=0){ this.x = x; this.y = y; } },
  Vector3: class { constructor(x=0, y=0, z=0){ this.x = x; this.y = y; this.z = z; } },
  Raycaster: class {
    setFromCamera() {}
    intersectObjects() { return []; }
  },
  BoxGeometry: class {},
  CylinderGeometry: class {},
  SphereGeometry: class {},
  MeshStandardMaterial: MockMaterial,
  MeshBasicMaterial: MockMaterial,
  CanvasTexture: class { constructor() { this.needsUpdate = false; } }
};

const mockCtx = {
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  font: '',
  fillRect: () => {},
  strokeRect: () => {},
  fillText: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  stroke: () => {}
};

const mockDoc = {
  createElement: (tag) => {
    if (tag === 'canvas') {
      return { width: 512, height: 384, getContext: () => mockCtx };
    }
    return {
      style: {},
      innerHTML: '',
      addEventListener: () => {}
    };
  },
  body: {
    appendChild: () => {}
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

const code = fs.readFileSync(path.join(__dirname, 'dist', 'cockpit-electrical.js'), 'utf8');
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const elec = sandbox.module.exports;

assert(elec, 'cockpitElectrical must export an object');
assert(typeof elec.buildSwitchPanel === 'function', 'buildSwitchPanel must be a function');
assert(typeof elec.toggleSwitch === 'function', 'toggleSwitch must be a function');
assert(typeof elec.setColdAndDark === 'function', 'setColdAndDark must be a function');
assert(typeof elec.update === 'function', 'update must be a function');
assert(typeof elec.initInteraction === 'function', 'initInteraction must be a function');

console.log('Testing initial state & toggleSwitch...');
assert.strictEqual(elec.state.battery, true, 'Default battery should be ON');
assert.strictEqual(elec.state.busVoltage >= 28.0, true, 'Default bus voltage should be ~28V');

const turnedOff = elec.toggleSwitch('battery');
assert.strictEqual(turnedOff, false, 'Battery should now be OFF');
assert.strictEqual(elec.state.battery, false);

const turnedOn = elec.toggleSwitch('battery');
assert.strictEqual(turnedOn, true, 'Battery should now be ON');
assert.strictEqual(elec.state.battery, true);

console.log('Testing 3D switch panel generation...');
const cabin = new MockGroup();
const panel = elec.buildSwitchPanel(mockTHREE, cabin, false);
assert(panel instanceof MockGroup, 'Switch panel must be a Group');
assert(cabin.children.includes(panel), 'Cabin must contain switch panel');
assert(panel.children.length > 5, 'Panel must have backing plate and individual switches');

console.log('Testing Cold & Dark transition...');
elec.setColdAndDark(true);
assert.strictEqual(elec.state.coldAndDark, true);
assert.strictEqual(elec.state.battery, false);
assert.strictEqual(elec.state.avionics, false);
assert.strictEqual(elec.state.apuRpm, 0);
assert.strictEqual(elec.state.eng1Rpm, 0);
assert.strictEqual(elec.state.gen1Online, false);
assert.strictEqual(elec.state.busVoltage, 0);

console.log('Testing Engine & APU Startup Sequence...');
// 1. Turn on Battery
elec.toggleSwitch('battery');
assert.strictEqual(elec.state.battery, true);
assert.strictEqual(elec.state.busVoltage, 24.0, 'Battery should supply 24V essential DC bus');

// 2. Start APU
elec.toggleSwitch('apu');
for (let i = 0; i < 50; i++) elec.update(0.1, null);
assert(elec.state.apuRpm > 90.0, 'APU RPM should spool up past 90%');
assert.strictEqual(elec.state.busVoltage, 28.0, 'APU Generator should supply 28V');

// 3. Turn on Fuel Pumps
elec.toggleSwitch('fuelPumpL');
elec.toggleSwitch('fuelPumpR');
assert.strictEqual(elec.state.fuelPumpL, true);
assert.strictEqual(elec.state.fuelPumpR, true);

// 4. Trigger Starter 1
elec.toggleSwitch('starter1');
for (let i = 0; i < 50; i++) elec.update(0.1, null);
assert(elec.state.eng1Rpm >= 60.0, 'Engine 1 should reach idle RPM ~62%');
assert.strictEqual(elec.state.gen1Online, true, 'Engine 1 generator should come online');

// 5. Trigger Starter 2
elec.toggleSwitch('starter2');
for (let i = 0; i < 50; i++) elec.update(0.1, null);
assert(elec.state.eng2Rpm >= 60.0, 'Engine 2 should reach idle RPM ~62%');
assert.strictEqual(elec.state.gen2Online, true, 'Engine 2 generator should come online');
assert.strictEqual(elec.state.busVoltage, 28.5, 'Main generators should supply 28.5V');

console.log('Testing flight thrust limit during cold state...');
const mockFlight = { throttle: 0.8, thrustLimited: false };
elec.setColdAndDark(true);
elec.update(0.016, mockFlight);
assert.strictEqual(mockFlight.thrustLimited, true, 'Cold & dark with 0 RPM must limit flight thrust');
assert(mockFlight.throttle <= 0.2, 'Throttle must be constrained when cold');

console.log('Testing Ready for Flight reset...');
elec.setColdAndDark(false);
assert.strictEqual(elec.state.coldAndDark, false);
assert.strictEqual(elec.state.battery, true);
assert.strictEqual(elec.state.eng1Rpm, 62.0);

console.log('All cockpit electrical & interactive switch tests passed successfully!');
