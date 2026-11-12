'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const code = fs.readFileSync(path.join(__dirname, 'dist/weather-storm.js'), 'utf8');

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  Date,
  Math,
  JSON,
  performance: { now: () => Date.now() },
  module: { exports: {} },
  window: null,
  AudioContext: class {
    constructor() { this.state = 'running'; this.currentTime = 0; }
    createOscillator() { return { type: '', frequency: { setValueAtTime: () => {} }, connect: () => {}, start: () => {}, stop: () => {} }; }
    createGain() { return { gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => {} }; }
  }
};
sandbox.window = sandbox;

vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const ws = sandbox.module.exports || sandbox.weatherStorm;

let clearedArcCalled = false;
let ridgeDrawn = false;

const mockCtx = {
  clearRect: () => {},
  fillRect: () => {},
  beginPath: () => {},
  arc: () => {},
  fill: () => {},
  stroke: () => { ridgeDrawn = true; },
  moveTo: () => {},
  lineTo: () => {},
  closePath: () => {},
  save: () => {},
  restore: () => {},
  set globalCompositeOperation(v) { if (v === 'destination-out') clearedArcCalled = true; },
  set fillStyle(v) {},
  set strokeStyle(v) {},
  set lineWidth(v) {},
  set lineCap(v) {}
};

const mockCanvas = {
  width: 1920,
  height: 1080,
  getContext: () => mockCtx
};

console.log('1. Testing Droplet Initialization & Density...');
ws.initDroplets(180);
assert.strictEqual(ws.state.droplets.length, 180, 'Must have 180 raindrops');
assert(typeof ws.state.droplets[0].driftVx === 'number', 'Droplet must have lateral drift velocity');

console.log('2. Testing High-Speed Airborne Streamline Physics (IAS = 180 kt)...');
const testDrop = ws.state.droplets[0];
testDrop.x = 0.7;
testDrop.y = 0.6;
testDrop.wiped = 0;

ws.renderCockpitWindshield(mockCanvas, 180, 0.05);
assert(testDrop.y < 0.6, 'Droplet must move upward under high-speed aerodynamic airflow');
assert(testDrop.x > 0.7, 'Droplet on right side (x > 0.5) must diverge outward to the right');
assert(clearedArcCalled, 'Wiper clearing arc must be carved out with destination-out');
assert(ridgeDrawn, 'Water accumulation boundary ridge must be stroked');

console.log('3. Testing Low-Speed Ground Gravity Physics (IAS = 10 kt)...');
testDrop.x = 0.5;
testDrop.y = 0.3;
testDrop.wiped = 0;

ws.renderCockpitWindshield(mockCanvas, 10, 0.05);
assert(testDrop.y > 0.3, 'Droplet must slide downward under gravity when stationary / slow');

console.log('4. Testing Wiper Cycle & Sweep...');
ws.state.wipers.mode = 1;
ws.state.wipers.angle = 0.8;
ws.stepWipers(0.02);
assert(ws.state.wipers.angle !== 0.8, 'Wipers must animate across dt');

console.log('PASS: All windshield raindrop physics & wiper clearing tests passed!');
