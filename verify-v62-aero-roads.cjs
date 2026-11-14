const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const distDir = path.join(__dirname, 'dist');

function makeMockThree() {
  class BufferGeometry {
    constructor() {
      this.attributes = {};
      this.index = null;
    }
    setAttribute(name, attr) { this.attributes[name] = attr; return this; }
    setIndex(idx) { this.index = Array.isArray(idx) ? { array: idx } : idx; return this; }
    computeVertexNormals() { return this; }
    rotateX() { return this; }
    rotateY() { return this; }
    rotateZ() { return this; }
    translate() { return this; }
    scale() { return this; }
  }
  class Float32BufferAttribute {
    constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; }
  }
  class Vector2 { constructor(x = 0, y = 0) { this.x = x; this.y = y; } }
  class Group {
    constructor() { this.children = []; this.position = { set() {} }; this.rotation = { set() {}, z: 0 }; }
    add(...items) { this.children.push(...items); }
  }
  class Mesh {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
      this.rotation = { x: 0, y: 0, z: 0 };
      this.scale = { x: 1, y: 1, z: 1, set() {} };
    }
  }
  class Object3D {
    constructor() {
      this.position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
      this.rotation = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
      this.matrix = {};
    }
    lookAt() {}
    updateMatrix() {}
  }
  class InstancedMesh {
    constructor(geometry, material, count) {
      this.geometry = geometry; this.material = material; this.count = count;
      this.matrices = [];
    }
    setMatrixAt(i, m) { this.matrices[i] = m; }
  }
  return {
    BufferGeometry,
    Float32BufferAttribute,
    Vector2,
    Group,
    Mesh,
    Object3D,
    InstancedMesh,
    LatheGeometry: class extends BufferGeometry { constructor(pts, seg) { super(); this.pts = pts; this.seg = seg; } },
    CylinderGeometry: class extends BufferGeometry {},
    CircleGeometry: class extends BufferGeometry {},
    TorusGeometry: class extends BufferGeometry {},
    ConeGeometry: class extends BufferGeometry {}
  };
}

// 1. Validate AeroCraft parametric NACA airfoil engine
{
  const THREE = makeMockThree();
  const sandbox = { THREE, window: {}, globalThis: {} };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const code = fs.readFileSync(path.join(distDir, 'aero-aircraft.js'), 'utf8');
  vm.runInNewContext(code, sandbox, { filename: 'aero-aircraft.js' });
  const A = sandbox.AeroCraft;
  assert.ok(A, 'AeroCraft global must be exported');

  const naca = A.nacaSection(24, 0.024, 0.4, 0.12);
  assert.strictEqual(naca.length, 25);
  assert.ok(naca[0][0] > 0.99 && Math.abs(naca[12][0]) < 0.01, 'NACA airfoil traverses TE -> LE -> TE');

  const wingGeo = A.buildWingLoft([
    { x: 0.5, y: 0.0, leadZ: -1.0, chord: 2.2, thick: 0.12, camber: 0.025 },
    { x: 5.5, y: 0.35, leadZ: 0.1, chord: 1.1, thick: 0.09, camber: 0.015 }
  ], { slices: 20, capTip: true });
  assert.ok(wingGeo.attributes.position.array.length > 180, 'Wing loft produces curved 3D airfoil vertices');
  assert.ok(wingGeo.index.array.length > 100, 'Wing loft produces triangle indices');

  const finGeo = A.buildVerticalFoilLoft([
    { y: 0.2, leadZ: 2.0, chord: 1.6, thick: 0.10 },
    { y: 2.4, leadZ: 2.9, chord: 0.7, thick: 0.07 }
  ], { slices: 16 });
  assert.ok(finGeo.attributes.position.array.length >= 90, 'Vertical fin loft produces valid geometry');

  const fuseGeo = A.buildFuselageLoft([
    { z: -4, y: -0.1, rx: 0.02, ry: 0.02 },
    { z: -1, y: 0, rx: 0.85, ry: 0.92 },
    { z: 3, y: 0.08, rx: 0.65, ry: 0.70 },
    { z: 6, y: 0.15, rx: 0.05, ry: 0.05 }
  ], 18);
  assert.ok(fuseGeo.attributes.position.array.length > 180, 'Fuselage loft produces smooth contoured body');

  const nac = A.buildTurbofanNacelle(THREE, 0.9, 1.0, { surface: {}, metal: {}, dark: {} });
  assert.ok(nac.group.children.length >= 6, 'Turbofan nacelle builds cowl, lip, intake barrel, cone, fan blades & nozzle');

  const bladeGeo = A.buildTwistedBlade(1.4, 0.14);
  assert.ok(bladeGeo.attributes.position.array.length > 60, 'Twisted propeller/rotor airfoil blade geometry created');
}

