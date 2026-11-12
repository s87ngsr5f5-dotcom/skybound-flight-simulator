'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const code = fs.readFileSync(path.join(__dirname, 'dist/multiplayer.js'), 'utf8');

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  Date,
  Math,
  JSON,
  URLSearchParams,
  URL,
  performance: { now: () => Date.now() },
  module: { exports: {} },
  location: { origin: 'https://s87ngsr5f5-dotcom.github.io', pathname: '/skybound-global/', search: '?room=DOGFIGHT-01' },
  window: null
};
sandbox.window = sandbox;

vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const multiplayer = sandbox.module.exports || sandbox.multiplayer;

console.log('1. Testing generateCustomRoomId()...');
const customRoom = multiplayer.generateCustomRoomId();
console.log('   Generated:', customRoom);
assert(typeof customRoom === 'string' && /^[A-Z]+-\d{3}$/.test(customRoom), 'Custom room ID format must be PREFIX-NUM');

console.log('2. Testing getPresetRooms()...');
const presets = multiplayer.getPresetRooms();
assert(Array.isArray(presets) && presets.length >= 6, 'Must have at least 6 preset rooms');
const presetIds = presets.map(p => p.id);
assert(presetIds.includes('8888'), 'Preset must include 8888');
assert(presetIds.includes('DOGFIGHT'), 'Preset must include DOGFIGHT');
assert(presetIds.includes('CARRIER'), 'Preset must include CARRIER');
assert(presetIds.includes('REFUEL'), 'Preset must include REFUEL');

console.log('3. Testing getRoomUrl() & parseUrlRoom()...');
const url = multiplayer.getRoomUrl('ACE-777');
assert(url.includes('?room=ACE-777'), 'URL must encode room param');
const parsed = multiplayer.parseUrlRoom();
assert.strictEqual(parsed, 'DOGFIGHT-01', 'Must parse DOGFIGHT-01 from search param');

console.log('4. Testing Room Isolation & switchRoom()...');
multiplayer.joinRoom('ROOM-ALPHA', 'PILOT-1');
assert.strictEqual(multiplayer.getRoomId(), 'ROOM-ALPHA');

// Inject peer into ROOM-ALPHA
multiplayer.injectPeer({
  id: 'peer-alpha-1',
  callsign: 'GHOST-01',
  aircraftId: 'f16v',
  state: { x: 100, y: 1000, z: 200, hp: 100 },
  targetState: { x: 100, y: 1000, z: 200, hp: 100 }
});
assert.strictEqual(multiplayer.getPeers().length, 1, 'Should have 1 peer in ROOM-ALPHA');

// Switch to ROOM-BETA
multiplayer.switchRoom('ROOM-BETA', 'PILOT-1');
assert.strictEqual(multiplayer.getRoomId(), 'ROOM-BETA');
assert.strictEqual(multiplayer.getPeers().length, 0, 'Peers from ROOM-ALPHA must be purged upon switching to ROOM-BETA');

multiplayer.leaveRoom();
console.log('PASS: All custom rooms verification tests passed!');
