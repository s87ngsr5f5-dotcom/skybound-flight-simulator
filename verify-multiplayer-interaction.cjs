'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const distDir = path.join(__dirname, 'dist');
const mpJs = fs.readFileSync(path.join(distDir, 'multiplayer.js'), 'utf8');
const mpCss = fs.readFileSync(path.join(distDir, 'multiplayer.css'), 'utf8');
const indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
const flightJs = fs.readFileSync(path.join(distDir, 'flight.js'), 'utf8');

console.log('1. Loading multiplayer module in sandbox...');
const sandbox = {
  Math, Date, Number, String, Array, Map, Set, console,
  setTimeout, clearTimeout, setInterval, clearInterval,
  module: { exports: {} }
};
sandbox.window = sandbox;
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(mpJs, sandbox);
const mp = sandbox.module.exports;

console.log('2. Testing computeFormationRendezvous()...');
const northPeer = {
  id: 'peer-1',
  callsign: 'VIPER-2',
  aircraftId: 'f16',
  state: { x: 1000, y: 1200, z: -2000, heading: 0, speed: 180 }
};
// Heading 0 (North): forward is (0, -1), right is (+1, 0)
// 600 m aft (+600 on z), 90 m right (+90 on x)
const rNorth = mp.computeFormationRendezvous(northPeer, 600, 90);
assert(rNorth, 'computeFormationRendezvous must return target state');
assert(Math.abs(rNorth.x - 1090) < 1e-6, 'Right lateral offset must match heading 0');
assert(Math.abs(rNorth.z - (-1400)) < 1e-6, 'Aft offset must match heading 0');
assert.strictEqual(rNorth.y, 1200);
assert.strictEqual(rNorth.speed, 180);

// Low altitude peer clamps rendezvous floor to >= 150m
const lowPeer = {
  id: 'peer-low',
  callsign: 'ROOKIE-1',
  state: { x: 0, y: 20, z: 0, heading: Math.PI / 2, speed: 40 }
};
const rLow = mp.computeFormationRendezvous(lowPeer, 600, 90);
assert(rLow.y >= 150, 'Rendezvous altitude must stay at or above 150 m floor');
assert(rLow.speed >= 95, 'Rendezvous speed must stay above stall safety floor (95 m/s)');

console.log('3. Testing getNearestPeer()...');
mp.injectPeer(northPeer);
mp.injectPeer(lowPeer);
const nearest = mp.getNearestPeer({ x: 950, z: -1950 });
assert(nearest && nearest.peer.id === 'peer-1', 'getNearestPeer must pick closest peer');

console.log('4. Verifying UI elements, defensive roundRect & responsive styles...');
assert(/if \(ctx\.roundRect\)/.test(mpJs), 'multiplayer.js must guard ctx.roundRect for Safari compatibility');
assert(/id="hudMpRadioHistory"/.test(indexHtml), 'index.html must include #hudMpRadioHistory');
assert(/id="headerMpUnread"/.test(indexHtml), 'index.html must include #headerMpUnread badge');
assert(/function rendezvousWithPeer\(/.test(flightJs), 'flight.js must define rendezvousWithPeer()');
assert(/function appendRadioHistory\(/.test(flightJs), 'flight.js must define appendRadioHistory()');
assert(/mp-rendezvous-btn/.test(mpCss) && /hud-mp-radio-history/.test(mpCss), 'multiplayer.css must style rendezvous button and radio history');

console.log('ALL MULTIPLAYER INTERACTION CHECKS PASSED!');
