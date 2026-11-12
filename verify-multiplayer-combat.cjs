'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');

const stored = new Map();
globalThis.localStorage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) };
globalThis.clamp = (value, min, max) => Math.max(min, Math.min(max, value));

for (const file of ['elevation', 'physics', 'regional-elevation', 'kinmen-elevation', 'region', 'fleet', 'benchmarks', 'operations', 'tactical']) {
  vm.runInThisContext(fs.readFileSync('dist/' + file + '.js', 'utf8'), { filename: file + '.js' });
}

const multiplayer = require('./dist/multiplayer.js');
globalThis.multiplayer = multiplayer;

console.log('Testing Multiplayer PVP Combat System...');

// 1. Join room
multiplayer.joinRoom('DOGFIGHT-88', 'VIPER-01');
multiplayer.setCombatMode(true);
assert.equal(multiplayer.isCombatMode(), true);

// 3. Create tactical flight
const ap = taiwanAirports.find(a => a.code === 'RCMQ');
const prof = benchmarkFleet.find(a => a.id === 'sf16');
const flight = makeTacticalFlight(ap, prof, 'duel', 0, true, false);
flight.tactical.radar = true;
flight.tactical.armed = true;

// 2. Setup mock peer in room directly in front of flight
const peerPos = tacticalPoint(flight, flight.heading, 2200, 0);
const mockPeer = {
  id: 'pilot_bandit_99',
  callsign: 'BANDIT-99',
  aircraftId: 'm2000',
  state: { x: peerPos.x, y: flight.y, z: peerPos.z, heading: flight.heading, speed: 180, vy: 0 },
  hp: 100,
  isCombat: true
};
multiplayer.injectPeer(mockPeer);

// 4. Radar contacts detection of online peer
const contacts = tacticalContacts(flight);
const peerContact = contacts.find(c => c.id === 'pilot_bandit_99');
assert.ok(peerContact, 'Multiplayer peer must appear in radar contacts');
assert.equal(peerContact.name, '機長 BANDIT-99');
assert.equal(peerContact.isPeer, true);

// 5. Target selection & radar lock
selectTacticalTarget(flight.tactical, peerContact.id);
assert.equal(flight.tactical.selected, 'pilot_bandit_99');

// Advance time to lock onto peer
for (let i = 0; i < 150; i++) stepTactical(flight, 1 / 120);
assert.equal(flight.tactical.lock, 1, 'Target lock must be achieved');

// 6. Fire missile at peer
const fired = tacticalFire(flight);
assert.ok(fired, 'Missile must be fired at locked peer');
assert.equal(flight.tactical.missiles.length, 1);
assert.equal(flight.tactical.missiles[0].target, 'pilot_bandit_99');

// 7. Gun lead calculation against peer
const leadPoint = tacticalGunLead(flight, peerContact);
assert.ok(leadPoint, 'Gun lead point must be computed for airborne peer');

// 8. Damage reception & Kill Feed
let killNotified = false;
multiplayer.addListener((event, data) => {
  if (event === 'kill_feed') killNotified = true;
});

multiplayer.handleIncomingMessage({
  type: 'combat',
  action: 'hit',
  sender: 'pilot_bandit_99',
  roomId: 'DOGFIGHT-88',
  targetId: multiplayer.getLocalId(),
  damage: 100,
  weapon: 'AIM-9X 響尾蛇飛彈',
  callsign: 'BANDIT-99'
});

assert.equal(multiplayer.getLocalHp(), 0, 'HP must drop to 0 on lethal hit');
const feed = multiplayer.getKillFeed();
assert.ok(feed.length > 0, 'Kill feed must record the combat defeat');
assert.equal(feed[0].killer, 'BANDIT-99');

// Clean up
multiplayer.leaveRoom();

console.log('PASS: Multiplayer PVP combat, peer radar acquisition, missile tracking, and kill feed passed!');
process.exit(0);