// 2. Validate Taiwan OSM roads dataset
{
  const roadIndexPath = path.join(distDir, 'taiwan-city', 'roads', 'index.json');
  assert.ok(fs.existsSync(roadIndexPath), 'dist/taiwan-city/roads/index.json must exist');
  const index = JSON.parse(fs.readFileSync(roadIndexPath, 'utf8'));
  assert.ok(index.roads >= 30000, `Expected >= 30000 Taiwan OSM roads, got ${index.roads}`);
  assert.ok(Array.isArray(index.chunks) && index.chunks.length >= 80, 'Expected >= 80 road chunks');
  const sampleMeta = index.chunks.find(c => c[3] > 50);
  assert.ok(sampleMeta && sampleMeta[0], 'Sample road chunk metadata must exist');
  const sampleChunk = JSON.parse(fs.readFileSync(path.join(distDir, 'taiwan-city', 'roads', `${sampleMeta[0]}.json`), 'utf8'));
  const roads = sampleChunk.r;
  assert.ok(Array.isArray(roads) && roads.length > 50, 'Road chunk contains road polylines');
  const [width, bridge, coords] = roads[0];
  assert.ok(width > 3 && (bridge === 0 || bridge === 1) && Array.isArray(coords) && coords.length >= 4, 'Road tuple [width, bridge, flatCoords] valid');
}

// 3. Validate road PBR, night lights, aircraft NACA rewrite, and Obsidian Aero-Deck UI files
{
  const taipei = fs.readFileSync(path.join(distDir, 'taipei-city.js'), 'utf8');
  assert.ok(taipei.includes('makeRoadTextures') && taipei.includes('emissiveMap'), 'taipei-city.js uses PBR asphalt + night street/headlight emissiveMap');
  assert.ok(taipei.includes('concreteCurb') && taipei.includes('zebra'), 'taipei-city.js includes curbs and zebra crosswalks');

  const taiwan = fs.readFileSync(path.join(distDir, 'taiwan-city.js'), 'utf8');
  assert.ok(taiwan.includes('taiwan-city/roads/index.json') && taiwan.includes('twRoadNight'), 'taiwan-city.js streams all-Taiwan PBR roads & night glow');

  const benchmark = fs.readFileSync(path.join(distDir, 'benchmark-models.js'), 'utf8');
  assert.ok(benchmark.includes('AeroCraft.buildWingLoft') && benchmark.includes('AeroCraft.buildTurbofanNacelle'), 'benchmark-models.js upgraded to AeroCraft NACA airfoils & nacelles');

  const heli = fs.readFileSync(path.join(distDir, 'helicopter.js'), 'utf8');
  assert.ok(heli.includes('AeroCraft.buildFuselageLoft') && heli.includes('AeroCraft.buildTwistedBlade'), 'helicopter.js upgraded to AeroCraft lofts & twisted airfoil blades');

  const flight = fs.readFileSync(path.join(distDir, 'flight.js'), 'utf8');
  assert.ok(flight.includes('AeroCraft.buildWingLoft') && flight.includes('emissivemap_fragment') && flight.includes('desktopControlDeck'), 'flight.js includes AeroCraft NACA light aircraft, night shader & Obsidian deck wiring');

  const sky = fs.readFileSync(path.join(distDir, 'atmospheric-sky.js'), 'utf8');
  assert.ok(sky.includes('skyglow'), 'atmospheric-sky.js includes metropolitan night skyglow');

  const uiCss = fs.readFileSync(path.join(distDir, 'aero-ui-v62.css'), 'utf8');
  assert.ok(uiCss.includes('desktop-deck') && uiCss.includes('#touchStick'), 'aero-ui-v62.css styles redesigned Obsidian Aero-Deck UI & controls');

  for (const htmlName of ['index.html', 'iphone.html']) {
    const html = fs.readFileSync(path.join(distDir, htmlName), 'utf8');
    assert.ok(Number(html.match(/id="edition">(\d+)\.(\d+)/)?.[1])>0 || Number(html.match(/id="edition">(\d+)\.(\d+)/)?.[2])>=62, `${htmlName} must show version 0.62 or newer`);
    assert.ok(html.includes('aero-ui-v62.css?v=62'), `${htmlName} must load aero-ui-v62.css?v=62`);
    assert.ok(html.includes('aero-aircraft.js?v=62'), `${htmlName} must load aero-aircraft.js?v=62`);
    assert.ok(html.includes('id="desktopControlDeck"'), `${htmlName} must include #desktopControlDeck`);
    assert.ok(html.indexOf('aero-aircraft.js?v=62') < html.indexOf('benchmarks.js'), `${htmlName} aero-aircraft.js must load before benchmarks.js`);
  }
}

console.log('verify-v62-aero-roads: OK (AeroCraft NACA lofts, 33k+ Taiwan PBR roads, night lighting & Obsidian Aero-Deck UI verified)');
