'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let fillCalls = 0;
let clearCalls = 0;
const mockCtx = {
  fillStyle: '',
  fillRect: () => { fillCalls++; },
  clearRect: () => { clearCalls++; },
  createRadialGradient: () => ({
    addColorStop: () => {}
  })
};

const mockCanvas = {
  width: 1920,
  height: 1080,
  style: {},
  getContext: () => mockCtx
};

const mockDoc = {
  createElement: (tag) => {
    if (tag === 'canvas') return mockCanvas;
    return {
      id: '',
      style: {},
      innerHTML: '',
      appendChild: () => {}
    };
  },
  body: {
    appendChild: () => {}
  }
};

const mockWindow = {
  innerWidth: 1920,
  innerHeight: 1080,
  addEventListener: () => {}
};

const sandbox = {
  document: mockDoc,
  window: mockWindow,
  console: console,
  module: { exports: {} }
};
sandbox.window = sandbox;

const code = fs.readFileSync(path.join(__dirname, 'dist', 'supermaneuver-gforce.js'), 'utf8');
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const sm = sandbox.module.exports;

assert(sm, 'supermaneuverGforce must export an object');
assert(typeof sm.initOverlay === 'function', 'initOverlay must be a function');
assert(typeof sm.toggleCobraArmed === 'function', 'toggleCobraArmed must be a function');
assert(typeof sm.computeSupermaneuverAero === 'function', 'computeSupermaneuverAero must be a function');
assert(typeof sm.stepPhysiology === 'function', 'stepPhysiology must be a function');
assert(typeof sm.renderVisualFX === 'function', 'renderVisualFX must be a function');
assert(typeof sm.update === 'function', 'update must be a function');

console.log('Testing Cobra Armed Toggle for Fighter vs Non-Fighter...');
const civilianFlight = { aircraft: { role: 'passenger' } };
assert.strictEqual(sm.toggleCobraArmed(civilianFlight), false, 'Civilian aircraft cannot arm Cobra');

const fighterFlight = {
  aircraft: { role: 'fighter', stallAngle: 0.28, vortexFactor: 1.2 },
  ground: false,
  vx: 0,
  vy: 0,
  vz: -130, // ~250 knots
  pitch: 0.1,
  pitchRate: 0,
  gForce: 1.0
};
assert.strictEqual(sm.toggleCobraArmed(fighterFlight), true, 'Fighter aircraft should arm Cobra');
assert.strictEqual(sm.state.cobraArmed, true);

console.log('Testing Cobra Maneuver Aerodynamics & High-AoA Pitch Up...');
// Trigger pull up
fighterFlight.pitch = 0.55;
sm.computeSupermaneuverAero(fighterFlight, 0.05);
assert.strictEqual(sm.state.cobraActive, true, 'Cobra maneuver must activate');
assert(sm.state.cobraDrag > 2.0, 'Airbrake form drag must increase drastically during Cobra');

// Advance Cobra timer into recovery phase
for (let i = 0; i < 25; i++) {
  sm.computeSupermaneuverAero(fighterFlight, 0.06);
}
assert(fighterFlight.pitchRate < 0, 'Auto-recovery nose-down restoring moment must be generated');

console.log('Testing Leading-Edge Vortex Lift (LERX)...');
fighterFlight.pitch = 0.75;
const aero = sm.computeSupermaneuverAero(fighterFlight, 0.016);
assert(aero.vortexLift > 0.5, 'Vortex lift must provide substantial high-AoA lift');

console.log('Testing Positive & Negative G without Blackout, Tunnel Vision, or Redout...');
fighterFlight.gForce = 8.2; // +8.2G high-G turn
for (let i = 0; i < 40; i++) {
  sm.stepPhysiology(fighterFlight, 0.05);
}
assert.strictEqual(sm.state.blackout, 0, 'Blackout visual effect must remain disabled');
assert.strictEqual(sm.state.tunnelVision, 1.0, 'Tunnel vision constriction must remain disabled');
assert.strictEqual(sm.state.audioMuffle, 0, 'Audio muffle must remain disabled');

fighterFlight.gForce = -3.2; // -3.2G inverted push
for (let i = 0; i < 30; i++) {
  sm.stepPhysiology(fighterFlight, 0.05);
}
assert.strictEqual(sm.state.redout, 0, 'Negative-G redout effect must remain disabled');

console.log('Testing Fullscreen Overlay Remains Clear (No Red/Dark Fill)...');
sm.initOverlay();
assert.strictEqual(mockCanvas.style.display, 'none', 'Overlay canvas should remain hidden');
fillCalls = 0;
clearCalls = 0;
sm.renderVisualFX();
assert.strictEqual(clearCalls, 1, 'renderVisualFX should only clear any residual frame');
assert.strictEqual(fillCalls, 0, 'renderVisualFX must never draw blackout or redout overlays');

console.log('Testing physics.js Integration with High-AoA & Cobra limits...');
const physicsCode = fs.readFileSync(path.join(__dirname, 'dist', 'physics.js'), 'utf8');
const physSandbox = {
  console: console,
  Math: Math,
  Object: Object,
  Boolean: Boolean,
  Number: Number,
  String: String
};
vm.createContext(physSandbox);
vm.runInContext(physicsCode, physSandbox);

assert(typeof physSandbox.flightSpeeds === 'function', 'flightSpeeds must be exported');
assert(typeof physSandbox.atmosphere === 'function', 'atmosphere must be exported');
assert(typeof physSandbox.createTrainer === 'function', 'createTrainer must be exported');

console.log('All supermaneuverability, vortex lift & G-force tests passed successfully!');
