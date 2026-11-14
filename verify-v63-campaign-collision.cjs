'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const distDir = path.join(__dirname, 'dist');

// 1. Verify BuildingCollision spatial hash in VM
{
  const src = fs.readFileSync(path.join(distDir, 'building-collision.js'), 'utf8');
  const ctx = { window: undefined };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  const bc = ctx.BuildingCollision;
  assert.ok(bc && typeof bc.add === 'function' && typeof bc.test === 'function' && typeof bc.clearGroup === 'function',
    'BuildingCollision exports add, test, clearGroup');

  bc.add('tp:chunk1', 100, 200, 140, 250, 95, 0);
  bc.addCircle('tp:landmarks', 500, 500, 30, 508, 0);
  assert.equal(bc.count, 2, 'Should register 2 building colliders');

  const hit1 = bc.test(120, 45, 225, 3);
  assert.ok(hit1 && hit1.top === 95, 'Aircraft flying through building volume hits box');
  assert.equal(bc.test(120, 120, 225, 3), null, 'Aircraft flying safely above rooftop misses box');
  const hitLm = bc.test(485, 320, 515, 5);
  assert.ok(hitLm && hitLm.top === 508, 'Taipei 101 cylinder landmark collision detected');

  bc.clearGroup('tp:chunk1');
  assert.equal(bc.test(120, 45, 225, 3), null, 'Cleared chunk colliders are removed');
  assert.equal(bc.count, 1, 'Remaining landmark collider count is 1');
  bc.reset();
  assert.equal(bc.count, 0, 'Reset empties collision registry');
}

// 2. Verify city & flight building collision integration
{
  const tp = fs.readFileSync(path.join(distDir, 'taipei-city.js'), 'utf8');
  const tw = fs.readFileSync(path.join(distDir, 'taiwan-city.js'), 'utf8');
  const flight = fs.readFileSync(path.join(distDir, 'flight.js'), 'utf8');
  assert.ok(tp.includes('BuildingCollision.add') && tp.includes('BuildingCollision.clearGroup'), 'taipei-city.js wires BuildingCollision');
  assert.ok(tw.includes('BuildingCollision.add') && tw.includes('BuildingCollision.clearGroup'), 'taiwan-city.js wires BuildingCollision');
  assert.ok(flight.includes('BuildingCollision.test') && flight.includes('crashedBuilding'), 'flight.js checks BuildingCollision.test in sim loop');

  // Verify enhanced explosion VFX + shake bug fix + cockpit/chase upgrades
  assert.ok(flight.includes('blastLight') && flight.includes('wave2Mat') && flight.includes('craterMat'), 'flight.js has enhanced explosion fireball/shockwave/pointlight VFX');
  assert.ok(/crashShake=f\.crashedBuilding\?2\.15:1\.65/.test(flight), 'flight.js enables crashShake on impact');
  assert.ok(flight.includes('chaseBank') && flight.includes('updateGaCockpit') && flight.includes('propBlurMat'), 'flight.js includes dynamic chase camera, GA cockpit & prop blur disc');
  assert.ok(flight.includes('camera.near!==targetNear'), 'flight.js dynamically tightens camera.near in cockpit view');
}

// 3. Verify AeroCraft bump/blur helpers, benchmark bulkhead clamp & airliner yoke/throttle animation
{
  const aero = fs.readFileSync(path.join(distDir, 'aero-aircraft.js'), 'utf8');
  assert.ok(aero.includes('getPanelBumpTexture') && aero.includes('getPropBlurTexture'), 'aero-aircraft.js exports bump and prop blur textures');
  const bm = fs.readFileSync(path.join(distDir, 'benchmark-models.js'), 'utf8');
  assert.ok(bm.includes('cockpitGlassMats') && bm.includes('cabinStart'), 'benchmark-models.js clamps passenger bulkhead & exposes cockpit glass mats');
  const ref = fs.readFileSync(path.join(distDir, 'airliner-refinement.js'), 'utf8');
  assert.ok(ref.includes('animateControls') && ref.includes('throttleLevers'), 'airliner-refinement.js exposes animated yoke and throttles');
  const aud = fs.readFileSync(path.join(distDir, 'flight-audio.js'), 'utf8');
  assert.ok(aud.includes("snap.connect(sFilter)") && aud.includes("crunch.type='sawtooth'"), 'flight-audio.js layers multi-band explosion audio');
}

