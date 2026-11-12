'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const code = fs.readFileSync('dist/flight-recorder.js', 'utf8');
const sandbox = {
  window: {},
  Math: Math,
  console: console
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const fdr = sandbox.flightRecorder || sandbox.window.flightRecorder;
assert(fdr, 'flightRecorder module should be defined');

console.log('Testing Flight Data Recorder (FDR) Sampling...');
fdr.reset();
assert.equal(fdr.samples.length, 0);

// Mock flight object
const mockFlight = {
  elapsed: 12.5,
  x: 100, y: 150, z: -200,
  vx: 0, vy: -1.2, vz: -65,
  speed: 65,
  pitch: 0.05,
  bank: 0.02,
  power: 0.45,
  flaps: 2,
  gear: true,
  ground: false
};

// Step telemetry
fdr.step(mockFlight, 0.2);
assert.equal(fdr.samples.length, 1);
const s0 = fdr.samples[0];
assert.equal(s0.t, 12.5);
assert.equal(s0.altM, 150);
assert(s0.ias > 0);
assert.equal(s0.vsi, Math.round(-1.2 * 196.85));
assert.equal(s0.gear, 1);
assert.equal(s0.ground, 0);
console.log('PASS: Telemetry sampled accurately with valid physics fields');

// Test Landing Evaluation
console.log('Testing Landing Evaluation & Butter Classification...');

// Test 1: Butter Landing (< 110 fpm, cross < 4.2m)
const butterTD = {
  verticalSpeed: -0.42, // ~-83 fpm
  cross: 1.2,
  along: 240,
  speed: 65,
  pitch: 0.06
};
const butterResult = fdr.evaluateLanding(butterTD, false);
assert(butterResult.butter, 'Should be flagged as Butter Landing');
assert(butterResult.grade.includes('BUTTER'), `Expected BUTTER grade: ${butterResult.grade}`);
assert.equal(butterResult.vsi, 83);
console.log(`PASS: Butter landing verified: ${butterResult.grade} (${butterResult.vsi} fpm)`);

// Test 2: Greaser (< 185 fpm)
const greaserTD = {
  verticalSpeed: -0.75, // ~-148 fpm
  cross: 3.5,
  along: 280,
  speed: 66,
  pitch: 0.05
};
const greaserResult = fdr.evaluateLanding(greaserTD, false);
assert(greaserResult.grade.includes('GREASER'), `Expected GREASER grade: ${greaserResult.grade}`);
console.log(`PASS: Greaser landing verified: ${greaserResult.grade}`);

// Test 3: Standard Airline (< 330 fpm)
const standardTD = {
  verticalSpeed: -1.25, // ~-246 fpm
  cross: 5.0,
  along: 310,
  speed: 68,
  pitch: 0.04
};
const standardResult = fdr.evaluateLanding(standardTD, false);
assert(standardResult.grade.includes('STANDARD'), `Expected STANDARD grade: ${standardResult.grade}`);
console.log(`PASS: Standard airline landing verified: ${standardResult.grade}`);

// Test 4: Hard Landing (> 560 fpm or crash)
const hardTD = {
  verticalSpeed: -3.2, // ~-630 fpm
  cross: 18.0,
  along: 900,
  speed: 80,
  pitch: -0.02
};
const hardResult = fdr.evaluateLanding(hardTD, true);
assert(hardResult.grade.includes('HARD'), `Expected HARD grade: ${hardResult.grade}`);
console.log(`PASS: Hard landing verified: ${hardResult.grade}`);

// Test CSV Export
console.log('Testing CSV Telemetry Export...');
const csv = fdr.exportCSV({ callsign: 'SKY-001' });
assert(csv.startsWith('Time_s,Altitude_m'), 'CSV should contain correct header');
const lines = csv.split('\r\n');
assert(lines.length >= 2, 'CSV should contain at least header and 1 row');
console.log(`PASS: CSV export verified with ${lines.length} lines`);

// Test Canvas Chart Rendering
console.log('Testing Canvas Chart Rendering...');
const mockCtx = {
  clearRect: () => {},
  fillRect: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  stroke: () => {},
  fillText: () => {},
  setLineDash: () => {},
  set strokeStyle(v) {},
  set fillStyle(v) {},
  set lineWidth(v) {},
  set font(v) {}
};
const mockCanvas = { width: 460, height: 160, getContext: () => mockCtx };

// Add a few more samples
for(let t = 13.0; t <= 18.0; t += 0.2){
  mockFlight.elapsed = t;
  mockFlight.y = Math.max(0, 150 - (t - 12.5) * 25);
  if(mockFlight.y === 0) mockFlight.ground = true;
  fdr.step(mockFlight, 0.2);
}

fdr.drawChart(mockCanvas, 'alt');
fdr.drawChart(mockCanvas, 'speed');
fdr.drawChart(mockCanvas, 'gforce');
console.log('PASS: Canvas chart rendering verified for alt, speed, and gforce tabs');

console.log('ALL FDR & DEBRIEFING TESTS PASSED 100%!');
process.exit(0);
