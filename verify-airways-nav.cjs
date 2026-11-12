'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const regionCode = fs.readFileSync(path.join(__dirname, 'dist', 'region.js'), 'utf8');
const airwaysCode = fs.readFileSync(path.join(__dirname, 'dist', 'airways-nav.js'), 'utf8');

const sandbox = {
  Math,
  limit: (n, a, b) => Math.min(b, Math.max(a, n)),
  console,
  module: { exports: {} }
};
sandbox.window = sandbox;
sandbox.global = sandbox;
vm.createContext(sandbox);

// Run region.js first to get geoPoint & airport definitions
vm.runInContext(regionCode, sandbox);
// Run airways-nav.js
vm.runInContext(airwaysCode, sandbox);

const airwaysNav = sandbox.module.exports || sandbox.airwaysNav || sandbox.window.airwaysNav;
const { geoPoint, taiwanAirports } = sandbox;

console.log('Testing Civil Aviation Airways & VOR Navigation Network (v0.41)...');

// 1. Taiwan VOR/DME Station Database & World Coordinates
console.log('Testing VOR/DME Stations Database...');
{
  assert.ok(Array.isArray(airwaysNav.taiwanVORStations), 'taiwanVORStations must be an array');
  assert.strictEqual(airwaysNav.taiwanVORStations.length, 7, 'Must have 7 major VOR stations');

  airwaysNav.ensureVORCoordinates(geoPoint);

  const apu = airwaysNav.taiwanVORStations.find(v => v.id === 'APU');
  assert.ok(apu, 'APU VOR must exist');
  assert.strictEqual(apu.freq, '112.5', 'APU frequency must be 112.5 MHz');
  assert.ok(typeof apu.x === 'number' && typeof apu.z === 'number', 'APU coordinates must be initialized');

  const hlg = airwaysNav.taiwanVORStations.find(v => v.id === 'HLG');
  assert.ok(hlg, 'HLG VOR must exist');
  assert.strictEqual(hlg.freq, '114.0', 'HLG frequency must be 114.0 MHz');

  console.log(`PASS: 7 VOR stations verified. APU: [${apu.x.toFixed(0)}, ${apu.z.toFixed(0)}], HLG: [${hlg.x.toFixed(0)}, ${hlg.z.toFixed(0)}]`);
}

// 2. VOR Tuning, Radial & DME Distance
console.log('Testing VOR Tuning & DME Radial Calculation...');
{
  const apu = airwaysNav.taiwanVORStations.find(v => v.id === 'APU');
  // Place aircraft 10 NM (18,520m) east of APU
  const testPlane = {
    x: apu.x + 18520,
    y: 1500,
    z: apu.z
  };
  const tuneRes = airwaysNav.tuneVOR('APU', testPlane);
  assert.ok(tuneRes, 'tuneVOR must return telemetry object');
  assert.ok(Math.abs(tuneRes.dmeNM - 10.0) < 0.2, `Expected DME ~10.0 NM, got ${tuneRes.dmeNM.toFixed(2)} NM`);
  assert.strictEqual(tuneRes.lineOfSight, true, 'Aircraft at 1500m must have line-of-sight');
  console.log(`PASS: VOR APU tuned: DME=${tuneRes.dmeNM.toFixed(1)} NM, Radial=${tuneRes.radial}°, ${tuneRes.toFrom}`);
}

// 3. Civil Airways Corridors
console.log('Testing Airways Corridors (W4, B591, A1)...');
{
  assert.ok(Array.isArray(airwaysNav.civilAirways), 'civilAirways must be an array');
  const w4 = airwaysNav.civilAirways.find(a => a.id === 'W4');
  assert.ok(w4, 'Airway W4 must exist');
  assert.strictEqual(JSON.stringify(w4.fixes), JSON.stringify(['TNA', 'HLG', 'MKG']), 'W4 fixes must connect Taipei, Houlong, Makung');
  assert.strictEqual(w4.mea, 5000, 'W4 MEA must be 5000 ft');

  const b591 = airwaysNav.civilAirways.find(a => a.id === 'B591');
  assert.ok(b591, 'Airway B591 must exist');
  assert.strictEqual(b591.fixes.length, 4, 'B591 must have 4 fixes connecting West coast');

  console.log(`PASS: Civil airways corridors verified: W4 (MEA ${w4.mea}'), B591 (MEA ${b591.mea}')`);
}

// 4. 14 NM ILS Approach Feather Cone
console.log('Testing 14 NM ILS Feather Approach Geometry...');
{
  const rctp = taiwanAirports.find(a => a.code === 'RCTP');
  assert.ok(rctp, 'RCTP airport must exist');
  const ils = airwaysNav.getILSFeatherDetails(rctp);
  assert.ok(ils, 'getILSFeatherDetails must return geometry for RCTP');
  assert.strictEqual(ils.coneVertices.length, 3, 'Cone must have 3 vertices');
  assert.strictEqual(ils.glideSlope, 3.0, 'Glide slope must be 3.0 degrees');

  // Outer marker distance verification
  const omDist = Math.hypot(ils.om.x - ils.touchdown.x, ils.om.z - ils.touchdown.z);
  const omNM = omDist / 1852;
  assert.ok(Math.abs(omNM - 4.0) < 0.25, `Outer Marker must be at ~4 NM, got ${omNM.toFixed(2)} NM`);
  assert.ok(ils.om.y > ils.mm.y, 'Outer Marker must be higher than Middle Marker on 3° glide slope');
  console.log(`PASS: RCTP 14 NM ILS Feather verified: OM at ${omNM.toFixed(1)} NM (Alt ${ils.om.y.toFixed(0)}m), MM (Alt ${ils.mm.y.toFixed(0)}m)`);
}

// 5. Precision Approach Lighting (PALS: ALSF-2 & Rabbit Flasher)
console.log('Testing ALSF-2 Precision Runway Lighting & Rabbit Flasher...');
{
  // Mock Three.js environment
  const mockThree = {
    Group: function() { this.children = []; this.add = function(m) { this.children.push(m); }; },
    Mesh: function(geo, mat) { this.geometry = geo; this.material = mat; this.position = { set: () => {} }; },
    BoxGeometry: function() {},
    MeshBasicMaterial: function(opt) { this.color = opt?.color; this.opacity = opt?.opacity ?? 1; this.clone = () => new mockThree.MeshBasicMaterial(opt); }
  };
  const rootGroup = new mockThree.Group();
  const rcss = taiwanAirports.find(a => a.code === 'RCSS');
  const pals = airwaysNav.buildPrecisionLighting(mockThree, rootGroup, rcss);
  assert.ok(pals, 'buildPrecisionLighting must return PALS controller');
  assert.ok(rootGroup.children.length > 0, 'Must attach PALS group to scene');
  assert.ok(pals.palsGroup.children.length > 60, `PALS must generate rich light elements, got ${pals.palsGroup.children.length}`);

  // Test Rabbit flasher update
  pals.updateRabbit(0.1);
  pals.updateRabbit(0.6);
  console.log(`PASS: ALSF-2 Precision Lighting & Rabbit Flasher verified with ${pals.palsGroup.children.length} light nodes`);
}

console.log('ALL AIRWAYS & VOR NAVIGATION TESTS PASSED 100%!\n');
