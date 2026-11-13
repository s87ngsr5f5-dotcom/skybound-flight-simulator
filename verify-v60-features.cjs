'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

console.log('1. Verifying Left Turn Controls & Helicopter/Plane Yaw...');
const flightJs = fs.readFileSync(path.join(__dirname, 'dist/flight.js'), 'utf8');
const controlsLine = flightJs.match(/const controls=new Set\(\[([^\]]+)\]\)/);
assert.ok(controlsLine, 'flight.js must define controls Set');
for (const key of ['KeyA', 'KeyD', 'Numpad4', 'Numpad6', 'Numpad8', 'Numpad2', 'ArrowLeft', 'ArrowRight']) {
  assert.ok(controlsLine[1].includes(`'${key}'`), `controls Set must include ${key}`);
}
assert.ok(flightJs.includes('e.target instanceof HTMLSelectElement'), 'flight.js blurs select elements to avoid hijacking arrows');

// Helicopter roll-coupled left turn verification
const heliCtx = vm.createContext({
  console, Math, module: { exports: {} },
  regionalHeight: () => 4, groundHeight: () => 4, flightWind: () => ({ x: 0, z: 0 }),
  fleet: [], runwayCoordinates: () => ({ along: 0, cross: 0 })
});
vm.runInContext(fs.readFileSync(path.join(__dirname, 'dist/physics.js'), 'utf8'), heliCtx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'dist/helicopter.js'), 'utf8'), heliCtx);
const heli = vm.runInContext(`configureHelicopterFlight({aircraft:helicopterProfile,start:'air',departure:{elevation:4},destination:{},regional:true,
  x:0,y:180,z:0,vx:0,vy:0,vz:-40,windVector:{x:0,z:0},heading:0,pitch:-.05,bank:0,pitchRate:0,bankRate:0,yawRate:0,
  power:.58,engines:[true],battery:true,fuel:280,fuelStart:280,elapsed:0,ground:false,parkingBrake:false})`, heliCtx);
heliCtx.heli = heli;
vm.runInContext(`for(let i=0;i<240;i++) stepTrainer(heli,{pitch:0,roll:-1,rudder:0,throttle:0,trim:0},1/120);`, heliCtx);
assert.ok(heli.bank < -0.2, `Helicopter should bank left on roll=-1, got ${heli.bank}`);
assert.ok(heli.heading < -0.15, `Helicopter heading should turn left on ArrowLeft/KeyA roll=-1, got ${heli.heading}`);

// Ground helicopter yaw with rotor up
const heliGround = vm.runInContext(`configureHelicopterFlight({aircraft:helicopterProfile,start:'runway',departure:{elevation:4},destination:{},regional:true,
  x:0,y:5.4,z:0,vx:0,vy:0,vz:0,windVector:{x:0,z:0},heading:0,pitch:0,bank:0,pitchRate:0,bankRate:0,yawRate:0,
  power:.4,engines:[true],battery:true,fuel:280,fuelStart:280,elapsed:0,ground:true,rotorRPM:.8,parkingBrake:false})`, heliCtx);
heliCtx.heliGround = heliGround;
vm.runInContext(`for(let i=0;i<120;i++) stepTrainer(heliGround,{pitch:0,roll:-1,rudder:0,throttle:0,trim:0},1/60);`, heliCtx);
assert.ok(heliGround.heading < -0.15, `Ground helicopter should allow left yaw when rotorRPM>0.35, got ${heliGround.heading}`);

// Fixed-wing Cessna 172S left turn in air & on ground
const planeCtx = vm.createContext({
  Math, Number, Boolean, String, Object, Array, console, module: { exports: {} },
  elevationGrid: new Float32Array(301 * 301),
  limit: (n, a, b) => Math.min(b, Math.max(a, n)),
  wrapAngle: angle => Math.atan2(Math.sin(angle), Math.cos(angle)),
  regionalHeight: () => 0,
  runwayCoordinates: () => ({ along: 0, cross: 0 }),
  cargoBalance: () => ({ shift: 0, mass: 0, problems: [] })
});
planeCtx.window = planeCtx;
planeCtx.global = planeCtx;
vm.runInContext(fs.readFileSync(path.join(__dirname, 'dist/physics.js'), 'utf8'), planeCtx);
const c172 = vm.runInContext(`(()=>{const f=createTrainer(true,0);f.aircraft=trainer;f.ground=false;f.y=500;return f;})()`, planeCtx);
planeCtx.f = c172;
const hStart = c172.heading;
vm.runInContext(`for(let i=0;i<120;i++) stepTrainer(f,{pitch:0,roll:-1,rudder:0,throttle:0.5,trim:0,autoLevel:true,response:0.55,maneuver:1},1/60);`, planeCtx);
const dAir = Math.atan2(Math.sin(c172.heading - hStart), Math.cos(c172.heading - hStart));
assert.ok(c172.bank < -0.25 && dAir < -0.05, `Fixed-wing left roll=-1 should bank and turn left, dH=${dAir}, bank=${c172.bank}`);
// Fixed-wing ground taxi left turn via rudder=-1
const c172g = vm.runInContext(`(()=>{const f=createTrainer(false,0);f.aircraft=trainer;f.ground=true;f.engines=[true];f.battery=true;return f;})()`, planeCtx);
planeCtx.fg = c172g;
const hgStart = c172g.heading;
vm.runInContext(`for(let i=0;i<180;i++) stepTrainer(fg,{pitch:0,roll:0,rudder:-1,throttle:0.9,trim:0,autoLevel:true,response:0.55,maneuver:1},1/60);`, planeCtx);
const dGround = Math.atan2(Math.sin(c172g.heading - hgStart), Math.cos(c172g.heading - hgStart));
assert.ok(dGround < -0.1, `Fixed-wing ground rudder=-1 should steer left, dGround=${dGround}`);
console.log('  PASS: Fixed-wing and Helicopter left turns verified.');

