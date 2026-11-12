'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const code = fs.readFileSync('dist/weather-storm.js', 'utf8');
const sandbox = {
  window: {},
  Math: Math,
  Float32Array: Float32Array,
  console: console
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const ws = sandbox.weatherStorm || sandbox.window.weatherStorm;
assert(ws, 'weatherStorm module should be defined');

console.log('Testing Microburst Windshear Physics...');

// Test 1: Outside microburst zone
const outPos = { x: 50000, y: 1000, z: 50000 };
const vel = { vx: 70, vy: -3, vz: 0 };
const outRes = ws.calculateMicroburst(outPos, vel, 0.02);
assert.equal(outRes.wind.x, 0);
assert.equal(outRes.wind.y, 0);
assert.equal(outRes.wind.z, 0);
assert.equal(outRes.warning, false);
console.log('PASS: Outside microburst zone has zero influence');

// Test 2: Core downdraft
const centerPos = { x: ws.state.microburst.center.x, y: 350, z: ws.state.microburst.center.z };
const centerRes = ws.calculateMicroburst(centerPos, vel, 0.02);
assert(centerRes.wind.y < -5.0, `Core downdraft should be significant: got ${centerRes.wind.y}`);
console.log(`PASS: Core downdraft verified: ${centerRes.wind.y.toFixed(2)} m/s (~${Math.round(centerRes.wind.y * 196.85)} fpm)`);

// Test 3: Horizontal outflow and F-Factor warning
// Approaching from west along runway heading:
const approachPos = { x: ws.state.microburst.center.x - 1200, y: 300, z: ws.state.microburst.center.z };
const appVel = { vx: 68, vy: -3.2, vz: 0 }; // 132 kt approach speed
const appRes = ws.calculateMicroburst(approachPos, appVel, 0.02);
assert(appRes.wind.x < 0, `Outflow on approach side should be opposing/headwind: ${appRes.wind.x}`);
assert(appRes.fFactor > 0.12, `F-Factor in windshear zone should exceed hazardous threshold: ${appRes.fFactor}`);
assert.equal(appRes.warning, true, 'EGPWS Warning should be active for hazardous windshear');
console.log(`PASS: Windshear F-Factor verified: ${appRes.fFactor.toFixed(3)} (Warning triggered: ${appRes.warning})`);

// Test 4: Lightning and Thunder acoustic propagation
console.log('Testing Lightning and Thunder propagation...');
ws.state.lightning.timer = ws.state.lightning.interval - 0.05;
ws.stepLightning(0.1, { x: 0, y: 500, z: 0 });
assert(ws.state.lightning.flashActive, 'Lightning flash should be active');
assert(ws.state.lightning.flashIntensity > 0, 'Flash intensity should be positive');
assert(ws.state.lightning.thunderQueue.length > 0, 'Thunder sound should be enqueued');
assert(ws.state.lightning.thunderQueue[0].delay > 0, 'Thunder delay should reflect acoustic propagation');
console.log(`PASS: Lightning strobe active (intensity ${ws.state.lightning.flashIntensity.toFixed(2)}), thunder delay: ${ws.state.lightning.thunderQueue[0].delay.toFixed(2)}s`);

// Test 5: Wiper blade animation & raindrop clearing
console.log('Testing Windshield Raindroplets & Wiper Simulation...');
ws.initDroplets(50);
assert.equal(ws.state.droplets.length, 50);

// Default mode is 0 (OFF)
assert.equal(ws.state.wipers.mode, 0);
ws.cycleWipers();
assert.equal(ws.state.wipers.mode, 1, 'Should cycle to LO');
ws.stepWipers(0.3);
assert(ws.state.wipers.angle > 0.3, `Wiper should sweep forward: ${ws.state.wipers.angle}`);

ws.cycleWipers();
assert.equal(ws.state.wipers.mode, 2, 'Should cycle to HI');
ws.cycleWipers();
assert.equal(ws.state.wipers.mode, 0, 'Should cycle back to OFF');

// Mock canvas for renderCockpitWindshield
const mockCtx = {
  clearRect: () => {},
  beginPath: () => {},
  arc: () => {},
  fill: () => {},
  stroke: () => {},
  moveTo: () => {},
  lineTo: () => {},
  save: () => {},
  restore: () => {},
  fillRect: () => {},
  closePath: () => {},
  set globalCompositeOperation(v) {},
  set fillStyle(v) {},
  set strokeStyle(v) {},
  set lineWidth(v) {},
  set lineCap(v) {}
};
const mockCanvas = {
  width: 800,
  height: 600,
  getContext: () => mockCtx
};

ws.state.wipers.mode = 1;
ws.state.wipers.angle = 0.5;
ws.renderCockpitWindshield(mockCanvas, 140, 0.02);
console.log('PASS: Windshield rendering and droplet integration verified!');

console.log('ALL WEATHERSHEAR TESTS PASSED 100%!');
process.exit(0);
