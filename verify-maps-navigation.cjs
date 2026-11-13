'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const distDir = path.join(__dirname, 'dist');
const airwaysJs = fs.readFileSync(path.join(distDir, 'airways-nav.js'), 'utf8');
const overviewJs = fs.readFileSync(path.join(distDir, 'taiwan-overview.js'), 'utf8');
const flightJs = fs.readFileSync(path.join(distDir, 'flight.js'), 'utf8');

console.log('1. Verifying airwaysNav.getVORStations() hotfix...');
const navSandbox = { Math, limit: (n, a, b) => Math.min(b, Math.max(a, n)), console, module: { exports: {} } };
navSandbox.window = navSandbox;
navSandbox.global = navSandbox;
vm.createContext(navSandbox);
vm.runInContext(airwaysJs, navSandbox);
assert.strictEqual(typeof navSandbox.airwaysNav.getVORStations, 'function', 'airwaysNav.getVORStations must be exported as a function');
const vors = navSandbox.airwaysNav.getVORStations();
assert(Array.isArray(vors) && vors.length === 7, 'getVORStations() must return the 7 Taiwan VOR stations');

console.log('2. Verifying defensive airportInfrastructure.init call in flight.js...');
assert(/typeof airwaysNav\.getVORStations==='function'\?airwaysNav\.getVORStations\(\):/.test(flightJs), 'flight.js must safely guard getVORStations()');

console.log('3. Verifying #planMap interactive airport selection & ETE dashboard in flight.js...');
assert(/planMap\.canvas\._hitTargets=/.test(flightJs), 'flight.js must maintain clickable #planMap airport hitTargets');
assert(/planMap\.canvas\.addEventListener\('click'/.test(flightJs), 'flight.js must support clicking airports on #planMap');
assert(/EST ETE/.test(flightJs), 'flight.js must display route distance and ETE on #planMap');

console.log('4. Verifying #radar zoom cycling, 45s predictor vector, VOR overlay & peer delta in flight.js...');
assert(/radarZoomModes=\['auto',15000,45000,120000\]/.test(flightJs), 'flight.js must define #radar zoom modes');
assert(/leadDist=Math\.max\(45,f\.speed\|\|60\)\*45/.test(flightJs), 'flight.js must draw ownship 45-second heading predictor vector');
assert(/radar\.fillText\(peer\.callsign\+' '\+pDistStr\+' '\+pAltStr/.test(flightJs), 'flight.js must render peer distance and altitude delta on #radar');

console.log('5. Verifying taiwan-overview.js 3D labels, VOR beacons & pulse ring...');
assert(/function createTagSprite\(/.test(overviewJs), 'taiwan-overview.js must define createTagSprite()');
assert(/airportLabels/.test(overviewJs), 'taiwan-overview.js must create 3D airportLabels');
assert(/vorLabels/.test(overviewJs), 'taiwan-overview.js must create 3D VOR beacon labels');
assert(/peerLabels/.test(overviewJs), 'taiwan-overview.js must create 3D multiplayer peer labels');
assert(/ringMesh/.test(overviewJs), 'taiwan-overview.js must animate ownship pulse ring');

console.log('ALL MAPS, RADAR & VOR HOTFIX CHECKS PASSED!');
