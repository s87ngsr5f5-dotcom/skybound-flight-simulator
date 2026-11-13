'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const distDir = path.join(__dirname, 'dist');
const skinsJs = fs.readFileSync(path.join(distDir, 'aircraft-skins.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
const flightJs = fs.readFileSync(path.join(distDir, 'flight.js'), 'utf8');

const storage = new Map();
const sandbox = {
  Math, Map, Array, console,
  localStorage: {
    getItem: k => storage.get(k) || null,
    setItem: (k, v) => storage.set(k, String(v))
  }
};
vm.createContext(sandbox);
vm.runInContext(skinsJs + '\nthis.aircraftSkins = aircraftSkins;', sandbox);
const skins = sandbox.aircraftSkins;

console.log('1. Verifying LIVERY_THEMES presets and persistence...');
assert(Array.isArray(skins.LIVERY_THEMES) && skins.LIVERY_THEMES.length >= 6, 'Must have 6+ livery themes');
assert.strictEqual(skins.setSelectedTheme('starlux'), 'starlux');
assert.strictEqual(skins.getSelectedTheme(), 'starlux');
assert.strictEqual(storage.get('skybound.liveryTheme'), 'starlux');

console.log('2. Verifying reapplyLivery replaces decalGroup without duplication on airliner, cargo, fighter, helicopter...');
class MockTexture { constructor(c) { this.canvas = c; this.repeat = { set: () => {} }; } }
class MockMesh { constructor(g, m) { this.isMesh = true; this.material = m; this.position = { set: () => {} }; this.rotation = { set: () => {}, x: 0, y: 0, z: 0 }; } traverse(fn) { fn(this); } }
class MockGroup {
  constructor() { this.children = []; this.userData = {}; this.parent = null; }
  add(...xs) { xs.forEach(x => { x.parent = this; this.children.push(x); }); }
  remove(x) { this.children = this.children.filter(c => c !== x); x.parent = null; }
  traverse(fn) { fn(this); this.children.forEach(c => c.traverse?.(fn)); }
}
const mockTHREE = {
  SRGBColorSpace: 'srgb', RepeatWrapping: 1000, DoubleSide: 2,
  CanvasTexture: MockTexture, PlaneGeometry: class {}, MeshBasicMaterial: class {},
  Group: MockGroup, Mesh: MockMesh
};

for (const profile of [
  { id: 'b773', role: 'passenger', geometry: [32, 3.1, 30] },
  { id: 'b748f', role: 'cargo', geometry: [34, 3.3, 32] },
  { id: 'f16v', role: 'fighter', geometry: [8, 0.85, 5.2] },
  { id: 'uh60', helicopter: true, geometry: [8.5, 1.2, 8] }
]) {
  const model = new MockGroup();
  skins.applyLivery(model, profile, mockTHREE, 'default');
  assert.strictEqual(model.userData.skinTheme, 'default');
  assert(model.userData.decalGroup.children.length > 0, `${profile.id} must have decal meshes`);
  skins.reapplyLivery(model, profile, mockTHREE, 'thunder');
  assert.strictEqual(model.userData.skinTheme, 'thunder');
  assert.strictEqual(model.children.length, 1, 'reapplyLivery must replace old decalGroup cleanly');
}

console.log('3. Verifying HTML selectors and flight.js live livery syncing...');
assert(/id="liveryThemeSelect"/.test(indexHtml), 'index.html must include #liveryThemeSelect');
assert(/id="hangarLiverySelect"/.test(indexHtml), 'index.html must include #hangarLiverySelect');
assert(/function syncLiveryThemeUI\(/.test(flightJs), 'flight.js must wire syncLiveryThemeUI()');

console.log('ALL LIVERY THEME & MULTI-ROLE DECAL CHECKS PASSED!');
