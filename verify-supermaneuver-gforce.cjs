'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const mockCtx = {
  fillStyle: '',
  fillRect: () => {},
  clearRect: () => {},
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

console.log('Testing Positive G Blackout & Tunnel Vision Physiology...');
fighterFlight.gForce = 8.2; // +8.2G high-G turn
for (let i = 0; i < 40; i++) {
  sm.stepPhysiology(fighterFlight, 0.05);
}
assert(sm.state.blackout > 0.4, 'Sustained +8.2G must induce blackout / greyout');
assert(sm.state.tunnelVision < 0.8, 'Peripheral vision must constrict into tunnel vision');

// Recovery from G
fighterFlight.gForce = 1.0;
for (let i = 0; i < 40; i++) {
  sm.stepPhysiology(fighterFlight, 0.05);
}
assert(sm.state.blackout < 0.1, 'Blackout must recover when G returns to 1.0');
assert(sm.state.tunnelVision > 0.9, 'Tunnel vision must clear back to full view');

console.log('Testing Negative G Redout Physiology...');
fighterFlight.gForce = -3.2; // -3.2G inverted push
for (let i = 0; i < 30; i++) {
  sm.stepPhysiology(fighterFlight, 0.05);
}
assert(sm.state.redout > 0.4, 'Negative G must induce retinal redout');

// Recovery from negative G
fighterFlight.gForce = 1.0;
for (let i = 0; i < 30; i++) {
  sm.stepPhysiology(fighterFlight, 0.05);
}
assert(sm.state.redout < 0.05, 'Redout must recover quickly');

console.log('Testing Fullscreen Overlay Init & Visual FX Rendering...');
sm.initOverlay();
sm.state.blackout = 0.65;
sm.renderVisualFX();
sm.state.blackout = 0;
sm.state.redout = 0.75;
sm.renderVisualFX();

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