// 4. Verify controls responsiveness update in VM
{
  const ctrlSrc = fs.readFileSync(path.join(distDir, 'controls.js'), 'utf8');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(ctrlSrc, ctx);
  const f = { aircraft: { role: 'fighter', mass: 8500 } };
  const out = ctx.smoothControls(f, { pitch: 1, roll: 1, rudder: 0, response: 0.7 }, 0.05);
  assert.ok(out.roll > 0.2 && out.pitch > 0.2, 'smoothControls responds briskly cleanly');
}

// 5. Verify 8 generated campaign artwork files & story campaign module
{
  const assetsDir = path.join(distDir, 'assets', 'campaign');
  const expectedImgs = ['title-bg.jpg', 'ch1.jpg', 'ch2.jpg', 'ch3.jpg', 'ch4.jpg', 'ch5.jpg', 'ch6.jpg', 'ch7.jpg'];
  for (const name of expectedImgs) {
    const p = path.join(assetsDir, name);
    assert.ok(fs.existsSync(p) && fs.statSync(p).size > 20000, `Campaign image missing or empty: ${name}`);
  }

  const storySrc = fs.readFileSync(path.join(distDir, 'campaign-story.js'), 'utf8');
  const docMock = { readyState: 'loading', addEventListener: () => {} };
  const storyCtx = { window: null, document: docMock, performance: { now: () => 0 }, localStorage: { getItem: () => null, setItem: () => {} }, setInterval: () => {} };
  storyCtx.window = storyCtx;
  vm.createContext(storyCtx);
  vm.runInContext(storySrc, storyCtx);
  assert.ok(storyCtx.SkyboundCampaign && storyCtx.SkyboundCampaign.chapters.length === 7, 'SkyboundCampaign exposes 7 story chapters');
  storyCtx.SkyboundCampaign.chapters.forEach((ch, idx) => {
    assert.equal(ch.image, `assets/campaign/ch${idx + 1}.jpg`, `Chapter ${idx + 1} maps to ch${idx + 1}.jpg`);
  });

  const css = fs.readFileSync(path.join(distDir, 'aero-ui-v63.css'), 'utf8');
  assert.ok(css.includes('#titleHub') && css.includes('#storyRadioBar') && css.includes('#storyDebrief'), 'aero-ui-v63.css styles clean itemized hub & story overlays');
}

// 6. Verify HTML script wiring & 0.63 version badge
{
  for (const htmlName of ['index.html', 'iphone.html']) {
    const html = fs.readFileSync(path.join(distDir, htmlName), 'utf8');
    assert.ok(Number(html.match(/id="edition">(\d+)\.(\d+)/)?.[1])>0 || Number(html.match(/id="edition">(\d+)\.(\d+)/)?.[2])>=63, `${htmlName} shows version 0.63 or newer`);
    assert.ok(html.includes('aero-ui-v63.css?v=63'), `${htmlName} loads aero-ui-v63.css?v=63`);
    assert.ok(html.includes('building-collision.js?v=63'), `${htmlName} loads building-collision.js?v=63`);
    assert.ok(html.includes('campaign-story.js?v=63'), `${htmlName} loads campaign-story.js?v=63`);
    assert.ok(html.indexOf('building-collision.js?v=63') < html.indexOf('taipei-city.js'), `${htmlName} loads building-collision.js before taipei-city.js`);
    assert.ok(html.indexOf('flight.js') < html.indexOf('campaign-story.js?v=63'), `${htmlName} loads campaign-story.js after flight.js`);
  }
}

console.log('verify-v63-campaign-collision: OK (Building collision + enhanced explosion VFX + 7-chapter story campaign + clean hub UI verified)');
