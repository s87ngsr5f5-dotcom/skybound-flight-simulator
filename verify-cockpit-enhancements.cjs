'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

class MockTexture {
  constructor(canvas) {
    this.canvas = canvas;
    this.colorSpace = '';
  }
}

class MockMaterial {
  constructor(params = {}) {
    this.isMeshStandardMaterial = true;
    this.isMeshPhysicalMaterial = true;
    this.opacity = params.opacity || 0.5;
    this.emissive = { getHex: () => 0x33ff88 };
    this.emissiveIntensity = 0;
    this.metalness = params.metalness || 0;
    this.roughness = params.roughness || 0.8;
  }
}

class MockMesh {
  constructor(geo, mat) {
    this.isMesh = true;
    this.geometry = geo;
    this.material = mat;
    this.position = { set: (x, y, z) => { this.x = x; this.y = y; this.z = z; } };
    this.rotation = { set: () => {}, x: 0, y: 0, z: 0 };
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
    this.userData = {};
    this.name = '';
  }
  add(...children) {
    this.children.push(...children);
  }
  traverse(fn) {
    fn(this);
    this.children.forEach(c => c.traverse?.(fn));
  }
}

const THREE = {
  CanvasTexture: MockTexture,
  MeshStandardMaterial: MockMaterial,
  MeshPhysicalMaterial: MockMaterial,
  MeshBasicMaterial: MockMaterial,
  Mesh: MockMesh,
  Group: MockGroup,
  PlaneGeometry: class { constructor(w, h) { this.w = w; this.h = h; } },
  SRGBColorSpace: 'srgb',
  DoubleSide: 2
};

const code = fs.readFileSync(path.join(__dirname, 'dist/cockpit-enhancements.js'), 'utf8');

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  Date,
  Math,
  JSON,
  THREE,
  module: { exports: {} },
  window: null,
  document: {
    createElement: (tag) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({
            fillRect: () => {},
            clearRect: () => {},
            beginPath: () => {},
            moveTo: () => {},
            lineTo: () => {},
            stroke: () => {},
            fill: () => {},
            arc: () => {},
            strokeRect: () => {},
            fillText: () => {},
            closePath: () => {},
            bezierCurveTo: () => {},
            createRadialGradient: () => ({ addColorStop: () => {} }),
            createLinearGradient: () => ({ addColorStop: () => {} })
          })
        };
      }
      return {};
    }
  }
};
sandbox.window = sandbox;

vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const ce = sandbox.module.exports || sandbox.cockpitEnhancements;

console.log('1. Testing getWindshieldGlareTexture()...');
const glareTex = ce.getWindshieldGlareTexture(THREE);
assert(glareTex instanceof MockTexture, 'Windshield glare must be CanvasTexture');

console.log('2. Testing getPlacardTexture()...');
const fighterPlacard = ce.getPlacardTexture(THREE, true);
assert(fighterPlacard instanceof MockTexture, 'Fighter placard must be CanvasTexture');
const airlinerPlacard = ce.getPlacardTexture(THREE, false);
assert(airlinerPlacard instanceof MockTexture, 'Airliner placard must be CanvasTexture');

console.log('3. Testing enhanceCockpit() on F-16V...');
const model = new MockGroup();
const cabin = new MockGroup();
model.userData.cabin = cabin;
const dialMesh = new MockMesh({}, new MockMaterial({ metalness: 0.1 }));
cabin.add(dialMesh);

ce.enhanceCockpit(model, { id: 'f16v', role: 'fighter', geometry: [7.5, 0.85, 4.7] }, THREE);
assert.strictEqual(model.userData.cockpitEnhanced, true, 'Model must be marked cockpitEnhanced');

const enhancedGroup = cabin.children.find(c => c.name === 'Cockpit_Enhancements');
assert(enhancedGroup, 'Cockpit_Enhancements group must be added to cabin');
const glareMesh = enhancedGroup.children.find(c => c.name === 'Windshield_Glare');
assert(glareMesh, 'Windshield_Glare mesh must exist in cockpit group');
const placardMesh = enhancedGroup.children.find(c => c.name === 'Cockpit_Placards');
assert(placardMesh, 'Cockpit_Placards mesh must exist in cockpit group');

console.log('4. Testing updateCockpitLighting() day/night transition...');
// Bright day (sunIntensity = 1.0)
ce.updateCockpitLighting(model, 1.0, '12:00');
assert(glareMesh.material.opacity > 0.15, 'Sun glare should be prominent in bright daylight');

// Night (sunIntensity = 0.1)
ce.updateCockpitLighting(model, 0.1, '22:00');
assert(dialMesh.material.emissiveIntensity > 0.5, 'Dial backlight should glow brightly at night');

console.log('PASS: All cockpit enhancements verification tests passed!');
