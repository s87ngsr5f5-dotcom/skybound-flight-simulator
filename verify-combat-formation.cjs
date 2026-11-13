'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const distDir = path.join(__dirname, 'dist');
const mpJs = fs.readFileSync(path.join(distDir, 'multiplayer.js'), 'utf8');
const mpCss = fs.readFileSync(path.join(distDir, 'multiplayer.css'), 'utf8');
const indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
const iphoneHtml = fs.readFileSync(path.join(distDir, 'iphone.html'), 'utf8');
const flightJs = fs.readFileSync(path.join(distDir, 'flight.js'), 'utf8');

console.log('1. Loading multiplayer module in sandbox...');
const sandbox = {
  Math, Date, Number, String, Array, Map, Set, console,
  performance: { now: () => 100000 },
  setTimeout, clearTimeout, setInterval, clearInterval,
  module: { exports: {} }
};
sandbox.window = sandbox;
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(mpJs, sandbox);
const mp = sandbox.module.exports;

console.log('2. Verifying computeFormationGuidance()...');
const leader = {
  id: 'leader-1',
  callsign: 'VIPER-1',
  aircraftId: 'f16',
  state: { x: 0, y: 1200, z: -1000, heading: 0, speed: 160 }
};
// Ownship trailing 500 m behind & left -> should bank right (+) and accelerate (+)
const own = { x: -80, y: 1100, z: -300, heading: 0, speed: 120, vy: 0 };
const guidance = mp.computeFormationGuidance(own, leader, 180, 55);
assert(guidance, 'computeFormationGuidance must return guidance object');
assert(guidance.slotDist > 400, 'slotDist should reflect remaining distance to formation slot');
assert(guidance.roll > 0, 'ownship left of slot should bank right toward slot');
assert(guidance.throttle > 0, 'slower ownship should add throttle to catch up');
assert(guidance.pitch > 0, 'lower ownship should pitch up toward leader altitude');

console.log('3. Verifying destroyPeer3D billboard.sprite cleanup on leave...');
let removedObjects = [];
const mockParent = { remove: (obj) => removedObjects.push(obj) };
let disposedCount = 0;
const mockSprite = {
  parent: mockParent,
  material: {
    map: { dispose: () => { disposedCount++; } },
    dispose: () => { disposedCount++; }
  }
};
mp.joinRoom('TESTROOM', 'SKY-01');
mp.injectPeer({
  id: 'ghost-peer',
  callsign: 'GHOST',
  state: { x: 0, y: 500, z: 0 },
  mesh: { parent: mockParent },
  billboard: { sprite: mockSprite, updateLabel: () => {} }
});
mp.handleIncomingMessage({ type: 'leave', sender: 'ghost-peer', roomId: 'TESTROOM' });
assert(removedObjects.includes(mockSprite), 'destroyPeer3D must detach peer.billboard.sprite from scene parent');
assert.strictEqual(disposedCount, 2, 'destroyPeer3D must dispose sprite texture and material');
mp.leaveRoom();

console.log('4. Verifying iphone.html anti-zoom sync...');
assert(/maximum-scale=1/.test(iphoneHtml) && /user-scalable=no/.test(iphoneHtml), 'iphone.html must sync anti-zoom viewport meta');
assert(/touch-action:\s*manipulation/.test(iphoneHtml), 'iphone.html must disable double-tap zoom');

console.log('5. Verifying HUD formation chip, 3D multiplayer projectiles & combat wiring...');
assert(/id="hudFormationChip"/.test(indexHtml), 'index.html must include #hudFormationChip');
assert(/mp-follow-btn/.test(mpCss) && /hud-formation-chip/.test(mpCss), 'multiplayer.css must style formation chip and follow toggle');
assert(/function spawnMpEffect\(/.test(flightJs), 'flight.js must define spawnMpEffect()');
assert(/function updateMpProjectiles\(/.test(flightJs), 'flight.js must define updateMpProjectiles()');
assert(/enemy_fire_missile/.test(flightJs) && /enemy_fire_gun/.test(flightJs), 'flight.js must render incoming multiplayer combat events');

console.log('ALL FORMATION AUTOPILOT & COMBAT SYNC CHECKS PASSED!');
