'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const code = fs.readFileSync('dist/air-refueling.js', 'utf8');
const sandbox = {
  console: console,
  Math: Math,
  window: {}
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const aar = sandbox.airRefueling || sandbox.window.airRefueling;
assert(aar, 'airRefueling module should be defined');

console.log('Testing KC-135 Tanker Orbit Navigation...');
const initialZ = aar.tanker.z;
aar.stepTanker(1.0);
assert(aar.tanker.z < initialZ, 'Tanker should progress along north leg');
console.log(`PASS: Tanker cruising at ${aar.tanker.speed} m/s (heading ${aar.tanker.heading.toFixed(2)} rad)`);

console.log('Testing Boom Tip World Coordinate Calculation...');
const tip = aar.getBoomTipWorld();
assert(typeof tip.x === 'number' && typeof tip.y === 'number' && typeof tip.z === 'number');
assert.equal(tip.y, aar.tanker.y - aar.tanker.boomOffset.down);
console.log(`PASS: Boom tip positioned at [${Math.round(tip.x)}, ${Math.round(tip.y)}, ${Math.round(tip.z)}]`);

console.log('Testing Pilot Director Lights (PDI) Guidance...');
// Mock Receiver Aircraft trailing 150m behind
const receiverFar = {
  x: tip.x,
  y: tip.y - 10,
  z: tip.z + 150,
  speed: 128
};
const guideFar = aar.calculateGuidance(receiverFar);
assert(guideFar.range > 140, 'Range should be over 140m');
assert.equal(guideFar.inEnvelope, false, 'Should not be in envelope');
assert.equal(aar.state.lights.fore, true, 'PDI should indicate FORE (fly forward)');
assert.equal(aar.state.lights.up, true, 'PDI should indicate UP (fly up)');
console.log(`PASS: PDI Guidance verified: Range ${guideFar.range}m, Fore=${aar.state.lights.fore}, Up=${aar.state.lights.up}`);

console.log('Testing Contact Envelope Latch & Fuel Transfer...');
// Get fresh tip position
const liveTip = aar.getBoomTipWorld();
const receiverIn = {
  x: liveTip.x + 0.3,
  y: liveTip.y - 0.2,
  z: liveTip.z + 0.5,
  speed: 125,
  vx: 0, vy: 0, vz: -125,
  fuel: 3200,
  fuelCapacity: 8000
};

let pillMessage = '';
const showPill = (msg) => { pillMessage = msg; };

// In each step, receiver moves along with its speed
receiverIn.z -= 125 * 0.5;
aar.stepRefueling(receiverIn, 0.5, showPill);
assert.equal(aar.state.connected, true, 'Receiver should latch into contact envelope');
assert.equal(aar.state.lights.contact, true, 'Contact light should be illuminated');
assert(pillMessage.includes('AAR CONTACT'), `Expected contact toast: ${pillMessage}`);
console.log(`PASS: AAR Contact Latch confirmed: ${pillMessage}`);

console.log('Testing High-Pressure Fuel Flow...');
const fuelBefore = receiverIn.fuel;
receiverIn.z -= 125 * 2.0;
aar.stepRefueling(receiverIn, 2.0, showPill);
const fuelAfter = receiverIn.fuel;
assert(fuelAfter > fuelBefore + 35, `Fuel should increase substantially: before ${fuelBefore}, after ${fuelAfter}`);
console.log(`PASS: Fuel transferred: +${(fuelAfter - fuelBefore).toFixed(1)} kg over 2.0s`);

console.log('Testing Breakout Disconnect Mechanics...');
// Receiver drifts out laterally beyond envelope
receiverIn.z -= 125 * 0.5;
receiverIn.x += 6.5;
aar.stepRefueling(receiverIn, 0.5, showPill);
assert.equal(aar.state.connected, false, 'Should disconnect when exceeding envelope');
assert.equal(aar.state.lights.disconnect, true, 'Disconnect light should be on');
assert(pillMessage.includes('DISCONNECT'), `Expected disconnect toast: ${pillMessage}`);
console.log(`PASS: Disconnect verified: ${pillMessage}`);

console.log('ALL AERIAL REFUELING TESTS PASSED 100%!');
process.exit(0);
