'use strict';
const assert = require('node:assert/strict');
const multiplayer = require('./dist/multiplayer.js');

console.log('Testing Multiplayer module...');

// 1. Join room
const roomInfo = multiplayer.joinRoom('TEST88', 'TOPGUN-1');
assert.equal(roomInfo.roomId, 'TEST88');
assert.equal(roomInfo.callsign, 'TOPGUN-1');
assert.equal(multiplayer.getRoomId(), 'TEST88');
assert.equal(multiplayer.getCallsign(), 'TOPGUN-1');
assert.equal(multiplayer.isConnected(), true);

// 2. Broadcast flight state
let broadcastCalled = false;
multiplayer.broadcastFlight({
  x: 100, y: 3500, z: -200, pitch: 0.05, bank: 0.1, heading: 1.57, speed: 220, vy: 2, power: 0.8
}, { id: 'f16v' });

// 3. Radio message
multiplayer.sendRadio('已抵達巡航高度 FL115');
const messages = multiplayer.getRadioMessages();
assert.ok(messages.length > 0);
assert.equal(messages[0].sender, 'TOPGUN-1');
assert.equal(messages[0].text, '已抵達巡航高度 FL115');

// 4. Leave room
multiplayer.leaveRoom();
assert.equal(multiplayer.isConnected(), false);
assert.equal(multiplayer.getRoomId(), '');

console.log('Multiplayer unit test passed successfully!');
