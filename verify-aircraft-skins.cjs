'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Mock minimal THREE for node test
class MockTexture {
  constructor(canvas) {
    this.canvas = canvas;
    this.wrapS = 1000;
    this.wrapT = 1000;
    this.repeat = { set: (x, y) => { this.repeatX = x; this.repeatY = y; } };
    this.colorSpace = '';
  }
}

class MockMaterial {
  constructor(params = {}) {
    this.isMeshStandardMaterial = true;
    this.bumpMap = params.bumpMap || null;
    this.bumpScale = params.bumpScale || 0;
    this.metalness = params.metalness || 0;
    this.roughness = params.roughness || 0.8;
    this.clearcoat = 0;
    this.clearcoatRoughness = 0;
    this.needsUpdate = false;
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
  RepeatWrapping: 1000,
  SRGBColorSpace: 'srgb',
  DoubleSide: 2
};

const code = fs.readFileSync(path.join(__dirname, 'dist/aircraft-skins.js'), 'utf8');

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
            createLinearGradient: () => ({ addColorStop: () => {} }),
            roundRect: () => {}
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
const skins = sandbox.module.exports || sandbox.aircraftSkins;

console.log('1. Testing getPanelBumpTexture()...');
const bumpFighter = skins.getPanelBumpTexture(THREE, true);
assert(bumpFighter instanceof MockTexture, 'Must generate CanvasTexture for bump map');
assert.strictEqual(bumpFighter.repeatX, 2);

console.log('2. Testing procedural decal textures...');
const roundel = skins.createRoundelTexture(THREE, true);
assert(roundel instanceof MockTexture, 'Roundel must be a CanvasTexture');
const tailArt = skins.createFighterTailTexture(THREE, { id: 'f16v' });
assert(tailArt instanceof MockTexture, 'Tail artwork must be a CanvasTexture');
const airliner = skins.createAirlinerLiveryTexture(THREE, { id: 'a320neo' });
assert(airliner instanceof MockTexture, 'Airliner livery must be a CanvasTexture');
const trainer = skins.createTrainerLiveryTexture(THREE);
assert(trainer instanceof MockTexture, 'Trainer livery must be a CanvasTexture');

console.log('3. Testing applyLivery() on Fighter (F-16V)...');
const fighterModel = new MockGroup();
const wingMesh = new MockMesh({}, new MockMaterial({ roughness: 0.85, metalness: 0.1 }));
fighterModel.add(wingMesh);

skins.applyLivery(fighterModel, { id: 'f16v', role: 'fighter', geometry: [7.5, 0.85, 4.7] }, THREE);
assert.strictEqual(fighterModel.userData.skinApplied, true, 'Model must be tagged skinApplied');
assert(wingMesh.material.bumpMap !== null, 'Material must have bumpMap assigned');
assert(wingMesh.material.metalness >= 0.45, 'Fighter metalness must be elevated for aerospace alloy');
assert(wingMesh.material.roughness <= 0.40, 'Fighter roughness must be tuned for sheen');
assert.strictEqual(wingMesh.material.clearcoat, 0.85, 'Fighter clearcoat must be applied');

const decalGroup = fighterModel.children.find(c => c.name === 'AircraftSkins_Decals');
assert(decalGroup, 'Decal group must be added to aircraft');
assert(decalGroup.children.length >= 4, 'Must have wing roundels, fuselage decals and tail flash');

console.log('4. Testing applyLivery() on Commercial Airliner (A320neo)...');
const airlinerModel = new MockGroup();
const bodyMesh = new MockMesh({}, new MockMaterial({ roughness: 0.7, metalness: 0.05 }));
airlinerModel.add(bodyMesh);

skins.applyLivery(airlinerModel, { id: 'a320neo', role: 'passenger', geometry: [18.8, 1.98, 17.9] }, THREE);
assert.strictEqual(airlinerModel.userData.skinApplied, true);
assert(bodyMesh.material.metalness >= 0.35, 'Airliner metalness must be elevated');
const airDecals = airlinerModel.children.find(c => c.name === 'AircraftSkins_Decals');
assert(airDecals, 'Airliner decals must be spawned');
assert(airDecals.children.length >= 2, 'Must have fuselage cheatlines on both sides');

console.log('PASS: All aircraft skins & decal verification tests passed!');