console.log('2. Verifying Volumetric Dynamic 3D Slanted Rain Streaks...');
const wsCtx = { window: {}, Math, Float32Array, console };
vm.createContext(wsCtx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'dist/weather-storm.js'), 'utf8'), wsCtx);
const ws = wsCtx.weatherStorm || wsCtx.window.weatherStorm;
class MockBufferGeometry {
  constructor() { this.attributes = {}; this.drawRange = { start: 0, count: Infinity }; }
  setAttribute(n, a) { this.attributes[n] = a; }
  setDrawRange(s, c) { this.drawRange = { start: s, count: c }; }
}
class MockBufferAttribute { constructor(arr, size) { this.array = arr; this.itemSize = size; this.needsUpdate = false; } }
class MockLineBasicMaterial { constructor(o) { Object.assign(this, o); } }
class MockLineSegments {
  constructor(g, m) { this.type = 'LineSegments'; this.geometry = g; this.material = m; this.position = { set(x, y, z) { this.x = x; this.y = y; this.z = z; } }; }
}
const mockTHREE = {
  BufferGeometry: MockBufferGeometry,
  BufferAttribute: MockBufferAttribute,
  LineBasicMaterial: MockLineBasicMaterial,
  LineSegments: MockLineSegments
};
const rainMesh = ws.createRainMesh(mockTHREE);
assert.equal(rainMesh.type, 'LineSegments', 'Rain must use THREE.LineSegments instead of coarse square PointsMaterial');
assert.ok(rainMesh.userData.count >= 2000, 'Rain streak count should be dense (>=2000)');
assert.ok(rainMesh.geometry.attributes.color, 'Rain streaks must have vertex color gradient');
ws.updateRainMesh(rainMesh, { x: 100, y: 200, z: 300 }, 0.016, 120, { vx: 120, vy: 0, vz: 0, windX: 4, windZ: 0, intensity: 1.0 });
const pos = rainMesh.geometry.attributes.position.array;
const dx = pos[3] - pos[0], dy = pos[4] - pos[1];
assert.ok(dx > 0.5 && dy > 0.1, `High forward airspeed vx=120 must sweep rain streak tail diagonally backward (+dx=${dx.toFixed(2)}, +dy=${dy.toFixed(2)})`);
console.log('  PASS: 3D wind-slanted LineSegments rain streaks verified.');

console.log('3. Verifying All-Taiwan 1:1 Building Tiles & Iconic Landmarks...');
const taiwanDir = path.join(__dirname, 'dist/taiwan-city');
const manifest = JSON.parse(fs.readFileSync(path.join(taiwanDir, 'index.json'), 'utf8'));
assert.equal(manifest.license, 'ODbL-1.0');
assert.ok(manifest.counts.buildings > 400000, `Expected >400k all-Taiwan buildings, got ${manifest.counts.buildings}`);
assert.ok(manifest.tiles.length >= 400, `Expected >=400 tiles across Taiwan, got ${manifest.tiles.length}`);

// Validate sample tiles including dense urban tile & small rural tile
const sortedTiles = [...manifest.tiles].sort((a, b) => b[3] - a[3]);
for (const sample of [sortedTiles[0], sortedTiles[Math.floor(sortedTiles.length / 2)], sortedTiles.at(-1)]) {
  const tileData = JSON.parse(fs.readFileSync(path.join(taiwanDir, `${sample[0]}.json`), 'utf8'));
  assert.equal(tileData.b.length, sample[3]);
  for (const b of tileData.b.slice(0, 50)) {
    const [cx, cz, h, tone, kind, coords] = b;
    assert.ok([cx, cz, h, tone, kind, ...coords].every(Number.isFinite));
    assert.ok(h >= 3.5 && h <= 390);
    assert.ok(coords.length >= 6 && coords.length % 2 === 0);
  }
}

const twCityJs = fs.readFileSync(path.join(__dirname, 'dist/taiwan-city.js'), 'utf8');
assert.ok(twCityJs.includes('MeshPhysicalMaterial') && twCityJs.includes('officeGlass'), 'taiwan-city.js must use Taipei-grade PBR officeGlass');
assert.ok(twCityJs.includes('高雄85大樓') && twCityJs.includes('台中之鑽') && twCityJs.includes('奇美博物館') && twCityJs.includes('故宮南院') && twCityJs.includes('蘭陽博物館') && twCityJs.includes('金門莒光樓'));

for (const htmlName of ['index.html', 'iphone.html']) {
  const html = fs.readFileSync(path.join(__dirname, 'dist', htmlName), 'utf8');
  assert.ok(/taiwan-city\.js\?v=6[0-2]/.test(html), `${htmlName} must include taiwan-city.js?v=60/61/62`);
  const twMatch = html.match(/taiwan-city\.js\?v=6[0-2]/);
  assert.ok(html.indexOf(twMatch[0]) < html.indexOf('flight.js?v=roll31'), `${htmlName} script order check`);
  assert.ok(/>0\.6[0-2]</.test(html), `${htmlName} version badge must be 0.60-0.62`);
}
console.log(`  PASS: Verified ${manifest.counts.buildings} OSM buildings in ${manifest.tiles.length} tiles + landmarks & v0.60 UI.`);
