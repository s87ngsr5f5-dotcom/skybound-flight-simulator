'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const code = fs.readFileSync(path.join(__dirname, 'dist/multiplayer.js'), 'utf8');

let spokenPhrase = null;
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
  location: { origin: 'https://s87ngsr5f5-dotcom.github.io', pathname: '/skybound-global/', search: '' },
  window: {
    speechSynthesis: {
      cancel: () => {},
      speak: (u) => { spokenPhrase = u.text; }
    }
  },
  SpeechSynthesisUtterance: class {
    constructor(text) {
      this.text = text;
    }
  }
};
sandbox.window.window = sandbox.window;

vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const multiplayer = sandbox.module.exports || sandbox.multiplayer;

console.log('1. Testing joinRoom & initial leaderboard...');
multiplayer.joinRoom('DOGFIGHT', 'ACE-01');
const initLb = multiplayer.getLeaderboard();
assert(Array.isArray(initLb), 'Leaderboard must be an array');
assert.strictEqual(initLb.length, 1);
assert.strictEqual(initLb[0].callsign, 'ACE-01');
assert.strictEqual(initLb[0].kills, 0);

console.log('2. Testing recordKillEvent & K/D ranking...');
multiplayer.recordKillEvent('ACE-01', 'BOGEY-99');
multiplayer.recordKillEvent('ACE-01', 'GHOST-02');
multiplayer.recordKillEvent('GHOST-02', 'ACE-01');

const lb = multiplayer.getLeaderboard();
console.log('Leaderboard:', lb);
assert.strictEqual(lb[0].callsign, 'ACE-01', 'ACE-01 must be rank 1');
assert.strictEqual(lb[0].rank, 1);
assert.strictEqual(lb[0].kills, 2);
assert.strictEqual(lb[0].deaths, 1);
assert.strictEqual(lb[0].kd, '2.00');

assert.strictEqual(lb[1].callsign, 'GHOST-02');
assert.strictEqual(lb[1].rank, 2);
assert.strictEqual(lb[1].kills, 1);
assert.strictEqual(lb[1].deaths, 1);

assert.strictEqual(lb[2].callsign, 'BOGEY-99');
assert.strictEqual(lb[2].rank, 3);
assert.strictEqual(lb[2].kills, 0);
assert.strictEqual(lb[2].deaths, 1);

console.log('3. Testing speakTacticalRadio voice callouts...');
let lastCallout = null;
multiplayer.addListener((type, data) => {
  if (type === 'tactical_radio_callout') lastCallout = data;
});

multiplayer.speakTacticalRadio('Splash one! Target destroyed!');
assert.strictEqual(spokenPhrase, 'Splash one! Target destroyed!');
assert.strictEqual(lastCallout, 'Splash one! Target destroyed!');

console.log('4. Testing Room Switch leaderboard reset...');
multiplayer.switchRoom('PEACEFUL-AIR', 'ACE-01');
const resetLb = multiplayer.getLeaderboard();
assert.strictEqual(resetLb.length, 1);
assert.strictEqual(resetLb[0].kills, 0, 'Scores must be cleared when switching rooms');

multiplayer.leaveRoom();
console.log('PASS: All multiplayer combat leaderboard verification tests passed!');
