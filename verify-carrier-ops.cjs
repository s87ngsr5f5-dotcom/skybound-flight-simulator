'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');

const stored = new Map();
globalThis.localStorage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) };
globalThis.clamp = (value, min, max) => Math.max(min, Math.min(max, value));

for (const file of ['elevation', 'physics', 'regional-elevation', 'kinmen-elevation', 'region', 'fleet', 'carrier-ops']) {
  vm.runInThisContext(fs.readFileSync('dist/' + file + '.js', 'utf8'), { filename: file + '.js' });
}

console.log('Testing Carrier Operations (CVN-78 福特號航艦)...');

// 1. Carrier Data Integrity
const carrier = carrierOps.getCarrierData();
assert.equal(carrier.code, 'CVN78');
assert.equal(carrier.deckElevation, 18.5);
assert.equal(carrier.catapults.length, 4);
assert.equal(carrier.wires.length, 4);
assert.equal(carrier.wires[2].id, 3);
assert.ok(carrier.wires[2].grade.includes('OK 3-Wire'));

// 2. Flight Deck Height and Boundaries
assert.equal(carrierOps.isOnDeck(carrier.x, carrier.z), true);
assert.equal(carrierOps.isOnDeck(carrier.x + 200, carrier.z), false);

// Test regionalHeight on carrier deck vs open sea
const deckHeight = regionalHeight(carrier.x, carrier.z);
assert.equal(deckHeight, 18.5, 'Deck elevation must be 18.5m on carrier');
const seaHeight = regionalHeight(carrier.x + 350, carrier.z);
assert.equal(seaHeight, 0, 'Offshore ocean height must be 0m');

// 3. Catapult Spool-Up & 3.5G Launch
const cat1 = carrier.catapults[0];
const catPos = carrierOps.getDeckPoint(cat1.along, cat1.cross, carrier.deckElevation);
const flight = {
  x: catPos.x,
  y: catPos.y,
  z: catPos.z,
  speed: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  heading: carrier.heading,
  power: 1.0, // Full throttle
  parkingBrake: true,
  ground: true,
  tailhook: false
};

let pillMessages = [];
const onPill = (msg) => pillMessages.push(msg);

// Step 1.5 seconds to spool up and trigger launch
for (let i = 0; i < 180; i++) {
  carrierOps.stepCatapult(flight, 1 / 120, onPill);
}
assert.equal(carrierOps.getCatapultState().launching, true, 'Catapult should be in launching state');

// Step through the 2.1 second acceleration stroke (3.5G forward acceleration)
for (let i = 0; i < 250; i++) {
  carrierOps.stepCatapult(flight, 1 / 120, onPill);
}

// After launch stroke, speed must exceed 150 knots (77 m/s) and plane should be airborne
assert.ok(flight.speed > 75, `Launch speed ${flight.speed} m/s must exceed 75 m/s (~150 kts)`);
assert.equal(flight.ground, false, 'Aircraft must be airborne off deck');
assert.ok(flight.vy > 0, 'Aircraft must have positive rate of climb off deck');
assert.equal(carrierOps.getCatapultState().launching, false, 'Catapult shuttle should release at stroke end');

// 4. Tailhook Deployment & Arrested Landing (Wire 3 Trap)
const wire3 = carrier.wires[2]; // Target 3-Wire
const wire3Pos = carrierOps.getDeckPoint(wire3.along, wire3.cross, carrier.deckElevation);

const landingPlane = {
  x: wire3Pos.x,
  y: carrier.deckElevation + 0.3,
  z: wire3Pos.z + 1,
  speed: 68, // ~132 knots typical approach speed
  vx: 0,
  vy: -1.2,
  vz: -68,
  heading: carrier.heading + carrier.angledHeading,
  power: 0.5,
  ground: false,
  tailhook: true // Hook lowered
};

let trapGrade = '';
const onGrade = (grade) => { trapGrade = grade; };

// Initial contact with Wire 3
carrierOps.stepArrestor(landingPlane, 1 / 120, onGrade);
const arrestState = carrierOps.getArrestState();
assert.equal(arrestState.caught, true, 'Wire must catch tailhook');
assert.equal(arrestState.wireId, 3, 'Wire 3 must be caught');
assert.ok(arrestState.grade.includes('OK 3-Wire'), 'Target wire must award OK 3-Wire grade');

// Step until stopped by 2.9G cable tension
let initialZ = landingPlane.z;
for (let i = 0; i < 300 && landingPlane.speed > 0; i++) {
  carrierOps.stepArrestor(landingPlane, 1 / 120, onGrade);
}

assert.equal(landingPlane.speed, 0, 'Aircraft must come to a full stop on deck');
assert.ok(landingPlane.parkingBrake, 'Brakes engaged upon stop');
const stoppingDist = Math.abs(landingPlane.z - initialZ);
assert.ok(stoppingDist < 90, `Stopping distance ${stoppingDist.toFixed(1)}m must be under 90m`);

// 5. Optical FLOLS Meatball calculation
const approachPlane = {
  x: wire3Pos.x,
  y: carrier.deckElevation + 180, // ~180m above deck
  z: carrier.z + 2950 // ~3000m behind carrier
};
const flols = carrierOps.calculateFLOLS(approachPlane);
assert.ok(flols, 'FLOLS should calculate approach');
assert.ok(Math.abs(flols.ballPos) < 0.6, 'Meatball should be centered on glide slope');

console.log('PASS: Carrier Operations (CVN-78 3.5G Catapult, 4-Wire Arrestor Trap, and FLOLS) passed 100%!');
process.exit(0);
